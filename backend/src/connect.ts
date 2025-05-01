import { env } from "cloudflare:workers";
import { createContextValues } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import OpenAI from "openai";

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
	StreamTTSResponseSchema,
	UnpinConversationResponseSchema,
} from "~/gen/chat/v1/chat_pb";
import { envStore } from "~/store-context";

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
					messages,
				});
				return response;
			},
			streamTTS: async function* (req, ctx) {
				try {
					const openAI = new OpenAI({
						apiKey: env.OPENAI_API_KEY,
					});
					const response = await openAI.audio.speech.create({
						model: "gpt-4o-mini-tts",
						input: req.text,
						voice: "nova",
					});
					const reader = response.body?.getReader();
					if (!reader) {
						throw new Error("No reader");
					}

					const bufferSize = 16 * 1024;
					let buffer = new Uint8Array(bufferSize);
					let bufferFill = 0;
					let finished = false;

					while (!finished) {
						try {
							const { done, value } = await reader.read();
							if (done) {
								finished = true;
								if (bufferFill > 0) {
									yield create(StreamTTSResponseSchema, {
										audio: buffer.slice(0, bufferFill),
									});
								}
								break;
							}

							if (value) {
								let valueOffset = 0;
								while (valueOffset < value.length) {
									const spaceInBuffer = bufferSize - bufferFill;
									const bytesToCopy = Math.min(
										value.length - valueOffset,
										spaceInBuffer,
									);

									buffer.set(
										value.subarray(valueOffset, valueOffset + bytesToCopy),
										bufferFill,
									);
									bufferFill += bytesToCopy;
									valueOffset += bytesToCopy;

									if (bufferFill === bufferSize) {
										yield create(StreamTTSResponseSchema, {
											audio: buffer,
										});
										buffer = new Uint8Array(bufferSize);
										bufferFill = 0;
									}
								}
							}
						} catch (readError) {
							console.error("Error reading from stream:", readError);
							throw readError;
						}
					}
				} catch (error) {
					console.error("Error in streamTTS:", error);
				}
			},
		});
	},
});
