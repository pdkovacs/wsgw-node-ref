import express from "express";

import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { format } from "node:util";

import { createStartServer } from "#common/create-start-server.js";
import { OtelConfig, setupMetrics, setupTracing, traced } from "#common/otel.js";
import { isEmpty } from "lodash";

export interface Server {
	readonly address: () => { address: string; port: number };
	readonly shutdown: () => Promise<void>;
}

const createOtelConfig = (): OtelConfig => {
	return {
		serviceNamespace: process.env.E2EAPP_OTLP_SERVICE_NAMESPACE ?? "bitkit/wsgw",
		serviceName: process.env.E2EAPP_OTLP_SERVICE_NAME ?? "wsgw-e2e-app",
		endpointUrl: process.env.E2EAPP_OTLP_ENDPOINT
	};
};

const createCounter = (counterName: string) => {
	return metrics.getMeter("wsgw-e2e-app").createCounter(counterName);
};

const rootOtelInstScope = "wsgw-e2e-app";

export const creStartServer = async (): Promise<Server> => {
	const otelConfig: OtelConfig = createOtelConfig();
	setupTracing(otelConfig);
	setupMetrics(otelConfig);

	const counter = createCounter("root.handler.call.count");

	const router: express.Router = express.Router();

	// router.get("/config", configHandler(conf.WsgwHost, conf.WsgwPort))

	// const apiGroup = authorizedGroup.Group("/api")
	// const apiHandler = newAPIHandler(config.GetWsgwUrl(conf), wsConnections)
	// const apiGroup.POST("/message", apiHandler.messageHandler())
	// const apiGroup.POST("/messages-in-bulk", apiHandler.sendInBulk())

	// const wsGroup = authorizedGroup.Group("/ws")
	// const wsHandler = newWSHandler(wsConnections)
	// wsGroup.GET(string(wsgw.ConnectPath), wsHandler.connectWsHandler(wsConnections))
	// wsGroup.POST(string(wsgw.DisonnectedPath), wsHandler.disconnectWsHandler(wsConnections))
	// wsGroup.POST(string(wsgw.MessagePath), messageWsHandler())

	router.get("/", (req, res) => {
		traced(req, () => {
			// const logger = req.logger;

			counter.add(1);

			const formattingSpan = trace.getTracer(rootOtelInstScope).startSpan("formatting response");
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
		rootOtelInstScope
	});
};
