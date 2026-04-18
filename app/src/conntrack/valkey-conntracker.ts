import { Redis as Valkey, type RedisOptions } from "iovalkey";
import { type FastifyRequest } from "fastify";
import { type WsConnections } from "./ws-connection-tracker.js";

const valkeyConnectionSetPrefix = "WsgwConnectionIds:";

const parseValkeyUrl = (valkeyUrl: string): { dbIndex: number; host: string; password: string; port: number; useTls: boolean; username: string } => {
	const parsed = new URL(valkeyUrl);
	const protocol = parsed.protocol.toLowerCase();
	const useTls = protocol === "valkeys:" || protocol === "rediss:";
	const supportedProtocols = ["valkey:", "valkeys:", "redis:", "rediss:"];
	if (!supportedProtocols.includes(protocol)) {
		throw new Error(`unsupported valkey URL protocol '${parsed.protocol}'`);
	}

	const port = parsed.port.length > 0 ? Number(parsed.port) : 6379;
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`invalid valkey URL port '${parsed.port}'`);
	}
	if (!parsed.hostname) {
		throw new Error("valkey URL host is required");
	}

	const dbPath = parsed.pathname.replace(/^\/+/, "");
	if (!dbPath) {
		return {
			dbIndex: 0,
			host: parsed.hostname,
			password: decodeURIComponent(parsed.password),
			port,
			useTls,
			username: decodeURIComponent(parsed.username)
		};
	}

	const dbIndex = Number(dbPath);
	if (!Number.isInteger(dbIndex) || dbIndex < 0) {
		throw new Error(`invalid valkey database index '${parsed.pathname}'`);
	}

	return {
		dbIndex,
		host: parsed.hostname,
		password: decodeURIComponent(parsed.password),
		port,
		useTls,
		username: decodeURIComponent(parsed.username)
	};
};

const createValkeyClient = async (valkeyUrl: string): Promise<Valkey> => {
	const { dbIndex, host, password, port, useTls, username } = parseValkeyUrl(valkeyUrl);
	const options: RedisOptions = {
		host,
		port,
		db: dbIndex,
		password: password.length > 0 ? password : undefined,
		username: username.length > 0 ? username : undefined,
		lazyConnect: true
	};

	if (useTls) {
		options.tls = {};
	}

	if (username && !password) {
		throw new Error("valkey URL has username but no password");
	}

	const client = new Valkey(options);
	try {
		await client.connect();
	} catch (err) {
		client.disconnect();
		throw err;
	}
	return client;
};

const createUserConnectionKey = (userId: string): string => `${valkeyConnectionSetPrefix}${userId}`;

export const createValkeyConnectionTracker = async (valkeyUrl: string): Promise<WsConnections> => {
	const client = await createValkeyClient(valkeyUrl);

	const addConnection = async (req: FastifyRequest, userId: string, connId: string): Promise<void> => {
		const logger = req.logger.child({ unit: "ValkeyConntracker", userId, connId });
		await client.sadd(createUserConnectionKey(userId), connId);
		logger.debug("connection added");
	};

	const removeConnection = async (req: FastifyRequest, userId: string, connId: string): Promise<boolean> => {
		const logger = req.logger.child({ unit: "ValkeyConntracker", userId, connId });
		const removedCount = await client.srem(createUserConnectionKey(userId), connId);
		logger.debug("connection removed");
		return removedCount > 0;
	};

	const getConnections = async (req: FastifyRequest, userId: string): Promise<string[]> => {
		const logger = req.logger.child({ unit: "ValkeyConntracker", userId });
		logger.debug("fetching connection list...");
		return client.smembers(createUserConnectionKey(userId));
	};

	return { addConnection, removeConnection, getConnections };
};
