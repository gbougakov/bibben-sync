const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function importKey(keyBase64: string): Promise<CryptoKey> {
	const keyData = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: ALGORITHM, length: KEY_LENGTH },
		false,
		["encrypt", "decrypt"],
	);
}

export async function encrypt(
	plaintext: string,
	keyBase64: string,
): Promise<string> {
	const key = await importKey(keyBase64);
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv, tagLength: TAG_LENGTH },
		key,
		encoded,
	);

	// Combine: iv (12 bytes) + ciphertext (includes auth tag)
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return btoa(String.fromCharCode(...combined));
}

export async function decrypt(
	ciphertextBase64: string,
	keyBase64: string,
): Promise<string> {
	const key = await importKey(keyBase64);
	const combined = Uint8Array.from(atob(ciphertextBase64), (c) =>
		c.charCodeAt(0),
	);

	const iv = combined.slice(0, IV_LENGTH);
	const ciphertext = combined.slice(IV_LENGTH);

	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv, tagLength: TAG_LENGTH },
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decrypted);
}
