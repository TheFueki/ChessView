import { create } from "zustand";

type RtcStatus = "idle" | "requesting_media" | "ready" | "connecting" | "connected" | "failed";

interface RtcPeerState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  status: RtcStatus;
  error: string | null;

  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  setStatus: (status: RtcStatus) => void;
  setError: (error: string | null) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  reset: () => void;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export const useRtcPeerStore = create<RtcPeerState>((set, get) => ({
  localStream: null,
  remoteStream: null,
  isCameraOn: true,
  isMicOn: true,
  status: "idle",
  error: null,

  setLocalStream: (stream) =>
    set((state) => {
      if (state.localStream && state.localStream !== stream) {
        stopStream(state.localStream);
      }

      return {
        localStream: stream,
        isCameraOn: stream ? stream.getVideoTracks().some((track) => track.enabled) : false,
        isMicOn: stream ? stream.getAudioTracks().some((track) => track.enabled) : false,
      };
    }),

  setRemoteStream: (stream) =>
    set((state) => {
      if (state.remoteStream && state.remoteStream !== stream) {
        stopStream(state.remoteStream);
      }

      return { remoteStream: stream };
    }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error }),

  toggleCamera: () => {
    const { localStream, isCameraOn } = get();
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !isCameraOn;
    });
    set({ isCameraOn: !isCameraOn });
  },

  toggleMic: () => {
    const { localStream, isMicOn } = get();
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMicOn;
    });
    set({ isMicOn: !isMicOn });
  },

  reset: () =>
    set((state) => {
      stopStream(state.localStream);
      stopStream(state.remoteStream);

      return {
        localStream: null,
        remoteStream: null,
        isCameraOn: true,
        isMicOn: true,
        status: "idle",
        error: null,
      };
    }),
}));
