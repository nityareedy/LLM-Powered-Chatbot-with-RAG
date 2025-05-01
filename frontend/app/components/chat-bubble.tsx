import {
	Box,
	HStack,
	Icon,
	IconButton,
	VStack,
	Clipboard,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { RiVolumeMuteLine, RiVolumeUpLine } from "react-icons/ri";
import ReactMarkdown from "react-markdown";

import { Prose } from "~/components/ui/prose";
import { chatClient } from "~/connect";
import type { Message } from "~/types";

interface ChatBubbleProps {
	message: Message;
}

export function StreamBubble() {
	return (
		<HStack w="full" maxW="3xl" mx="auto" p={2}>
			<Box
				animation="pulse 2s linear infinite"
				boxSize={4}
				rounded="full"
				bg="bg.inverted"
				display="inline-block"
				verticalAlign="middle"
				mx={2}
			/>
		</HStack>
	);
}

export function StreamContentBubble({
	streamContent,
}: {
	streamContent: string;
}) {
	return (
		<HStack w="full" maxW="3xl" mx="auto">
			<Prose rounded="2xl" p={2} px={3}>
				<ReactMarkdown
					components={{
						p: "span",
					}}
				>
					{streamContent}
				</ReactMarkdown>
				<Box
					animation="pulse 2s linear infinite"
					boxSize={4}
					rounded="full"
					bg="bg.inverted"
					display="inline-block"
					verticalAlign="middle"
					mx={2}
				/>
			</Prose>
		</HStack>
	);
}

export function ChatBubble({ message }: ChatBubbleProps) {
	switch (message.role) {
		case "user":
			return <UserBubble message={message} />;
		case "assistant":
			return <RobotBubble message={message} />;
	}
}

export function UserBubble({ message }: ChatBubbleProps) {
	return (
		<HStack w="full" flexDir="row-reverse" maxW="3xl" mx="auto">
			<Prose bg="bg.muted" rounded="2xl" p={2} px={3} roundedBottomRight={0}>
				<ReactMarkdown>{message.content}</ReactMarkdown>
			</Prose>
		</HStack>
	);
}

export function RobotBubble({ message }: ChatBubbleProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	function playAudio() {
		if (isPlaying) {
			stopAudio();
			return;
		}
		setIsPlaying(true);
		const mediaSource = new MediaSource();
		const audio = new Audio();
		audioRef.current = audio;
		audio.src = URL.createObjectURL(mediaSource);
		mediaSource.addEventListener("sourceopen", async () => {
			const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
			const stream = chatClient.streamTTS({
				text: message.content,
			});
			for await (const chunk of stream) {
				if (sourceBuffer.updating) {
					await new Promise((resolve) =>
						sourceBuffer.addEventListener("updateend", resolve, { once: true }),
					);
				}
				sourceBuffer.appendBuffer(chunk.audio);
			}
			// Wait for the final update to complete before ending the stream
			if (sourceBuffer.updating) {
				await new Promise((resolve) =>
					sourceBuffer.addEventListener("updateend", resolve, { once: true }),
				);
			}
			mediaSource.endOfStream();
		});
		audio.onended = () => {
			audioRef.current = null;
			setIsPlaying(false);
		};
		audio.onerror = () => {
			audioRef.current = null;
			if (audio.src) {
				URL.revokeObjectURL(audio.src);
			}
			setIsPlaying(false);
		};
		audio.play();
	}

	function stopAudio() {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
		setIsPlaying(false);
	}

	useEffect(() => {
		return () => {
			stopAudio();
		};
	}, []);

	return (
		<HStack w="full" maxW="3xl" mx="auto">
			<VStack w="full" gap={0} alignItems="flex-start">
				<Prose rounded="2xl" p={2} px={3}>
					<ReactMarkdown
						components={{
							p: "span",
						}}
					>
						{message.content}
					</ReactMarkdown>
				</Prose>
				<HStack px={3} gap={0.5}>
					<IconButton
						variant="ghost"
						size="xs"
						color="fg.muted"
						onClick={playAudio}
					>
						<Icon as={isPlaying ? RiVolumeMuteLine : RiVolumeUpLine} />
					</IconButton>
					<Clipboard.Root value={message.content}>
						<Clipboard.Trigger asChild>
							<IconButton variant="ghost" size="xs" color="fg.muted">
								<Clipboard.Indicator />
							</IconButton>
						</Clipboard.Trigger>
					</Clipboard.Root>
				</HStack>
			</VStack>
		</HStack>
	);
}
