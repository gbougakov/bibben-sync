import { describe, it, expect } from "vitest";
import { parseIcsContent, PATTERNS } from "../src/lib/ics-parser";

describe("ICS Parser", () => {
	describe("PATTERNS", () => {
		it("matches CBA reservations", () => {
			expect("CBA - Boekenzaal Seat 191").toMatch(PATTERNS.CBA);
			expect("CBA - Zolder Seat 373").toMatch(PATTERNS.CBA);
			expect("CBA - Tulp 1 Seat 574").toMatch(PATTERNS.CBA);
			expect("Canceled: CBA - Boekenzaal Seat 191").toMatch(PATTERNS.CBA);
		});

		it("matches RBIB reservations", () => {
			expect("RBIB - Zaal 1A Seat 18").toMatch(PATTERNS.RBIB);
			expect("RBIB - Zaal 1B Seat 107").toMatch(PATTERNS.RBIB);
			expect("RBIB - Zaal 2C Seat 245").toMatch(PATTERNS.RBIB);
			expect("Canceled: RBIB - Zaal 1A Seat 29").toMatch(PATTERNS.RBIB);
		});

		it("matches SBIB reservations with empty room", () => {
			expect("SBIB -  Seat 127").toMatch(PATTERNS.SBIB);
			expect("Canceled: SBIB -  Seat 127").toMatch(PATTERNS.SBIB);
		});

		it("matches EBIB reservations with double space", () => {
			expect("EBIB - Quiet Study  Seat 263").toMatch(PATTERNS.EBIB);
			expect("EBIB - Flexispace Seat 002").toMatch(PATTERNS.EBIB);
			expect("Canceled: EBIB - Flexispace Seat 002").toMatch(PATTERNS.EBIB);
		});

		it("does not match personal events", () => {
			expect("This is a test event").not.toMatch(PATTERNS.CBA);
			expect("This is a test event").not.toMatch(PATTERNS.RBIB);
			expect("This is a test event").not.toMatch(PATTERNS.SBIB);
			expect("This is a test event").not.toMatch(PATTERNS.EBIB);
		});

		it("does not match unknown library codes", () => {
			expect("XBIB - Room Seat 123").not.toMatch(PATTERNS.CBA);
			expect("XBIB - Room Seat 123").not.toMatch(PATTERNS.RBIB);
		});
	});

	describe("parseIcsContent", () => {
		it("parses a simple VEVENT", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:CBA - Boekenzaal Seat 191
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:040000008200E00074C5B7101A82E0080000000020641ACF86D2DB01
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(1);
			expect(events[0].libraryCode).toBe("CBA");
			expect(events[0].room).toBe("Boekenzaal");
			expect(events[0].seatNumber).toBe("191");
			expect(events[0].isCanceled).toBe(false);
		});

		it("parses a canceled VEVENT", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Canceled: CBA - Boekenzaal Seat 191
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:040000008200E00074C5B7101A82E0080000000020641ACF86D2DB01
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(1);
			expect(events[0].isCanceled).toBe(true);
		});

		it("filters out non-reservation events", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:This is a test event
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:test-uid-123
END:VEVENT
BEGIN:VEVENT
SUMMARY:CBA - Boekenzaal Seat 191
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:reservation-uid-456
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(1);
			expect(events[0].libraryCode).toBe("CBA");
		});

		it("handles line folding (RFC 5545)", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:CBA - Boekenzaal Seat 191
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:040000008200E00074C5B7101A82E00800000000206
 41ACF86D2DB01000000000000000010000000D7
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(1);
			expect(events[0].uid).toBe(
				"040000008200E00074C5B7101A82E0080000000020641ACF86D2DB01000000000000000010000000D7",
			);
		});

		it("parses multiple events", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:CBA - Boekenzaal Seat 191
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:uid1
END:VEVENT
BEGIN:VEVENT
SUMMARY:RBIB - Zaal 1A Seat 18
DTSTART;TZID=Romance Standard Time:20251207T100000
DTEND;TZID=Romance Standard Time:20251207T120000
UID:uid2
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(2);
			expect(events[0].libraryCode).toBe("CBA");
			expect(events[1].libraryCode).toBe("RBIB");
		});

		it("handles SBIB with empty room", () => {
			const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:SBIB -  Seat 127
DTSTART;TZID=Romance Standard Time:20251206T140000
DTEND;TZID=Romance Standard Time:20251206T150000
UID:sbib-uid
END:VEVENT
END:VCALENDAR`;

			const events = parseIcsContent(ics);
			expect(events).toHaveLength(1);
			expect(events[0].libraryCode).toBe("SBIB");
			expect(events[0].room).toBe("Unknown");
			expect(events[0].seatNumber).toBe("127");
		});
	});
});
