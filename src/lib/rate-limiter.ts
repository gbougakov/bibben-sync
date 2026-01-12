/**
 * Simple rate limiter for staggering requests.
 * Ensures a minimum delay between operations to avoid overwhelming external APIs.
 */
export class RateLimiter {
	private lastRequestTime = 0;
	private readonly minDelayMs: number;

	/**
	 * @param requestsPerSecond Maximum requests per second (e.g., 2 = 500ms between requests)
	 */
	constructor(requestsPerSecond: number) {
		this.minDelayMs = 1000 / requestsPerSecond;
	}

	/**
	 * Wait if necessary to respect the rate limit, then mark a request as started.
	 */
	async acquire(): Promise<void> {
		const now = Date.now();
		const elapsed = now - this.lastRequestTime;
		const waitTime = this.minDelayMs - elapsed;

		if (waitTime > 0) {
			await sleep(waitTime);
		}

		this.lastRequestTime = Date.now();
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
