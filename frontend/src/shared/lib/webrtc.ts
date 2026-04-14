import { STUN_SERVERS } from "@/shared/config";

export class PeerConnection {
  private pc: RTCPeerConnection;
  private remoteStream = new MediaStream();
  private pendingCandidates: RTCIceCandidateInit[] = [];

  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  onIceCandidate: ((candidate: RTCIceCandidateInit) => void) | null = null;
  onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        const alreadyPresent = this.remoteStream
          .getTracks()
          .some((existingTrack) => existingTrack.id === track.id);

        if (!alreadyPresent) {
          this.remoteStream.addTrack(track);
        }
      });

      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate.toJSON());
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(this.pc.connectionState);
    };
  }

  attachLocalStream(stream: MediaStream): void {
    const existingTrackIds = new Set(
      this.pc
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId)),
    );

    stream.getTracks().forEach((track) => {
      if (!existingTrackIds.has(track.id)) {
        this.pc.addTrack(track, stream);
      }
    });
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription?.toJSON() ?? offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(offer);
    await this.flushPendingCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription?.toJSON() ?? answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
    await this.flushPendingCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    await this.pc.addIceCandidate(candidate);
  }

  close(): void {
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.pc.close();
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc.remoteDescription || this.pendingCandidates.length === 0) {
      return;
    }

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];

    for (const candidate of candidates) {
      await this.pc.addIceCandidate(candidate);
    }
  }
}

function mediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera or microphone permission was denied.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera or microphone was found on this device.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to access the camera and microphone.";
}

export async function getLocalMediaStream(video = true, audio = true): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch (error) {
    throw new Error(mediaErrorMessage(error));
  }
}
