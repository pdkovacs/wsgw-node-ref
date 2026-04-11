import { Handler } from "express";
import { trace } from "@opentelemetry/api";
import { WsConnections } from "../conntrack/ws-connection-tracker.js";
import { connectionIDHeaderKey } from "#common/wsgw.js";
import { isNil } from "lodash";
import { StatusCodes } from "http-status-codes";
import { otelScope, WsHandlerMetrics } from "./metrics.js";

export const connectWsHandler = (metrics: WsHandlerMetrics, wsConnections: WsConnections): Handler => async (req, res) => {
	await trace.getTracer(otelScope).startActiveSpan("new-ws-connection", async (span) => {
		try {
			metrics.connectRequestCounter.add(1);

			const userId = req.session.user?.userId;
			if (isNil(userId)) {
				req.logger.error("No user id in session");
				res.sendStatus(StatusCodes.FORBIDDEN);
				return;
			}

			const connId = req.headers[connectionIDHeaderKey] as string;
			if (isNil(connId)) {
				req.logger.error("No connection-id header %s", connectionIDHeaderKey);
				res.sendStatus(StatusCodes.BAD_REQUEST);
				return;
			}

			req.logger.debug("incoming connection request...", { "connid": connId });
			await wsConnections.addConnection(req, userId, connId);
			res.sendStatus(StatusCodes.OK);
		} finally {
			span.end();
		}
	});
};

export const disconnectWsHandler = (metrics: WsHandlerMetrics, wsConnections: WsConnections): Handler => async (req, res) => {
	await trace.getTracer(otelScope).startActiveSpan("ws-disconnect", async (span) => {
		try {
			metrics.disconnectRequestCounter.add(1);

			const userId = req.session.user?.userId;
			if (isNil(userId)) {
				req.logger.info("incoming ws disconnection request without userId");
				res.sendStatus(StatusCodes.BAD_REQUEST);
				return;
			}

			const logger = req.logger.child({ "userId": userId });

			const connId = req.headers[connectionIDHeaderKey] as string;
			if (isNil(connId)) {
				logger.info("incoming ws disconnection request without connection-id");
				res.sendStatus(StatusCodes.BAD_REQUEST);
				return;
			}

			logger.debug("incoming disconnection request", { "connid": connId });
			if (!await wsConnections.removeConnection(req, userId, connId)) {
				logger.info("user has no ws connections");
			}
			res.sendStatus(StatusCodes.OK);
		} finally {
			span.end();
		}
	});
};


export const messageWsHandler = (metrics: WsHandlerMetrics, _wsConnections: WsConnections): Handler => async (req, res) => {
	metrics.messageRequestCounter.add(1);
	const connId = req.headers[connectionIDHeaderKey];
	if (isNil(connId)) {
		req.logger.info("send message request without connection-id");
		return res.sendStatus(StatusCodes.BAD_REQUEST);
	}
	const message = req.body;
	req.logger.debug("message received", { connectionIDKey: connId, "message": message });
	return res.sendStatus(StatusCodes.OK);
};
