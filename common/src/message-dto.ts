export interface E2EMessage {
	readonly testRunId: string;
	readonly id: string;
	readonly sender: string;
	readonly recipients: [];
	readonly data: string;
	readonly sentAt: string;
	readonly destination: string;
	readonly traceData: { [key: string]: string };
}

export const setSentAt = (message: E2EMessage): E2EMessage => {
	// performance.timeOrigin + performance.now() gives sub-millisecond precision,
	// allowing microsecond-granularity timestamps compatible with Go's time.RFC3339Nano.
	const nowMs = performance.timeOrigin + performance.now();
	const isoMs = new Date(Math.floor(nowMs)).toISOString(); // "...190Z"
	const microsFrac = Math.floor((nowMs % 1) * 1000).toString().padStart(3, "0");
	const timestamp = isoMs.replace(/(\.\d{3})Z$/, `$1${microsFrac}Z`);
	return {
		...message,
		sentAt: timestamp
	};
};

export const getSentAt = (message: E2EMessage): Date => {
	return new Date(message.sentAt);
};
