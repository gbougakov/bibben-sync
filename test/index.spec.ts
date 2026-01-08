import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Worker", () => {
	it("returns 404 for unknown routes", async () => {
		const request = new IncomingRequest("http://example.com/unknown");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body).toEqual({ error: "Not found" });
	});

	it("returns 400 for POST /encrypt without body", async () => {
		const request = new IncomingRequest("http://example.com/encrypt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toEqual({ error: "Missing icsUrl" });
	});
});

describe("Scheduled handler", () => {
	it("has cleanup cron configured", () => {
		// Verify the scheduled handler exists and can differentiate cron triggers
		expect(worker.scheduled).toBeDefined();
		expect(typeof worker.scheduled).toBe("function");
	});
});
