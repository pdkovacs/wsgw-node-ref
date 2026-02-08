import { Request, Handler } from "express";
import pLimit from "p-limit";
import { createWsgwConnectionTracker, WsConnections } from "../conntrack/ws-connection-tracker.js";
import { ApiHandlerMetrics, createApiHandlerMetrics } from "./metrics.js";
import { WsgwLocator } from "../config.js";
import { format } from "node:util";
// import { context, Context, propagation } from "@opentelemetry/api";
import { traced } from "#common/otel.js";
import { E2EMessage } from "#common/message-dto.js";
import { StatusCodes } from "http-status-codes";
import axios from "axios";

export interface ApiHandlerParams {
	readonly wsgwUrl: string;
	readonly wsConnections: WsConnections;
	readonly metrics: ApiHandlerMetrics;
}

export const createApiHanlderParams = async (wsgwLocator: WsgwLocator): Promise<ApiHandlerParams> => {
	const apiHandlerParams: ApiHandlerParams = {
		wsgwUrl: format("http://%s:%d", wsgwLocator.wsgwHost, wsgwLocator.wsgwPort),
		wsConnections: await createWsgwConnectionTracker(""),
		metrics: createApiHandlerMetrics()
	};
	return apiHandlerParams;
};

export const createMessageHandler = (params: ApiHandlerParams): Handler => async (req, res) => {
	traced(req, async () => {
		const { metrics: handlerMetrics } = params;
		handlerMetrics.messageRequestCounter.add(1);

		await sendMessageToUser(req, req.body);

		res.end();
	});
};

const sendMessageToUser = async (req: Request, messageIn: E2EMessage): Promise<void> => {
	req.logger = req.logger.child({ testRunId: messageIn.testRunId });

	const maxNrConcurrentSends = 4;
	const nrConcurrentSends = Math.min(messageIn.recipients.length, maxNrConcurrentSends);

	const limit = pLimit(nrConcurrentSends);

	const tasks = messageIn.recipients.map(recipient =>
		limit(() => sendMessageToUserDevices(req, recipient, messageIn))
	);

	await Promise.all(tasks);
};

const sendMessageToUserDevices = async (req: Request, userId: string, message: E2EMessage): Promise<void> => {
	// wsConnIds, err := h.wsConnections.GetConnections(ctx, userId)
	await sendMessage(req, "", userId, message, [""], async () => undefined);
};

const sendMessage = async (req: Request, wsgwUrl: string, userId: string, message: E2EMessage, wsConnIds: string[], discardConnId: (connId: string) => Promise<void>): Promise<number> => {
	let statusCode = StatusCodes.NO_CONTENT;

	for (const wsConnId of wsConnIds) {
		const url = format("%s%s/%s", wsgwUrl, "/message", wsConnId);
		const response = await axios.post(url, message);
		if (response.status !== StatusCodes.NO_CONTENT) {
			if (response.status === StatusCodes.NOT_FOUND) {
				discardConnId(wsConnId);
				continue;
			}
			statusCode = response.status;
			continue;
		}
	}

	return statusCode;
};

export const createBulkMessageHandler = (/* params: ApiHandlerParams */): Handler => () => async (/* req, res */) => {
	// const { metrics: handlerMetrics } = params;
	// handlerMetrics.messageRequestCounter.Add(allMessages.length), metric.WithAttributes(attribute.String("runId", allMessages[0].TestRunId)));
};

