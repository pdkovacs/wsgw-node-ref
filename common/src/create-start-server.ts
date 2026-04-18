import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import helmet from "@fastify/helmet";

import { type AddressInfo } from "net";
import { getLogger, setDefaultLogLevel } from "./logger.js";
import { tracingMiddleWare } from "./otel.js";
import { getAppInfoHandler } from "./app-info-handler.js";
import { CredentialsMatch, setupAuthentication } from "./security/authentication-handler.js";
import { resolve } from "path";
import { PasswordCredentials } from "./security/password-credentials.js";
import { createUserService } from "./security/user-service.js";
import { userInfoHandler, userListHandler } from "./security/user-handlers.js";
import { isNil } from "lodash";

export interface ServerConfig {
	readonly host: string;
	readonly port: number;
	readonly http2?: boolean;
	readonly routes: FastifyPluginAsync;
	readonly passwordCredentialsList: PasswordCredentials[];
	readonly rootOtelInstScope: string;
	readonly serviceName: string;
}

export interface Server {
	readonly address: () => { address: string; port: number };
	readonly shutdown: () => Promise<void>;
}

export const createStartServer = async (config: ServerConfig): Promise<Server> => {
	setDefaultLogLevel("debug");
	const logger = getLogger("server");
	// Fastify's TS split between FastifyHttpOptions / FastifyHttp2Options makes
	// a runtime-toggled http2 flag awkward to express without widening the whole
	// FastifyInstance type (which would then require Http2-typed handlers
	// everywhere). Runtime behavior is correct regardless: `http2: true` with
	// no `https` option serves h2c. Keep the instance typed as http1 so
	// downstream handler typings stay sane.
	const fastifyOptions = {
		logger: false,
		trustProxy: true,
		...(config.http2 ? { http2: true } : {})
	};
	const app = (Fastify as (opts: unknown) => FastifyInstance)(fastifyOptions);

	app.addHook("onRequest", tracingMiddleWare(config.rootOtelInstScope));
	await app.register(helmet);
	app.addHook("onRequest", (req, _, done) => {
		req.logger = logger.child({
			serviceName: config.serviceName,
			requestUrl: req.url,
			method: req.method,
			ip: req.ip
		});
		req.session = {};
		done();
	});

	app.get("/app-info", getAppInfoHandler(resolve(".")));

	const userService = await createUserService(config.passwordCredentialsList);

	const credentialsMatch: CredentialsMatch = async targetCreds =>
		!isNil(config.passwordCredentialsList.find(creds => creds.username === targetCreds.username && creds.password === targetCreds.password));

	await app.register(async protectedApp => {
		setupAuthentication(protectedApp, credentialsMatch);

		protectedApp.get("/user", userInfoHandler(userService));
		protectedApp.get("/users", userListHandler(userService));

		await protectedApp.register(config.routes);
	});

	await app.listen({
		host: config.host,
		port: config.port
	});

	const addressInfo = app.server.address() as AddressInfo;
	logger.info("server is listening", addressInfo);

	return {
		address: () => addressInfo,
		shutdown: async () => {
			logger.info("server is closing...");
			await app.close();
		}
	};
};
