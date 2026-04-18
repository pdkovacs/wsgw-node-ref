import { type FastifyReply, type FastifyRequest } from "fastify";
import * as path from "path";
import { readFile } from "fs/promises";
import { StatusCodes } from "http-status-codes";

interface VersionInfo {
	readonly version: string;
	readonly commit: string;
	readonly buildTime: string;
}

export const getAppInfoHandler = (packageRootDir: string) => async (req: FastifyRequest, reply: FastifyReply) => {
	const logger = req.logger;
	try {
		logger.debug("BEGIN");
		const versionJSON = await readFile(path.resolve(packageRootDir, "version.json"), "utf8");
		const versionInfo: VersionInfo = JSON.parse(versionJSON);
		reply.send(versionInfo);
	} catch (error) {
		logger.error(error);
		reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: "Failed to retreive " });
	}
};
