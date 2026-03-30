import { Client } from "./client.js";
import { DeliveryTracker } from "./delivery-tracker.js";
import { ClientMonitoring } from "./metrics.js";

export interface TestRun {
	readonly userCount: number;
	readonly testDataChunkSize: number;
	readonly runId: string;
	readonly dlvrTracker: DeliveryTracker;
	readonly monitoring: ClientMonitoring;
	readonly clients: Client[];
	readonly notifyCompleted: () => Promise<void>;
}
