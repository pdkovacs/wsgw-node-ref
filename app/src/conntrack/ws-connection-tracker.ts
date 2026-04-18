import { type FastifyRequest } from "fastify";
import { createInMemoryConnectionTracker } from "./in-memory-conntracker.js";
import { createDynamodbConnectionTracker } from "./dynamodb-conntracker.js";

export interface WsConnections {
	readonly addConnection: (req: FastifyRequest, userId: string, connId: string) => Promise<void>;
	readonly removeConnection: (req: FastifyRequest, userId: string, connId: string) => Promise<boolean>;
	readonly getConnections: (req: FastifyRequest, userId: string) => Promise<string[]>;
}

export const createWsgwConnectionTracker = async (dynamodbUrl?: string): Promise<WsConnections> => {
	if (dynamodbUrl) {
		return createDynamodbConnectionTracker(dynamodbUrl);
	}
	return createInMemoryConnectionTracker();
};

