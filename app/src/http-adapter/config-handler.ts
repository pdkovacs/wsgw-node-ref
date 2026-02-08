import { Handler } from "express";
import { createWsgwLocator } from "../config.js";

export const configHandler: Handler = (_req, res) => {
	res.json(createWsgwLocator());
};
