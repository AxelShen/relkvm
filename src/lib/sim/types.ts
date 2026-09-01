export type PowerState =
  | "off"
  | "posting"
  | "bootmenu"
  | "setup"
  | "shell"
  | "booting"
  | "os";

export type BiosTab = "main" | "advanced" | "chipset" | "boot" | "security" | "exit";

export type BootTarget = "shell" | "nvme" | "usb" | "pxe";

export interface JetKvmLink {
  id: string;
  host: string;
  fw: string;
}

export interface DutProfile {
  id: string;
  name: string;
  platform: string;
  cpu: string;
  cores: string;
  memory: string;
  storage: string;
  biosVersion: string;
  biosTag: string;
  biosDate: string;
  vendor: string;
  board: string;
  serial: string;
  jetkvm: JetKvmLink;
}

export interface BiosSettings {
  virtTech: boolean;
  hyperThreading: boolean;
  turboBoost: boolean;
  nxBit: boolean;
  above4g: boolean;
  vtd: boolean;
  sataMode: "AHCI" | "RAID";
  primaryDisplay: "PEG" | "IGFX" | "PCI";
  usbLegacy: boolean;
  xhciHandoff: boolean;
  secureBoot: boolean;
  tpm: boolean;
  cfgLock: boolean;
  adminPw: boolean;
  csm: boolean;
  bootMode: "UEFI" | "Legacy";
  fastBoot: boolean;
  quietBoot: boolean;
  boot1: BootTarget;
}

export type BiosItemKind = "info" | "toggle" | "enum" | "submenu" | "action";

export interface BiosItem {
  id: string;
  kind: BiosItemKind;
  name: string;
  help: string;
  value?: string;
  setting?: keyof BiosSettings;
  options?: string[];
  action?: BiosAction;
  children?: BiosItem[];
}

export type BiosAction =
  | "save-exit"
  | "discard-exit"
  | "defaults"
  | "save"
  | "discard"
  | "override-shell"
  | "override-nvme"
  | "override-usb";

export interface BiosDialog {
  title: string;
  body?: string;
  options: string[];
  index: number;
  kind: "save-reset" | "discard" | "defaults" | "save" | "notice";
}

export interface ConsoleBuf {
  lines: string[];
  input: string;
  history: string[];
  histIndex: number;
}

export interface DutState {
  profile: DutProfile;
  power: PowerState;
  postMs: number;
  bootMs: number;
  settings: BiosSettings;
  saved: BiosSettings;
  tab: BiosTab;
  stack: { title: string; items: BiosItem[]; index: number }[];
  dialog: BiosDialog | null;
  bootIndex: number;
  shell: ConsoleBuf;
  os: ConsoleBuf;
  lastKey: string | null;
  isoMounted: boolean;
}

export type HidKey =
  | "Enter"
  | "Escape"
  | "Delete"
  | "Backspace"
  | "Tab"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "F1"
  | "F9"
  | "F10"
  | "F12"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "Control+Alt+Delete"
  | string;

export type AgentTool = "power" | "key" | "type" | "wait" | "assert" | "sleep" | "mount";

export interface PlayStep {
  id: string;
  tool: AgentTool;
  label: string;
  key?: string;
  text?: string;
  submit?: boolean;
  needle?: string;
  timeoutMs?: number;
  ms?: number;
  action?: "on" | "off" | "cycle";
  iso?: boolean;
}

export interface Playbook {
  id: string;
  name: string;
  nameZh: string;
  blurb: string;
  stages: ("POST" | "BIOS" | "SHELL" | "OS")[];
  steps: PlayStep[];
  custom?: boolean;
}

export type StepStatus = "pending" | "running" | "pass" | "fail" | "skip";

export interface StepResult {
  id: string;
  label: string;
  tool: AgentTool;
  status: StepStatus;
  detail: string;
  ms: number;
  rpc?: string;
}

export interface RunReport {
  id: string;
  playbookId: string;
  playbookName: string;
  dutId: string;
  dutName: string;
  startedAt: number;
  finishedAt: number;
  status: "pass" | "fail" | "abort";
  results: StepResult[];
}

export type RailCapture = {
  id: string;
  t: number;
  dutName: string;
  phase: string;
  dataUrl: string;
  ocr: string;
};

export interface RpcEntry {
  id: string;
  t: number;
  dir: "tx" | "rx" | "note";
  method: string;
  body: string;
}

export const BIOS_TABS: { id: BiosTab; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "advanced", label: "Advanced" },
  { id: "chipset", label: "Chipset" },
  { id: "boot", label: "Boot" },
  { id: "security", label: "Security" },
  { id: "exit", label: "Save & Exit" },
];

export const BOOT_LABEL: Record<BootTarget, string> = {
  shell: "UEFI: Built-in EFI Shell",
  nvme: "UEFI: NVMe0 WD_BLACK",
  usb: "UEFI: USB Key",
  pxe: "UEFI: PXE IPv4",
};

export const POST_PROMPT_MS = 1700;
export const POST_AUTO_MS = 5600;
export const OS_READY_MS = 2800;
