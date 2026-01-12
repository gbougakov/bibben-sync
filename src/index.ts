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
	// No HTTP endpoints exposed - sync is triggered via scheduled() and email()
	// This prevents unauthenticated access to sync and encryption functionality
	async fetch(_request, _env, _ctx): Promise<Response> {
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
