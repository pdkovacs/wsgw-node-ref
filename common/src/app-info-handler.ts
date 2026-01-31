import { type Handler } from "express";
import * as path from "path";
import { readFile } from "fs/promises";

interface VersionInfo {
	readonly version: string;
	readonly commit: string;
	readonly buildTime: string;
}

export const getAppInfoHandler = (packageRootDir: string): Handler => async (req, res) => {
	const logger = req.logger;
	try {
		logger.debug("BEGIN");
		const versionJSON = await readFile(path.resolve(packageRootDir, "version.json"), "utf8");
		const versionInfo: VersionInfo = JSON.parse(versionJSON);
		res.send(versionInfo);
	} catch (error) {
		logger.error(error);
		res.status(500).send({ error: "Failed to retreive " }).end();
	}
};
