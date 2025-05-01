import { queryClient } from "~/root";
import type { Conversation, Message } from "~/types";

export const QueryKeys = {
	messages: (conversationId: string) => ["messages", conversationId],
	conversations: () => ["conversations"],
};

export function addQueryMessage(message: Message) {
	queryClient.setQueryData(
		QueryKeys.messages(message.conversationId),
		(prev: Message[] | undefined) => {
			if (!prev) {
				return [message];
			}
			return [...prev, message];
		},
	);
}

export function updateConversationTitle(conversationId: string, title: string) {
	queryClient.setQueryData(
		QueryKeys.conversations(),
		(prev: Conversation[]) => {
			return prev.map((conversation) =>
				conversation.id === conversationId
					? { ...conversation, title }
					: conversation,
			);
		},
	);
}

export function updateConversationUpdatedAt(conversationId: string) {
	queryClient.setQueryData(
		QueryKeys.conversations(),
		(prev: Conversation[]) => {
			if (!prev) return [];
			return prev.map((conversation) =>
				conversation.id === conversationId
					? { ...conversation, updatedAt: new Date().toISOString() }
					: conversation,
			);
		},
	);
}

export function pinConversation(conversationId: string) {
	queryClient.setQueryData(
		QueryKeys.conversations(),
		(prev: Conversation[]) => {
			return prev.map((conversation) =>
				conversation.id === conversationId
					? { ...conversation, pinned: true }
					: conversation,
			);
		},
	);
}

export function unpinConversation(conversationId: string) {
	queryClient.setQueryData(
		QueryKeys.conversations(),
		(prev: Conversation[]) => {
			return prev.map((conversation) =>
				conversation.id === conversationId
					? { ...conversation, pinned: false }
					: conversation,
			);
		},
	);
}
