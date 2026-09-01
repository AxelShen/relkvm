/** USB HID usage IDs — same table JetKVM uses (gadget HID / HUT 1.12). */

export const MOD_CTRL = 0x01;
export const MOD_SHIFT = 0x02;
export const MOD_ALT = 0x04;
export const MOD_GUI = 0x08;

const BASE: Record<string, number> = {
  a: 0x04, b: 0x05, c: 0x06, d: 0x07, e: 0x08, f: 0x09, g: 0x0a, h: 0x0b,
  i: 0x0c, j: 0x0d, k: 0x0e, l: 0x0f, m: 0x10, n: 0x11, o: 0x12, p: 0x13,
  q: 0x14, r: 0x15, s: 0x16, t: 0x17, u: 0x18, v: 0x19, w: 0x1a, x: 0x1b,
  y: 0x1c, z: 0x1d,
  "1": 0x1e, "2": 0x1f, "3": 0x20, "4": 0x21, "5": 0x22, "6": 0x23,
  "7": 0x24, "8": 0x25, "9": 0x26, "0": 0x27,
  "\n": 0x28, "\r": 0x28, "\t": 0x2b, " ": 0x2c,
  "-": 0x2d, "=": 0x2e, "[": 0x2f, "]": 0x30, "\\": 0x31,
  ";": 0x33, "'": 0x34, "`": 0x35, ",": 0x36, ".": 0x37, "/": 0x38,
};

const SHIFTED: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6",
  "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\",
  ":": ";", '"': "'", "~": "`", "<": ",", ">": ".", "?": "/",
};

const NAMED: Record<string, number> = {
  Enter: 0x28,
  Escape: 0x29,
  Backspace: 0x2a,
  Tab: 0x2b,
  " ": 0x2c,
  CapsLock: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  PrintScreen: 0x46,
  Insert: 0x49,
  Home: 0x4a,
  PageUp: 0x4b,
  Delete: 0x4c,
  End: 0x4d,
  PageDown: 0x4e,
  ArrowRight: 0x4f,
  ArrowLeft: 0x50,
  ArrowDown: 0x51,
  ArrowUp: 0x52,
};

export interface HidReport {
  keys: number[];
  modifier: number;
}

export function hidToReport(key: string): HidReport | null {
  if (key === "Control+Alt+Delete") {
    return { keys: [NAMED.Delete], modifier: MOD_CTRL | MOD_ALT };
  }
  if (NAMED[key] != null) return { keys: [NAMED[key]], modifier: 0 };
  if (key.length === 1) {
    const ch = key;
    if (BASE[ch]) return { keys: [BASE[ch]], modifier: 0 };
    if (ch >= "A" && ch <= "Z") return { keys: [BASE[ch.toLowerCase()]], modifier: MOD_SHIFT };
    const base = SHIFTED[ch];
    if (base && BASE[base]) return { keys: [BASE[base]], modifier: MOD_SHIFT };
  }
  return null;
}
