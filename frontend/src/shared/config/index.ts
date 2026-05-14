export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:8000";

export const API_BASE_URL = `${SERVER_URL}/api/v1`;

export const WS_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : `${SERVER_URL.replace(/^http/, "ws")}/ws`;

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];
