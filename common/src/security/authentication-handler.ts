import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { getLogger } from "../logger.js";
import { PasswordCredentials } from "./password-credentials.js";
import { StatusCodes } from "http-status-codes";

const getAuthorizationHeader = (req: FastifyRequest): string => {
	const authorization = req.headers.authorization;
	return Array.isArray(authorization) ? (authorization[0] ?? "") : (authorization ?? "");
};

const getCredentials = (req: FastifyRequest): PasswordCredentials => {
	const logger = getLogger("getCredentials");
	const b64auth = getAuthorizationHeader(req).split(" ")[1] ?? "";
	logger.debug("authorization header: %s", b64auth);
	const strauth = Buffer.from(b64auth, "base64").toString();
	const splitIndex = strauth.indexOf(":");
	const login = strauth.substring(0, splitIndex);
	const password = strauth.substring(splitIndex + 1);
	return {
		username: login,
		password
	};
};

export type CredentialsMatch = (credentials: PasswordCredentials) => Promise<boolean>;

export const basicAuthenticationHandler = (
	credentialsMatch: CredentialsMatch
): ((req: FastifyRequest, reply: FastifyReply) => Promise<void>) => async (req, reply) => {
	const logger = getLogger(`basic-authentication-handler (${req.url})`);
	try {
		const requestCredentials: PasswordCredentials = getCredentials(req);
		const matchFound = await credentialsMatch(requestCredentials);
		logger.debug("matchFound: %o", matchFound);
		if (matchFound) {
			req.session.user = { userId: requestCredentials.username, displayName: requestCredentials.username };
			return;
		} else {
			reply.header("WWW-Authenticate", "Basic").code(StatusCodes.UNAUTHORIZED).send();
			return;
		}
	} catch (error) {
		const errmsg = `Error during authentication: ${error}`;
		logger.error("Error during authentication: %o", error);
		reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send(errmsg);
	}
};

export const setupAuthentication = (server: FastifyInstance, credentialsMatch: CredentialsMatch) => {
	server.addHook("preHandler", basicAuthenticationHandler(credentialsMatch));
};
