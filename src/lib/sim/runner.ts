import { applyHid, ocrText, powerCycle, powerOff, powerOn } from "./engine";
import { JETKVM_RPC } from "@/lib/jetkvm/contract";
import type { DutProfile, DutState, HidKey, PlayStep, RpcEntry, StepResult } from "./types";

/**
 * 劇本執行時的 DUT 手柄。Phase 1 由 lab-store 接到模擬引擎。
 * Phase 2 同一個 runStep 可改接 live JetKVM transport（見 src/lib/jetkvm/）。
 */
export interface LabHost {
  getDut: () => DutState;
  setDut: (updater: (s: DutState) => DutState) => void;
  speed: () => number;
  aborted: () => boolean;
  pushRpc: (entry: Omit<RpcEntry, "id" | "t">) => void;
  onHid: (key: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fillNeedle(raw: string, p: DutProfile): string {
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = p[key as keyof DutProfile];
    return typeof v === "string" ? v : "";
  });
}

function hidRpc(key: string): Omit<RpcEntry, "id" | "t"> {
  return {
    dir: "tx",
    method: JETKVM_RPC.hidKey,
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

  if (host.aborted()) return { ...fail("aborted"), status: "skip" };

  if (step.tool === "sleep") {
    await sleep((step.ms ?? 400) / pace());
    return pass(`${step.ms ?? 400}ms`);
  }

  if (step.tool === "power") {
    const action = step.action ?? "cycle";
    host.pushRpc({
      dir: "tx",
      method: JETKVM_RPC.power,
      body: JSON.stringify({ action }),
    });
    host.setDut((s) => {
      if (action === "off") return powerOff(s);
      if (action === "on") return powerOn(s);
      return powerCycle(s);
    });
    host.pushRpc({ dir: "rx", method: JETKVM_RPC.power, body: '{"ok":true}' });
    await sleep(280 / pace());
    return pass(action, JETKVM_RPC.power);
  }

  if (step.tool === "mount") {
    host.pushRpc({
      dir: "tx",
      method: JETKVM_RPC.mount,
      body: JSON.stringify({ image: "rel-test-agent.iso", mounted: step.iso !== false }),
    });
    host.setDut((s) => ({ ...s, isoMounted: step.iso !== false }));
    return pass(step.iso === false ? "ejected" : "rel-test-agent.iso");
  }

  if (step.tool === "key") {
    const key = (step.key ?? "Enter") as HidKey;
    host.onHid(key);
    host.pushRpc(hidRpc(key));
    host.setDut((s) => applyHid(s, key));
    host.pushRpc({ dir: "rx", method: JETKVM_RPC.hidKey, body: '{"ok":true}' });
    await sleep(90 / pace());
    return pass(key, JETKVM_RPC.hidKey);
  }

  if (step.tool === "type") {
    const text = needleOf(step.text ?? "");
    host.pushRpc({
      dir: "tx",
      method: JETKVM_RPC.hidText,
      body: JSON.stringify({ text, submit: Boolean(step.submit) }),
    });
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
    return pass(text, JETKVM_RPC.hidText);
  }

  if (step.tool === "wait" || step.tool === "assert") {
    const needle = needleOf(step.needle);
    const timeout = step.timeoutMs ?? (step.tool === "assert" ? 0 : 8000);
    const deadline = performance.now() + timeout;
    const method = step.tool === "wait" ? JETKVM_RPC.ocrWait : "rel.assert.ocr";
    host.pushRpc({
      dir: "tx",
      method,
      body: JSON.stringify({ needle, timeoutMs: timeout }),
    });
    const hit = (): boolean => ocrText(host.getDut()).toLowerCase().includes(needle.toLowerCase());
    if (step.tool === "assert") {
      if (hit()) return pass(`ocr ∋ "${needle}"`);
      return fail(`畫面沒有「${needle}」`);
    }
    while (performance.now() < deadline) {
      if (host.aborted()) return { ...fail("aborted"), status: "skip" };
      if (hit()) {
        host.pushRpc({ dir: "rx", method: JETKVM_RPC.ocrWait, body: '{"matched":true}' });
        return pass(`ocr ∋ "${needle}"`, JETKVM_RPC.ocrWait);
      }
      await sleep(50);
    }
    return fail(`逾時 ${timeout}ms，未見「${needle}」`);
  }

  return fail("unknown tool");
}
