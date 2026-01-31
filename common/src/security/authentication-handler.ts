import { type Handler, type Request, type Router } from "express";
import session from "express-session";
import { getLogger } from "../logger.js";
import { PasswordCredentials } from "./password-credentials.js";

const getAuthorizationHeader: (req: Request) => string = req => req.headers.authorization ?? "";

const getCredentials = (req: Request): PasswordCredentials => {
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
): Handler => (req, res, next) => {
	const logger = getLogger(`basic-authentication-handler (${req.url})`);
	const asyncFunc = async (): Promise<void> => {
		const requestCredentials: PasswordCredentials = getCredentials(req);
		const matchFound = await credentialsMatch(requestCredentials);
		logger.debug("matchFound: %o", matchFound);
		if (matchFound) {
			req.session.user = { userId: requestCredentials.username, displayName: requestCredentials.username };
			next();
		} else {
			res.set("WWW-Authenticate", "Basic").status(401).end();
		}
	};
	asyncFunc()
		.then(
			() => undefined
		).catch(error => {
			const errmsg = `Error during authentication: ${error}`;
			logger.error("Error during authentication: %o", error);
			res.status(500).send(errmsg).end();
		});
};

export const setupSecurity = (router: Router, credentialsMatch: CredentialsMatch) => {
	router.use(session({
		secret: "my-secret", // TODO: a secret string used to sign the session ID cookie
		resave: false, // don't save session if unmodified
		saveUninitialized: false // don't create session until something stored,
	}));
	router.use(basicAuthenticationHandler(credentialsMatch));
};
