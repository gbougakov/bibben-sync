import type { ParsedEvent } from "../types";

// Hardcoded library patterns (auditable allowlist)
// Only events matching these patterns will be extracted
const LIBRARY_PATTERNS: Record<string, RegExp> = {
	CBA: /^(Canceled:\s*)?CBA - (.+?) Seat (\d+)$/,
	RBIB: /^(Canceled:\s*)?RBIB - (.+?) Seat (\d+)$/,
	SBIB: /^(Canceled:\s*)?SBIB - (.*?) ?Seat (\d+)$/, // Room can be empty
	EBIB: /^(Canceled:\s*)?EBIB - (.+?) +Seat (\d+)$/, // Double space before Seat
	Agora: /^(Canceled:\s*)?Agora - (.+?) Seat (\d+)$/,
	PBIB: /^(Canceled:\s*)?PBIB - (.*?) ?Seat (\d+)$/, // Room can be empty
	Erasmushuis: /^(Canceled:\s*)?Erasmushuis (.+?) Seat (\d+)$/, // No dash separator
	FBIB: /^(Canceled:\s*)?FBIB - (.+?) Seat (\d+)$/,
	MSB: /^(Canceled:\s*)?MSB - (.+?) - Seat (\d+)$/, // Has " - " before Seat
};

interface PatternMatch {
	libraryCode: string;
	isCanceled: boolean;
	room: string;
	seatNumber: string;
}

function matchSummary(summary: string): PatternMatch | null {
	for (const [libraryCode, pattern] of Object.entries(LIBRARY_PATTERNS)) {
		const match = summary.match(pattern);
		if (match) {
			return {
				libraryCode,
				isCanceled: !!match[1],
				room: match[2]?.trim() || "Unknown",
				seatNumber: match[3],
			};
		}
	}
	return null;
}

function parseIcsDateTime(dtString: string): Date {
	// Format: 20251206T140000 (local time, TZID is Romance Standard Time = Europe/Brussels)
	const match = dtString.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
	if (!match) {
		throw new Error(`Invalid datetime: ${dtString}`);
	}

	const [, year, month, day, hour, minute, second] = match;

	// Create date in Europe/Brussels timezone
	// Romance Standard Time is UTC+1 (winter) or UTC+2 (summer/DST)
	// For now, we'll parse as local Belgian time and let the date be approximate
	// A more robust solution would use a proper TZ library
	const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

	// Parse as UTC first, then we'll need to adjust based on DST
	// For simplicity, treating as Europe/Brussels local time
	const date = new Date(isoString);

	// Check if date is in DST (rough approximation: last Sunday of March to last Sunday of October)
	const isDst = isInDst(date);
	const offsetHours = isDst ? 2 : 1;

	// Adjust to UTC by subtracting the offset
	return new Date(date.getTime() - offsetHours * 60 * 60 * 1000);
}

function isInDst(date: Date): boolean {
	const year = date.getFullYear();
	const month = date.getMonth();

	// DST in Belgium: last Sunday of March to last Sunday of October
	if (month < 2 || month > 9) return false; // Jan, Feb, Nov, Dec - no DST
	if (month > 2 && month < 9) return true; // Apr-Sep - DST

	// March or October - need to check the last Sunday
	const lastDay = new Date(year, month + 1, 0);
	const lastSunday = lastDay.getDate() - lastDay.getDay();

	if (month === 2) {
		// March
		return date.getDate() >= lastSunday;
	} else {
		// October
		return date.getDate() < lastSunday;
	}
}

function getField(block: string, name: string): string | null {
	// Match field with optional parameters (e.g., DTSTART;TZID=...)
	const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"));
	return match ? match[1].trim() : null;
}

function parseVEvent(block: string): ParsedEvent | null {
	const summary = getField(block, "SUMMARY");
	const uid = getField(block, "UID");
	const dtstart = getField(block, "DTSTART");
	const dtend = getField(block, "DTEND");

	if (!summary || !uid || !dtstart || !dtend) {
		return null;
	}

	// Only match reservation events
	const match = matchSummary(summary);
	if (!match) {
		return null;
	}

	return {
		uid: uid.replace(/\s+/g, ""), // UIDs can be wrapped across lines
		summary,
		startsAt: parseIcsDateTime(dtstart),
		endsAt: parseIcsDateTime(dtend),
		isCanceled: match.isCanceled,
		libraryCode: match.libraryCode,
		room: match.room,
		seatNumber: match.seatNumber,
	};
}

export function parseIcsContent(icsContent: string): ParsedEvent[] {
	// Unfold long lines per RFC 5545 (lines can be split with CRLF + space/tab)
	const unfolded = icsContent.replace(/\r?\n[ \t]/g, "");

	// Split into VEVENT blocks
	const eventBlocks = unfolded.split("BEGIN:VEVENT").slice(1);

	return eventBlocks
		.map((block) => parseVEvent(block))
		.filter((event): event is ParsedEvent => event !== null);
}

// Export patterns for testing
export const PATTERNS = LIBRARY_PATTERNS;
