import { metrics } from "@opentelemetry/api";
import { createHistogram } from "#common/otel.js";

const otelScope = "ws.e2e.client";

export interface ClientMonitoring {
	readonly incMsgRecipientToReachCounter: (value: number) => void;
	readonly incMsgCreatedCounter: (value: number) => void;
	readonly incMsgParseErrCounter: (value: number) => void;
	readonly incOutstandingMsgNotFoundCounter: (value: number) => void;
	readonly incMsgTextMismatchCounter: (value: number) => void;
	readonly recordDeliveryDurationMs: (value: number) => void;
	// readonly recordDeliveryDurationUs: (value: number) => void;
}

export const createMetrics = (runId: string): ClientMonitoring => {
	const msgRecipientToReachCounter = createCounter("ws.e2e.test.client.msg.recipient.counter", "MsgRecipientToReachCounter");
	const msgCreatedCounter = createCounter("ws.e2e.test.client.msg.created", "MsgCreatedCounter");
	const msgParseErrCounter = createCounter("ws.e2e.test.client.msg.parse.error", "MsgParseErrCounter");
	const msgNotFoundCounter = createCounter("ws.e2e.test.client.outstanding.msg.notfound.error", "MsgNotFoundCounter");
	const msgTextMismatchCounter = createCounter("ws.e2e.test.client.outstanding.msg.text.mismatch.error", "dMsgTextMismatchCounter");

	const deliveryDurationHistogramMs = createHistogram(
		otelScope,
		"ws.e2e.test.delivery.duration.ms",
		"Message delivery duration in milliseconds",
		"ms",
		{
			advice: {
				explicitBucketBoundaries: [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000]
			}
		}
	);

	// const deliveryDurationHistogramUs = createHistogram(otelScope, "ws.e2e.test.delivery.duration.us", "Message delivery duration in microseconds", "us");

	const attributes = { "runId": runId };

	return {
		incMsgRecipientToReachCounter: (count: number) => {
			return msgRecipientToReachCounter.add(count, attributes);
		},
		incMsgCreatedCounter: (count: number) => {
			msgCreatedCounter.add(count, attributes);
		},
		incMsgParseErrCounter: (count: number) => {
			msgParseErrCounter.add(count, attributes);
		},
		incOutstandingMsgNotFoundCounter: (count: number) => {
			msgNotFoundCounter.add(count, attributes);
		},
		incMsgTextMismatchCounter: (count: number) => {
			msgTextMismatchCounter.add(count, attributes);
		},
		recordDeliveryDurationMs: (deliveryDurationMs: number) => {
			deliveryDurationHistogramMs.record(deliveryDurationMs);
		}// ,
		// recordDeliveryDurationUs: (deliveryDuration: number) => {
		// 	deliveryDurationHistogramUs.record(deliveryDuration);
		// }
	};
};

export const createCounter = (counterName: string, description?: string) => {
	const options = description ? { description } : {};
	return metrics.getMeter("wsgw-e2e-app").createCounter(counterName, options);
};
