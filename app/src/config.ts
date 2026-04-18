import { type PasswordCredentials } from "#common/security/password-credentials.js";

const defaultServerPort = 8080;

const envNamePrefix = "E2EAPP_";

export type ConnectionTrackingType = "in-memory" | "dynamodb" | "valkey";

export interface ConnectionTrackingConfiguration {
	// E2EAPP_CONNECTION_TRACKING
	readonly type: ConnectionTrackingType;
	// E2EAPP_CONNECTION_TRACKING_URL
	readonly url?: string;
}

const isPasswordCredentials = (value: unknown): value is PasswordCredentials =>
	typeof value === "object"
	&& value !== null
	&& typeof (value as Partial<PasswordCredentials>).username === "string"
	&& typeof (value as Partial<PasswordCredentials>).password === "string";

const parseServerPort = (value: string | undefined): number => {
	const port = Number(value);
	return Number.isNaN(port) ? defaultServerPort : port;
};

const parsePasswordCredentialsList = (value: string | undefined): PasswordCredentials[] => {
	const parsedValue: unknown = JSON.parse(value ?? "[]");

	if (!Array.isArray(parsedValue) || parsedValue.length === 0 || parsedValue.some(credentials => !isPasswordCredentials(credentials))) {
		throw new Error("E2EAPP_PASSWORD_CREDENTIALS should be set");
	}

	return parsedValue;
};

const parseConnectionTrackingType = (value: string | undefined): ConnectionTrackingType => {
	const trackerType = value?.trim().toLowerCase();

	if (!trackerType) {
		return "in-memory";
	}

	if (trackerType === "in-memory" || trackerType === "dynamodb" || trackerType === "valkey") {
		return trackerType;
	}

	throw new Error("E2EAPP_CONNECTION_TRACKING should be one of in-memory|dynamodb|valkey");
};

const parseConnectionTrackingUrl = (value: string | undefined): string | undefined => {
	const url = value?.trim();
	if (!url) {
		return undefined;
	}

	try {
		new URL(url);
	} catch {
		throw new Error("E2EAPP_CONNECTION_TRACKING_URL should be a valid URL");
	}

	return url;
};

const parseConnectionTrackingConfiguration = (
	typeValue: string | undefined,
	urlValue: string | undefined
): ConnectionTrackingConfiguration => {
	const type = parseConnectionTrackingType(typeValue);
	const url = parseConnectionTrackingUrl(urlValue);

	if (type === "in-memory" && url) {
		throw new Error("E2EAPP_CONNECTION_TRACKING_URL should not be set when E2EAPP_CONNECTION_TRACKING=in-memory");
	}

	return {
		type,
		...(url ? { url } : {})
	};
};

export interface Configuration {
	// Prefix used by app-scoped environment variables.
	readonly envNamePrefix: string;
	// E2EAPP_SERVER_PORT
	readonly serverPort: number;
	// E2EAPP_HTTP2
	readonly http2: boolean;
	// E2EAPP_PASSWORD_CREDENTIALS
	readonly passwordCredentialsList: PasswordCredentials[];
	readonly connectionTracking: ConnectionTrackingConfiguration;
}

export const configuration: Configuration = {
	envNamePrefix,
	serverPort: parseServerPort(process.env.E2EAPP_SERVER_PORT),
	http2: process.env.E2EAPP_HTTP2 === "true",
	passwordCredentialsList: parsePasswordCredentialsList(process.env.E2EAPP_PASSWORD_CREDENTIALS),
	connectionTracking: parseConnectionTrackingConfiguration(
		process.env.E2EAPP_CONNECTION_TRACKING,
		process.env.E2EAPP_CONNECTION_TRACKING_URL
	)
};
