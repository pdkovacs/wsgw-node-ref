import { PasswordCredentials } from "./password-credentials.js";
import { UserInfo } from "./user-info.js";

export interface UserService {
	readonly getDisplayName: (userId: string) => Promise<string>;
	readonly getUserInfo: (userId: string) => Promise<UserInfo>;
	readonly getUsers: () => Promise<UserInfo[]>;
}

export const createUserService = async (passwordCreds: PasswordCredentials[]): Promise<UserService> => {
	return {
		getDisplayName,
		getUserInfo,
		getUsers: getUsers(passwordCreds)
	};
};

const getDisplayName = async (userId: string): Promise<string> => {
	return userId;
};

const getUserInfo = async (userId: string): Promise<UserInfo> => {
	const userInfo: UserInfo = {
		userId,
		displayName: await getDisplayName(userId)
	};
	return userInfo;
};

const getUsers = (passwordCreds: PasswordCredentials[]) => async (): Promise<UserInfo[]> => {
	if (passwordCreds.length > 0) {
		const userInfoList: UserInfo[] = [];
		for (const creds of passwordCreds) {
			userInfoList.push({
				userId: creds.username,
				displayName: creds.username
			});
		}
		return userInfoList;
	}
	throw new Error("no password credentials");
};
