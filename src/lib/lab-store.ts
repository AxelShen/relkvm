import { create } from "zustand";
import { applyHid, bootSelect, createDut, ocrText, powerCycle, powerOff, powerOn, setupSelect, setupTab as applySetupTab, tick } from "./sim/engine";
import { DUTS } from "./sim/fleet";
import { PLAYBOOKS, blankCustom } from "./sim/playbooks";
import { runStep, type LabHost } from "./sim/runner";
import type {
  BiosTab,
  DutState,
  HidKey,
  Playbook,
  RailCapture,
  RpcEntry,
  RunReport,
  StepResult,
} from "./sim/types";

const emptyDuts = () =>
  Object.fromEntries(DUTS.map((p) => [p.id, createDut(p)])) as Record<string, DutState>;

let rpcSeq = 0;
let hidSeq = 0;

export type RailTab = "timeline" | "flow" | "shots" | "tools" | "rpc" | "ai";

export interface LabState {
  duts: Record<string, DutState>;
  activeId: string;
  speed: 1 | 2 | 4;
  running: boolean;
  aborting: boolean;
  playbookId: string;
  stepResults: StepResult[];
  currentStepId: string | null;
  reports: RunReport[];
  rpc: RpcEntry[];
  hidBadges: { id: string; key: string }[];
  captures: RailCapture[];
  rail: RailTab;
  draft: Playbook | null;
  customBooks: Playbook[];
  focused: boolean;
  selectDut: (id: string) => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  setPlaybook: (id: string) => void;
  setRail: (r: LabState["rail"]) => void;
  setDraft: (p: Playbook | null) => void;
  upsertCustom: (p: Playbook) => void;
  removeCustom: (id: string) => void;
  newCustom: (from?: Playbook) => Playbook;
  setFocused: (v: boolean) => void;
  tick: (dt: number) => void;
  hid: (key: HidKey) => void;
  setupPick: (index: number, activate?: boolean) => void;
  setupTab: (tab: BiosTab) => void;
  bootPick: (index: number, activate?: boolean) => void;
  power: (action: "on" | "off" | "cycle") => void;
  mountIso: (on: boolean) => void;
  pushRpc: (e: Omit<RpcEntry, "id" | "t">) => void;
  run: (book?: Playbook) => Promise<void>;
  abort: () => void;
  pushCapture: (c: Omit<RailCapture, "id">) => void;
  removeCapture: (id: string) => void;
}

function persistFlows(customBooks: Playbook[]) {
  try {
    localStorage.setItem("relkvm-flows", JSON.stringify(customBooks));
  } catch {
    /* ignore */
  }
}

export const useLab = create<LabState>()((set, get) => {
  const host = (): LabHost => ({
    getDut: () => get().duts[get().activeId],
    setDut: (updater) =>
      set((s) => ({
        duts: { ...s.duts, [s.activeId]: updater(s.duts[s.activeId]) },
      })),
    speed: () => get().speed,
    aborted: () => get().aborting,
    pushRpc: (entry) => get().pushRpc(entry),
    onHid: (key) => {
      const id = `h${hidSeq++}`;
      set((s) => ({ hidBadges: [...s.hidBadges, { id, key }].slice(-6) }));
      window.setTimeout(() => {
        set((s) => ({ hidBadges: s.hidBadges.filter((b) => b.id !== id) }));
      }, 700);
    },
  });

  return {
    duts: emptyDuts(),
    activeId: DUTS[0].id,
    speed: 1,
    running: false,
    aborting: false,
    playbookId: PLAYBOOKS[0].id,
    stepResults: [],
    currentStepId: null,
    reports: [],
    rpc: [],
    hidBadges: [],
    captures: [],
    rail: "timeline",
    draft: null,
    customBooks: [],
    focused: false,
    selectDut: (id) => set({ activeId: id }),
    setSpeed: (speed) => set({ speed }),
    setPlaybook: (playbookId) => set({ playbookId, draft: null }),
    setRail: (rail) => set({ rail }),
    setDraft: (draft) => set({ draft, playbookId: draft ? draft.id : get().playbookId }),
    upsertCustom: (p) => {
      const book = { ...p, custom: true as const };
      set((s) => {
        const exists = s.customBooks.some((b) => b.id === book.id);
        const customBooks = exists
          ? s.customBooks.map((b) => (b.id === book.id ? book : b))
          : [...s.customBooks, book];
        persistFlows(customBooks);
        return { customBooks, playbookId: book.id, draft: null };
      });
    },
    removeCustom: (id) => {
      set((s) => {
        const customBooks = s.customBooks.filter((b) => b.id !== id);
        persistFlows(customBooks);
        const playbookId =
          s.playbookId === id ? (customBooks[0]?.id ?? PLAYBOOKS[0].id) : s.playbookId;
        return { customBooks, playbookId };
      });
    },
    newCustom: (from) => {
      const book = blankCustom(from);
      get().upsertCustom(book);
      set({ rail: "flow" });
      return book;
    },
    setFocused: (focused) => set({ focused }),
    tick: (dt) => {
      const { activeId, duts, speed } = get();
      const next = tick(duts[activeId], dt * speed);
      if (next !== duts[activeId]) {
        set({ duts: { ...duts, [activeId]: next } });
      }
    },
    hid: (key) => {
      const { activeId, duts, running } = get();
      if (running) return;
      host().onHid(String(key));
      get().pushRpc({
        dir: "tx",
        method: "kvm.hid.key",
        body: JSON.stringify({ keys: [key], source: "manual" }),
      });
      set({
        duts: { ...duts, [activeId]: applyHid(duts[activeId], key) },
      });
    },
    setupPick: (index, activate) => {
      if (get().running) return;
      const { activeId, duts } = get();
      let next = setupSelect(duts[activeId], index);
      if (activate) next = applyHid(next, "Enter");
      set({ duts: { ...duts, [activeId]: next } });
    },
    setupTab: (tab) => {
      if (get().running) return;
      const { activeId, duts } = get();
      set({ duts: { ...duts, [activeId]: applySetupTab(duts[activeId], tab) } });
    },
    bootPick: (index, activate) => {
      if (get().running) return;
      const { activeId, duts } = get();
      let next = bootSelect(duts[activeId], index);
      if (activate) next = applyHid(next, "Enter");
      set({ duts: { ...duts, [activeId]: next } });
    },
    power: (action) => {
      const { activeId, duts } = get();
      const cur = duts[activeId];
      const next =
        action === "off" ? powerOff(cur) : action === "on" ? powerOn(cur) : powerCycle(cur);
      get().pushRpc({
        dir: "tx",
        method: "kvm.atx.setPower",
        body: JSON.stringify({ action }),
      });
      set({ duts: { ...duts, [activeId]: next } });
    },
    mountIso: (on) => {
      const { activeId, duts } = get();
      set({
        duts: { ...duts, [activeId]: { ...duts[activeId], isoMounted: on } },
      });
    },
    pushRpc: (entry) => {
      const row: RpcEntry = { ...entry, id: `r${rpcSeq++}`, t: Date.now() };
      set((s) => ({ rpc: [...s.rpc, row].slice(-80) }));
    },
    abort: () => set({ aborting: true }),
    pushCapture: (c) => {
      const row: RailCapture = { ...c, id: `cap-${Date.now()}-${rpcSeq++}` };
      set((s) => ({ captures: [row, ...s.captures].slice(0, 24) }));
    },
    removeCapture: (id) => set((s) => ({ captures: s.captures.filter((c) => c.id !== id) })),
    run: async (book) => {
      if (get().running) return;
      const playbook =
        book ??
        get().draft ??
        [...get().customBooks, ...PLAYBOOKS].find((p) => p.id === get().playbookId) ??
        PLAYBOOKS[0];
      const startedAt = Date.now();
      const dutId = get().activeId;
      const dutName = get().duts[dutId].profile.name;
      set({
        running: true,
        aborting: false,
        stepResults: playbook.steps.map((st) => ({
          id: st.id,
          label: st.label,
          tool: st.tool,
          status: "pending",
          detail: "",
          ms: 0,
        })),
        currentStepId: playbook.steps[0]?.id ?? null,
        rail: "timeline",
      });
      get().pushRpc({
        dir: "note",
        method: "rel.playbook.start",
        body: JSON.stringify({ id: playbook.id, dut: dutId }),
      });

      const results: StepResult[] = [];
      let failed = false;
      for (const step of playbook.steps) {
        if (get().aborting) break;
        set((s) => ({
          currentStepId: step.id,
          stepResults: s.stepResults.map((r) =>
            r.id === step.id ? { ...r, status: "running" } : r,
          ),
        }));
        const result = await runStep(step, host());
        results.push(result);
        if (result.status === "fail") failed = true;
        set((s) => ({
          stepResults: s.stepResults.map((r) => (r.id === step.id ? result : r)),
        }));
        if (failed && (step.tool === "wait" || step.tool === "assert")) break;
      }

      const aborted = get().aborting;
      const status = aborted ? "abort" : failed ? "fail" : "pass";
      const report: RunReport = {
        id: `run-${startedAt}`,
        playbookId: playbook.id,
        playbookName: playbook.nameZh,
        dutId,
        dutName,
        startedAt,
        finishedAt: Date.now(),
        status,
        results,
      };
      set((s) => {
        const reports = [report, ...s.reports].slice(0, 12);
        try {
          localStorage.setItem("relkvm-reports", JSON.stringify(reports));
        } catch {
          /* ignore */
        }
        return {
          running: false,
          aborting: false,
          currentStepId: null,
          reports,
        };
      });
    },
  };
});

export function activeDut(): DutState {
  const s = useLab.getState();
  return s.duts[s.activeId];
}

export function screenOcr(): string {
  return ocrText(activeDut());
}

export function hydrateReports() {
  try {
    const raw = localStorage.getItem("relkvm-reports");
    if (!raw) return;
    const reports = JSON.parse(raw) as LabState["reports"];
    if (Array.isArray(reports)) useLab.setState({ reports });
  } catch {
    /* ignore */
  }
}

export function hydrateCustom() {
  try {
    const raw = localStorage.getItem("relkvm-flows");
    if (!raw) return;
    const customBooks = JSON.parse(raw) as Playbook[];
    if (Array.isArray(customBooks)) useLab.setState({ customBooks });
  } catch {
    /* ignore */
  }
}

export function resolveBook(id: string, customBooks: Playbook[], draft: Playbook | null): Playbook {
  if (draft && draft.id === id) return draft;
  return customBooks.find((p) => p.id === id) ?? PLAYBOOKS.find((p) => p.id === id) ?? PLAYBOOKS[0];
}
