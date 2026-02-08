import { Request } from "express";
import { createInMemoryConnectionTracker } from "./in-memory-conntracker.js";

export interface WsConnections {
	readonly addConnection: (req: Request, userId: string, connId: string) => Promise<void>;
	readonly removeConnection: (req: Request, userId: string, connId: string) => Promise<boolean>;
	readonly getConnections: (req: Request, userId: string) => Promise<string[]>;
}

export const createWsgwConnectionTracker = async (redisUrl: string): Promise<WsConnections> => {
	if (redisUrl) {
		throw new Error("unsupported WS-connection tracker: redis");
	}
	return createInMemoryConnectionTracker();
};


