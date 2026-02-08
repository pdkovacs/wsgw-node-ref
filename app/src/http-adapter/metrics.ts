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

export const createCounter = (counterName: string, description?: string) => {
	const options = description ? { description } : {};
	return metrics.getMeter("wsgw-e2e-app").createCounter(counterName, options);
};

