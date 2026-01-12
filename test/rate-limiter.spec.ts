import { describe, it, expect } from "vitest";
import { RateLimiter } from "../src/lib/rate-limiter";

describe("RateLimiter", () => {
	it("should not delay the first request", async () => {
		const limiter = new RateLimiter(2);
		const start = Date.now();
		await limiter.acquire();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(50); // Should be nearly instant
	});

	it("should delay subsequent requests to respect rate limit", async () => {
		const limiter = new RateLimiter(2); // 2 RPS = 500ms between requests

		await limiter.acquire();
		const start = Date.now();
		await limiter.acquire();
		const elapsed = Date.now() - start;

		// Should wait approximately 500ms (with some tolerance)
		expect(elapsed).toBeGreaterThanOrEqual(450);
		expect(elapsed).toBeLessThan(600);
	});

	it("should allow immediate requests if enough time has passed", async () => {
		const limiter = new RateLimiter(10); // 10 RPS = 100ms between requests

		await limiter.acquire();
		// Wait longer than the rate limit interval
		await new Promise((resolve) => setTimeout(resolve, 150));

		const start = Date.now();
		await limiter.acquire();
		const elapsed = Date.now() - start;

		expect(elapsed).toBeLessThan(50); // Should be nearly instant
	});
});
