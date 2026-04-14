import { useEffect, useRef } from "react";
import { useGameStore } from "@/entities/game";
import { useRtcPeerStore } from "@/entities/rtc-peer";
import { useUserStore } from "@/entities/user";
import { wsClient } from "@/shared/api";
import { getLocalMediaStream, PeerConnection } from "@/shared/lib/webrtc";

const RTC_ERROR_CODES = new Set(["NOT_IN_GAME", "WS_NOT_READY"]);

function mapConnectionState(state: RTCPeerConnectionState) {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "failed":
    case "disconnected":
    case "closed":
      return "failed";
    default:
      return "ready";
  }
}

export function useConnectRtc() {
  const accessToken = useUserStore((state) => state.accessToken);
  const gameId = useGameStore((state) => state.gameId);
  const myColor = useGameStore((state) => state.myColor);
  const setLocalStream = useRtcPeerStore((state) => state.setLocalStream);
  const setRemoteStream = useRtcPeerStore((state) => state.setRemoteStream);
  const setStatus = useRtcPeerStore((state) => state.setStatus);
  const setError = useRtcPeerStore((state) => state.setError);
  const resetRtc = useRtcPeerStore((state) => state.reset);

  const peerRef = useRef<PeerConnection | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const initiatedOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!gameId || !myColor || !accessToken) {
      resetRtc();
      return;
    }

    wsClient.connect(accessToken);
    setStatus("requesting_media");
    setError(null);
    initiatedOfferRef.current = false;
    pendingOfferRef.current = null;
    connectedRef.current = false;

    const peer = new PeerConnection();
    peerRef.current = peer;

    peer.onRemoteStream = (stream) => {
      setRemoteStream(stream);
      setStatus("connected");
      setError(null);
      connectedRef.current = true;
    };

    peer.onIceCandidate = (candidate) => {
      sendSignal("rtc_ice", { candidate });
    };

    peer.onConnectionStateChange = (state) => {
      const mappedState = mapConnectionState(state);
      setStatus(mappedState);

      if (mappedState === "failed") {
        setError("Peer connection was interrupted. Refresh the game page if video does not recover.");
      }
    };

    let isDisposed = false;
    let retryTimer: number | null = null;

    const sendSignal = (
      type: "rtc_offer" | "rtc_answer" | "rtc_ice",
      payload: { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit },
    ) => {
      const sent =
        type === "rtc_ice"
          ? wsClient.send("rtc_ice", payload as { candidate: RTCIceCandidateInit }, gameId)
          : wsClient.send(type, payload as { sdp: RTCSessionDescriptionInit }, gameId);
      if (!sent) {
        setError("Realtime signaling is not ready yet.");
      }
      return sent;
    };

    const scheduleOfferRetry = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }

      retryTimer = window.setTimeout(async () => {
        if (isDisposed || connectedRef.current || myColor !== "white" || !localStreamRef.current) {
          return;
        }

        initiatedOfferRef.current = false;
        await createOfferIfNeeded();
      }, 4000);
    };

    const createOfferIfNeeded = async () => {
      if (myColor !== "white" || initiatedOfferRef.current || !localStreamRef.current || connectedRef.current) {
        return;
      }

      initiatedOfferRef.current = true;
      setStatus("connecting");

      try {
        const offer = await peer.createOffer();
        if (!isDisposed) {
          sendSignal("rtc_offer", { sdp: offer });
          scheduleOfferRetry();
        }
      } catch {
        if (!isDisposed) {
          setStatus("failed");
          setError("Unable to start the peer connection.");
        }
      }
    };

    const handlePendingOfferIfReady = async () => {
      if (!pendingOfferRef.current || !localStreamRef.current) {
        return;
      }

      try {
        setStatus("connecting");
        const answer = await peer.handleOffer(pendingOfferRef.current);
        pendingOfferRef.current = null;
        sendSignal("rtc_answer", { sdp: answer });
      } catch {
        setStatus("failed");
        setError("Unable to answer the peer connection offer.");
      }
    };

    getLocalMediaStream(true, true)
      .then(async (stream) => {
        if (isDisposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        peer.attachLocalStream(stream);
        setLocalStream(stream);
        setStatus("ready");

        await handlePendingOfferIfReady();
        await createOfferIfNeeded();
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }

        setLocalStream(null);
        setStatus("failed");
        setError(error instanceof Error ? error.message : "Unable to access the camera and microphone.");
      });

    const offOffer = wsClient.on("rtc_offer", async (envelope) => {
      if (envelope.game_id !== gameId || !peerRef.current) {
        return;
      }

      if (!localStreamRef.current) {
        pendingOfferRef.current = envelope.payload.sdp;
        return;
      }

      try {
        setStatus("connecting");
        const answer = await peerRef.current.handleOffer(envelope.payload.sdp);
        sendSignal("rtc_answer", { sdp: answer });
      } catch {
        setStatus("failed");
        setError("Unable to accept the incoming peer connection.");
      }
    });

    const offAnswer = wsClient.on("rtc_answer", async (envelope) => {
      if (envelope.game_id !== gameId || !peerRef.current) {
        return;
      }

      try {
        await peerRef.current.handleAnswer(envelope.payload.sdp);
      } catch {
        setStatus("failed");
        setError("Unable to finalize the peer connection.");
      }
    });

    const offIce = wsClient.on("rtc_ice", async (envelope) => {
      if (envelope.game_id !== gameId || !peerRef.current) {
        return;
      }

      try {
        await peerRef.current.addIceCandidate(envelope.payload.candidate);
      } catch {
        setError("A network candidate could not be applied.");
      }
    });

    const offError = wsClient.on("error", ({ payload }) => {
      if (!RTC_ERROR_CODES.has(payload.code)) {
        return;
      }

      setError(payload.message);
    });

    return () => {
      isDisposed = true;
      offOffer();
      offAnswer();
      offIce();
      offError();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      peerRef.current?.close();
      peerRef.current = null;
      pendingOfferRef.current = null;
      localStreamRef.current = null;
      connectedRef.current = false;
      resetRtc();
    };
  }, [accessToken, gameId, myColor, resetRtc, setError, setLocalStream, setRemoteStream, setStatus]);
}
