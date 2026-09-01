"use client";

import type { JetKvmSession } from "./session";

let workerPromise: Promise<{
  recognize: (c: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
}> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(async (mod) => {
      const worker = await mod.createWorker("eng", 1);
      return worker;
    });
  }
  return workerPromise;
}

export async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  return data.text.replace(/\s+/g, " ").trim();
}

export async function ocrSession(session: JetKvmSession): Promise<string> {
  const canvas = session.grabCanvas();
  if (!canvas) return "";
  return ocrCanvas(canvas);
}

export async function ocrWaitLive(
  session: JetKvmSession,
  needle: string,
  timeoutMs: number,
  aborted: () => boolean,
): Promise<boolean> {
  const want = needle.toLowerCase();
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (aborted()) return false;
    try {
      const text = await ocrSession(session);
      if (text.toLowerCase().includes(want)) return true;
    } catch {
      /* tesseract / empty frame */
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  return false;
}
