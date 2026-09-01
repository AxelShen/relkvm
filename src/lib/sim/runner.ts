import type { KvmTransport, TransportMode } from "@/lib/jetkvm/contract";
import { JETKVM_LIVE_RPC, JETKVM_RPC } from "@/lib/jetkvm/contract";
import { applyHid, ocrText, powerCycle, powerOff, powerOn } from "./engine";
import type { DutProfile, DutState, HidKey, PlayStep, RpcEntry, StepResult } from "./types";

/**
 * 劇本執行時的 DUT 手柄。
 * sim：接到模擬引擎。live：接到 JetKVM WebRTC JSON-RPC，不改步驟 JSON。
 */
export interface LabHost {
  getDut: () => DutState;
  setDut: (updater: (s: DutState) => DutState) => void;
  speed: () => number;
  aborted: () => boolean;
  pushRpc: (entry: Omit<RpcEntry, "id" | "t">) => void;
  onHid: (key: string) => void;
  mode: () => TransportMode;
  live: () => KvmTransport | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fillNeedle(raw: string, p: DutProfile): string {
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = p[key as keyof DutProfile];
    return typeof v === "string" ? v : "";
  });
}

function hidRpc(key: string, live: boolean): Omit<RpcEntry, "id" | "t"> {
  return {
    dir: "tx",
    method: live ? JETKVM_LIVE_RPC.hidReport : JETKVM_RPC.hidKey,
    body: JSON.stringify({ keys: [key], mods: [], holdMs: 40 }),
  };
}

export async function runStep(step: PlayStep, host: LabHost): Promise<StepResult> {
  const t0 = performance.now();
  const fail = (detail: string): StepResult => ({
    id: step.id,
    label: step.label,
    tool: step.tool,
    status: "fail",
    detail,
    ms: Math.round(performance.now() - t0),
  });
  const pass = (detail: string, rpc?: string): StepResult => ({
    id: step.id,
    label: step.label,
    tool: step.tool,
    status: "pass",
    detail,
    ms: Math.round(performance.now() - t0),
    rpc,
  });

  const pace = () => Math.max(1, host.speed());
  const dut0 = host.getDut();
  const needleOf = (s?: string) => fillNeedle(s ?? "", dut0.profile);
  const live = host.mode() === "live" ? host.live() : null;

  if (host.aborted()) return { ...fail("aborted"), status: "skip" };

  if (host.mode() === "live" && !live) {
    return fail("尚未連上 JetKVM");
  }

  if (step.tool === "sleep") {
    await sleep((step.ms ?? 400) / (live ? 1 : pace()));
    return pass(`${step.ms ?? 400}ms`);
  }

  if (step.tool === "power") {
    const action = step.action ?? "cycle";
    const method = live ? JETKVM_LIVE_RPC.power : JETKVM_RPC.power;
    host.pushRpc({ dir: "tx", method, body: JSON.stringify({ action }) });
    if (live) {
      try {
        await live.setPower(action);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "ATX 失敗");
      }
    } else {
      host.setDut((s) => {
        if (action === "off") return powerOff(s);
        if (action === "on") return powerOn(s);
        return powerCycle(s);
      });
    }
    host.pushRpc({ dir: "rx", method, body: '{"ok":true}' });
    await sleep(live ? 400 : 280 / pace());
    return pass(action, method);
  }

  if (step.tool === "mount") {
    const method = live ? JETKVM_LIVE_RPC.mount : JETKVM_RPC.mount;
    const image = "rel-test-agent.iso";
    host.pushRpc({
      dir: "tx",
      method,
      body: JSON.stringify({ image, mounted: step.iso !== false }),
    });
    if (live) {
      try {
        await live.mountMedia(image, step.iso !== false);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "掛載失敗");
      }
    } else {
      host.setDut((s) => ({ ...s, isoMounted: step.iso !== false }));
    }
    return pass(step.iso === false ? "ejected" : image, method);
  }

  if (step.tool === "key") {
    const key = (step.key ?? "Enter") as HidKey;
    host.onHid(key);
    host.pushRpc(hidRpc(key, Boolean(live)));
    if (live) {
      try {
        await live.hidKey(key);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "HID 失敗");
      }
    } else {
      host.setDut((s) => applyHid(s, key));
    }
    host.pushRpc({
      dir: "rx",
      method: live ? JETKVM_LIVE_RPC.hidReport : JETKVM_RPC.hidKey,
      body: '{"ok":true}',
    });
    await sleep(live ? 80 : 90 / pace());
    return pass(key, live ? JETKVM_LIVE_RPC.hidReport : JETKVM_RPC.hidKey);
  }

  if (step.tool === "type") {
    const text = needleOf(step.text ?? "");
    const method = live ? JETKVM_LIVE_RPC.hidReport : JETKVM_RPC.hidText;
    host.pushRpc({
      dir: "tx",
      method,
      body: JSON.stringify({ text, submit: Boolean(step.submit) }),
    });
    if (live) {
      try {
        await live.hidText(text, Boolean(step.submit));
      } catch (e) {
        return fail(e instanceof Error ? e.message : "HID 輸入失敗");
      }
    } else {
      for (const ch of text) {
        if (host.aborted()) return { ...fail("aborted"), status: "skip" };
        host.onHid(ch);
        host.setDut((s) => applyHid(s, ch));
        await sleep(22 / pace());
      }
      if (step.submit) {
        host.onHid("Enter");
        host.setDut((s) => applyHid(s, "Enter"));
        await sleep(140 / pace());
      }
    }
    return pass(text, method);
  }

  if (step.tool === "wait" || step.tool === "assert") {
    const needle = needleOf(step.needle);
    const timeout = step.timeoutMs ?? (step.tool === "assert" ? 0 : 8000);
    const method = step.tool === "wait" ? JETKVM_RPC.ocrWait : "rel.assert.ocr";
    host.pushRpc({
      dir: "tx",
      method,
      body: JSON.stringify({ needle, timeoutMs: timeout }),
    });
    if (live) {
      if (step.tool === "assert") {
        try {
          const text = await live.ocrSnapshot();
          if (text.toLowerCase().includes(needle.toLowerCase())) {
            return pass(`ocr ∋ "${needle}"`);
          }
          return fail(`畫面沒有「${needle}」`);
        } catch (e) {
          return fail(e instanceof Error ? e.message : "OCR 失敗");
        }
      }
      try {
        const ok = await live.ocrWait(needle, timeout);
        if (ok) {
          host.pushRpc({ dir: "rx", method, body: '{"matched":true}' });
          return pass(`ocr ∋ "${needle}"`, method);
        }
        return fail(`逾時 ${timeout}ms，未見「${needle}」`);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "OCR 等待失敗");
      }
    }
    const hit = (): boolean => ocrText(host.getDut()).toLowerCase().includes(needle.toLowerCase());
    if (step.tool === "assert") {
      if (hit()) return pass(`ocr ∋ "${needle}"`);
      return fail(`畫面沒有「${needle}」`);
    }
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      if (host.aborted()) return { ...fail("aborted"), status: "skip" };
      if (hit()) {
        host.pushRpc({ dir: "rx", method, body: '{"matched":true}' });
        return pass(`ocr ∋ "${needle}"`, method);
      }
      await sleep(50);
    }
    return fail(`逾時 ${timeout}ms，未見「${needle}」`);
  }

  return fail("unknown tool");
}
