import { Request, Handler } from "express";
import pLimit from "p-limit";
import { trace } from "@opentelemetry/api";
import { injectIntoHeaders, injectTraceData } from "#common/otel.js";
import { WsConnections } from "../conntrack/ws-connection-tracker.js";
import { ApiHandlerMetrics, createApiHandlerMetrics, otelScope } from "./metrics.js";
import { format } from "node:util";
import { E2EMessage } from "#common/message-dto.js";
import { StatusCodes } from "http-status-codes";
import axios from "axios";
import { WsgwLocator } from "#common/wsgw.js";

export interface ApiHandlerParams {
	readonly wsgwUrl: string;
	readonly wsConnections: WsConnections;
	readonly metrics: ApiHandlerMetrics;
}

export const createApiHanlderParams = async (wsgwLocator: WsgwLocator, wsConnections: WsConnections): Promise<ApiHandlerParams> => {
	return {
		wsgwUrl: format("http://%s:%d", wsgwLocator.wsgwHost, wsgwLocator.wsgwPort),
		wsConnections,
		metrics: createApiHandlerMetrics()
	};
};

export const createMessageHandler = (params: ApiHandlerParams): Handler => async (req, res) => {
	await trace.getTracer(otelScope).startActiveSpan("handle-send-message-request", async (span) => {
		try {
			const { metrics: handlerMetrics } = params;
			handlerMetrics.messageRequestCounter.add(1);
			await sendMessageToUser(req, params, req.body);
			res.end();
		} finally {
			span.end();
		}
	});
};

const sendMessageToUser = async (req: Request, params: ApiHandlerParams, messageIn: E2EMessage): Promise<void> => {
	req.logger = req.logger.child({ testRunId: messageIn.testRunId });

	const maxNrConcurrentSends = 4;
	const nrConcurrentSends = Math.min(messageIn.recipients.length, maxNrConcurrentSends);

	const limit = pLimit(nrConcurrentSends);

	const tasks = messageIn.recipients.map(recipient =>
		limit(() => sendMessageToUserDevices(req, params, recipient, messageIn))
	);

	await Promise.all(tasks);
};

const sendMessageToUserDevices = async (req: Request, params: ApiHandlerParams, userId: string, message: E2EMessage): Promise<void> => {
	const wsConnIds = await trace.getTracer(otelScope).startActiveSpan("find-user-devices", async (span) => {
		try {
			return await params.wsConnections.getConnections(req, userId);
		} finally {
			span.end();
		}
	});
	await sendMessage(req, params, userId, message, wsConnIds,
		(connId) => params.wsConnections.removeConnection(req, userId, connId));
};

const sendMessage = async (
	req: Request,
	params: ApiHandlerParams,
	userId: string,
	message: E2EMessage,
	wsConnIds: string[],
	discardConnId: (connId: string) => Promise<boolean>
): Promise<number> => {
	const logger = req.logger.child({ "wsgwUrl": params.wsgwUrl });
	logger.debug("message to send...", { "recipient": userId, "msg": message, "targetConnectionCount": wsConnIds.length });
	let statusCode = StatusCodes.NO_CONTENT;

	for (const wsConnId of wsConnIds) {
		const url = format("%s%s/%s", params.wsgwUrl, "/message", wsConnId);
		const messageToSend = { ...message, traceData: injectTraceData() };
		// validateStatus disables axios's default behaviour of throwing on 4xx/5xx,
		// so the NOT_FOUND check below is reachable and stale connection IDs get discarded.
		const response = await axios.post(url, messageToSend, { validateStatus: () => true, headers: injectIntoHeaders() });
		if (response.status !== StatusCodes.NO_CONTENT) {
			if (response.status === StatusCodes.NOT_FOUND) {
				params.metrics.staleWsConnIdCounter.add(1);
				await discardConnId(wsConnId);
				continue;
			}
			statusCode = response.status;
			continue;
		}
	}

	return statusCode;
};

export const createBulkMessageHandler = (params: ApiHandlerParams): Handler => {
	const { metrics: handlerMetrics } = params;

	return async (req, res) => {
		const allMessages: E2EMessage[] = req.body;
		handlerMetrics.messageRequestCounter.add(allMessages.length, { "runId": allMessages[0].testRunId });

		try {
			req.logger.debug("sending messages", { "msgCount": allMessages.length });
			for (const messageIn of allMessages) {
				await sendMessageToUser(req, params, messageIn);
			}
			res.end();
		} catch (err) {
			req.logger.error("error in createBulkMessageHandler: %o", err);
			res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
		}
	};
};
