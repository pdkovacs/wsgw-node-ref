import { Handler, Router } from "express";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { format } from "node:util";

import { createStartServer } from "#common/create-start-server.js";
import { OtelConfig, setupMetrics, setupTracing, traced } from "#common/otel.js";
import { connectPath, disonnectedPath, messagePath } from "#common/wsgw.js";
import { isEmpty, isNil } from "lodash";
import { createApiHanlderParams, createBulkMessageHandler, createMessageHandler } from "./http-adapter/api-handler.js";
import { createCounter, createWsHandlerMetrics } from "./http-adapter/metrics.js";
import { createOtelConfig, createWsgwLocator } from "./config.js";
import { configHandler } from "./http-adapter/config-handler.js";
import { createWsgwConnectionTracker } from "./conntrack/ws-connection-tracker.js";
import { connectWsHandler, disconnectWsHandler, messageWsHandler } from "./http-adapter/ws-handlers.js";
import { envNamePrefix } from "./config.js";
import { StatusCodes } from "http-status-codes";

export interface Server {
	readonly address: () => { address: string; port: number };
	readonly shutdown: () => Promise<void>;
}

const serviceName = "wsgw-e2e-client";

export const creStartServer = async (): Promise<Server> => {
	const otelConfig: OtelConfig = createOtelConfig();
	setupTracing(otelConfig);
	setupMetrics(otelConfig);

	const router: Router = Router();

	router.get("/config", configHandler);

	const apiRouter = Router();
	apiRouter.post("/run", createRunTestHandler());

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

const createRunTestHandler = (): Handler => (req, res) => {
	let userCount = 32;
	const userCountStr = req.query["user-count"] as string;
	if (!isEmpty(userCountStr.trim())) {
		const userCount: number = parseInt(userCountStr.trim(), 10);
		if (isNaN(userCount)) {
			req.logger.error("failed to convert query parameter 'user-count'", { userCountStr })
			return res.sendStatus(StatusCodes.BAD_REQUEST);
		}
		if (userCount < 1) {
			req.logger.error("'user-count' must be greater than 1", { userCount });
			return res.sendStatus(StatusCodes.BAD_REQUEST)
		}
	}

	let testDataChunkSize = 1;
	const testDataChunkSizeStr = req.query["testdata-chunksize"] as string;
	if (!isEmpty(testDataChunkSizeStr.trim())) {
		testDataChunkSize = parseInt(testDataChunkSizeStr, 10);
		if (isNaN(testDataChunkSize)) {
			req.logger.error("failed to convert query parameter 'testdata-partion-count'", { testDataChunkSizeStr })
			return res.sendStatus(StatusCodes.BAD_REQUEST)
		}
		if (testDataChunkSize < 1) {
			req.logger.error("'testdata-partion-count' must be greater than 1", { testDataChunkSize })
			return res.sendStatus(StatusCodes.BAD_REQUEST)
		}
	}

	let testRunTimeout = 20 * 1000 * 60 // time.Minute
	const testRunTimeoutStr = req.query["timeout"] as string;
	if (!isEmpty(testRunTimeoutStr.trim()) {
		const testRunTimeout = parseInt(testRunTimeoutStr, 10);
		if (isNaN(testRunTimeout)) {
			req.logger.error("failed to convert query parameter 'timeout'", { testRunTimeoutStr })
			return res.sendStatus(StatusCodes.BAD_REQUEST)
		}
	}

	const formattingSpan = trace.getTracer(serviceName).startSpan("test-run");
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


	tracer:= otel.Tracer(config.OtelScope)
	tmpCtx, span := tracer.Start(runContext,)
	runContext = tmpCtx
	defer span.End()

	run:= newTestRun(userCount, testDataChunkSize, notifyDone)
	span.SetAttributes(attribute.KeyValue{ Key: "runId", Value: attribute.StringValue(run.runId) })
	runContext = logger.With().Str("runId", run.runId).Logger().WithContext(runContext)

	run.createConnectRunClients(runContext, conf)

	g.JSON(http.StatusOK, map[string]string{ "id": run.runId })

		select {
		case <-testRunDone:
logger.Debug().Bool("isContextAlive", runContext.Err() == nil).Msg("test-run done")
		case <-time.After(testRunTimeout):
logger.Debug().Msg("had enough waiting")
		}
logger.Debug().Msg("about to cancel test run context...")
};
