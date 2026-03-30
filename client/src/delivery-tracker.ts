// TODO:
// For now, recipients will be usernames, but it really should be connectionIds (userDevices aka. destinations).

import { isEmpty, isNil, size } from "lodash";
import { Message } from "./message.js";

interface PendingDeliveries {
	readonly pending: Record<string, Message>;
	notifyEmpty?: () => Promise<void>;
}

// The test-client could actually know of the connectionIds: see WSGW_ACK_NEW_CONN_WITH_CONN_ID (AckNewConnWithConnId)
export interface DeliveryTracker {
	readonly getMessage: (msgId: string) => Message | null;
	readonly markDelivered: (msgId: string, recipient: string) => Message | null;
	readonly watchDraining: (notifyEmpty: () => Promise<void>) => void;
}

export const createDeliveryTracker = (): DeliveryTracker => {
	const pendingDeliveries: PendingDeliveries = {
		pending: {}
	};

	const deliveryTracker: DeliveryTracker = {
		getMessage: getMessage(pendingDeliveries),
		markDelivered: markDelivered(pendingDeliveries),
		watchDraining: watchDraining(pendingDeliveries)
	};
	return deliveryTracker;
};

export const getMessage = (pendingDeliveries: PendingDeliveries) => (msgId: string): Message | null => {
	const pending = pendingDeliveries.pending[msgId];

	if (isNil(pending)) {
		return null;
	}

	return pending;
};

// Returns the message, if it was delivered to all recipients
const markDelivered = (pendingDeliveries: PendingDeliveries) => (msgId: string, recipient: string): Message | null => {
	try {
		const pending = pendingDeliveries.pending[msgId];
		if (isNil(pending)) {
			return null;
		}

		const updatedRecipList: string[] = [];

		for (const recip of pending.recipients) {
			if (recip === recipient) {
				continue;
			}
			updatedRecipList.push(recip);
		}

		if (isEmpty(updatedRecipList)) {
			delete pendingDeliveries.pending[msgId];
			return pending;
		}

		const message: Message = {
			...pending,
			recipients: updatedRecipList
		};
		pendingDeliveries.pending[msgId] = message;

		return null;
	} finally {
		if (!isNil(pendingDeliveries.notifyEmpty) && isEmpty(pendingDeliveries.pending)) {
			pendingDeliveries.notifyEmpty();
		}
	}

};

const watchDraining = (pendingDeliveries: PendingDeliveries) => (notifyEmpty: () => Promise<void>) => {
	if (size(pendingDeliveries) == 0) {
		notifyEmpty();
	}

	pendingDeliveries.notifyEmpty = notifyEmpty;
};

export const selectRecipients = (candidates: string[], howMany: number) => {
	const n = candidates.length;
	if (howMany >= n) {
		return candidates;
	}

	const result = [];
	let k = howMany; // elements still needed

	for (let i = 0; i < n; i++) {
		const remaining = n - i; // elements left to visit (including current)

		// Probability of selecting current element = k / remaining
		if (Math.floor(Math.random() * remaining) < k) {
			result.push(candidates[i]);
			k--; // one less element needed
			if (k === 0) {
				break; // done selecting
			}
		}
	}

	return result;
};

