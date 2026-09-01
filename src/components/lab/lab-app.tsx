"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cable,
  Camera,
  Check,
  Circle,
  LoaderCircle,
  MonitorPlay,
  Plus,
  Power,
  Square,
  Terminal,
  Trash2,
  Unplug,
  Waypoints,
} from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { FlowEditor } from "@/components/lab/flow-editor";
import { HidKeyboard } from "@/components/lab/hid-keyboard";
import { KvmScreen } from "@/components/lab/kvm-screen";
import { LiveHdmi } from "@/components/lab/live-hdmi";
import { cn } from "@/lib/cn";
import { composePlaybook } from "@/lib/grok";
import { getJetKvmSession } from "@/lib/jetkvm/session";
import { hydrateCustom, hydrateReports, resolveBook, screenOcr, useLab } from "@/lib/lab-store";
import { DUTS } from "@/lib/sim/fleet";
import { PLAYBOOKS, TOOL_CATALOG } from "@/lib/sim/playbooks";
import type { HidKey, StepStatus } from "@/lib/sim/types";

function hidLabel(key: string) {
  const map: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    Delete: "DEL",
    Backspace: "BKSP",
    Enter: "Enter",
    "Control+Alt+Delete": "Ctrl+Alt+Del",
  };
  return map[key] ?? key;
}

export function LabApp() {
  const duts = useLab((s) => s.duts);
  const activeId = useLab((s) => s.activeId);
  const dut = duts[activeId];
  const selectDut = useLab((s) => s.selectDut);
  const speed = useLab((s) => s.speed);
  const setSpeed = useLab((s) => s.setSpeed);
  const playbookId = useLab((s) => s.playbookId);
  const setPlaybook = useLab((s) => s.setPlaybook);
  const running = useLab((s) => s.running);
  const run = useLab((s) => s.run);
  const abort = useLab((s) => s.abort);
  const power = useLab((s) => s.power);
  const hid = useLab((s) => s.hid);
  const tick = useLab((s) => s.tick);
  const focused = useLab((s) => s.focused);
  const setFocused = useLab((s) => s.setFocused);
  const hidBadges = useLab((s) => s.hidBadges);
  const rail = useLab((s) => s.rail);
  const setRail = useLab((s) => s.setRail);
  const draft = useLab((s) => s.draft);
  const customBooks = useLab((s) => s.customBooks);
  const newCustom = useLab((s) => s.newCustom);
  const isoMounted = dut.isoMounted;
  const mountIso = useLab((s) => s.mountIso);
  const mode = useLab((s) => s.mode);
  const setMode = useLab((s) => s.setMode);
  const liveHost = useLab((s) => s.liveHost);
  const setLiveHost = useLab((s) => s.setLiveHost);
  const livePassword = useLab((s) => s.livePassword);
  const setLivePassword = useLab((s) => s.setLivePassword);
  const liveStatus = useLab((s) => s.liveStatus);
  const liveError = useLab((s) => s.liveError);
  const connectLive = useLab((s) => s.connectLive);
  const disconnectLive = useLab((s) => s.disconnectLive);

  const book = resolveBook(playbookId, customBooks, draft);
  const bezelRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const capturing = useRef(false);
  const lastShotStep = useRef<string | null>(null);
  const pushCapture = useLab((s) => s.pushCapture);
  const stepResults = useLab((s) => s.stepResults);

  const captureScreen = async (reason = "manual") => {
    capturing.current = true;
    try {
      let dataUrl = "";
      const s = useLab.getState();
      if (s.mode === "live") {
        const canvas = getJetKvmSession().grabCanvas();
        if (!canvas) return;
        dataUrl = canvas.toDataURL("image/png");
      } else {
        const node = screenRef.current;
        if (!node) return;
        dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: "#101418",
        });
      }
      const d = s.duts[s.activeId];
      pushCapture({
        t: Date.now(),
        dutName: d.profile.name,
        phase: `${s.mode === "live" ? "live" : d.power} · ${reason}`,
        dataUrl,
        ocr: screenOcr(),
      });
      if (reason === "bezel" || reason === "PrtSc" || reason === "manual") {
        s.setRail("shots");
      }
    } catch {
      /* capture can fail on empty frames */
    } finally {
      capturing.current = false;
    }
  };

  useEffect(() => {
    hydrateReports();
    hydrateCustom();
  }, []);

  useEffect(() => {
    let last = performance.now();
    let id = 0;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const powerState = useLab.getState().duts[useLab.getState().activeId].power;
      if (powerState === "posting" || powerState === "booting") {
        tick(dt);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useLab.getState().focused) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "PrintScreen") {
        e.preventDefault();
        void captureScreen("PrtSc");
        return;
      }
      const combo = e.ctrlKey && e.altKey && (e.key === "Delete" || e.key === "Backspace");
      const mapped: HidKey = combo
        ? "Control+Alt+Delete"
        : e.key === "Del"
          ? "Delete"
          : e.key;
      e.preventDefault();
      hid(mapped);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hid]);

  useEffect(() => {
    if (running) lastShotStep.current = null;
  }, [running]);

  useEffect(() => {
    const done = stepResults.filter((r) => r.tool === "assert" && (r.status === "pass" || r.status === "fail"));
    const last = done[done.length - 1];
    if (!last || last.id === lastShotStep.current) return;
    lastShotStep.current = last.id;
    void captureScreen(last.label);
  }, [stepResults]);

  const latency = 34 + (dut.profile.jetkvm.id.charCodeAt(0) % 11);
  const live = mode === "live" ? liveStatus === "connected" : dut.power !== "off";
  const connecting = liveStatus === "connecting";

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="mr-auto">
          <div className="text-lg font-semibold tracking-tight">RelKVM</div>
          <div className="text-xs text-muted">BIOS · UEFI Shell · OS RELEASE 自動操控</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusDot on={live} label={live ? "HDMI" : "無訊號"} />
          <StatusDot on={live} label="HID" />
          <span className="tabular-nums">{live ? (mode === "live" ? "live" : `${latency} ms`) : "—"}</span>
          <span className="hidden sm:inline">JetKVM {dut.profile.jetkvm.id}</span>
        </div>
        <div className="flex rounded-md border border-border p-1">
          {(
            [
              ["sim", "模擬"],
              ["live", "真機"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={running}
              onClick={() => setMode(id)}
              className={cn(
                "h-11 min-w-16 rounded-sm px-3 text-sm",
                mode === id ? "bg-accent text-accent-fg" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {([1, 2, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSpeed(n)}
              className={cn(
                "h-11 min-w-11 rounded-sm px-2 text-sm",
                speed === n ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-foreground",
              )}
            >
              {n}x
            </button>
          ))}
        </div>
      </header>

      {mode === "live" && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3 sm:px-6">
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs text-muted">JetKVM IP</span>
            <input
              value={liveHost}
              onChange={(e) => setLiveHost(e.target.value)}
              placeholder="192.168.7.22"
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="min-w-36 flex-1">
            <span className="mb-1 block text-xs text-muted">密碼（若有）</span>
            <input
              type="password"
              value={livePassword}
              onChange={(e) => setLivePassword(e.target.value)}
              autoComplete="off"
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          {liveStatus === "connected" ? (
            <Button variant="outline" onClick={() => void disconnectLive()} disabled={running}>
              斷線
            </Button>
          ) : (
            <Button onClick={() => void connectLive()} disabled={running || connecting}>
              {connecting ? <LoaderCircle className="size-4 animate-spin" /> : <Cable className="size-4" />}
              連線
            </Button>
          )}
          {liveError && <p className="w-full text-xs text-fail">{liveError}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6">
        {DUTS.map((p) => {
          const st = duts[p.id];
          const on = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectDut(p.id)}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-left transition-colors duration-150",
                on ? "border-accent bg-surface-2" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    st.power === "off" ? "bg-muted" : "bg-pass",
                  )}
                />
                {p.name}
              </div>
              <div className="text-xs text-muted">
                {p.biosVersion} · {p.jetkvm.host}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        {PLAYBOOKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlaybook(p.id)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm",
              !draft && playbookId === p.id
                ? "bg-accent text-accent-fg"
                : "bg-surface text-muted hover:text-foreground",
            )}
          >
            {p.nameZh}
          </button>
        ))}
        {customBooks.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlaybook(p.id)}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm",
              !draft && playbookId === p.id
                ? "bg-accent text-accent-fg"
                : "border border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {p.nameZh}
          </button>
        ))}
        {draft && (
          <span className="min-h-11 rounded-md bg-surface-2 px-3 py-2 text-sm">Grok 劇本</span>
        )}
        <button
          type="button"
          disabled={running}
          onClick={() => newCustom()}
          className="inline-flex h-11 items-center gap-1 rounded-md border border-dashed border-border px-3 text-sm text-muted hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-4" />
          新增流程
        </button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() => power(mode === "live" ? "on" : dut.power === "off" ? "on" : "off")}
            disabled={running}
          >
            <Power className="size-4" />
            {mode === "live" ? "ATX 短按" : dut.power === "off" ? "電源" : "關機"}
          </Button>
          {running ? (
            <Button variant="danger" onClick={abort}>
              <Square className="size-4" />
              中止
            </Button>
          ) : (
            <Button onClick={() => void run()}>
              <MonitorPlay className="size-4" />
              執行 {book.nameZh}
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-4 pb-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] sm:px-6">
        <section className="flex min-h-0 flex-col gap-3">
          <div
            ref={bezelRef}
            tabIndex={0}
            onClick={() => setFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
            }}
            className={cn(
              "relative overflow-hidden rounded-lg border bg-surface outline-none",
              focused ? "border-accent" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted">
              <span className="flex items-center gap-2">
                <Cable className="size-3.5" />
                {dut.profile.jetkvm.host}
                <span className="hidden sm:inline">· WebRTC · 1080p60</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {dut.profile.name} · {dut.power.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => void captureScreen("bezel")}
                  className="inline-flex h-11 items-center gap-1 rounded-sm px-2 text-muted hover:text-foreground"
                >
                  <Camera className="size-4" />
                  截圖
                </button>
              </div>
            </div>
            <div ref={screenRef} className="aspect-video">
              {mode === "live" ? <LiveHdmi /> : <KvmScreen dut={dut} />}
            </div>
            {hidBadges.length > 0 && (
              <div className="pointer-events-none absolute bottom-10 left-3 flex flex-wrap gap-1">
                {hidBadges.map((b) => (
                  <span
                    key={b.id}
                    className="hid-pop rounded-sm bg-accent px-2 py-0.5 font-mono text-xs text-accent-fg"
                  >
                    {hidLabel(b.key)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <HidKeyboard
            disabled={running}
            onKey={(key) => {
              setFocused(true);
              hid(key);
            }}
            onPrintScreen={() => {
              setFocused(true);
              void captureScreen("PrtSc");
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={running}
              onClick={() => mountIso(!isoMounted)}
              className={cn(
                "h-11 rounded-sm border px-3 text-xs",
                isoMounted
                  ? "border-pass/40 bg-pass/10 text-pass"
                  : "border-border bg-surface text-muted",
              )}
            >
              {isoMounted ? "ISO 已掛載" : "掛 virtual media"}
            </button>
          </div>
          <p className="text-xs text-muted">
            點 HDMI 畫面後可用鍵盤。
            {mode === "live"
              ? " 真機：按鍵走 JetKVM keyboardReport，電源走 setATXPowerAction。"
              : " Agent 透過模擬 HID 送鍵，OCR 等畫面。"}
          </p>
        </section>

        <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
          <div className="flex gap-1 border-b border-border p-1">
            {(
              [
                ["timeline", "時間軸"],
                ["flow", "流程"],
                ["shots", "截圖"],
                ["tools", "工具"],
                ["rpc", "RPC"],
                ["ai", "Grok"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRail(id)}
                className={cn(
                  "h-11 min-w-11 flex-1 rounded-sm px-2 text-sm",
                  rail === id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-72 flex-1 overflow-auto p-3">
            {rail === "timeline" && <Timeline bookName={book.nameZh} blurb={book.blurb} />}
            {rail === "flow" && <FlowEditor />}
            {rail === "shots" && <ShotsPane />}
            {rail === "tools" && <ToolsPane />}
            {rail === "rpc" && <RpcPane />}
            {rail === "ai" && <AiPane />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", on ? "bg-pass" : "bg-muted")} />
      {label}
    </span>
  );
}

function Timeline({ bookName, blurb }: { bookName: string; blurb: string }) {
  const results = useLab((s) => s.stepResults);
  const current = useLab((s) => s.currentStepId);
  const reports = useLab((s) => s.reports);
  const last = reports[0];
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium">{bookName}</div>
        <p className="text-xs text-muted">{blurb}</p>
      </div>
      {last && results.length === 0 && (
        <LastReport />
      )}
      <ol className="space-y-1">
        {results.length === 0 && (
          <li className="text-sm text-muted">按「執行」後，每一步會變成 JetKVM 工具呼叫。</li>
        )}
        {results.map((r) => (
          <li
            key={r.id}
            className={cn(
              "flex items-start gap-2 rounded-sm px-2 py-1.5 text-sm",
              r.id === current && "bg-surface-2",
            )}
          >
            <StatusIcon status={r.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{r.label}</span>
                <span className="font-mono text-xs text-muted tabular-nums">{r.ms ? `${r.ms}ms` : ""}</span>
              </div>
              {r.detail && <div className="truncate font-mono text-xs text-muted">{r.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      {reports.length > 0 && results.length > 0 && <LastReport />}
    </div>
  );
}

function LastReport() {
  const reports = useLab((s) => s.reports);
  const last = reports[0];
  if (!last) return null;
  const pass = last.results.filter((r) => r.status === "pass").length;
  const fail = last.results.filter((r) => r.status === "fail").length;
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          {last.dutName} · {last.playbookName}
        </span>
        <span
          className={cn(
            "font-medium",
            last.status === "pass" ? "text-pass" : last.status === "fail" ? "text-fail" : "text-warn",
          )}
        >
          {last.status.toUpperCase()}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted tabular-nums">
        {pass} pass · {fail} fail · {((last.finishedAt - last.startedAt) / 1000).toFixed(1)}s
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "pass") return <Check className="mt-0.5 size-4 text-pass" />;
  if (status === "fail") return <Unplug className="mt-0.5 size-4 text-fail" />;
  if (status === "running")
    return <LoaderCircle className="mt-0.5 size-4 animate-spin text-accent" />;
  if (status === "skip") return <Circle className="mt-0.5 size-4 text-warn" />;
  return <Circle className="mt-0.5 size-4 text-muted" />;
}

function ShotsPane() {
  const captures = useLab((s) => s.captures);
  const removeCapture = useLab((s) => s.removeCapture);
  if (!captures.length) {
    return (
      <p className="text-sm text-muted">
        按 HDMI 框上的「截圖」、鍵盤 PrtSc，或跑到 assert 步驟會自動存畫面。
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {captures.map((c) => (
        <li key={c.id} className="overflow-hidden rounded-md border border-border">
          <img src={c.dataUrl} alt={c.phase} className="w-full" />
          <div className="flex items-start justify-between gap-2 px-2 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm">{c.dutName}</div>
              <div className="truncate text-xs text-muted">{c.phase}</div>
            </div>
            <div className="flex gap-1">
              <a
                href={c.dataUrl}
                download={`relkvm-${c.dutName}-${c.t}.png`}
                className="inline-flex h-11 items-center px-2 text-xs text-muted hover:text-foreground"
              >
                下載
              </a>
              <button
                type="button"
                onClick={() => removeCapture(c.id)}
                className="inline-flex size-11 items-center justify-center text-muted hover:text-fail"
                aria-label="刪除截圖"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ToolsPane() {
  return (
    <ul className="space-y-3">
      {TOOL_CATALOG.map((t) => (
        <li key={t.name} className="rounded-md border border-border px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Waypoints className="size-3.5 text-muted" />
            {t.name}
          </div>
          <div className="mt-1 font-mono text-xs text-muted">{t.rpc}</div>
          <p className="mt-1 text-xs text-muted">{t.hint}</p>
        </li>
      ))}
    </ul>
  );
}

function RpcPane() {
  const rpc = useLab((s) => s.rpc);
  const rows = useMemo(() => [...rpc].reverse(), [rpc]);
  if (!rows.length) {
    return <p className="text-sm text-muted">尚無 JSON-RPC。執行套件或手動按鍵會出現在這裡。</p>;
  }
  return (
    <ul className="space-y-2 font-mono text-xs">
      {rows.map((r) => (
        <li key={r.id} className="rounded-sm bg-surface-2 px-2 py-1.5">
          <div className="flex justify-between gap-2 text-muted">
            <span>{r.dir === "tx" ? "→" : r.dir === "rx" ? "←" : "·"} {r.method}</span>
          </div>
          <div className="truncate text-foreground">{r.body}</div>
        </li>
      ))}
    </ul>
  );
}

function AiPane() {
  const [goal, setGoal] = useState("F12 進 UEFI Shell，跑 smbiosview -t 0 確認 BIOS 版本，再 relinfo。");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useLab((s) => s.draft);
  const setDraft = useLab((s) => s.setDraft);
  const upsertCustom = useLab((s) => s.upsertCustom);
  const setRail = useLab((s) => s.setRail);
  const run = useLab((s) => s.run);
  const running = useLab((s) => s.running);
  const dut = useLab((s) => s.duts[s.activeId]);

  const onCompose = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await composePlaybook({
        data: {
          goal,
          ocr: screenOcr(),
          dut: `${dut.profile.name} BIOS ${dut.profile.biosVersion} ${dut.profile.cpu}`,
        },
      });
      if (!res.ok) setError(res.error);
      else setDraft(res.playbook);
    } catch (e) {
      setError(e instanceof Error ? e.message : "組成劇本失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        用 Grok 依目前畫面寫一份 HID 劇本。只在你按下時呼叫，不會自動連打 API。
      </p>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent/40"
      />
      <Button onClick={() => void onCompose()} disabled={busy || running}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Terminal className="size-4" />}
        讓 Grok 寫劇本
      </Button>
      {error && <p className="text-sm text-fail">{error}</p>}
      {draft && (
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-sm font-medium">{draft.nameZh}</div>
          <p className="text-xs text-muted">{draft.blurb}</p>
          <ol className="mt-2 space-y-1 font-mono text-xs text-muted">
            {draft.steps.map((s) => (
              <li key={s.id}>
                {s.tool} {s.key ?? s.text ?? s.needle ?? s.action ?? ""}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void run(draft)} disabled={running}>
              執行此劇本
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                upsertCustom({ ...draft, custom: true });
                setDraft(null);
                setRail("flow");
              }}
              disabled={running}
            >
              存成自訂流程
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              丟掉
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
