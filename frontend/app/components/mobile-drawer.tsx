import {
	Button,
	Center,
	Drawer,
	HStack,
	Icon,
	IconButton,
	Input,
	InputGroup,
	Portal,
	Spinner,
	Text,
	VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { RiMenu2Line, RiPushpinLine, RiSearchLine } from "react-icons/ri";
import { chatClient } from "~/connect";

import { handleNewChat } from "~/routes/home";
import { categorizeConversationsByDate } from "~/utils/conversation";
import { useChatStore } from "~/stores/chat";
import { stripProtoMetadata, type Conversation } from "~/types";
import { QueryKeys } from "~/utils/query";
import { ConversationItem } from "~/components/conversation-item";

export function MobileDrawer() {
	const containerRef = useRef<HTMLDivElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);

	const { conversationSearch, setConversationSearch } = useChatStore();

	function doWithCloseMenu(fn: () => void) {
		fn();
		closeRef.current?.click();
	}

	const { data: conversations, isLoading: isConversationsLoading } = useQuery<
		Conversation[]
	>({
		queryKey: QueryKeys.conversations(),
		queryFn: async () => {
			const response = await chatClient.listConversations({});
			return stripProtoMetadata(response.conversations);
		},
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

	return (
		<Drawer.Root placement="start">
			<Drawer.Trigger asChild hideFrom="md">
				<IconButton variant="ghost" size="xs">
					<Icon as={RiMenu2Line} />
				</IconButton>
			</Drawer.Trigger>
			<Portal>
				<Drawer.Backdrop />
				<Drawer.Positioner>
					<Drawer.Content w={64} gap={2} ref={containerRef}>
						<Drawer.Body asChild>
							<VStack w="full" px={0}>
								<VStack w="full" p={2}>
									<Button
										w="full"
										size="sm"
										onClick={() => doWithCloseMenu(handleNewChat)}
									>
										New Chat
									</Button>
									<InputGroup startElement={<Icon as={RiSearchLine} />}>
										<Input
											placeholder="Search"
											size="sm"
											value={conversationSearch}
											onChange={(e) => setConversationSearch(e.target.value)}
										/>
									</InputGroup>
								</VStack>
								{isConversationsLoading && (
									<Center flex={1}>
										<Spinner size="sm" />
									</Center>
								)}
								<VStack
									w="full"
									overflowY="auto"
									hidden={isConversationsLoading}
								>
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
											<Text fontSize="sm" fontWeight="bolder">
												Pinned
											</Text>
										</HStack>
										{pinnedConversations?.map((conversation) => (
											<ConversationItem
												key={conversation.id}
												conversation={conversation}
												containerRef={
													containerRef as React.RefObject<HTMLDivElement>
												}
												closeMenuRef={
													closeRef as React.RefObject<HTMLButtonElement>
												}
											/>
										))}
										{/* Categorized Normal Section */}
										{categories.map(
											(category) =>
												category.data.length > 0 && (
													<VStack
														key={category.label}
														w="full"
														align="stretch"
														gap={0}
													>
														<Text
															fontSize="sm"
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
																containerRef={
																	containerRef as React.RefObject<HTMLDivElement>
																}
																closeMenuRef={
																	closeRef as React.RefObject<HTMLButtonElement>
																}
															/>
														))}
													</VStack>
												),
										)}
									</VStack>
								</VStack>
							</VStack>
						</Drawer.Body>
					</Drawer.Content>
				</Drawer.Positioner>
			</Portal>
			<Drawer.CloseTrigger ref={closeRef} />
		</Drawer.Root>
	);
}
