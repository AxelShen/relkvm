/**
 * RelKVM DUT 操控契約。
 *
 * sim  — 瀏覽器 DUT 狀態機
 * live — 同一組方法打到實體 JetKVM（WebRTC DataChannel "rpc"）
 *
 * 劇本只認 tool 名稱。live 時 RPC 字串用 stock JetKVM jsonrpc.go 的方法名。
 */

export type TransportMode = "sim" | "live";

export type PowerAction = "on" | "off" | "cycle";

/** RelKVM 自己的邏輯名（模擬 log / 舊劇本註解） */
export const JETKVM_RPC = {
  power: "kvm.atx.setPower",
  hidKey: "kvm.hid.key",
  hidText: "kvm.hid.text",
  ocrWait: "kvm.video.ocrWait",
  ocr: "kvm.video.ocr",
  mount: "kvm.virtualMedia.mount",
} as const;

/** jetkvm/kvm jsonrpc.go 真實方法 */
export const JETKVM_LIVE_RPC = {
  power: "setATXPowerAction",
  atxState: "getATXState",
  hidKey: "keypressReport",
  hidReport: "keyboardReport",
  mouse: "absMouseReport",
  mount: "mountWithHTTP",
  unmount: "unmountImage",
  ping: "ping",
  video: "getVideoState",
} as const;

export interface JetKvmEndpoint {
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
  ocrWait(needle: string, timeoutMs: number): Promise<boolean>;
  ocrSnapshot(): Promise<string>;
  mountMedia(image: string, mounted: boolean): Promise<void>;
}
