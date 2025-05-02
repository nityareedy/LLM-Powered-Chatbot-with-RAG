import {
	VStack,
	HStack,
	Textarea,
	Spacer,
	IconButton,
	Icon,
} from "@chakra-ui/react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { chatClient } from "~/connect";
import { RiArrowUpLine } from "react-icons/ri";
import { WebSocketClient } from "~/lib/websocket";
import { useChatStore } from "~/stores/chat";
import {
	addQueryConversation,
	addQueryMessage,
	updateConversationUpdatedAt,
} from "~/utils/query";
import { stripProtoMetadata } from "~/types";

export function ChatInput() {
	const [isComposing, setIsComposing] = useState(false);
	const [content, setContent] = useState("");

	const webSocket = WebSocketClient.getInstance();
	const { conversationId, setConversationId, setIsStreaming } = useChatStore();

	const createConversationMutation = useMutation({
		mutationFn: async () => {
			const response = await chatClient.createConversation({});
			return stripProtoMetadata(response.conversation);
		},
		onSettled(data, error, variables, context) {
			if (data) {
				setConversationId(data.id);
				addQueryConversation(data);
			}
		},
	});

	async function handleSendMessage() {
		if (content.trim() === "") return;
		let convId = conversationId;
		if (!convId) {
			const conversation = await createConversationMutation.mutateAsync();
			if (conversation) {
				convId = conversation.id;
			}
		}
		if (!convId) return;
		updateConversationUpdatedAt(convId);
		setIsStreaming(true);
		const id = crypto.randomUUID();
		addQueryMessage({
			id,
			conversationId: convId,
			role: "user",
			content,
			createdAt: new Date().toISOString(),
		});
		webSocket.send({
			type: "chat.stream.create",
			eventId: id,
			conversationId: convId,
			content,
			model: useChatStore.getState().model,
		});
		setContent("");
	}

	return (
		<HStack w="full" p={2}>
			<VStack
				w="full"
				rounded="2xl"
				borderWidth={1}
				p={1}
				gap={0}
				maxW="3xl"
				mx="auto"
			>
				<HStack w="full">
					<Textarea
						id="chat-input"
						spellCheck={false}
						placeholder="Type a message, press enter to send"
						value={content}
						resize="none"
						autoFocus
						border="none"
						focusRingWidth={0}
						onChange={(e) => setContent(e.target.value)}
						onCompositionStart={() => setIsComposing(true)}
						onCompositionEnd={() => setIsComposing(false)}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" &&
								!e.shiftKey &&
								!isComposing &&
								content.trim() !== ""
							) {
								e.preventDefault();
								handleSendMessage();
							}
						}}
					/>
				</HStack>
				<HStack w="full" px={1}>
					<Spacer />
					<IconButton
						onClick={handleSendMessage}
						disabled={content.trim() === ""}
						size="xs"
						rounded="full"
					>
						<Icon as={RiArrowUpLine} size="sm" flexShrink={0} />
					</IconButton>
				</HStack>
			</VStack>
		</HStack>
	);
}
