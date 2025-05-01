import {
	Button,
	Center,
	CloseButton,
	Heading,
	HStack,
	Icon,
	IconButton,
	Input,
	InputGroup,
	Spacer,
	Spinner,
	Text,
	VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { RiAddLine, RiBook2Line, RiPushpinLine, RiSearchLine } from "react-icons/ri";

import {
	ChatBubble,
	StreamBubble,
	StreamContentBubble,
} from "~/components/chat-bubble";
import { ChatInput } from "~/components/chat-input";
import { ConversationItem } from "~/components/conversation-item";
import { ModelsMenu } from "~/components/models-menu";
import { chatClient } from "~/connect";
import { WebSocketClient } from "~/lib/websocket";
import { useChatStore } from "~/stores/chat";
import {
	addQueryMessage,
	QueryKeys,
	updateConversationTitle,
} from "~/utils/query";
import { stripProtoMetadata, type Conversation, type Message } from "~/types";
import { MobileDrawer } from "~/components/mobile-drawer";
import { RenameDialog } from "~/components/rename-dialog";
import { categorizeConversationsByDate } from "~/utils/conversation";

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

export function handleNewChat() {
	useChatStore.getState().setConversationId(null);
	document.getElementById("chat-input")?.focus();
}

export function handleSelectConversation(conversationId: string) {
	useChatStore.getState().setConversationId(conversationId);
	document.getElementById("chat-input")?.focus();
}

export default function Home() {
	const {
		conversationId,
		streamContent,
		isStreaming,
		conversationSearch,
		setConversationSearch,
	} = useChatStore();

	const messageEndRef = useRef<HTMLDivElement>(null);

	const endElement = conversationSearch ? (
		<CloseButton size="xs" me="-2" onClick={() => setConversationSearch("")} />
	) : undefined;

	const { data: conversations, isLoading: isConversationsLoading } = useQuery<
		Conversation[]
	>({
		queryKey: QueryKeys.conversations(),
		queryFn: async () => {
			const response = await chatClient.listConversations({});
			return stripProtoMetadata(response.conversations);
		},
	});

	const { data: messages, isLoading: isMessagesLoading } = useQuery<Message[]>({
		queryKey: QueryKeys.messages(conversationId || ""),
		queryFn: async () => {
			const response = await chatClient.listMessages({
				conversationId: conversationId || undefined,
			});
			return stripProtoMetadata(response.messages);
		},
		enabled: !!conversationId,
	});

	const filteredConversations = conversations?.filter((conversation) =>
		conversation.title.toLowerCase().includes(conversationSearch.toLowerCase()),
	);

	const pinnedConversations = filteredConversations
		?.filter((conversation) => conversation.pinned)
		// Sort pinned conversations by updatedAt descending
		.sort(
			(a, b) =>
				new Date(b.updatedAt || b.createdAt).getTime() -
				new Date(a.updatedAt || a.createdAt).getTime(),
		);

	const normalConversations = filteredConversations?.filter(
		(conversation) => !conversation.pinned,
	);

	const categorizedNormalConversations =
		categorizeConversationsByDate(normalConversations);

	const categories = [
		{ label: "Today", data: categorizedNormalConversations.today },
		{ label: "Yesterday", data: categorizedNormalConversations.yesterday },
		{
			label: "Previous 7 days",
			data: categorizedNormalConversations.previous7Days,
		},
		{
			label: "Previous 30 days",
			data: categorizedNormalConversations.previous30Days,
		},
		{ label: "Older", data: categorizedNormalConversations.older },
	];

	useEffect(() => {
		messageEndRef.current?.scrollIntoView({ behavior: "instant" });
	}, [messages, streamContent]);

	return (
		<HStack align="stretch" w="full" h="dvh" gap={0}>
			<VStack w={64} borderRightWidth={1} gap={0} flexShrink={0} hideBelow="md">
				<VStack w="full" p={2}>
					<Button w="full" size="sm" onClick={() => handleNewChat()}>
						New Chat
					</Button>
					<InputGroup
						startElement={<Icon as={RiSearchLine} />}
						endElement={endElement}
					>
						<Input
							placeholder="Search"
							size="sm"
							value={conversationSearch}
							onChange={(e) => setConversationSearch(e.target.value)}
						/>
					</InputGroup>
					<Button size="sm" w="full" variant="subtle" colorPalette="blue">
						<Icon as={RiBook2Line} />
						Knowledges
					</Button>
				</VStack>
				{isConversationsLoading && (
					<Center flex={1}>
						<Spinner size="sm" />
					</Center>
				)}
				<VStack w="full" overflowY="auto" hidden={isConversationsLoading}>
					<VStack w="full" p={2} gap={0}>
						<HStack
							w="full"
							justifyContent="flex-start"
							mb={1}
							gap={1}
							px={1}
							color="fg.info"
							hidden={pinnedConversations?.length === 0}
						>
							<Icon as={RiPushpinLine} />
							<Text fontSize="xs" fontWeight="bolder">
								Pinned
							</Text>
						</HStack>
						{pinnedConversations?.map((conversation) => (
							<ConversationItem
								key={conversation.id}
								conversation={conversation}
							/>
						))}
						{categories.map(
							(category) =>
								category.data.length > 0 && (
									<VStack key={category.label} w="full" align="stretch" gap={0}>
										<Text
											fontSize="xs"
											fontWeight="bolder"
											color="fg.info"
											my={1}
											px={1}
										>
											{category.label}
										</Text>
										{category.data.map((conversation) => (
											<ConversationItem
												key={conversation.id}
												conversation={conversation}
											/>
										))}
									</VStack>
								),
						)}
					</VStack>
				</VStack>
			</VStack>
			<VStack w="full" flex={1}>
				<HStack w="full" p={1} px={2}>
					<MobileDrawer />
					<ModelsMenu />
					<Spacer />
					<IconButton
						rounded="full"
						size="xs"
						variant="ghost"
						onClick={() => handleNewChat()}
					>
						<Icon as={RiAddLine} size="md" color="fg.muted" flexShrink={0} />
					</IconButton>
				</HStack>
				{!conversationId && (
					<VStack flex={1} justifyContent="center" alignItems="center">
						<Heading size="2xl">How can I help you?</Heading>
						<HStack color="fg.muted">
							Ask me anything, I'm here to help you.
						</HStack>
					</VStack>
				)}
				{isMessagesLoading && (
					<Center flex={1}>
						<Spinner size="sm" />
					</Center>
				)}
				<VStack
					flex={1}
					p={2}
					w="full"
					overflowY="auto"
					hidden={!conversationId || isMessagesLoading}
				>
					{messages?.map((message) => (
						<ChatBubble key={message.id} message={message} />
					))}
					{isStreaming && streamContent !== "" && (
						<StreamContentBubble streamContent={streamContent} />
					)}
					{isStreaming && streamContent === "" && <StreamBubble />}
					<div ref={messageEndRef} />
				</VStack>
				<ChatInput />
			</VStack>
			<RenameDialog />
		</HStack>
	);
}
