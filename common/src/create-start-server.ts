import express from "express";
import helmet from "helmet";
import * as http from "node:http";

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
	readonly routes: express.Router;
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
	const app = express();

	app.use(tracingMiddleWare(config.rootOtelInstScope));
	app.use(helmet());
	app.set("trust proxy", true);
	app.use((req, _, next) => {
		req.logger = logger.child({
			serviceName: config.serviceName,
			requestUrl: req.originalUrl,
			method: req.method,
			ip: req.ip
		});
		next();
	});
	app.use(express.json());

	app.get("/app-info", getAppInfoHandler(resolve(".")));

	const userService = await createUserService(config.passwordCredentialsList);

	const credentialsMatch: CredentialsMatch = async targetCreds =>
		!isNil(config.passwordCredentialsList.find(creds => creds.username === targetCreds.username && creds.password === targetCreds.password));

	setupAuthentication(app, credentialsMatch);

	app.get("/user", userInfoHandler(userService));
	app.get("/users", userListHandler(userService));

	app.use(config.routes);

	const httpServer = http.createServer(app);

	return await new Promise(resolve => {
		httpServer.listen(config.port, config.host,
			() => {
				const addressInfo = httpServer.address() as AddressInfo;
				logger.info("server is listenening", addressInfo);
				resolve({
					address: () => addressInfo,
					shutdown: async () => {
						await new Promise<void>((resolve, reject) => {
							Promise.resolve() // close app resources
								.then()
								.catch(error => {
									logger.error("#shutdown: failed to close app resources: %o", error);
								})
								.finally(() => {
									logger.info("server is closing...");
									httpServer.close(error => {
										reject(error);
									});
									resolve();
								});
						});
					}
				});
			}
		);
	});
};
