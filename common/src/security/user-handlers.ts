import { type FastifyReply, type FastifyRequest } from "fastify";
import { UserService } from "./user-service.js";
import { isNil } from "lodash";
import { UserInfo } from "./user-info.js";
import { StatusCodes } from "http-status-codes";

type UserInfoHandler = (userService: UserService) => (req: FastifyRequest, reply: FastifyReply) => void;

export const userInfoHandler: UserInfoHandler = () => (req, reply) => {
	const requestUser = req.session.user;
	if (isNil(requestUser)) {
		req.logger.debug("No user associated with this request");
		reply.code(StatusCodes.UNAUTHORIZED).send();
		return;
	}
	reply.send(requestUser);
};

type UserListHandler = (userService: UserService) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

export const userListHandler: UserListHandler = userService => async (req, reply) => {
	if (isNil(userService)) {
		req.logger.error("userService should not be nil");
		reply.code(StatusCodes.INTERNAL_SERVER_ERROR).send();
		return;
	}
	const users = await userService.getUsers();
	const userInfoList: UserInfo[] = users.map(user => {
		const userInfo: UserInfo = {
			userId: user.userId,
			displayName: user.displayName
		};
		return userInfo;
	});
	reply.send(userInfoList);
};
