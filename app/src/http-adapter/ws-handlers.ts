import { type FastifyReply, type FastifyRequest } from "fastify";
import { trace } from "@opentelemetry/api";
import { WsConnections } from "../conntrack/ws-connection-tracker.js";
import { connectionIDHeaderKey } from "#common/wsgw.js";
import { isNil } from "lodash";
import { StatusCodes } from "http-status-codes";
import { otelScope, WsHandlerMetrics } from "./metrics.js";

const getConnectionIdFromHeader = (req: FastifyRequest): string | undefined => {
	const connId = req.headers[connectionIDHeaderKey];
	return Array.isArray(connId) ? connId[0] : connId;
};

export const connectWsHandler = (metrics: WsHandlerMetrics, wsConnections: WsConnections) => async (req: FastifyRequest, reply: FastifyReply) => {
	await trace.getTracer(otelScope).startActiveSpan("new-ws-connection", async (span) => {
		try {
			metrics.connectRequestCounter.add(1);

			const userId = req.session.user?.userId;
			if (isNil(userId)) {
				req.logger.error("No user id in session");
				reply.code(StatusCodes.FORBIDDEN).send();
				return;
			}

			const connId = getConnectionIdFromHeader(req);
			if (isNil(connId)) {
				req.logger.error("No connection-id header %s", connectionIDHeaderKey);
				reply.code(StatusCodes.BAD_REQUEST).send();
				return;
			}

			req.logger.debug("incoming connection request...", { "connid": connId });
			await wsConnections.addConnection(req, userId, connId);
			reply.code(StatusCodes.OK).send();
		} finally {
			span.end();
		}
	});
};

export const disconnectWsHandler = (metrics: WsHandlerMetrics, wsConnections: WsConnections) => async (req: FastifyRequest, reply: FastifyReply) => {
	await trace.getTracer(otelScope).startActiveSpan("ws-disconnect", async (span) => {
		try {
			metrics.disconnectRequestCounter.add(1);

			const userId = req.session.user?.userId;
			if (isNil(userId)) {
				req.logger.info("incoming ws disconnection request without userId");
				reply.code(StatusCodes.BAD_REQUEST).send();
				return;
			}

			const logger = req.logger.child({ "userId": userId });

			const connId = getConnectionIdFromHeader(req);
			if (isNil(connId)) {
				logger.info("incoming ws disconnection request without connection-id");
				reply.code(StatusCodes.BAD_REQUEST).send();
				return;
			}

			logger.debug("incoming disconnection request", { "connid": connId });
			if (!await wsConnections.removeConnection(req, userId, connId)) {
				logger.info("user has no ws connections");
			}
			reply.code(StatusCodes.OK).send();
		} finally {
			span.end();
		}
	});
};


export const messageWsHandler = (metrics: WsHandlerMetrics, _wsConnections: WsConnections) => async (req: FastifyRequest, reply: FastifyReply) => {
	metrics.messageRequestCounter.add(1);
	const connId = getConnectionIdFromHeader(req);
	if (isNil(connId)) {
		req.logger.info("send message request without connection-id");
		reply.code(StatusCodes.BAD_REQUEST).send();
		return;
	}
	const message = req.body;
	req.logger.debug("message received", { connectionIDKey: connId, "message": message });
	reply.code(StatusCodes.OK).send();
};
