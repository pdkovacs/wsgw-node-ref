import { Handler } from "express";
import { createWsgwLocator } from "#common/wsgw.js";
import { envNamePrefix } from "../config.js";

export const configHandler: Handler = (_req, res) => {
	res.json(createWsgwLocator(envNamePrefix));
};
