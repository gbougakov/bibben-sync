import PostalMime from "postal-mime";

export interface EmailParseResult {
	senderEmail: string;
	icsUrl: string;
}

export interface EmailParseError {
	error: string;
}

const ALLOWED_SENDER_DOMAIN = "student.kuleuven.be";
const ALLOWED_ICS_HOST = "outlook.office365.com";

export async function parseCalendarSharingEmail(
	rawEmail: ArrayBuffer,
): Promise<EmailParseResult | EmailParseError> {
	const parser = new PostalMime();
	const email = await parser.parse(rawEmail);

	// Get sender email from headers
	const senderEmail = email.from?.address;
	if (!senderEmail) {
		return { error: "No sender email found" };
	}

	// Validate sender domain
	if (!senderEmail.endsWith(`@${ALLOWED_SENDER_DOMAIN}`)) {
		return { error: `Sender must be from @${ALLOWED_SENDER_DOMAIN}` };
	}

	// Find the sharing_metadata.xml attachment
	const xmlAttachment = email.attachments?.find(
		(att) =>
			att.filename === "sharing_metadata.xml" ||
			att.mimeType === "application/x-sharing-metadata-xml",
	);

	if (!xmlAttachment) {
		return { error: "No sharing_metadata.xml attachment found" };
	}

	// Parse the XML content
	const xmlContent =
		typeof xmlAttachment.content === "string"
			? xmlAttachment.content
			: new TextDecoder().decode(xmlAttachment.content);

	const icsUrl = extractIcsUrlFromXml(xmlContent);
	if (!icsUrl) {
		return { error: "No ICalUrl found in attachment" };
	}

	// Validate ICS URL domain
	try {
		const url = new URL(icsUrl);
		if (url.host !== ALLOWED_ICS_HOST) {
			return { error: `ICS URL must be from ${ALLOWED_ICS_HOST}` };
		}
	} catch {
		return { error: "Invalid ICS URL format" };
	}

	return { senderEmail, icsUrl };
}

function extractIcsUrlFromXml(xmlContent: string): string | null {
	// Extract ICalUrl using regex (simpler than full XML parsing for this specific case)
	// The ICalUrl is in the format: <ICalUrl xmlns="...">URL</ICalUrl>
	const match = xmlContent.match(/<ICalUrl[^>]*>([^<]+)<\/ICalUrl>/);
	return match ? match[1].trim() : null;
}

// Export for testing
export { extractIcsUrlFromXml };
