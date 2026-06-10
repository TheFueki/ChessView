import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wsClient } from "../ws";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  closeFromServer() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("ws client", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    wsClient.disconnect();
  });

  it("connects with the bearer token and publishes connection state changes", () => {
    const states: string[] = [];
    const unsubscribe = wsClient.onConnectionStateChange((state) => states.push(state));

    wsClient.connect("access-token");
    MockWebSocket.instances[0].open();

    expect(MockWebSocket.instances[0].url).toBe("ws://localhost:3000/ws?token=access-token");
    expect(states).toEqual(["idle", "connecting", "open"]);

    unsubscribe();
  });

  it("sends typed envelopes only when the socket is open", () => {
    vi.setSystemTime(new Date("2026-06-10T10:00:00.000Z"));

    wsClient.connect("access-token");
    expect(wsClient.send("queue_join", { time_control: "5+0" })).toBe(false);

    const socket = MockWebSocket.instances[0];
    socket.open();

    expect(wsClient.send("queue_join", { time_control: "5+0" })).toBe(true);
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "queue_join",
        payload: { time_control: "5+0" },
        timestamp: "2026-06-10T10:00:00.000Z",
      }),
    );

    vi.useRealTimers();
  });

  it("dispatches server events and stops after unsubscribing", () => {
    const handler = vi.fn();
    const unsubscribe = wsClient.on("queue_joined", handler);

    wsClient.connect("access-token");
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message({
      type: "queue_joined",
      payload: { position: 2, time_control: "5+0" },
      timestamp: "2026-06-10T10:00:00.000Z",
    });
    unsubscribe();
    socket.message({
      type: "queue_joined",
      payload: { position: 1, time_control: "5+0" },
      timestamp: "2026-06-10T10:00:01.000Z",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "queue_joined",
        payload: { position: 2, time_control: "5+0" },
      }),
    );
  });
});
