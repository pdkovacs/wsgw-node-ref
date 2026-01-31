import { Handler } from "express";
import { UserService } from "./user-service.js";
import { isNil } from "lodash";
import { UserInfo } from "./user-info.js";

type UserInfoHandler = (userService: UserService) => Handler;

export const userInfoHandler: UserInfoHandler = () => (req, res) => {
	const requestUser = req.session.user;
	if (isNil(requestUser)) {
		req.logger.debug("No user associated with this request");
		res.sendStatus(401).end();
	}
	res.json(requestUser);
};

type UserListHandler = (userService: UserService) => Handler;

export const userListHandler: UserListHandler = userService => async (req, res) => {
	if (isNil(userService)) {
		req.logger.error("userService should not be nil");
		res.sendStatus(500).end();
	}
	const users = await userService.getUsers();
	const userInfoList: UserInfo[] = users.map(user => {
		const userInfo: UserInfo = {
			userId: user.userId,
			displayName: user.displayName
		};
		return userInfo;
	});
	res.json(userInfoList);
};
