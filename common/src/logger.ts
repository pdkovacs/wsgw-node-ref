import { isNil } from "lodash";
import winston from "winston";

export type LoggerFactory = (label: string) => winston.Logger;
export type LogLevel = "info" | "error" | "debug" | "warn";

let defaultLogLevel: LogLevel = "info";

// Keep track of the loggers by label, so they can be reconfigured, if necessary
type Loggers = Record<string, winston.Logger>;
const loggers: Loggers = {};

export const getLogger = (label: string): winston.Logger => {
	const cached = loggers[label];

	if (!isNil(cached)) {
		return cached;
	} else {
		const logger = winston.createLogger({
			level: defaultLogLevel,
			format: winston.format.combine(
				winston.format.splat(),
				winston.format.timestamp(),
				winston.format.label({ label }),
				winston.format.json()
			),
			transports: [new winston.transports.Console()]
		});
		loggers[label] = logger;
		return logger;
	}
};

export const setDefaultLogLevel = (logLevel: LogLevel): void => {
	defaultLogLevel = logLevel;
};

export const updateDefaultLogLevel = (logLevel: LogLevel): void => {
	defaultLogLevel = logLevel;
	for (const logger of Object.values(loggers)) {
		if (isNil(logger)) {
			return;
		}
		logger.level = logLevel;
	};
};

export const getDefaultLogLevel = (): string => defaultLogLevel;
