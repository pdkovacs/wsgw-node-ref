import { Span } from "@opentelemetry/api";
import { Logger } from "winston"; // the *import* makes this a module

declare global {
	namespace Express {
		interface Request {
			logger: Logger;
			_span: Span;
		}
	}
}
