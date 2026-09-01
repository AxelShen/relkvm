"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { HidKey } from "@/lib/sim/types";

type KeySpec = { key: HidKey; label: string; wide?: "sm" | "md" | "lg" | "xl"; tone?: "fn" | "mod" | "danger" };

const F_ROW: KeySpec[] = [
  { key: "Escape", label: "Esc", tone: "fn" },
  { key: "F1", label: "F1", tone: "fn" },
  { key: "F2", label: "F2", tone: "fn" },
  { key: "F3", label: "F3", tone: "fn" },
  { key: "F4", label: "F4", tone: "fn" },
  { key: "F5", label: "F5", tone: "fn" },
  { key: "F6", label: "F6", tone: "fn" },
  { key: "F7", label: "F7", tone: "fn" },
  { key: "F8", label: "F8", tone: "fn" },
  { key: "F9", label: "F9", tone: "fn" },
  { key: "F10", label: "F10", tone: "fn" },
  { key: "F11", label: "F11", tone: "fn" },
  { key: "F12", label: "F12", tone: "fn" },
  { key: "PrintScreen", label: "PrtSc", tone: "fn" },
  { key: "Delete", label: "Del", tone: "danger" },
];

const NUM_ROW: KeySpec[] = [
  { key: "`", label: "`" },
  { key: "1", label: "1" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "8", label: "8" },
  { key: "9", label: "9" },
  { key: "0", label: "0" },
  { key: "-", label: "-" },
  { key: "=", label: "=" },
  { key: "Backspace", label: "Bksp", wide: "md", tone: "mod" },
];

const Q_ROW: KeySpec[] = [
  { key: "Tab", label: "Tab", wide: "sm", tone: "mod" },
  { key: "q", label: "Q" },
  { key: "w", label: "W" },
  { key: "e", label: "E" },
  { key: "r", label: "R" },
  { key: "t", label: "T" },
  { key: "y", label: "Y" },
  { key: "u", label: "U" },
  { key: "i", label: "I" },
  { key: "o", label: "O" },
  { key: "p", label: "P" },
  { key: "[", label: "[" },
  { key: "]", label: "]" },
  { key: "\\", label: "\\", wide: "sm" },
];

const A_ROW: KeySpec[] = [
  { key: "CapsLock", label: "Caps", wide: "md", tone: "mod" },
  { key: "a", label: "A" },
  { key: "s", label: "S" },
  { key: "d", label: "D" },
  { key: "f", label: "F" },
  { key: "g", label: "G" },
  { key: "h", label: "H" },
  { key: "j", label: "J" },
  { key: "k", label: "K" },
  { key: "l", label: "L" },
  { key: ";", label: ";" },
  { key: "'", label: "'" },
  { key: "Enter", label: "Enter", wide: "md", tone: "mod" },
];

const Z_ROW: KeySpec[] = [
  { key: "Shift", label: "Shift", wide: "lg", tone: "mod" },
  { key: "z", label: "Z" },
  { key: "x", label: "X" },
  { key: "c", label: "C" },
  { key: "v", label: "V" },
  { key: "b", label: "B" },
  { key: "n", label: "N" },
  { key: "m", label: "M" },
  { key: ",", label: "," },
  { key: ".", label: "." },
  { key: "/", label: "/" },
  { key: "Shift", label: "Shift", wide: "lg", tone: "mod" },
];

const BOTTOM: KeySpec[] = [
  { key: "Control", label: "Ctrl", wide: "sm", tone: "mod" },
  { key: "Meta", label: "Win", tone: "mod" },
  { key: "Alt", label: "Alt", tone: "mod" },
  { key: " ", label: "Space", wide: "xl" },
  { key: "Alt", label: "Alt", tone: "mod" },
  { key: "Control+Alt+Delete", label: "C-A-D", wide: "md", tone: "danger" },
];

const NAV: KeySpec[][] = [
  [
    { key: "Insert", label: "Ins", tone: "fn" },
    { key: "Home", label: "Home", tone: "fn" },
    { key: "PageUp", label: "PgUp", tone: "fn" },
  ],
  [
    { key: "Delete", label: "Del", tone: "danger" },
    { key: "End", label: "End", tone: "fn" },
    { key: "PageDown", label: "PgDn", tone: "fn" },
  ],
  [
    { key: "ArrowLeft", label: "←" },
    { key: "ArrowDown", label: "↓" },
    { key: "ArrowUp", label: "↑" },
    { key: "ArrowRight", label: "→" },
  ],
];

const SHIFT_MAP: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": "\"",
  ",": "<",
  ".": ">",
  "/": "?",
};

function wideClass(wide?: KeySpec["wide"]) {
  if (wide === "xl") return "min-w-36 flex-1";
  if (wide === "lg") return "min-w-20";
  if (wide === "md") return "min-w-16";
  if (wide === "sm") return "min-w-14";
  return "min-w-11";
}

export function HidKeyboard({
  disabled,
  onKey,
  onPrintScreen,
}: {
  disabled?: boolean;
  onKey: (key: HidKey) => void;
  onPrintScreen: () => void;
}) {
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);

  const press = (spec: KeySpec) => {
    if (spec.key === "PrintScreen") {
      onPrintScreen();
      return;
    }
    if (spec.key === "Shift") {
      setShift((v) => !v);
      return;
    }
    if (spec.key === "CapsLock") {
      setCaps((v) => !v);
      return;
    }
    if (spec.key === "Control" || spec.key === "Alt" || spec.key === "Meta") return;
    let sent = spec.key;
    if (sent.length === 1) {
      const letter = /[a-z]/.test(sent);
      if (letter) sent = shift !== caps ? sent.toUpperCase() : sent;
      else if (shift && SHIFT_MAP[sent]) sent = SHIFT_MAP[sent];
    }
    if (shift && spec.key !== "Shift") setShift(false);
    onKey(sent);
  };

  return (
    <div className="space-y-1.5 overflow-x-auto">
      <Row keys={F_ROW} disabled={disabled} shift={shift} caps={caps} onPress={press} />
      <Row keys={NUM_ROW} disabled={disabled} shift={shift} caps={caps} onPress={press} />
      <Row keys={Q_ROW} disabled={disabled} shift={shift} caps={caps} onPress={press} />
      <Row keys={A_ROW} disabled={disabled} shift={shift} caps={caps} onPress={press} />
      <Row keys={Z_ROW} disabled={disabled} shift={shift} caps={caps} onPress={press} />
      <div className="flex flex-wrap gap-1.5">
        <div className="min-w-0 flex-1">
          <Row keys={BOTTOM} disabled={disabled} shift={shift} caps={caps} onPress={press} />
        </div>
        <div className="space-y-1.5">
          {NAV.map((row, i) => (
            <Row key={i} keys={row} disabled={disabled} shift={shift} caps={caps} onPress={press} />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">
        完整 HID 鍵盤。PrtSc 截 HDMI 畫面。點 KVM 後也可用實體鍵盤。
      </p>
    </div>
  );
}

function Row({
  keys,
  disabled,
  shift,
  caps,
  onPress,
}: {
  keys: KeySpec[];
  disabled?: boolean;
  shift: boolean;
  caps: boolean;
  onPress: (spec: KeySpec) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((spec, i) => {
        const active =
          (spec.key === "Shift" && shift) || (spec.key === "CapsLock" && caps);
        return (
          <button
            key={`${spec.key}-${spec.label}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => onPress(spec)}
            className={cn(
              "h-11 rounded-sm border px-1.5 font-mono text-xs disabled:opacity-40",
              wideClass(spec.wide),
              active
                ? "border-accent bg-accent text-accent-fg"
                : spec.tone === "danger"
                  ? "border-fail/40 bg-surface text-fail hover:bg-surface-2"
                  : spec.tone === "fn" || spec.tone === "mod"
                    ? "border-border bg-surface-2 text-muted hover:text-foreground"
                    : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {labelFor(spec, shift, caps)}
          </button>
        );
      })}
    </div>
  );
}

function labelFor(spec: KeySpec, shift: boolean, caps: boolean) {
  if (spec.key.length !== 1) return spec.label;
  if (/[a-z]/.test(spec.key)) return shift !== caps ? spec.label : spec.label.toLowerCase();
  if (shift && SHIFT_MAP[spec.key]) return SHIFT_MAP[spec.key];
  return spec.label;
}
