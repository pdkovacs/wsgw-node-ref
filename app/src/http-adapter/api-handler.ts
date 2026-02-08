import { Request, Handler } from "express";
import pLimit from "p-limit";
import { WsConnections } from "../conntrack/ws-connection-tracker.js";
import { ApiHandlerMetrics, createApiHandlerMetrics } from "./metrics.js";
import { format } from "node:util";
// import { context, Context, propagation } from "@opentelemetry/api";
import { traced } from "#common/otel.js";
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
	traced(req, async () => {
		const { metrics: handlerMetrics } = params;
		handlerMetrics.messageRequestCounter.add(1);

		await sendMessageToUser(req, params, req.body);

		res.end();
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
	const wsConnIds = await params.wsConnections.getConnections(req, userId);
	await sendMessage(req, params.wsgwUrl, userId, message, wsConnIds,
		(connId) => params.wsConnections.removeConnection(req, userId, connId));
};

const sendMessage = async (
	req: Request,
	wsgwUrl: string,
	userId: string,
	message: E2EMessage,
	wsConnIds: string[],
	discardConnId: (connId: string) => Promise<boolean>
): Promise<number> => {
	const logger = req.logger.child({ "wsgwUrl": wsgwUrl });
	logger.debug("message to send...", { "recipient": userId, "msg": message, "targetConnectionCount": wsConnIds.length });
	let statusCode = StatusCodes.NO_CONTENT;

	for (const wsConnId of wsConnIds) {
		const url = format("%s%s/%s", wsgwUrl, "/message", wsConnId);
		const response = await axios.post(url, message);
		if (response.status !== StatusCodes.NO_CONTENT) {
			if (response.status === StatusCodes.NOT_FOUND) {
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
