import { createServerFn } from "@tanstack/react-start";

export function normalizeJetKvmBase(host: string): string {
  const raw = host.trim();
  if (!raw) throw new Error("請填 JetKVM IP");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withProto.replace(/\/+$/, "");
}

function assertLabHost(base: string) {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error("JetKVM 位址無效");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("只接受 http / https");
  }
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) throw new Error("真機請填區域網 IP（例如 192.168.7.22）");
  const [a, b] = [Number(m[1]), Number(m[2])];
  const lan =
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
  if (!lan) throw new Error("只允許 RFC1918 內網位址");
}

export const jetkvmHandshake = createServerFn({ method: "POST" })
  .validator((input: { host: string; password: string; offerB64: string }) => input)
  .handler(async ({ data }) => {
    const base = normalizeJetKvmBase(data.host);
    assertLabHost(base);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let cookie = "";
    if (data.password) {
      const login = await fetch(`${base}/auth/login-local`, {
        method: "POST",
        headers,
        body: JSON.stringify({ password: data.password }),
      });
      if (!login.ok && login.status !== 204) {
        return { ok: false as const, error: `登入失敗 HTTP ${login.status}` };
      }
      cookie = login.headers.get("set-cookie") ?? "";
    }
    const session = await fetch(`${base}/webrtc/session`, {
      method: "POST",
      headers: cookie ? { ...headers, Cookie: cookie.split(";")[0] } : headers,
      body: JSON.stringify({ sd: data.offerB64 }),
    });
    if (!session.ok) {
      return { ok: false as const, error: `webrtc/session HTTP ${session.status}` };
    }
    const json = (await session.json()) as { sd?: string };
    if (!json.sd) return { ok: false as const, error: "裝置沒有回 SDP" };
    return { ok: true as const, sd: json.sd };
  });
