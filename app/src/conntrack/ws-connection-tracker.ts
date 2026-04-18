import { type FastifyRequest } from "fastify";
import { createInMemoryConnectionTracker } from "./in-memory-conntracker.js";
import { createDynamodbConnectionTracker } from "./dynamodb-conntracker.js";
import { type ConnectionTrackingConfiguration } from "../config.js";

export interface WsConnections {
	readonly addConnection: (req: FastifyRequest, userId: string, connId: string) => Promise<void>;
	readonly removeConnection: (req: FastifyRequest, userId: string, connId: string) => Promise<boolean>;
	readonly getConnections: (req: FastifyRequest, userId: string) => Promise<string[]>;
}

export const createWsgwConnectionTracker = async (connectionTracking: ConnectionTrackingConfiguration): Promise<WsConnections> => {
	switch (connectionTracking.type) {
		case "in-memory":
			return createInMemoryConnectionTracker();
		case "dynamodb":
			return createDynamodbConnectionTracker(connectionTracking.url);
		case "valkey":
			throw new Error("E2EAPP_CONNECTION_TRACKING=valkey is not implemented yet");
	}
};
