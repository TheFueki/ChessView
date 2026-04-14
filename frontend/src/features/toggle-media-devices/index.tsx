import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useRtcPeerStore } from "@/entities/rtc-peer";
import { Button } from "@/shared/ui";

export function ToggleCameraButton() {
  const localStream = useRtcPeerStore((state) => state.localStream);
  const isCameraOn = useRtcPeerStore((state) => state.isCameraOn);
  const toggleCamera = useRtcPeerStore((state) => state.toggleCamera);

  return (
    <Button
      type="button"
      size="sm"
      variant={isCameraOn ? "secondary" : "danger"}
      onClick={toggleCamera}
      disabled={!localStream}
      className="h-10 w-10 rounded-full p-0"
      title={isCameraOn ? "Turn camera off" : "Turn camera on"}
    >
      {isCameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
    </Button>
  );
}

export function ToggleMicButton() {
  const localStream = useRtcPeerStore((state) => state.localStream);
  const isMicOn = useRtcPeerStore((state) => state.isMicOn);
  const toggleMic = useRtcPeerStore((state) => state.toggleMic);

  return (
    <Button
      type="button"
      size="sm"
      variant={isMicOn ? "secondary" : "danger"}
      onClick={toggleMic}
      disabled={!localStream}
      className="h-10 w-10 rounded-full p-0"
      title={isMicOn ? "Mute microphone" : "Unmute microphone"}
    >
      {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
    </Button>
  );
}
