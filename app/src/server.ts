import { type FastifyPluginAsync } from "fastify";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { format } from "node:util";

import { createStartServer } from "#common/create-start-server.js";
import { createOtelConfig, OtelConfig, setupMetrics, setupTracing } from "#common/otel.js";
import { connectPath, createWsgwLocator, disonnectedPath, messagePath } from "#common/wsgw.js";
import { createApiHanlderParams, createBulkMessageHandler, createMessageHandler } from "./http-adapter/api-handler.js";
import { createCounter, createWsHandlerMetrics } from "./http-adapter/metrics.js";
import { configHandler } from "./http-adapter/config-handler.js";
import { createWsgwConnectionTracker } from "./conntrack/ws-connection-tracker.js";
import { connectWsHandler, disconnectWsHandler, messageWsHandler } from "./http-adapter/ws-handlers.js";
import { configuration } from "./config.js";

export interface Server {
	readonly address: () => { address: string; port: number };
	readonly shutdown: () => Promise<void>;
}

const serviceName = "e2e-app";

export const creStartServer = async (): Promise<Server> => {
	const { connectionTracking, envNamePrefix, http2, passwordCredentialsList, serverPort } = configuration;

	const otelConfig: OtelConfig = createOtelConfig(envNamePrefix, serviceName);
	setupTracing(otelConfig);
	setupMetrics(otelConfig);

	const counter = createCounter("root.handler.call.count");

	const routes: FastifyPluginAsync = async router => {
		router.get("/config", configHandler);

		const wsConnections = await createWsgwConnectionTracker(connectionTracking);

		await router.register(async apiRouter => {
			const apiHandlerParams = await createApiHanlderParams(createWsgwLocator(envNamePrefix), wsConnections);
			apiRouter.post("/message", createMessageHandler(apiHandlerParams));
			apiRouter.post("/messages-in-bulk", createBulkMessageHandler(apiHandlerParams));
		}, { prefix: "/api" });

		await router.register(async wsRouter => {
			const wsHandlerMetrics = createWsHandlerMetrics();
			wsRouter.get(connectPath, connectWsHandler(wsHandlerMetrics, wsConnections));
			wsRouter.post(disonnectedPath, disconnectWsHandler(wsHandlerMetrics, wsConnections));
			wsRouter.post(messagePath, messageWsHandler(wsHandlerMetrics, wsConnections));
		}, { prefix: "/ws" });

		router.get<{ Querystring: { someone?: string } }>("/test-otel", (req, reply) => {
			counter.add(1);

			const formattingSpan = trace.getTracer(serviceName).startSpan("formatting response");
			try {
				const greeting = format("Hello, %s", req.query.someone);
				formattingSpan.setStatus({ code: SpanStatusCode.OK });
				reply.send(greeting);
			} catch (err) {
				formattingSpan.setStatus({
					code: SpanStatusCode.ERROR,
					message: (err as Error).message ?? (err as string).toString()
				});
			} finally {
				formattingSpan.end();
			}
		});
	};

	return createStartServer({
		host: "0.0.0.0",
		port: serverPort,
		http2,
		routes,
		passwordCredentialsList,
		rootOtelInstScope: serviceName,
		serviceName
	});
};
