import { OtelConfig } from "#common/otel.js";

const envNamePrefix = "E2EAPP_";

export interface WsgwLocator {
	readonly wsgwHost: string;
	readonly wsgwPort: number;
}

export const createWsgwLocator = (): WsgwLocator => {
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

export const createOtelConfig = (): OtelConfig => {
	return {
		serviceNamespace: process.env.E2EAPP_OTLP_SERVICE_NAMESPACE ?? "bitkit/wsgw",
		serviceName: process.env.E2EAPP_OTLP_SERVICE_NAME ?? "wsgw-e2e-app",
		endpointUrl: process.env.E2EAPP_OTLP_ENDPOINT
	};
};
