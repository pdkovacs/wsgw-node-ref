/**
 * Smoke test: full round-trip through WSGW.
 *
 * 1. Open a WebSocket connection to WSGW with Basic Auth.
 *    WSGW synchronously calls the app's GET /ws/connect before upgrading, so by the
 *    time the "open" event fires the connection is already registered in the app's tracker.
 * 2. POST a message via the app's /api/message endpoint targeting the connected user.
 * 3. Assert the message arrives on the WebSocket.
 *
 * Environment variables (all optional, fall back to local minikube defaults):
 *   E2ECLIENT_WSGW_URI          e.g. "10.104.246.62:8080"
 *   E2ECLIENT_APP_SERVICE_URL   e.g. "http://10.96.21.43:8080"
 *   E2ECLIENT_PASSWORD_CREDENTIALS  JSON array: [{"username":"...","password":"..."},...]
 */

import WebSocket from "ws";
import axios from "axios";
import { E2EMessage } from "#common/message-dto.js";

const TIMEOUT_MS = 5_000;

const wsgwHost = process.env["E2ECLIENT_WSGW_URI"] ?? "10.104.246.62:8080";
const appUrl = process.env["E2ECLIENT_APP_SERVICE_URL"] ?? "http://10.96.21.43:8080";
const credentials: { username: string; password: string }[] = JSON.parse(
	process.env["E2ECLIENT_PASSWORD_CREDENTIALS"] ?? "[{\"username\":\"user1\",\"password\":\"crixcrax1\"}]"
);
const { username, password } = credentials[0];
const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`Timeout: ${label}`)), TIMEOUT_MS)
		)
	]);
}

async function smokeTest(): Promise<void> {
	const ws = new WebSocket(`ws://${wsgwHost}/connect`, {
		headers: { Authorization: `Basic ${basicAuth}` }
	});

	// Register the delivery listener before opening so no message can be missed.
	const deliveryPromise = new Promise<string>((resolve, reject) => {
		ws.once("message", data => resolve(data.toString()));
		ws.once("error", reject);
	});

	// Step 1: wait for WebSocket to open.
	// By the time "open" fires, WSGW has already called the app's GET /ws/connect
	// and the connection is registered in the app's tracker.
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			ws.once("open", resolve);
			ws.once("error", reject);
		}),
		"WebSocket open"
	);
	console.log("WebSocket connected");

	// Step 2: send a message to the connected user via the app API.
	const message: E2EMessage = {
		testRunId: "smoke-test",
		id: "msg-1",
		sender: "smoke-test",
		recipients: [username] as unknown as [],
		data: "hello from smoke test",
		sentAt: new Date().toISOString(),
		destination: "",
		traceData: {}
	};

	await withTimeout(
		axios.post(`${appUrl}/api/message`, message, {
			headers: { Authorization: `Basic ${basicAuth}` }
		}),
		"POST /api/message"
	);
	console.log("Message POSTed to app");

	// Step 3: assert the message arrives on the WebSocket.
	const delivered = await withTimeout(deliveryPromise, "message delivery on WebSocket");
	ws.close();

	const deliveredMsg = JSON.parse(delivered) as E2EMessage;
	if (deliveredMsg.data !== message.data) {
		throw new Error(`Data mismatch: expected "${message.data}", got "${deliveredMsg.data}"`);
	}

	console.log("Message delivered:", delivered);
	console.log("PASSED");
}

smokeTest().then(() => process.exit(0)).catch(err => {
	console.error("FAILED:", err.message);
	process.exit(1);
});
