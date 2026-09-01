"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/lab-store";
import { PLAYBOOKS, STEP_KEYS, STEP_PRESETS } from "@/lib/sim/playbooks";
import type { AgentTool, PlayStep, Playbook } from "@/lib/sim/types";

const TOOLS: AgentTool[] = ["power", "key", "type", "wait", "assert", "sleep", "mount"];
const STAGES: Playbook["stages"][number][] = ["POST", "BIOS", "SHELL", "OS"];

const field =
  "h-11 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40";

export function FlowEditor() {
  const playbookId = useLab((s) => s.playbookId);
  const customBooks = useLab((s) => s.customBooks);
  const draft = useLab((s) => s.draft);
  const upsertCustom = useLab((s) => s.upsertCustom);
  const removeCustom = useLab((s) => s.removeCustom);
  const newCustom = useLab((s) => s.newCustom);
  const setPlaybook = useLab((s) => s.setPlaybook);
  const setDraft = useLab((s) => s.setDraft);
  const running = useLab((s) => s.running);

  const selected =
    (draft && draft.id === playbookId ? draft : null) ??
    customBooks.find((p) => p.id === playbookId) ??
    PLAYBOOKS.find((p) => p.id === playbookId) ??
    PLAYBOOKS[0];
  const editable = Boolean(selected.custom);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (next: Playbook) => {
    if (!editable) return;
    upsertCustom(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const updateStep = (index: number, part: Partial<PlayStep>) => {
    const steps = selected.steps.map((s, i) => (i === index ? { ...s, ...part } : s));
    patch({ ...selected, steps });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= selected.steps.length) return;
    const steps = [...selected.steps];
    const tmp = steps[index];
    steps[index] = steps[j];
    steps[j] = tmp;
    patch({ ...selected, steps });
  };

  const addStep = (presetIndex: number) => {
    const preset = STEP_PRESETS[presetIndex] ?? STEP_PRESETS[0];
    const step: PlayStep = {
      ...preset.step,
      id: `${selected.id}-s${Date.now()}`,
    };
    patch({ ...selected, steps: [...selected.steps, step] });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        內建套件只能複製。自訂流程可增刪改步驟，存在這台瀏覽器。
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => newCustom()} disabled={running}>
          <Plus className="size-4" />
          新增空白
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => newCustom(selected)}
          disabled={running}
        >
          <Copy className="size-4" />
          複製目前
        </Button>
        {draft && !draft.custom && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              upsertCustom({ ...draft, custom: true });
              setDraft(null);
            }}
            disabled={running}
          >
            存 Grok 劇本
          </Button>
        )}
      </div>

      {!editable ? (
        <div className="rounded-md border border-border px-3 py-3 text-sm text-muted">
          「{selected.nameZh}」是內建套件。按「複製目前」才能改步驟。
        </div>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-xs text-muted">流程名稱</span>
            <input
              className={field}
              value={selected.nameZh}
              onChange={(e) => patch({ ...selected, nameZh: e.target.value, name: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">說明</span>
            <input
              className={field}
              value={selected.blurb}
              onChange={(e) => patch({ ...selected, blurb: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {STAGES.map((st) => {
              const on = selected.stages.includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    const stages = on
                      ? selected.stages.filter((x) => x !== st)
                      : [...selected.stages, st];
                    patch({ ...selected, stages: stages.length ? stages : ["POST"] });
                  }}
                  className={cn(
                    "h-11 rounded-sm px-3 text-xs",
                    on ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ol className="space-y-2">
        {selected.steps.map((step, i) => (
          <li key={step.id} className="rounded-md border border-border bg-surface-2 p-2">
            <div className="mb-2 flex items-center gap-1">
              <span className="w-6 font-mono text-xs text-muted tabular-nums">{i + 1}</span>
              <select
                className={cn(field, "h-11 flex-1")}
                value={step.tool}
                disabled={!editable}
                onChange={(e) =>
                  updateStep(i, { tool: e.target.value as AgentTool, label: step.label })
                }
              >
                {TOOLS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {editable && (
                <>
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center text-muted hover:text-foreground"
                    onClick={() => moveStep(i, -1)}
                    aria-label="上移"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center text-muted hover:text-foreground"
                    onClick={() => moveStep(i, 1)}
                    aria-label="下移"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="flex size-11 items-center justify-center text-muted hover:text-fail"
                    onClick={() =>
                      patch({ ...selected, steps: selected.steps.filter((_, j) => j !== i) })
                    }
                    aria-label="刪除步驟"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
            <input
              className={cn(field, "mb-2")}
              value={step.label}
              disabled={!editable}
              placeholder="步驟名稱"
              onChange={(e) => updateStep(i, { label: e.target.value })}
            />
            <StepFields step={step} disabled={!editable} onChange={(part) => updateStep(i, part)} />
          </li>
        ))}
      </ol>

      {editable && (
        <label className="block space-y-1">
          <span className="text-xs text-muted">新增步驟</span>
          <select
            className={field}
            defaultValue=""
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) addStep(n);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              選一個模板…
            </option>
            {STEP_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {saved && <span className="text-xs text-pass">已儲存</span>}
          {!confirmDel ? (
            <Button size="sm" variant="danger" onClick={() => setConfirmDel(true)}>
              <Trash2 className="size-4" />
              刪除流程
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  removeCustom(selected.id);
                  setConfirmDel(false);
                  setPlaybook(PLAYBOOKS[0].id);
                }}
              >
                確定刪除
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
                取消
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepFields({
  step,
  disabled,
  onChange,
}: {
  step: PlayStep;
  disabled: boolean;
  onChange: (part: Partial<PlayStep>) => void;
}) {
  if (step.tool === "power") {
    return (
      <select
        className={field}
        disabled={disabled}
        value={step.action ?? "cycle"}
        onChange={(e) => onChange({ action: e.target.value as PlayStep["action"] })}
      >
        <option value="cycle">cycle 循環</option>
        <option value="on">on 開機</option>
        <option value="off">off 關機</option>
      </select>
    );
  }
  if (step.tool === "key") {
    return (
      <select
        className={field}
        disabled={disabled}
        value={step.key ?? "Enter"}
        onChange={(e) => onChange({ key: e.target.value })}
      >
        {STEP_KEYS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    );
  }
  if (step.tool === "type") {
    return (
      <div className="space-y-2">
        <input
          className={field}
          disabled={disabled}
          value={step.text ?? ""}
          placeholder="要打的字，例如 smbiosview -t 0"
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <label className="flex h-11 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={step.submit !== false}
            disabled={disabled}
            onChange={(e) => onChange({ submit: e.target.checked })}
          />
          送出 Enter
        </label>
      </div>
    );
  }
  if (step.tool === "wait" || step.tool === "assert") {
    return (
      <div className="space-y-2">
        <input
          className={field}
          disabled={disabled}
          value={step.needle ?? ""}
          placeholder="畫面要出現的文字，可用 {{biosVersion}}"
          onChange={(e) => onChange({ needle: e.target.value })}
        />
        {step.tool === "wait" && (
          <input
            className={field}
            disabled={disabled}
            type="number"
            min={200}
            value={step.timeoutMs ?? 8000}
            onChange={(e) => onChange({ timeoutMs: Number(e.target.value) || 8000 })}
          />
        )}
      </div>
    );
  }
  if (step.tool === "sleep") {
    return (
      <input
        className={field}
        disabled={disabled}
        type="number"
        min={50}
        value={step.ms ?? 400}
        onChange={(e) => onChange({ ms: Number(e.target.value) || 400 })}
      />
    );
  }
  if (step.tool === "mount") {
    return (
      <label className="flex h-11 items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={step.iso !== false}
          disabled={disabled}
          onChange={(e) => onChange({ iso: e.target.checked })}
        />
        掛上 ISO
      </label>
    );
  }
  return null;
}
