import { env } from "cloudflare:workers";
import { createContextValues } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

import { createWorkerHandler } from "~/connectrpc-handler";
import {
	ChatService,
	CreateConversationResponseSchema,
	DeleteConversationResponseSchema,
	ListConversationsResponseSchema,
	ListMessagesResponseSchema,
	ListModelsResponseSchema,
	PinConversationResponseSchema,
	RenameConversationResponseSchema,
	SpeechToTextResponseSchema,
	StreamTTSResponseSchema,
	UnpinConversationResponseSchema,
} from "~/gen/chat/v1/chat_pb";
import { envStore } from "~/store-context";
import { getTTSChunkingPrompt } from "~/prompts/tts";

const TTSInputSchema = z.object({
	chunks: z.array(z.string()),
});

const TTS_SHORT_TEXT_WORD_THRESHOLD = 100;

export const handler = createWorkerHandler({
	contextValues(req, env, ctx) {
		return createContextValues().set(envStore, env);
	},
	routes(router) {
		router.service(ChatService, {
			listModels: async (req, ctx) => {
				const models = await env.AI.models({
					task: "Text Generation",
				});
				const response = create(ListModelsResponseSchema, {
					models: models.map((model) => ({
						id: model.id,
						name: model.name,
						description: model.description,
					})),
				});
				return response;
			},
			listConversations: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				const conversations = await stub.listConversations();
				const response = create(ListConversationsResponseSchema, {
					conversations: conversations.map((conversation) => ({
						id: conversation.id,
						title: conversation.title ?? undefined,
						pinned: conversation.pinned ?? false,
						createdAt: conversation.created_at ?? undefined,
						updatedAt: conversation.updated_at ?? undefined,
					})),
				});
				return response;
			},
			createConversation: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				const conversation = await stub.createConversation();
				const response = create(CreateConversationResponseSchema, {
					conversation: {
						id: conversation.id,
						title: conversation.title ?? undefined,
						pinned: conversation.pinned ?? false,
						createdAt: conversation.created_at ?? undefined,
						updatedAt: conversation.updated_at ?? undefined,
					},
				});
				return response;
			},
			deleteConversation: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				await stub.deleteConversation(req.conversationId);
				return create(DeleteConversationResponseSchema, {});
			},
			renameConversation: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				await stub.renameConversation(req.conversationId, req.title);
				return create(RenameConversationResponseSchema, {});
			},
			pinConversation: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				await stub.pinConversation(req.conversationId);
				return create(PinConversationResponseSchema, {});
			},
			unpinConversation: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				await stub.unpinConversation(req.conversationId);
				return create(UnpinConversationResponseSchema, {});
			},
			listMessages: async (req, ctx) => {
				const id: DurableObjectId =
					env.WORKERS_AI_DURABLE_OBJECT.idFromName("foo");
				const stub = env.WORKERS_AI_DURABLE_OBJECT.get(id);
				const messages = await stub.listMessages({
					conversationId: req.conversationId,
				});
				const response = create(ListMessagesResponseSchema, {
					messages: messages.map((message) => ({
						id: message.id,
						conversationId: message.conversation_id,
						role: message.role,
						content: message.content,
						createdAt: message.created_at ?? undefined,
					})),
				});
				return response;
			},
			streamTTS: async function* (req, ctx) {
				try {
					const words = req.text.split(/\s+/).filter(Boolean);
					let chunks: string[];

					if (words.length < TTS_SHORT_TEXT_WORD_THRESHOLD) {
						chunks = [req.text];
					} else {
						const response = await env.AI.run(
							"@cf/meta/llama-4-scout-17b-16e-instruct" as unknown as any,
							{
								messages: [
									{
										role: "system",
										content: getTTSChunkingPrompt(req.text),
									},
								],
								response_format: zodResponseFormat(TTSInputSchema, "tts_input"),
							},
							{
								gateway: {
									id: env.CLOUDFLARE_AI_GATEWAY_ID,
									cacheTtl: 60 * 60 * 24 * 30,
								},
							},
						);
						const result = response as unknown as {
							response: z.infer<typeof TTSInputSchema>;
						};
						chunks = result.response.chunks;
					}

					for (const chunk of chunks) {
						if (!chunk || chunk.trim().length === 0) {
							continue;
						}
						const ttsResponse = await env.AI.run(
							"@cf/myshell-ai/melotts",
							{
								prompt: chunk,
							},
							{
								gateway: {
									id: env.CLOUDFLARE_AI_GATEWAY_ID,
									cacheTtl: 60 * 60 * 24 * 30,
								},
							},
						);
						const audioData = ttsResponse.valueOf() as {
							audio: string;
						};
						const data = base64ToBytes(audioData.audio);
						yield create(StreamTTSResponseSchema, {
							audio: data,
						});
					}
				} catch (error) {
					console.error("Error in streamTTS:", error);
				}
			},
			speechToText: async (req, ctx) => {
				const result = await env.AI.run("@cf/openai/whisper", {
					audio: bytesToNumberArray(req.audio),
				});
				return create(SpeechToTextResponseSchema, {
					text: result.text,
				});
			},
		});
	},
});

function base64ToBytes(base64: string) {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.codePointAt(0) ?? 0);
}

function bytesToNumberArray(bytes: Uint8Array) {
	return Array.from(bytes).map((byte) => byte);
}
