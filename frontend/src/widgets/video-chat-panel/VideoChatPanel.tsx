import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, ShieldCheck, VideoOff } from "lucide-react";
import { useMessageStore } from "@/entities/message";
import { useRtcPeerStore } from "@/entities/rtc-peer";
import { useUserStore } from "@/entities/user";
import { useConnectRtc } from "@/features/connect-rtc";
import { ChatInput, useGameChat } from "@/features/send-chat-message";
import { ToggleCameraButton, ToggleMicButton } from "@/features/toggle-media-devices";
import { http } from "@/shared/api";
import type { FaceVerificationProfileResponse, FaceVerificationSessionResponse } from "@/shared/types";
import { Spinner } from "@/shared/ui";

const FACE_TEMPLATE_PROVIDER = "local_face_template";

function formatTime(value: string) {
  const date = new Date(value);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function attachStream(element: HTMLVideoElement | null, stream: MediaStream | null, muted: boolean) {
  if (!element) {
    return;
  }

  if (element.srcObject !== stream) {
    element.srcObject = stream;
  }

  element.muted = muted;
  if (stream) {
    void element.play().catch(() => undefined);
  }
}

function remoteFallback(status: string, error: string | null, hasLocalStream: boolean) {
  if (error) {
    return error;
  }

  if (!hasLocalStream) {
    return "Allow camera and microphone access to start video.";
  }

  if (status === "connecting") {
    return "Connecting to your opponent...";
  }

  if (status === "connected") {
    return "Opponent video is unavailable right now.";
  }

  return "Waiting for your opponent to join video.";
}

function captureFaceSample(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to read camera frame");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function VideoChatPanel({ gameId }: { gameId?: string }) {
  useGameChat();
  useConnectRtc();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [faceSession, setFaceSession] = useState<FaceVerificationSessionResponse | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [isVerifyingFace, setIsVerifyingFace] = useState(false);

  const messages = useMessageStore((state) => state.messages);
  const isLoading = useMessageStore((state) => state.isLoading);
  const chatError = useMessageStore((state) => state.error);
  const userId = useUserStore((state) => state.user?.id);

  const localStream = useRtcPeerStore((state) => state.localStream);
  const remoteStream = useRtcPeerStore((state) => state.remoteStream);
  const rtcStatus = useRtcPeerStore((state) => state.status);
  const rtcError = useRtcPeerStore((state) => state.error);
  const isCameraOn = useRtcPeerStore((state) => state.isCameraOn);
  const isMicOn = useRtcPeerStore((state) => state.isMicOn);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    attachStream(localVideoRef.current, localStream, true);
  }, [localStream]);

  useEffect(() => {
    attachStream(remoteVideoRef.current, remoteStream, false);
  }, [remoteStream]);

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        const isMine = message.user_id === userId;

        return (
          <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                isMine
                  ? "bg-violet-600 text-white"
                  : "border border-neutral-800 bg-neutral-900 text-neutral-100"
              }`}
            >
              <div
                className={`text-[10px] uppercase tracking-[0.2em] ${
                  isMine ? "text-violet-100/80" : "text-neutral-500"
                }`}
              >
                {isMine ? "You" : message.username}
              </div>
              <div className="mt-1 break-words text-sm leading-5">{message.content}</div>
              <div
                className={`mt-1 text-[11px] ${
                  isMine ? "text-violet-100/80" : "text-neutral-500"
                }`}
              >
                {formatTime(message.created_at)}
              </div>
            </div>
          </div>
        );
      }),
    [messages, userId],
  );

  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getTracks().length > 0);
  const hasLocalVideo = Boolean(localStream && localStream.getTracks().length > 0);

  const verifyFaceFromVideo = async () => {
    const video = localVideoRef.current;
    if (!video || !hasLocalVideo) {
      setFaceError("Turn on camera before verifying identity.");
      return;
    }

    setIsVerifyingFace(true);
    setFaceError(null);
    try {
      const faceSample = captureFaceSample(video);
      const profiles = await http.get<FaceVerificationProfileResponse[]>("/identity/face-verification/me");
      const hasFaceTemplate = profiles.some(
        (profile) => profile.provider === FACE_TEMPLATE_PROVIDER && profile.status === "enrolled",
      );
      if (!hasFaceTemplate) {
        setFaceError("Enroll Face ID from Settings before verifying a live game.");
        return;
      }
      const session = await http.post<FaceVerificationSessionResponse>("/identity/face-verification/faces/verify", {
        game_id: gameId ?? null,
        face_sample: faceSample,
      });
      setFaceSession(session);
    } catch (error) {
      setFaceError(error instanceof Error ? error.message : "Face verification failed");
    } finally {
      setIsVerifyingFace(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-shrink-0 bg-neutral-900">
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-800">
          {hasRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <VideoOff className="h-6 w-6 text-neutral-600" />
              <span className="max-w-[200px] text-xs leading-relaxed text-neutral-500">
                {remoteFallback(rtcStatus, rtcError, hasLocalVideo)}
              </span>
            </div>
          )}

          {rtcStatus === "requesting_media" || rtcStatus === "connecting" ? (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/80 px-3 py-1 text-xs text-neutral-300">
              <Spinner size="sm" />
              {rtcStatus === "requesting_media" ? "Requesting camera..." : "Connecting video..."}
            </div>
          ) : null}
        </div>

        <div className="absolute bottom-2 right-2 h-20 w-28 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-800 shadow-lg">
          {hasLocalVideo ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${isCameraOn ? "" : "opacity-30"}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-neutral-500">
              {rtcError ? "Permissions needed" : "You"}
            </div>
          )}
          <div className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] ${isMicOn ? "bg-neutral-950/70 text-neutral-300" : "bg-red-600/80 text-red-100"}`}>
            {isMicOn ? "Mic on" : "Muted"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-neutral-800 px-3 py-2.5">
        <ToggleCameraButton />
        <ToggleMicButton />
        <button
          type="button"
          onClick={verifyFaceFromVideo}
          disabled={!hasLocalVideo || isVerifyingFace}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVerifyingFace ? <Spinner size="sm" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {faceSession?.status === "verified" ? "Identity verified" : "Verify identity"}
        </button>
      </div>

      {faceError || faceSession ? (
        <div className="border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
          {faceError ? faceError : `Live face check: ${faceSession?.status}`}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-neutral-800/50 px-3 py-2">
          <MessageSquare className="h-3.5 w-3.5 text-neutral-500" />
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Chat</span>
        </div>
        <div ref={containerRef} className="flex-1 space-y-3 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : messages.length > 0 ? (
            renderedMessages
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <MessageSquare className="h-5 w-5 text-neutral-700" />
              <span className="max-w-[180px] text-xs leading-relaxed text-neutral-500">
                {chatError ? chatError : "No messages yet. Say hello!"}
              </span>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <ChatInput />
        </div>
      </div>
    </div>
  );
}

export default VideoChatPanel;
