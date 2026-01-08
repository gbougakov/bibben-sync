import { encrypt } from "./lib/crypto";
import {
	createClient,
	getUsersWithIcsUrl,
	getUserByEmail,
	updateUserIcsUrl,
	deleteExpiredReservations,
} from "./lib/db";
import { parseCalendarSharingEmail } from "./lib/email-parser";
import { syncUserReservations } from "./lib/sync-service";
import "./types"; // Import to extend Env interface

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// POST /encrypt
		if (request.method === "POST" && url.pathname === "/encrypt") {
			try {
				const body = await request.json<{ icsUrl: string }>();
				if (!body.icsUrl || typeof body.icsUrl !== "string") {
					return Response.json({ error: "Missing icsUrl" }, { status: 400 });
				}
				const ciphertext = await encrypt(body.icsUrl, env.ENCRYPTION_KEY);
				return Response.json({ ciphertext });
			} catch {
				return Response.json({ error: "Encryption failed" }, { status: 500 });
			}
		}

		// POST /sync/:userId
		const syncMatch = url.pathname.match(/^\/sync\/([a-zA-Z0-9_-]+)$/);
		if (request.method === "POST" && syncMatch) {
			const userId = syncMatch[1];
			const client = createClient(env.HYPERDRIVE);

			try {
				await client.connect();
				const result = await syncUserReservations(
					client,
					userId,
					env.ENCRYPTION_KEY,
				);
				return Response.json(result);
			} catch (e) {
				return Response.json({ error: `Sync failed: ${e}` }, { status: 500 });
			} finally {
				await client.end();
			}
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	},

	async scheduled(controller, env, ctx): Promise<void> {
		const client = createClient(env.HYPERDRIVE);

		try {
			await client.connect();

			if (controller.cron === "0 3 * * *") {
				// Daily cleanup at 3 AM UTC
				const deleted = await deleteExpiredReservations(client);
				console.log(`Deleted ${deleted} expired reservations`);
			} else {
				// Hourly sync at :35
				const users = await getUsersWithIcsUrl(client);
				console.log(`Starting scheduled sync for ${users.length} users`);

				for (const user of users) {
					try {
						const result = await syncUserReservations(
							client,
							user.id,
							env.ENCRYPTION_KEY,
						);
						console.log(
							`Synced user ${user.id}: ${result.synced} reservations, ${result.errors.length} errors`,
						);
					} catch (e) {
						console.error(`Failed to sync user ${user.id}:`, e);
					}
				}

				console.log("Scheduled sync complete");
			}
		} finally {
			await client.end();
		}
	},

	async email(message, env, ctx): Promise<void> {
		const client = createClient(env.HYPERDRIVE);

		try {
			// Parse the raw email
			const rawEmail = await new Response(message.raw).arrayBuffer();
			const result = await parseCalendarSharingEmail(rawEmail);

			if ("error" in result) {
				console.error(`Email parsing failed: ${result.error}`);
				return;
			}

			const { senderEmail, icsUrl } = result;
			console.log(`Received calendar share from ${senderEmail}`);

			await client.connect();

			// Look up user by sender email
			const user = await getUserByEmail(client, senderEmail);
			if (!user) {
				console.error(`No user found with email: ${senderEmail}`);
				return;
			}

			// Encrypt and store the ICS URL
			const encryptedIcsUrl = await encrypt(icsUrl, env.ENCRYPTION_KEY);
			await updateUserIcsUrl(client, user.id, encryptedIcsUrl);
			console.log(`Updated ICS URL for user ${user.id}`);

			// Trigger immediate sync
			const syncResult = await syncUserReservations(
				client,
				user.id,
				env.ENCRYPTION_KEY,
			);
			console.log(
				`Synced ${syncResult.synced} reservations for user ${user.id}`,
			);
		} catch (e) {
			console.error(`Email handler error:`, e);
		} finally {
			await client.end();
		}
	},
} satisfies ExportedHandler<Env>;
