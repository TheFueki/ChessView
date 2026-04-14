const requireEnv = (key: string): string => {
  const value = import.meta.env[key] as string | undefined;

  if (!value) {
    throw new Error(`${key} must be set`);
  }

  return value;
};

export const SERVER_URL = requireEnv("VITE_SERVER_URL");

export const API_BASE_URL = `${SERVER_URL}/api/v1`;

export const WS_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    : `${SERVER_URL.replace(/^http/, "ws")}/ws`;

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];
