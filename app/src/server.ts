import { Router } from "express";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { format } from "node:util";

import { createStartServer } from "#common/create-start-server.js";
import { createOtelConfig, OtelConfig, setupMetrics, setupTracing, traced } from "#common/otel.js";
import { connectPath, createWsgwLocator, disonnectedPath, messagePath } from "#common/wsgw.js";
import { isEmpty } from "lodash";
import { createApiHanlderParams, createBulkMessageHandler, createMessageHandler } from "./http-adapter/api-handler.js";
import { createCounter, createWsHandlerMetrics } from "./http-adapter/metrics.js";
import { configHandler } from "./http-adapter/config-handler.js";
import { createWsgwConnectionTracker } from "./conntrack/ws-connection-tracker.js";
import { connectWsHandler, disconnectWsHandler, messageWsHandler } from "./http-adapter/ws-handlers.js";
import { envNamePrefix } from "./config.js";

export interface Server {
	readonly address: () => { address: string; port: number };
	readonly shutdown: () => Promise<void>;
}

const serviceName = "wsgw-e2e-app";

export const creStartServer = async (): Promise<Server> => {
	const otelConfig: OtelConfig = createOtelConfig(envNamePrefix, "wsgw-e2e-app");
	setupTracing(otelConfig);
	setupMetrics(otelConfig);

	const counter = createCounter("root.handler.call.count");

	const router: Router = Router();

	router.get("/config", configHandler);

	const wsConnections = await createWsgwConnectionTracker();

	const apiRouter = Router();
	const apiHandlerParams = await createApiHanlderParams(createWsgwLocator(envNamePrefix), wsConnections);
	apiRouter.post("/message", createMessageHandler(apiHandlerParams));
	apiRouter.post("/messages-in-bulk", createBulkMessageHandler(apiHandlerParams));
	router.use("/api", apiRouter);

	const wsRouter = Router();
	const wsHandlerMetrics = createWsHandlerMetrics();
	wsRouter.get(connectPath, connectWsHandler(wsHandlerMetrics, wsConnections));
	wsRouter.post(disonnectedPath, disconnectWsHandler(wsHandlerMetrics, wsConnections));
	wsRouter.post(messagePath, messageWsHandler(wsHandlerMetrics, wsConnections));
	router.use("/ws", wsRouter);

	router.get("/test-otel", (req, res) => {
		traced(req, () => {
			// const logger = req.logger;

			counter.add(1);

			const formattingSpan = trace.getTracer(serviceName).startSpan("formatting response");
			try {
				const greeting = format("Hello, %s", req.query.someone);
				formattingSpan.setStatus({ code: SpanStatusCode.OK });
				res.json(greeting);
			} catch (err) {
				formattingSpan.setStatus({
					code: SpanStatusCode.ERROR,
					message: (err as Error).message ?? (err as string).toString()
				});
			} finally {
				formattingSpan.end();
			}
		});
	});

	const port = Number(process.env.E2EAPP_SERVER_PORT);
	const passwordCredentialsList = JSON.parse(process.env.E2EAPP_PASSWORD_CREDENTIALS ?? "[]");
	if (isEmpty(passwordCredentialsList)) {
		throw new Error("E2EAPP_PASSWORD_CREDENTIALS should be set");
	}

	return createStartServer({
		host: "0.0.0.0",
		port: isNaN(port) ? 8080 : port,
		routes: router,
		passwordCredentialsList,
		rootOtelInstScope: serviceName,
		serviceName
	});
};
