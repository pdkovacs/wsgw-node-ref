import { type PasswordCredentials } from "#common/security/password-credentials.js";

const defaultServerPort = 8080;

const envNamePrefix = "E2EAPP_";

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

export interface Configuration {
	// Prefix used by app-scoped environment variables.
	readonly envNamePrefix: string;
	// E2EAPP_SERVER_PORT
	readonly serverPort: number;
	// E2EAPP_HTTP2
	readonly http2: boolean;
	// E2EAPP_PASSWORD_CREDENTIALS
	readonly passwordCredentialsList: PasswordCredentials[];
}

export const configuration: Configuration = {
	envNamePrefix,
	serverPort: parseServerPort(process.env.E2EAPP_SERVER_PORT),
	http2: process.env.E2EAPP_HTTP2 === "true",
	passwordCredentialsList: parsePasswordCredentialsList(process.env.E2EAPP_PASSWORD_CREDENTIALS)
};
