import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/lib/crypto";

// Test key: 32 random bytes encoded as base64
// This is NOT a real key - only for testing
const TEST_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="; // "0123456789abcdef0123456789abcdef" in base64

describe("Crypto", () => {
	it("encrypts and decrypts a string", async () => {
		const plaintext = "https://outlook.office365.com/owa/calendar/abc123/test.ics";

		const ciphertext = await encrypt(plaintext, TEST_KEY);
		expect(ciphertext).not.toBe(plaintext);
		expect(ciphertext.length).toBeGreaterThan(0);

		const decrypted = await decrypt(ciphertext, TEST_KEY);
		expect(decrypted).toBe(plaintext);
	});

	it("produces different ciphertext each time (random IV)", async () => {
		const plaintext = "https://outlook.office365.com/owa/calendar/abc123/test.ics";

		const ciphertext1 = await encrypt(plaintext, TEST_KEY);
		const ciphertext2 = await encrypt(plaintext, TEST_KEY);

		expect(ciphertext1).not.toBe(ciphertext2);

		// But both decrypt to the same plaintext
		const decrypted1 = await decrypt(ciphertext1, TEST_KEY);
		const decrypted2 = await decrypt(ciphertext2, TEST_KEY);
		expect(decrypted1).toBe(plaintext);
		expect(decrypted2).toBe(plaintext);
	});

	it("fails to decrypt with wrong key", async () => {
		const plaintext = "https://outlook.office365.com/owa/calendar/abc123/test.ics";
		const wrongKey = "YWJjZGVmZ2hpamtsbW5vcGFiY2RlZmdoaWprbG1ub3A="; // Different 32-byte key

		const ciphertext = await encrypt(plaintext, TEST_KEY);

		await expect(decrypt(ciphertext, wrongKey)).rejects.toThrow();
	});

	it("fails to decrypt tampered ciphertext", async () => {
		const plaintext = "https://outlook.office365.com/owa/calendar/abc123/test.ics";
		const ciphertext = await encrypt(plaintext, TEST_KEY);

		// Tamper with the ciphertext
		const tamperedBytes = Uint8Array.from(atob(ciphertext), (c) =>
			c.charCodeAt(0),
		);
		tamperedBytes[20] ^= 0xff; // Flip some bits
		const tampered = btoa(String.fromCharCode(...tamperedBytes));

		await expect(decrypt(tampered, TEST_KEY)).rejects.toThrow();
	});

	it("handles empty string", async () => {
		const plaintext = "";
		const ciphertext = await encrypt(plaintext, TEST_KEY);
		const decrypted = await decrypt(ciphertext, TEST_KEY);
		expect(decrypted).toBe(plaintext);
	});

	it("handles unicode characters", async () => {
		const plaintext = "https://example.com/café-émoji-🎉";
		const ciphertext = await encrypt(plaintext, TEST_KEY);
		const decrypted = await decrypt(ciphertext, TEST_KEY);
		expect(decrypted).toBe(plaintext);
	});
});
