import { Request } from "express";
import { WsConnections } from "./ws-connection-tracker.js";
import { isNil } from "lodash";

type ConnectinIds = string[];
interface ConnectionIdsByMsgId { [msgId: string]: ConnectinIds };

export const createInMemoryConnectionTracker = async (): Promise<WsConnections> => {

	const conntracker: ConnectionIdsByMsgId = {
	};

	const addConnection = async (req: Request, userId: string, connId: string) => {
		const logger = req.logger.child({ unit: "InmemoryConntracker", userId: userId, connId: connId });
		logger.debug("BEGIN");
		const connIds = conntracker[userId];

		if (isNil(connIds)) {
			conntracker[userId] = [connId];
		} else {
			conntracker[userId].push(connId);
		}
	};

	const getConnections = async (_: Request, userId: string): Promise<string[]> => {
		const connIdList = conntracker[userId];

		if (isNil(connIdList)) {
			return [];
		}

		return [...connIdList];
	};

	const removeConnection = async (_: Request, userId: string, connId: string): Promise<boolean> => {
		const connIdList = conntracker[userId];

		if (!isNil(connIdList)) {
			conntracker[userId] = connIdList.filter(id => id != connId);
			return true;
		}

		return false;
	};

	const wsConnections: WsConnections = {
		addConnection,
		getConnections,
		removeConnection
	};

	return wsConnections;
};
