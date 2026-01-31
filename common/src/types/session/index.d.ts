import { UserInfo } from "#common/security/user-info.ts";

declare module "express-session" {
	interface SessionData {
		user: UserInfo;
	}
}
