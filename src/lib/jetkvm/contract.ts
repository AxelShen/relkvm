/**
 * RelKVM DUT 操控契約。
 *
 * Phase 1（目前）：`sim` — 瀏覽器內 DUT 狀態機，RPC 只寫進 log。
 * Phase 2（下一步）：`live` — 同一組方法打到實體 JetKVM JSON-RPC / WebSocket。
 *
 * 劇本（playbook）只認 tool 名稱，不認 transport。接真機時不要改步驟格式。
 */

export type TransportMode = "sim" | "live";

export type PowerAction = "on" | "off" | "cycle";

export const JETKVM_RPC = {
  power: "kvm.atx.setPower",
  hidKey: "kvm.hid.key",
  hidText: "kvm.hid.text",
  ocrWait: "kvm.video.ocrWait",
  ocr: "kvm.video.ocr",
  mount: "kvm.virtualMedia.mount",
} as const;

export interface JetKvmEndpoint {
  /** DUT 上的 JetKVM，例如 192.168.7.22 */
  host: string;
  deviceId: string;
  fw: string;
}

export interface KvmTransport {
  mode: TransportMode;
  endpoint: JetKvmEndpoint;
  setPower(action: PowerAction): Promise<void>;
  hidKey(key: string): Promise<void>;
  hidText(text: string, submit?: boolean): Promise<void>;
  /** HDMI OCR 等到畫面含 needle；逾時回 false。 */
  ocrWait(needle: string, timeoutMs: number): Promise<boolean>;
  ocrSnapshot(): Promise<string>;
  mountMedia(image: string, mounted: boolean): Promise<void>;
}
