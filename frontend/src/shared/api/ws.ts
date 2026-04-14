/**
 * Typed singleton WebSocket client for authenticated real-time flows.
 */

import { WS_BASE_URL } from "@/shared/config";
import type {
  ClientEventType,
  ConnectionState,
  EventPayload,
  EventType,
  WSEnvelope,
} from "@/shared/types";

type EventHandler<K extends EventType> = (envelope: WSEnvelope<EventPayload<K>>) => void;
type ConnectionListener = (state: ConnectionState) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<EventType, Set<(envelope: WSEnvelope) => void>>();
  private connectionListeners = new Set<ConnectionListener>();
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30_000;
  private token: string | null = null;
  private connectionState: ConnectionState = "idle";

  connect(token: string): void {
    if (
      this.token === token &&
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.ws && this.token !== token) {
      this.disconnect();
    }

    this.token = token;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    this.token = null;
    const socket = this.ws;
    this.ws = null;
    this.setConnectionState("idle");
    socket?.close();
  }

  send<K extends ClientEventType>(type: K, payload: EventPayload<K>, gameId?: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const envelope: WSEnvelope<EventPayload<K>> = {
      type,
      payload,
      game_id: gameId,
      timestamp: new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(envelope));
    return true;
  }

  on<K extends EventType>(type: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const typedHandler = handler as (envelope: WSEnvelope) => void;
    this.listeners.get(type)!.add(typedHandler);

    return () => {
      this.listeners.get(type)?.delete(typedHandler);
    };
  }

  onConnectionStateChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  isOpen(): boolean {
    return this.connectionState === "open";
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  private open(): void {
    if (!this.token) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      return;
    }

    const socket = new WebSocket(`${WS_BASE_URL}?token=${this.token}`);
    this.ws = socket;
    this.setConnectionState("connecting");

    socket.onopen = () => {
      if (this.ws !== socket) {
        return;
      }

      this.reconnectAttempt = 0;
      this.setConnectionState("open");
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket) {
        return;
      }

      try {
        const envelope = JSON.parse(event.data) as WSEnvelope;
        const handlers = this.listeners.get(envelope.type);
        handlers?.forEach((handler) => {
          try {
            handler(envelope);
          } catch (error) {
            console.error("[WS] Event handler failed", envelope.type, error);
          }
        });
      } catch (error) {
        console.error("[WS] Failed to parse message", event.data, error);
      }
    };

    socket.onclose = () => {
      if (this.ws !== socket) {
        return;
      }

      this.ws = null;

      if (this.token) {
        this.setConnectionState("disconnected");
        this.reconnect();
      } else {
        this.setConnectionState("idle");
      }
    };

    socket.onerror = (error) => {
      if (this.ws !== socket) {
        return;
      }

      console.error("[WS] Error", error);
      this.setConnectionState("error");
    };
  }

  private reconnect(): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, this.maxReconnectDelay);
    this.reconnectAttempt += 1;
    window.setTimeout(() => this.open(), delay);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.connectionListeners.forEach((listener) => listener(state));
  }
}

export const wsClient = new WebSocketClient();
