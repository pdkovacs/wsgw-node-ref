import { Request } from "express";
import { createInMemoryConnectionTracker } from "./in-memory-conntracker.js";
import { createDynamodbConnectionTracker } from "./dynamodb-conntracker.js";

export interface WsConnections {
	readonly addConnection: (req: Request, userId: string, connId: string) => Promise<void>;
	readonly removeConnection: (req: Request, userId: string, connId: string) => Promise<boolean>;
	readonly getConnections: (req: Request, userId: string) => Promise<string[]>;
}

export const createWsgwConnectionTracker = async (dynamodbUrl?: string): Promise<WsConnections> => {
	if (dynamodbUrl) {
		return createDynamodbConnectionTracker(dynamodbUrl);
	}
	return createInMemoryConnectionTracker();
};


