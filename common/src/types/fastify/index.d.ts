import { UserInfo } from "#common/security/user-info.ts";
import { Logger } from "winston"; // the *import* makes this a module

declare module "fastify" {
	interface FastifyRequest {
		logger: Logger;
		session: {
			user?: UserInfo;
		};
	}
}
