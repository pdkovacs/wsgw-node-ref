import { type FastifyReply, type FastifyRequest } from "fastify";
import { createWsgwLocator } from "#common/wsgw.js";
import { envNamePrefix } from "../config.js";

export const configHandler = (_req: FastifyRequest, reply: FastifyReply) => {
	reply.send(createWsgwLocator(envNamePrefix));
};
