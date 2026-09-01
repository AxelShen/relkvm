"use client";

import { jetkvmHandshake, normalizeJetKvmBase } from "./signaling";

export type LiveStatus = "idle" | "connecting" | "connected" | "error";

type RpcPending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

/**
 * Browser WebRTC client matching jetkvm/kvm:
 * POST /auth/login-local → POST /webrtc/session { sd: b64(offer) }
 * DataChannel label "rpc" carries JSON-RPC 2.0 (keypressReport, setATXPowerAction, …).
 */
export class JetKvmSession {
  status: LiveStatus = "idle";
  error: string | null = null;
  host = "";
  private pc: RTCPeerConnection | null = null;
  private rpc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private nextId = 0;
  private pending = new Map<number, RpcPending>();
  private videoEls = new Set<HTMLVideoElement>();

  get connected() {
    return this.status === "connected" && this.rpc?.readyState === "open";
  }

  attachVideo(el: HTMLVideoElement) {
    this.videoEls.add(el);
    if (this.stream) el.srcObject = this.stream;
    return () => {
      this.videoEls.delete(el);
      el.srcObject = null;
    };
  }

  private bindStream(stream: MediaStream) {
    this.stream = stream;
    for (const el of this.videoEls) el.srcObject = stream;
  }

  async rpcCall(method: string, params: Record<string, unknown> = {}, timeoutMs = 12000) {
    if (!this.rpc || this.rpc.readyState !== "open") {
      throw new Error("JetKVM rpc 未連線");
    }
    const id = ++this.nextId;
    const payload = { jsonrpc: "2.0", method, params, id };
    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.rpc.send(JSON.stringify(payload));
    const timer = setTimeout(() => {
      this.pending.delete(id);
    }, timeoutMs);
    try {
      return await Promise.race([
        result,
        new Promise<unknown>((_, reject) =>
          setTimeout(() => reject(new Error(`${method} 逾時`)), timeoutMs),
        ),
      ]);
    } finally {
      clearTimeout(timer);
      this.pending.delete(id);
    }
  }

  async connect(host: string, password: string) {
    await this.disconnect();
    this.status = "connecting";
    this.error = null;
    this.host = host;
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      this.pc = pc;
      pc.addTransceiver("video", { direction: "recvonly" });
      const rpc = pc.createDataChannel("rpc");
      this.rpc = rpc;

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        this.bindStream(stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          this.status = "error";
          this.error = `WebRTC ${pc.connectionState}`;
        }
      };

      const opened = new Promise<void>((resolve, reject) => {
        rpc.onopen = () => resolve();
        rpc.onerror = () => reject(new Error("rpc channel error"));
        setTimeout(() => reject(new Error("rpc channel 逾時")), 15000);
      });
      rpc.onmessage = (ev) => this.onRpcMessage(String(ev.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIce(pc);

      const local = pc.localDescription;
      if (!local?.sdp) throw new Error("沒有 SDP offer");
      const offerB64 = utf8ToB64(JSON.stringify({ type: local.type, sdp: local.sdp }));

      const sd = await exchangeSd(host, password, offerB64);
      const answer = JSON.parse(b64ToUtf8(sd)) as { type: RTCSdpType; sdp: string };
      await pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
      await opened;
      this.status = "connected";
    } catch (e) {
      this.status = "error";
      this.error = e instanceof Error ? e.message : "連線失敗";
      await this.disconnect(false);
      throw e;
    }
  }

  private onRpcMessage(raw: string) {
    try {
      const msg = JSON.parse(raw) as {
        id?: number;
        result?: unknown;
        error?: { message?: string; data?: string };
        method?: string;
      };
      if (msg.id == null) return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error.data || msg.error.message || "rpc error"));
      } else {
        pending.resolve(msg.result);
      }
    } catch {
      /* ignore non-json */
    }
  }

  grabCanvas(): HTMLCanvasElement | null {
    const el = [...this.videoEls][0];
    if (!el || el.videoWidth < 8) return null;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0);
    return canvas;
  }

  async disconnect(resetStatus = true) {
    for (const [, p] of this.pending) p.reject(new Error("disconnected"));
    this.pending.clear();
    try {
      this.rpc?.close();
    } catch {
      /* */
    }
    this.rpc = null;
    try {
      this.pc?.close();
    } catch {
      /* */
    }
    this.pc = null;
    this.stream = null;
    for (const el of this.videoEls) el.srcObject = null;
    if (resetStatus && this.status !== "error") {
      this.status = "idle";
      this.error = null;
    }
  }
}

function waitIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", on);
      resolve();
    };
    const on = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", on);
    setTimeout(done, 2500);
  });
}

async function exchangeSd(host: string, password: string, offerB64: string) {
  try {
    const sd = await directHandshake(host, password, offerB64);
    if (sd) return sd;
  } catch {
    /* CORS — fall through to server proxy */
  }
  const res = await jetkvmHandshake({ data: { host, password, offerB64 } });
  if (!res.ok) throw new Error(res.error);
  return res.sd;
}

async function directHandshake(host: string, password: string, offerB64: string) {
  const base = normalizeJetKvmBase(host);
  if (password) {
    const login = await fetch(`${base}/auth/login-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (!login.ok && login.status !== 204) {
      throw new Error(`登入失敗 HTTP ${login.status}`);
    }
  }
  const session = await fetch(`${base}/webrtc/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ sd: offerB64 }),
  });
  if (!session.ok) throw new Error(`webrtc/session HTTP ${session.status}`);
  const json = (await session.json()) as { sd?: string };
  if (!json.sd) throw new Error("裝置沒有回 SDP");
  return json.sd;
}

function utf8ToB64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function b64ToUtf8(s: string) {
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

let singleton: JetKvmSession | null = null;

export function getJetKvmSession() {
  if (!singleton) singleton = new JetKvmSession();
  return singleton;
}
