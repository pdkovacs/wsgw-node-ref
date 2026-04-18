import { type FastifyRequest } from "fastify";
import {
	DynamoDBClient,
	QueryCommand,
	PutItemCommand,
	DeleteItemCommand
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { WsConnections } from "./ws-connection-tracker.js";

const TABLE_NAME = "WsgwConnectionIds";
const USER_ID_ATTRIBUTE = "UserId";
const CONNECTION_ID_ATTRIBUTE = "ConnectionId";
const DATE_CREATED_ATTRIBUTE = "DateCreated";

export const createDynamodbConnectionTracker = async (dynamodbUrl: string): Promise<WsConnections> => {
	const clientConfig = dynamodbUrl
		? { endpoint: dynamodbUrl, region: "eu-west-2" }
		: { region: "eu-west-2" };
	const client = new DynamoDBClient(clientConfig);

	const addConnection = async (req: FastifyRequest, userId: string, connId: string): Promise<void> => {
		const logger = req.logger.child({ unit: "DynamodbConntracker", userId, connId });

		await client.send(new PutItemCommand({
			TableName: TABLE_NAME,
			Item: marshall({
				[USER_ID_ATTRIBUTE]: userId,
				[CONNECTION_ID_ATTRIBUTE]: connId,
				[DATE_CREATED_ATTRIBUTE]: new Date().toISOString()
			}),
			ReturnConsumedCapacity: "TOTAL"
		}));

		logger.debug("connection added");
	};

	const removeConnection = async (req: FastifyRequest, userId: string, connId: string): Promise<boolean> => {
		const logger = req.logger.child({ unit: "DynamodbConntracker", userId, connId });

		await client.send(new DeleteItemCommand({
			TableName: TABLE_NAME,
			Key: marshall({
				[USER_ID_ATTRIBUTE]: userId,
				[CONNECTION_ID_ATTRIBUTE]: connId
			}),
			ReturnConsumedCapacity: "TOTAL"
		}));

		logger.debug("connection removed");
		return false;
	};

	const getConnections = async (req: FastifyRequest, userId: string): Promise<string[]> => {
		const logger = req.logger.child({ unit: "DynamodbConntracker", userId });

		const connIds: string[] = [];
		let lastEvaluatedKey: Record<string, unknown> | undefined;

		do {
			logger.debug("fetching next page...");
			const response = await client.send(new QueryCommand({
				TableName: TABLE_NAME,
				KeyConditionExpression: "#uid = :userId",
				ExpressionAttributeNames: { "#uid": USER_ID_ATTRIBUTE },
				ExpressionAttributeValues: marshall({ ":userId": userId }),
				...(lastEvaluatedKey && { ExclusiveStartKey: marshall(lastEvaluatedKey) })
			}));

			for (const item of response.Items ?? []) {
				const record = unmarshall(item);
				connIds.push(record[CONNECTION_ID_ATTRIBUTE] as string);
			}

			lastEvaluatedKey = response.LastEvaluatedKey
				? unmarshall(response.LastEvaluatedKey) as Record<string, unknown>
				: undefined;
		} while (lastEvaluatedKey);

		return connIds;
	};

	return { addConnection, removeConnection, getConnections };
};
