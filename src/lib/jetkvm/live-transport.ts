import type { JetKvmEndpoint, KvmTransport } from "./contract";

/**
 * 實體 JetKVM 尚未接線。Phase 2 在這裡補：
 * WebSocket JSON-RPC → ATX / HID / virtual media，HDMI 畫面做 OCR。
 */
export function createLiveTransport(endpoint: JetKvmEndpoint): KvmTransport {
  const todo = (method: string) => () =>
    Promise.reject(
      new Error(`live JetKVM ${method} 尚未接線（${endpoint.host}）。先用模擬器。`),
    );

  return {
    mode: "live",
    endpoint,
    setPower: todo("kvm.atx.setPower"),
    hidKey: todo("kvm.hid.key"),
    hidText: todo("kvm.hid.text"),
    ocrWait: async () => {
      throw new Error(`live JetKVM kvm.video.ocrWait 尚未接線（${endpoint.host}）。`);
    },
    ocrSnapshot: todo("kvm.video.ocr"),
    mountMedia: todo("kvm.virtualMedia.mount"),
  };
}
