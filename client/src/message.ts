import { PasswordCredentials } from "#common/security/password-credentials.js";
import { Span } from "@opentelemetry/api";

type recipientName = string;

export interface Message {
	readonly testRunId: string;
	readonly id: string;
	readonly text: string;
	readonly sender: PasswordCredentials;
	readonly recipients: recipientName[];
	readonly sentAt: Date;
	readonly span: Span;
}
