import { cloneSettings, defaultSettings } from "./fleet";
import { emptyConsole, runOsCommand, runShellCommand, shellBanner, tabItems } from "./firmware";
import type {
  BiosAction,
  BiosItem,
  BiosSettings,
  BiosTab,
  BootTarget,
  ConsoleBuf,
  DutProfile,
  DutState,
  HidKey,
} from "./types";
import { BIOS_TABS, BOOT_LABEL, OS_READY_MS, POST_AUTO_MS, POST_PROMPT_MS } from "./types";

function pushLines(buf: ConsoleBuf, extra: string[]): ConsoleBuf {
  if (extra.length === 1 && extra[0] === "__CLS__") {
    return { ...buf, lines: [], input: "" };
  }
  const lines = [...buf.lines, ...extra];
  return { ...buf, lines: lines.slice(-48), input: "" };
}

function rootFrame(profile: DutProfile, settings: BiosSettings, tab: BiosTab) {
  const items = tabItems(tab, profile, settings);
  return { title: BIOS_TABS.find((t) => t.id === tab)?.label ?? tab, items, index: 0 };
}

export function createDut(profile: DutProfile): DutState {
  const settings = defaultSettings();
  return {
    profile,
    power: "off",
    postMs: 0,
    bootMs: 0,
    settings,
    saved: cloneSettings(settings),
    tab: "main",
    stack: [rootFrame(profile, settings, "main")],
    dialog: null,
    bootIndex: 1,
    shell: emptyConsole(),
    os: emptyConsole(),
    lastKey: null,
    isoMounted: false,
  };
}

function rebuildStack(state: DutState, tab = state.tab, keepIndex = true): DutState {
  const frame = rootFrame(state.profile, state.settings, tab);
  if (keepIndex && state.stack.length === 1) {
    frame.index = Math.min(state.stack[0].index, frame.items.length - 1);
  }
  return { ...state, tab, stack: [frame] };
}

function currentFrame(state: DutState) {
  return state.stack[state.stack.length - 1];
}

function currentItem(state: DutState): BiosItem | undefined {
  const f = currentFrame(state);
  return f.items[f.index];
}

function patchFrame(state: DutState, index: number): DutState {
  const stack = state.stack.map((f, i) =>
    i === state.stack.length - 1 ? { ...f, index } : f,
  );
  return { ...state, stack };
}

function enterShell(state: DutState): DutState {
  return {
    ...state,
    power: "shell",
    dialog: null,
    shell: { ...emptyConsole(), lines: shellBanner(state.profile) },
    lastKey: null,
  };
}

function enterOs(state: DutState): DutState {
  return {
    ...state,
    power: "booting",
    bootMs: 0,
    dialog: null,
    os: emptyConsole(),
  };
}

function finishOsBoot(state: DutState): DutState {
  return {
    ...state,
    power: "os",
    os: {
      ...emptyConsole(),
      lines: [
        `Linux ${state.profile.name.toLowerCase()} 6.8.0-relkvm #1 SMP x86_64`,
        `DMI: RelKVM Labs ${state.profile.name}/${state.profile.board}, BIOS ${state.profile.biosVersion} ${state.profile.biosDate}`,
        "RelKVM DUT OS 24.04 LTS   (RELEASE image)",
        `${state.profile.name.toLowerCase()} login: root   (autologin)`,
      ],
    },
  };
}

export function powerOn(state: DutState): DutState {
  if (state.power !== "off") return powerCycle(state);
  return { ...state, power: "posting", postMs: 0, dialog: null, lastKey: null };
}

export function powerOff(state: DutState): DutState {
  return {
    ...createDut(state.profile),
    settings: cloneSettings(state.saved),
    saved: cloneSettings(state.saved),
    isoMounted: state.isoMounted,
    power: "off",
  };
}

export function powerCycle(state: DutState): DutState {
  return powerOn(powerOff(state));
}

function bootFrom(state: DutState, target: BootTarget): DutState {
  if (target === "shell") return enterShell(state);
  if (target === "usb" && !state.isoMounted) {
    return {
      ...state,
      power: "posting",
      postMs: POST_PROMPT_MS,
      dialog: {
        title: "No bootable USB device.",
        options: ["OK"],
        index: 0,
        kind: "notice",
      },
    };
  }
  if (target === "pxe") {
    return {
      ...state,
      power: "posting",
      postMs: POST_PROMPT_MS,
      dialog: {
        title: "PXE: No DHCP offer.",
        options: ["OK"],
        index: 0,
        kind: "notice",
      },
    };
  }
  return enterOs(state);
}

function applyAction(state: DutState, action: BiosAction): DutState {
  switch (action) {
    case "save-exit":
      return {
        ...state,
        dialog: {
          title: "Save configuration and reset?",
          options: ["Yes", "No"],
          index: 0,
          kind: "save-reset",
        },
      };
    case "discard-exit":
      return {
        ...state,
        dialog: {
          title: "Discard changes and exit?",
          options: ["Yes", "No"],
          index: 0,
          kind: "discard",
        },
      };
    case "defaults":
      return {
        ...state,
        dialog: {
          title: "Load optimized defaults?",
          options: ["Yes", "No"],
          index: 0,
          kind: "defaults",
        },
      };
    case "save":
      return { ...state, saved: cloneSettings(state.settings) };
    case "discard":
      return rebuildStack({ ...state, settings: cloneSettings(state.saved) });
    case "override-shell":
      return enterShell({ ...state, saved: cloneSettings(state.settings) });
    case "override-nvme":
      return enterOs({ ...state, saved: cloneSettings(state.settings) });
    case "override-usb":
      return bootFrom({ ...state, saved: cloneSettings(state.settings) }, "usb");
  }
}

function cycleSetting(state: DutState, item: BiosItem, dir: 1 | -1): DutState {
  if (!item.setting) return state;
  const key = item.setting;
  const next: BiosSettings = { ...state.settings };
  if (item.kind === "toggle") {
    const cur = next[key];
    if (typeof cur !== "boolean") return state;
    (next as unknown as Record<string, boolean>)[key] = !cur;
  } else if (item.kind === "enum" && item.options) {
    const cur = String(next[key]);
    const i = item.options.indexOf(cur);
    const j = (i + dir + item.options.length) % item.options.length;
    const val = item.options[j];
    if (key === "boot1") next.boot1 = val as BootTarget;
    else (next as unknown as Record<string, string>)[key] = val;
  } else {
    return state;
  }
  if (state.stack.length === 1) {
    const frame = rootFrame(state.profile, next, state.tab);
    frame.index = state.stack[0].index;
    return { ...state, settings: next, stack: [frame] };
  }
  const root = rootFrame(state.profile, next, state.tab);
  root.index = state.stack[0].index;
  const parent = root.items[root.index];
  const sub = {
    title: parent.name,
    items: parent.children ?? [],
    index: state.stack[1].index,
  };
  return { ...state, settings: next, stack: [root, sub] };
}

function applySetupHid(state: DutState, key: HidKey): DutState {
  if (state.dialog) {
    const d = state.dialog;
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      const index = (d.index + 1) % d.options.length;
      return { ...state, dialog: { ...d, index } };
    }
    if (key === "Escape") return { ...state, dialog: null };
    if (key === "Enter") {
      const yes = d.options[d.index] === "Yes" || d.options[d.index] === "OK";
      if (d.kind === "notice") {
        return { ...state, dialog: null };
      }
      if (!yes) return { ...state, dialog: null };
      if (d.kind === "save-reset") {
        const saved = cloneSettings(state.settings);
        return bootFrom({ ...state, saved, settings: saved, dialog: null }, saved.boot1);
      }
      if (d.kind === "discard") {
        const settings = cloneSettings(state.saved);
        return bootFrom({ ...state, settings, dialog: null }, settings.boot1);
      }
      if (d.kind === "defaults") {
        const settings = defaultSettings();
        return rebuildStack({ ...state, settings, dialog: null });
      }
      return { ...state, dialog: null };
    }
    return state;
  }

  if (key === "F10") return applyAction(state, "save-exit");
  if (key === "F9") return applyAction(state, "defaults");
  if (key === "F1") {
    return {
      ...state,
      dialog: {
        title: "Help",
        body: currentItem(state)?.help ?? "Aptio Setup Utility",
        options: ["OK"],
        index: 0,
        kind: "notice",
      },
    };
  }

  const top = state.stack.length === 1;
  if (top && (key === "ArrowLeft" || key === "ArrowRight")) {
    const i = BIOS_TABS.findIndex((t) => t.id === state.tab);
    const n = (i + (key === "ArrowRight" ? 1 : -1) + BIOS_TABS.length) % BIOS_TABS.length;
    return rebuildStack(state, BIOS_TABS[n].id, false);
  }

  const frame = currentFrame(state);
  if (key === "ArrowDown") {
    return patchFrame(state, (frame.index + 1) % frame.items.length);
  }
  if (key === "ArrowUp") {
    return patchFrame(state, (frame.index - 1 + frame.items.length) % frame.items.length);
  }
  if (key === "Home") return patchFrame(state, 0);
  if (key === "End") return patchFrame(state, frame.items.length - 1);

  const item = currentItem(state);
  if (!item) return state;

  if (key === "Escape") {
    if (!top) return { ...state, stack: state.stack.slice(0, -1) };
    return applyAction(state, "discard-exit");
  }

  if (key === "+" || key === "-" || key === "ArrowLeft" || key === "ArrowRight") {
    const dir: 1 | -1 = key === "-" || key === "ArrowLeft" ? -1 : 1;
    if (item.kind === "toggle" || item.kind === "enum") return cycleSetting(state, item, dir);
  }

  if (key === "Enter") {
    if (item.kind === "submenu" && item.children) {
      return {
        ...state,
        stack: [...state.stack, { title: item.name, items: item.children, index: 0 }],
      };
    }
    if (item.kind === "toggle" || item.kind === "enum") return cycleSetting(state, item, 1);
    if (item.kind === "action" && item.action) return applyAction(state, item.action);
  }

  return state;
}

function typeInto(buf: ConsoleBuf, key: HidKey): ConsoleBuf | null {
  if (key === "Backspace") return { ...buf, input: buf.input.slice(0, -1) };
  if (key === "ArrowUp") {
    if (!buf.history.length) return buf;
    const histIndex = buf.histIndex < 0 ? buf.history.length - 1 : Math.max(0, buf.histIndex - 1);
    return { ...buf, histIndex, input: buf.history[histIndex] };
  }
  if (key === "ArrowDown") {
    if (buf.histIndex < 0) return buf;
    const histIndex = buf.histIndex + 1;
    if (histIndex >= buf.history.length) return { ...buf, histIndex: -1, input: "" };
    return { ...buf, histIndex, input: buf.history[histIndex] };
  }
  if (key.length === 1) return { ...buf, input: buf.input + key };
  return null;
}

function applyShellHid(state: DutState, key: HidKey): DutState {
  if (key === "Control+Alt+Delete" || key === "F12") return powerCycle(state);
  if (key === "Enter") {
    const cmd = state.shell.input;
    const echo = `Shell> ${cmd}`;
    const out = runShellCommand(state, cmd);
    if (out[0] === "__RESET__") return powerCycle(state);
    if (out[0] === "__EXIT__") return bootFrom(state, state.saved.boot1);
    const history = cmd.trim() ? [...state.shell.history, cmd] : state.shell.history;
    if (out[0] === "__CLS__") {
      return { ...state, shell: { lines: [], input: "", history, histIndex: -1 } };
    }
    return {
      ...state,
      shell: pushLines({ ...state.shell, history, histIndex: -1 }, [echo, ...out]),
    };
  }
  const next = typeInto(state.shell, key);
  if (next) return { ...state, shell: next };
  return state;
}

function applyOsHid(state: DutState, key: HidKey): DutState {
  if (key === "Control+Alt+Delete") return powerCycle(state);
  if (key === "Enter") {
    const cmd = state.os.input;
    const host = state.profile.name.toLowerCase();
    const echo = `root@${host}:~# ${cmd}`;
    const out = runOsCommand(state, cmd);
    if (out[0] === "__RESET__") return powerCycle(state);
    const history = cmd.trim() ? [...state.os.history, cmd] : state.os.history;
    if (out[0] === "__CLS__") {
      return { ...state, os: { lines: [], input: "", history, histIndex: -1 } };
    }
    return { ...state, os: pushLines({ ...state.os, history, histIndex: -1 }, [echo, ...out]) };
  }
  const next = typeInto(state.os, key);
  if (next) return { ...state, os: next };
  return state;
}

export function applyHid(state: DutState, key: HidKey): DutState {
  const tagged = { ...state, lastKey: key };
  if (tagged.power === "off") return tagged;
  if (tagged.power === "posting") {
    if (tagged.postMs >= POST_PROMPT_MS) {
      if (key === "Delete") {
        return rebuildStack({
          ...tagged,
          power: "setup",
          tab: "main",
          dialog: null,
        }, "main", false);
      }
      if (key === "F12") {
        return { ...tagged, power: "bootmenu", bootIndex: 1 };
      }
    }
    return tagged;
  }
  if (tagged.power === "bootmenu") {
    const opts: BootTarget[] = ["shell", "nvme", "usb", "pxe"];
    if (key === "ArrowDown") return { ...tagged, bootIndex: (tagged.bootIndex + 1) % 4 };
    if (key === "ArrowUp") return { ...tagged, bootIndex: (tagged.bootIndex + 3) % 4 };
    if (key === "Escape") return { ...tagged, power: "posting", postMs: POST_PROMPT_MS };
    if (key === "Enter") return bootFrom(tagged, opts[tagged.bootIndex]);
    return tagged;
  }
  if (tagged.power === "setup") return applySetupHid(tagged, key);
  if (tagged.power === "shell") return applyShellHid(tagged, key);
  if (tagged.power === "os") return applyOsHid(tagged, key);
  return tagged;
}

export function tick(state: DutState, dt: number): DutState {
  if (state.power === "posting") {
    const postMs = state.postMs + dt;
    if (postMs >= POST_AUTO_MS) {
      return bootFrom({ ...state, postMs }, state.saved.boot1);
    }
    return { ...state, postMs };
  }
  if (state.power === "booting") {
    const bootMs = state.bootMs + dt;
    if (bootMs >= OS_READY_MS) return finishOsBoot({ ...state, bootMs });
    return { ...state, bootMs };
  }
  return state;
}

export function ocrText(state: DutState): string {
  const p = state.profile;
  if (state.power === "off") return "NO SIGNAL HDMI DISCONNECTED";
  if (state.power === "posting") {
    const bits = [
      "RelKVM Labs",
      p.name,
      `BIOS Version ${p.biosVersion} ${p.biosTag}`,
      p.biosDate,
      p.cpu,
      p.memory,
      p.storage,
    ];
    if (state.postMs >= POST_PROMPT_MS) {
      bits.push("Press DEL to enter Setup", "Press F12 for Boot Menu");
    }
    return bits.join("\n");
  }
  if (state.power === "bootmenu") {
    return [
      "Please select boot device",
      BOOT_LABEL.shell,
      BOOT_LABEL.nvme,
      BOOT_LABEL.usb,
      BOOT_LABEL.pxe,
    ].join("\n");
  }
  if (state.power === "setup") {
    const frame = currentFrame(state);
    const item = currentItem(state);
    const rows = frame.items.map((it) => `${it.name} ${it.value ?? ""}`);
    return [
      "Aptio Setup Utility",
      ...BIOS_TABS.map((t) => t.label),
      frame.title,
      ...rows,
      item?.help ?? "",
      state.dialog?.title ?? "",
    ].join("\n");
  }
  if (state.power === "shell") {
    return [...state.shell.lines, `Shell> ${state.shell.input}`].join("\n");
  }
  if (state.power === "booting") {
    return `Linux version 6.8.0-relkvm DMI BIOS ${p.biosVersion} ${p.name}`;
  }
  return [...state.os.lines, `root@${p.name.toLowerCase()}:~# ${state.os.input}`].join("\n");
}

export function setupTab(state: DutState, tab: BiosTab): DutState {
  if (state.power !== "setup" || state.dialog) return state;
  return rebuildStack(state, tab, false);
}

export function setupSelect(state: DutState, index: number): DutState {
  if (state.power !== "setup" || state.dialog) return state;
  const frame = currentFrame(state);
  if (index < 0 || index >= frame.items.length) return state;
  return patchFrame(state, index);
}

export function bootSelect(state: DutState, index: number): DutState {
  if (state.power !== "bootmenu") return state;
  return { ...state, bootIndex: Math.max(0, Math.min(3, index)) };
}

export function memCount(state: DutState): number {
  const total = state.profile.memory.startsWith("256")
    ? 262144
    : state.profile.memory.startsWith("64")
      ? 65536
      : 131072;
  const t = Math.min(1, Math.max(0, (state.postMs - 280) / 900));
  return Math.round(total * t);
}

export function osPrompt(state: DutState): string {
  return `root@${state.profile.name.toLowerCase()}:~#`;
}
