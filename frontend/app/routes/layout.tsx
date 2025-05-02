import { HStack, Box } from "@chakra-ui/react";
import { Outlet } from "react-router";

import { WebSocketClient } from "~/lib/websocket";
import { useChatStore } from "~/stores/chat";
import { addQueryMessage, updateConversationTitle } from "~/utils/query";
import { SideBar } from "~/components/sidebar";
import { RenameDialog } from "~/components/rename-dialog";

export async function clientLoader() {
	const webSocketUrl = import.meta.env.VITE_WEBSOCKET_URL;
	WebSocketClient.initialize(webSocketUrl);
	const webSocket = WebSocketClient.getInstance();
	webSocket.on("chat.stream.response", (data) => {
		const content = data.content;
		if (content) {
			useChatStore.getState().appendStreamContent(content);
		}
	});
	webSocket.on("chat.stream.done", (data) => {
		addQueryMessage({
			id: crypto.randomUUID(),
			conversationId: data.conversationId,
			content: useChatStore.getState().streamContent,
			role: "assistant",
			createdAt: new Date().toISOString(),
		});
		useChatStore.getState().clearStreamContent();
		useChatStore.getState().setIsStreaming(false);
	});
	webSocket.on("conversation.title.update", (data) => {
		updateConversationTitle(data.conversationId, data.title);
	});
}

clientLoader.hydrate = true as const;

export default function Layout() {
	return (
		<HStack align="stretch" w="full" h="dvh" gap={0}>
			<Box hideBelow="md">
				<SideBar />
			</Box>
			<Outlet />
			<RenameDialog />
		</HStack>
	);
}
