import { describe, it, expect } from "vitest";
import { extractIcsUrlFromXml } from "../src/lib/email-parser";

describe("Email Parser", () => {
	describe("extractIcsUrlFromXml", () => {
		it("extracts ICalUrl from sharing_metadata.xml", () => {
			const xml = `<?xml version="1.0" encoding="utf-8"?>
<SharingMessage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="http://schemas.microsoft.com/sharing/2008">
  <DataType>calendar</DataType>
  <Initiator>
    <Name>Test User</Name>
    <SmtpAddress>test.user@student.kuleuven.be</SmtpAddress>
  </Initiator>
  <Invitation>
    <Providers>
      <Provider Type="ms-exchange-publish" TargetRecipients="test@example.com">
        <BrowseUrl xmlns="http://schemas.microsoft.com/exchange/sharing/2008">https://outlook.office365.com/owa/calendar/abc123/reachcalendar.html</BrowseUrl>
        <ICalUrl xmlns="http://schemas.microsoft.com/exchange/sharing/2008">https://outlook.office365.com/owa/calendar/abc123/def456/reachcalendar.ics</ICalUrl>
      </Provider>
    </Providers>
  </Invitation>
</SharingMessage>`;

			const result = extractIcsUrlFromXml(xml);
			expect(result).toBe(
				"https://outlook.office365.com/owa/calendar/abc123/def456/reachcalendar.ics",
			);
		});

		it("returns null when no ICalUrl found", () => {
			const xml = `<?xml version="1.0" encoding="utf-8"?>
<SharingMessage xmlns="http://schemas.microsoft.com/sharing/2008">
  <DataType>calendar</DataType>
</SharingMessage>`;

			const result = extractIcsUrlFromXml(xml);
			expect(result).toBeNull();
		});

		it("handles whitespace around URL", () => {
			const xml = `<ICalUrl xmlns="http://schemas.microsoft.com/exchange/sharing/2008">
        https://outlook.office365.com/owa/calendar/abc123/test.ics
      </ICalUrl>`;

			const result = extractIcsUrlFromXml(xml);
			expect(result).toBe(
				"https://outlook.office365.com/owa/calendar/abc123/test.ics",
			);
		});
	});
});
