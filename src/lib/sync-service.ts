import type { Client } from "pg";
import { decrypt } from "./crypto";
import { parseIcsContent } from "./ics-parser";
import { getUserById, upsertReservation, updateUserLastSynced } from "./db";
import type { SyncResult } from "../types";

const ALLOWED_ICS_HOST = "outlook.office365.com";
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds
const MAX_ICS_SIZE_BYTES = 1_000_000; // 1 MB

function calculateExpiresAt(endsAt: Date, keepHistory: boolean): Date {
	if (keepHistory) {
		const oneYearLater = new Date(endsAt);
		oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
		return oneYearLater;
	}
	return endsAt;
}

export async function syncUserReservations(
	client: Client,
	userId: string,
	encryptionKey: string,
): Promise<SyncResult> {
	const errors: string[] = [];

	const user = await getUserById(client, userId);
	if (!user || !user.icsUrl) {
		return { synced: 0, errors: ["User not found or no ICS URL configured"] };
	}

	// Decrypt ICS URL
	let icsUrl: string;
	try {
		icsUrl = await decrypt(user.icsUrl, encryptionKey);
	} catch {
		return { synced: 0, errors: ["Failed to decrypt ICS URL"] };
	}

	// Validate ICS URL domain before fetching
	try {
		const url = new URL(icsUrl);
		if (url.host !== ALLOWED_ICS_HOST) {
			return { synced: 0, errors: [`ICS URL must be from ${ALLOWED_ICS_HOST}`] };
		}
	} catch {
		return { synced: 0, errors: ["Invalid ICS URL format"] };
	}

	// Fetch ICS content with timeout and size limits
	let icsContent: string;
	try {
		const response = await fetch(icsUrl, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});

		if (!response.ok) {
			return { synced: 0, errors: [`ICS fetch failed: ${response.status}`] };
		}

		// Check Content-Length header if present
		const contentLength = response.headers.get("content-length");
		if (contentLength && parseInt(contentLength, 10) > MAX_ICS_SIZE_BYTES) {
			return { synced: 0, errors: ["ICS file too large"] };
		}

		icsContent = await response.text();

		// Also check actual content size (Content-Length can be missing or inaccurate)
		if (icsContent.length > MAX_ICS_SIZE_BYTES) {
			return { synced: 0, errors: ["ICS content too large"] };
		}
	} catch (e) {
		if (e instanceof Error && e.name === "TimeoutError") {
			return { synced: 0, errors: ["ICS fetch timed out"] };
		}
		return { synced: 0, errors: ["ICS fetch failed"] };
	}

	console.log(`Fetched ICS content for user ${userId} (${icsContent.length} bytes)`);

	// Parse events
	const events = parseIcsContent(icsContent);

	// Upsert each reservation
	let synced = 0;
	const now = new Date();
	for (const event of events) {
		try {
			const expiresAt = calculateExpiresAt(event.endsAt, user.keepHistory);

			// Skip events that would already be expired (avoids re-adding old reservations)
			if (expiresAt <= now) {
				continue;
			}

			await upsertReservation(client, userId, event, expiresAt);
			synced++;
		} catch (e) {
			// Log full error for debugging, but return sanitized message
			console.error(`Failed to upsert event ${event.uid}:`, e);
			errors.push(`Failed to upsert event ${event.uid}`);
		}
	}

	// Update last synced timestamp
	await updateUserLastSynced(client, userId);

	return { synced, errors };
}
