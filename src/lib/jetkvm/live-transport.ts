import type { JetKvmEndpoint, KvmTransport, PowerAction } from "./contract";
import { hidToReport } from "./hid-map";
import { ocrSession, ocrWaitLive } from "./ocr";
import { getJetKvmSession } from "./session";

const HOLD_MS = 40;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Stock JetKVM JSON-RPC (jetkvm/kvm jsonrpc.go).
 * RelKVM tool names stay the same; this adapter maps them onto the device.
 */
export function createLiveTransport(endpoint: JetKvmEndpoint): KvmTransport {
  const session = () => getJetKvmSession();

  const report = async (keys: number[], modifier: number) => {
    await session().rpcCall("keyboardReport", { keys, modifier });
  };

  const tap = async (keys: number[], modifier: number) => {
    await report(keys, modifier);
    await sleep(HOLD_MS);
    await report([], 0);
  };

  return {
    mode: "live",
    endpoint,
    async setPower(action: PowerAction) {
      const s = session();
      const state = (await s.rpcCall("getATXState")) as { power?: boolean } | undefined;
      const on = Boolean(state?.power);
      if (action === "on") {
        if (!on) await s.rpcCall("setATXPowerAction", { action: "power-short" });
        return;
      }
      if (action === "off") {
        if (on) await s.rpcCall("setATXPowerAction", { action: "power-long" });
        return;
      }
      try {
        await s.rpcCall("setATXPowerAction", { action: "reset" });
      } catch {
        if (on) await s.rpcCall("setATXPowerAction", { action: "power-long" });
        await sleep(1200);
        await s.rpcCall("setATXPowerAction", { action: "power-short" });
      }
    },
    async hidKey(key: string) {
      const mapped = hidToReport(key);
      if (!mapped) throw new Error(`無法對應 HID：${key}`);
      await tap(mapped.keys, mapped.modifier);
    },
    async hidText(text: string, submit?: boolean) {
      for (const ch of text) {
        const mapped = hidToReport(ch);
        if (!mapped) continue;
        await tap(mapped.keys, mapped.modifier);
        await sleep(18);
      }
      if (submit) {
        const enter = hidToReport("Enter");
        if (enter) await tap(enter.keys, enter.modifier);
      }
    },
    async ocrWait(needle: string, timeoutMs: number) {
      return ocrWaitLive(session(), needle, timeoutMs, () => false);
    },
    async ocrSnapshot() {
      return ocrSession(session());
    },
    async mountMedia(image: string, mounted: boolean) {
      const s = session();
      if (!mounted) {
        await s.rpcCall("unmountImage", {});
        return;
      }
      await s.rpcCall("mountWithHTTP", { url: image, mode: "cdrom" });
    },
  };
}
