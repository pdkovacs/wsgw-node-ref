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
	// https://github.com/wadey/node-microtime claims to give microseond-precision
	// millisecond-precision should serve us for some (long?) time, though.
	const timestamp = new Date().toISOString();
	return {
		...message,
		sentAt: timestamp
	};
};

export const getSentAt = (message: E2EMessage): Date => {
	return new Date(message.sentAt);
};
