export const connectPath = "/connect";
export const disonnectedPath = "/disconnected";
export const messagePath = "/message";

// Lowercase: Express normalises all incoming header names to lowercase,
// so req.headers["X-WSGW-CONNECTION-ID"] would always be undefined.
export const connectionIDHeaderKey = "x-wsgw-connection-id";
export const connIdPathParamName = "connectionId";

export interface WsgwLocator {
	readonly wsgwHost: string;
	readonly wsgwPort: number;
}

export const createWsgwLocator = (envNamePrefix: string): WsgwLocator => {
	const wsgwHost = process.env[envNamePrefix + "WSGW_HOST"];
	if (!wsgwHost) {
		throw new Error(envNamePrefix + "WSGW_HOST must be defined");
	}
	const wsgwPortString = process.env[envNamePrefix + "WSGW_PORT"];
	if (!wsgwPortString) {
		throw new Error(envNamePrefix + "WSGW_PORT must be defined");
	}
	const wsgwPort = Number(wsgwPortString);
	if (isNaN(wsgwPort)) {
		throw new Error(envNamePrefix + "WSGW_PORT is not a number: " + wsgwPortString);
	}

	return {
		wsgwHost,
		wsgwPort
	};
};
