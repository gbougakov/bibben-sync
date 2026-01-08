import { Client } from "pg";
import type { ParsedEvent, User } from "../types";

export function createClient(hyperdrive: Hyperdrive): Client {
	return new Client({ connectionString: hyperdrive.connectionString });
}

export async function getUserById(
	client: Client,
	userId: string,
): Promise<User | null> {
	const result = await client.query<User>(
		'SELECT id, "icsUrl", "icsLastSynced", "keepHistory" FROM "User" WHERE id = $1',
		[userId],
	);
	return result.rows[0] ?? null;
}

export async function getUserByEmail(
	client: Client,
	email: string,
): Promise<User | null> {
	const result = await client.query<User>(
		'SELECT id, "icsUrl", "icsLastSynced", "keepHistory" FROM "User" WHERE email = $1',
		[email],
	);
	return result.rows[0] ?? null;
}

export async function updateUserIcsUrl(
	client: Client,
	userId: string,
	encryptedIcsUrl: string,
): Promise<void> {
	await client.query(
		'UPDATE "User" SET "icsUrl" = $2, "updatedAt" = NOW() WHERE id = $1',
		[userId, encryptedIcsUrl],
	);
}

export async function getUsersWithIcsUrl(client: Client): Promise<User[]> {
	const result = await client.query<User>(
		'SELECT id, "icsUrl", "icsLastSynced", "keepHistory" FROM "User" WHERE "icsUrl" IS NOT NULL',
	);
	return result.rows;
}

export async function upsertReservation(
	client: Client,
	userId: string,
	event: ParsedEvent,
	expiresAt: Date,
): Promise<void> {
	await client.query(
		`INSERT INTO "Reservation"
		 (id, "userId", "libraryId", "externalUid", room, "seatNumber", "startsAt", "endsAt", "isCanceled", "expiresAt", "createdAt", "updatedAt")
		 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		 ON CONFLICT ("userId", "externalUid")
		 DO UPDATE SET
		   "libraryId" = EXCLUDED."libraryId",
		   room = EXCLUDED.room,
		   "seatNumber" = EXCLUDED."seatNumber",
		   "startsAt" = EXCLUDED."startsAt",
		   "endsAt" = EXCLUDED."endsAt",
		   "isCanceled" = EXCLUDED."isCanceled",
		   "expiresAt" = EXCLUDED."expiresAt",
		   "updatedAt" = NOW()`,
		[
			userId,
			event.libraryCode,
			event.uid,
			event.room,
			event.seatNumber,
			event.startsAt,
			event.endsAt,
			event.isCanceled,
			expiresAt,
		],
	);
}

export async function updateUserLastSynced(
	client: Client,
	userId: string,
): Promise<void> {
	await client.query(
		'UPDATE "User" SET "icsLastSynced" = NOW(), "updatedAt" = NOW() WHERE id = $1',
		[userId],
	);
}

export async function deleteExpiredReservations(
	client: Client,
): Promise<number> {
	const result = await client.query(
		'DELETE FROM "Reservation" WHERE "expiresAt" <= NOW()',
	);
	return result.rowCount ?? 0;
}
