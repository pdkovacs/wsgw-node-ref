import { Counter, metrics } from "@opentelemetry/api";

export interface ApiHandlerMetrics {
	readonly messageRequestCounter: Counter;
	readonly staleWsConnIdCounter: Counter;
}

export const createApiHandlerMetrics = (): ApiHandlerMetrics => {
	const messageRequestCounter = createCounter(
		"api.message.request.counter",
		"Number of message sending requests via api"
	);

	const staleWsConnIdCounter = createCounter(
		"stale.wsconnid.counter",
		"Number of stale websocket connection-ids encountered"
	);

	return {
		messageRequestCounter,
		staleWsConnIdCounter
	};
};

export interface WsHandlerMetrics {
	readonly connectRequestCounter: Counter;
	readonly disconnectRequestCounter: Counter;
	readonly messageRequestCounter: Counter;
}

export const createWsHandlerMetrics = (): WsHandlerMetrics => {
	const connectRequestCounter = createCounter(
		"ws.connect.request.counter",
		"Number of websocket connection requests"
	);

	const disconnectRequestCounter = createCounter(
		"ws.disconnect.request.counter",
		"Number of websocket disconnection requests"
	);

	const messageRequestCounter = createCounter(
		"ws.message.request.counter",
		"Number of websocket message requests"
	);

	return {
		connectRequestCounter,
		disconnectRequestCounter,
		messageRequestCounter
	};
};

export const createCounter = (counterName: string, description?: string) => {
	const options = description ? { description } : {};
	return metrics.getMeter("wsgw-e2e-app").createCounter(counterName, options);
};

