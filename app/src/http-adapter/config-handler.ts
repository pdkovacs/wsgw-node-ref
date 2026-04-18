import { type FastifyReply, type FastifyRequest } from "fastify";
import { createWsgwLocator } from "#common/wsgw.js";
import { configuration } from "../config.js";

export const configHandler = (_req: FastifyRequest, reply: FastifyReply) => {
	reply.send(createWsgwLocator(configuration.envNamePrefix));
};
