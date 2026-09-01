import { createServerFn } from "@tanstack/react-start";
import type { Playbook, PlayStep } from "./sim/types";

const TOOLS = new Set(["power", "key", "type", "wait", "assert", "sleep", "mount"]);

function parseBook(raw: string, goal: string): Playbook | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const json = JSON.parse(raw.slice(start, end + 1)) as {
      name?: string;
      nameZh?: string;
      blurb?: string;
      stages?: Playbook["stages"];
      steps?: Partial<PlayStep>[];
    };
    if (!Array.isArray(json.steps) || json.steps.length === 0) return null;
    const steps: PlayStep[] = json.steps
      .filter((s) => s && TOOLS.has(String(s.tool)))
      .slice(0, 40)
      .map((s, i) => ({
        id: String(s.id ?? `s${i}`),
        tool: s.tool as PlayStep["tool"],
        label: String(s.label ?? s.tool),
        key: s.key,
        text: s.text,
        submit: s.submit,
        needle: s.needle,
        timeoutMs: s.timeoutMs,
        ms: s.ms,
        action: s.action,
        iso: s.iso,
      }));
    if (!steps.length) return null;
    return {
      id: `ai-${Date.now()}`,
      name: json.name ?? "Grok playbook",
      nameZh: json.nameZh ?? "Grok 劇本",
      blurb: json.blurb ?? goal.slice(0, 80),
      stages: json.stages ?? ["POST", "BIOS"],
      steps,
    };
  } catch {
    return null;
  }
}

export const composePlaybook = createServerFn({ method: "POST" })
  .validator((input: { goal: string; ocr: string; dut: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "此環境沒有 AI 額度，請改跑內建套件。" };
    }
    const goal = data.goal.trim().slice(0, 500);
    if (!goal) return { ok: false as const, error: "請先描述要測什麼。" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 900,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You write RelKVM playbooks that drive a DUT through JetKVM HID. Reply with ONE JSON object only. Tools: power (action on|off|cycle), key (key: Delete|Enter|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|F12|F10|F9|F1), type (text, submit boolean), wait (needle, timeoutMs), assert (needle), sleep (ms), mount (iso boolean). Placeholders allowed: {{biosVersion}} {{biosTag}} {{biosDate}} {{vendor}} {{board}} {{serial}} {{name}}. BIOS is AMI Aptio: DEL=setup, F12=boot menu, Left/Right=tabs Main Advanced Chipset Boot Security Save&Exit. Shell prompt Shell>, OS prompt root@. Prefer wait over sleep. Typical: power cycle, wait Press DEL, then either Delete into setup or F12 boot menu (ArrowUp=UEFI Shell, Enter default NVMe).",
          },
          {
            role: "user",
            content: `DUT: ${data.dut}\nOCR now:\n${data.ocr.slice(0, 1200)}\nGoal: ${goal}\nJSON shape: {"name","nameZh","blurb","stages":["POST"|"BIOS"|"SHELL"|"OS"],"steps":[{"id","tool","label",...}]}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: `xAI API ${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    const book = parseBook(text, goal);
    if (!book) return { ok: false as const, error: "Grok 沒有產出可執行的劇本。" };
    return { ok: true as const, playbook: book };
  });
