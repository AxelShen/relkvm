"use client";

import { kernelLog } from "@/lib/sim/firmware";
import { memCount, osPrompt } from "@/lib/sim/engine";
import { BIOS_TABS, BOOT_LABEL, POST_PROMPT_MS, type BootTarget, type DutState } from "@/lib/sim/types";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/lab-store";

const BOOT_OPTS: BootTarget[] = ["shell", "nvme", "usb", "pxe"];

export function KvmScreen({ dut }: { dut: DutState }) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-kvm-post font-mono text-xs leading-5 text-kvm-post-fg sm:text-sm sm:leading-6">
      {dut.power === "off" && <NoSignal />}
      {dut.power === "posting" && <PostScreen dut={dut} />}
      {dut.power === "bootmenu" && <BootMenu dut={dut} />}
      {dut.power === "setup" && <BiosScreen dut={dut} />}
      {dut.power === "shell" && <ShellScreen dut={dut} />}
      {dut.power === "booting" && <BootingScreen dut={dut} />}
      {dut.power === "os" && <OsScreen dut={dut} />}
      <div className="kvm-scan absolute inset-0" />
    </div>
  );
}

function NoSignal() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface text-signal">
      <div className="text-xl tracking-widest text-muted">NO SIGNAL</div>
      <p className="text-xs text-muted">HDMI 未鎖定 · 按電源啟動 DUT</p>
    </div>
  );
}

function PostScreen({ dut }: { dut: DutState }) {
  const p = dut.profile;
  const mem = memCount(dut);
  const showPrompt = dut.postMs >= POST_PROMPT_MS;
  return (
    <div className="flex h-full flex-col bg-kvm-post px-4 py-4 text-kvm-post-fg sm:px-6">
      <div className="text-xs tracking-widest text-pass">RELKVM LABS</div>
      <div className="mt-2 text-lg font-medium tracking-tight text-foreground sm:text-xl">{p.name}</div>
      <div className="mt-4 space-y-1">
        <Row k="BIOS" v={`${p.biosVersion}  ${p.biosTag}   ${p.biosDate}`} />
        <Row k="CPU " v={p.cpu} />
        <Row k="MEM " v={`${mem.toLocaleString()} kB`} />
        {dut.postMs > 900 && <Row k="AHCI" v={`Port 0: ${p.storage}`} />}
        {dut.postMs > 1200 && <Row k="USB " v="JetKVM HID  xHCI Hand-off" />}
      </div>
      <div className="mt-auto space-y-1 pb-2">
        {showPrompt ? (
          <>
            <div className="text-foreground">Press DEL to enter Setup</div>
            <div>Press F12 for Boot Menu</div>
          </>
        ) : (
          <div className="text-muted">POST…</div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-muted">{k}</span>
      <span className="ml-3">{v}</span>
    </div>
  );
}

function BootMenu({ dut }: { dut: DutState }) {
  const bootPick = useLab((s) => s.bootPick);
  return (
    <div className="flex h-full flex-col bg-kvm-shell px-4 py-5 text-kvm-shell-fg sm:px-8">
      <div className="mb-4 text-foreground">Please select boot device:</div>
      <ul className="space-y-0.5">
        {BOOT_OPTS.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => bootPick(i, true)}
              className={cn(
                "w-full px-2 py-1 text-left",
                i === dut.bootIndex ? "bg-kvm-bios-hi text-kvm-bios-sel" : "hover:bg-surface-2",
              )}
            >
              {BOOT_LABEL[id]}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto text-muted">↑↓ Select &nbsp; Enter Boot &nbsp; Esc Cancel</div>
    </div>
  );
}

function BiosScreen({ dut }: { dut: DutState }) {
  const setupPick = useLab((s) => s.setupPick);
  const setupTab = useLab((s) => s.setupTab);
  const hid = useLab((s) => s.hid);
  const frame = dut.stack[dut.stack.length - 1];
  const item = frame.items[frame.index];
  const nested = dut.stack.length > 1;

  return (
    <div className="flex h-full flex-col bg-kvm-gui font-sans text-kvm-gui-fg">
      <header className="flex items-center justify-between gap-3 border-b border-kvm-gui-line bg-kvm-gui-panel px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium tracking-tight">Aptio Setup Utility</div>
          <div className="truncate text-xs text-kvm-gui-muted">
            American Megatrends · Graphic Mode · {dut.profile.biosVersion} {dut.profile.biosTag}
          </div>
        </div>
        <div className="hidden text-right text-xs text-kvm-gui-muted sm:block">
          <div>{dut.profile.vendor}</div>
          <div>{dut.profile.biosDate}</div>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-kvm-gui-line bg-kvm-gui px-2 py-2">
        {BIOS_TABS.map((t) => {
          const on = t.id === dut.tab && !nested;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setupTab(t.id)}
              className={cn(
                "h-11 shrink-0 rounded-md px-3 text-sm",
                on
                  ? "bg-kvm-gui-hi text-kvm-gui-fg"
                  : "text-kvm-gui-muted hover:bg-kvm-gui-panel hover:text-kvm-gui-fg",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="min-h-0 overflow-auto px-3 py-3">
          {nested && (
            <button
              type="button"
              onClick={() => hid("Escape")}
              className="mb-2 h-11 rounded-md px-3 text-sm text-kvm-gui-muted hover:bg-kvm-gui-panel hover:text-kvm-gui-fg"
            >
              ← {frame.title}
            </button>
          )}
          <ul className="space-y-1">
            {frame.items.map((it, i) => {
              const on = i === frame.index;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setupPick(i, it.kind !== "info")}
                    className={cn(
                      "flex h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm",
                      on ? "bg-kvm-gui-hi" : "hover:bg-kvm-gui-panel",
                    )}
                  >
                    <span className="truncate">
                      {it.kind === "submenu" ? `${it.name}` : it.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-kvm-gui-muted">
                      {it.kind === "submenu" && "▸"}
                      {it.kind === "toggle" && (
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-14 items-center justify-center rounded-sm px-2",
                            it.value === "Enabled"
                              ? "bg-pass/20 text-pass"
                              : "bg-kvm-gui-panel text-kvm-gui-muted",
                          )}
                        >
                          {it.value}
                        </span>
                      )}
                      {it.kind === "enum" && it.value != null && (
                        <span className="rounded-sm bg-kvm-gui-panel px-2 py-0.5 text-kvm-gui-fg">
                          {it.value}
                        </span>
                      )}
                      {it.kind === "info" && it.value}
                      {it.kind === "action" && "Run"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <aside className="hidden border-l border-kvm-gui-line bg-kvm-gui-panel px-3 py-3 text-xs text-kvm-gui-muted sm:block">
          <div className="mb-2 text-sm text-kvm-gui-fg">Item Help</div>
          <p className="leading-5">{item?.help}</p>
          <p className="mt-4 text-kvm-gui-muted">
            Mouse 點選或鍵盤 ↑↓ Enter。F10 儲存離開，F9 預設，Esc 返回。
          </p>
        </aside>
      </div>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-kvm-gui-line bg-kvm-gui-panel px-3 py-2 text-xs text-kvm-gui-muted">
        <span>F1 Help</span>
        <span>↑↓ Select</span>
        <span>± Change</span>
        <span>F9 Defaults</span>
        <span>F10 Save</span>
        <span>ESC Exit</span>
      </footer>

      {dut.dialog && (
        <div className="absolute inset-0 flex items-center justify-center bg-kvm-gui/70">
          <div className="w-full max-w-sm rounded-lg border border-kvm-gui-line bg-kvm-gui-panel p-4">
            <div className="mb-2 text-sm font-medium">{dut.dialog.title}</div>
            {dut.dialog.body && <p className="mb-4 text-sm text-kvm-gui-muted">{dut.dialog.body}</p>}
            <div className="flex gap-2">
              {dut.dialog.options.map((opt, i) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    const cur = dut.dialog?.index ?? 0;
                    if (i !== cur) hid(i > cur ? "ArrowRight" : "ArrowLeft");
                    hid("Enter");
                  }}
                  className={cn(
                    "h-11 min-w-16 rounded-md px-4 text-sm",
                    i === dut.dialog?.index
                      ? "bg-accent text-accent-fg"
                      : "border border-kvm-gui-line text-kvm-gui-muted",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ShellScreen({ dut }: { dut: DutState }) {
  return (
    <Console
      lines={dut.shell.lines}
      prompt="Shell>"
      input={dut.shell.input}
      className="bg-kvm-shell text-kvm-shell-fg"
    />
  );
}

function OsScreen({ dut }: { dut: DutState }) {
  return (
    <Console
      lines={dut.os.lines}
      prompt={osPrompt(dut)}
      input={dut.os.input}
      className="bg-kvm-os text-kvm-os-fg"
    />
  );
}

function BootingScreen({ dut }: { dut: DutState }) {
  const lines = kernelLog(dut.profile, dut.bootMs);
  return (
    <div className="h-full overflow-auto bg-kvm-os px-3 py-3 font-mono text-kvm-os-fg">
      {lines.map((ln, i) => (
        <div key={i} className="whitespace-pre-wrap">
          {ln}
        </div>
      ))}
    </div>
  );
}

function Console({
  lines,
  prompt,
  input,
  className,
}: {
  lines: string[];
  prompt: string;
  input: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col overflow-auto px-3 py-3", className)}>
      <div className="min-h-0 flex-1 overflow-auto">
        {lines.map((ln, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {ln}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="text-pass">{prompt}</span>
        <span>
          {input}
          <span className="kvm-cursor" />
        </span>
      </div>
    </div>
  );
}
