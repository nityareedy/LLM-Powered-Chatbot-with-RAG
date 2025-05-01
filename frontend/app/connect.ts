import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { ChatService } from "~/gen/chat/v1/chat_pb";

export const transport = createConnectTransport({
	baseUrl: import.meta.env.VITE_API_URL,
});

export const chatClient = createClient(ChatService, transport);
