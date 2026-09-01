# RelKVM

BIOS RELEASE 自動操控台。用 JetKVM 那一層工具（ATX 電源、USB HID、HDMI OCR、virtual media）驅動 DUT：POST → AMI Aptio Setup → UEFI Shell → Linux OS。

**目前這份是 Phase 1 模擬器。** 沒有搬 JetKVM 原始碼。DUT / **graphic Aptio Setup** / Shell / OS 都在瀏覽器裡跑。Phase 2 再把同一組 tool 接到實體 JetKVM。

Repo: [github.com/AxelShen/relkvm](https://github.com/AxelShen/relkvm)

## 兩階段

| | Phase 1（這份） | Phase 2（下一步） |
| --- | --- | --- |
| DUT | 瀏覽器狀態機 | 實驗室真機 |
| 畫面 | 模擬 Aptio / Shell / OS | JetKVM HDMI |
| 按鍵 / 電源 | 模擬 HID + ATX | JetKVM JSON-RPC |
| 流程格式 | `power` `key` `type` `wait` `assert` `mount` | **同一份 playbook，不改** |

接真機時只實作 [`src/lib/jetkvm/live-transport.ts`](src/lib/jetkvm/live-transport.ts)。契約在 [`src/lib/jetkvm/contract.ts`](src/lib/jetkvm/contract.ts)。劇本跑 [`src/lib/sim/runner.ts`](src/lib/sim/runner.ts)，不該為了真機改步驟 JSON。

右上角 **模擬 / 真機** 切換。真機對齊 [jetkvm/kvm](https://github.com/jetkvm/kvm) `jsonrpc.go`：

| RelKVM | JetKVM RPC |
| --- | --- |
| 電源 | `setATXPowerAction`（power-short / power-long / reset） |
| 鍵盤 | `keyboardReport` `{ keys, modifier }` |
| ISO | `mountWithHTTP` / `unmountImage` |
| 畫面 | WebRTC H.264 + 瀏覽器 Tesseract OCR |

握手：`POST /auth/login-local` → `POST /webrtc/session`，DataChannel 名稱 `rpc`。請在實驗室電腦跑 RelKVM，與 JetKVM 同一區網。

## 怎麼跑模擬器

1. 選一台 DUT
2. 選流程（建議先「完整 RELEASE」）
3. 按 **執行**
4. 中間 HDMI 畫面會自己走；右側時間軸逐步變綠或紅

手動：按 **電源** → 等 `Press DEL` → 底下完整 HID 鍵盤按 **Del** 進 **graphic Aptio**，或 **F12** 進 Boot Menu。HDMI 框上的 **截圖** 或鍵盤 **PrtSc** 會把畫面存進右側「截圖」分頁（assert 步驟也會自動拍）。

## 自訂流程：新增、修改、刪除步驟

內建套件（完整 RELEASE、POST 身份、Shell 診斷、OS smoke、旋鈕）是唯讀的。要改步驟，做成**自訂流程**，存在這台瀏覽器（`localStorage` 鍵 `relkvm-flows`）。

### 新增空白流程

1. 按工具列 **新增流程**，或右側 **流程** 分頁的 **新增空白**
2. 預設兩步：循環電源 → 等待 `Press DEL`
3. 改名稱、說明，勾選 POST / BIOS / SHELL / OS

### 從內建 RELEASE 複製

1. 先選內建套件（例如「完整 RELEASE」）
2. **流程** 分頁按 **複製目前**
3. 副本可增刪改

### 編輯步驟

自訂流程才可改：

| 動作 | 怎麼做 |
| --- | --- |
| 加步驟 | 「新增步驟」選模板（循環電源、DEL 進 Setup、等畫面文字、核對、輸入…） |
| 改工具 | `power` / `key` / `type` / `wait` / `assert` / `sleep` / `mount` |
| 改參數 | HID 鍵、要打的字、OCR 針（可用 `{{biosVersion}}`）、timeout |
| 調整順序 | 上移 / 下移 |
| 刪一步 | 該列垃圾桶 |
| 刪整份 | 底部 **刪除流程** → **確定刪除** |

改完自動存。按 **執行** 就用目前這份流程。

### Grok 寫劇本

右側 **Grok** 分頁寫目標 → **讓 Grok 寫劇本** → **存成自訂流程**。

### 工具對照

| 工具 | RPC | 用途 |
| --- | --- | --- |
| `power` | `kvm.atx.setPower` | on / off / cycle |
| `key` | `kvm.hid.key` | DEL、方向鍵、F12、Enter |
| `type` | `kvm.hid.text` | Shell / OS 指令，可自動 Enter |
| `wait` | `kvm.video.ocrWait` | HDMI OCR 等到文字出現 |
| `assert` | `rel.assert.ocr` | 當下畫面必須含針，否則 FAIL |
| `sleep` | `rel.sleep` | 固定等待（優先用 wait） |
| `mount` | `kvm.virtualMedia.mount` | 掛 RELEASE agent ISO |

OCR 佔位符：`{{biosVersion}}` `{{biosTag}}` `{{biosDate}}` `{{vendor}}` `{{board}}` `{{serial}}` `{{name}}`。

## 本機

```bash
git clone https://github.com/AxelShen/relkvm.git
cd relkvm
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

## 技術

- TanStack Start + React 19 + Tailwind v4
- Zustand（DUT 模擬狀態、流程 CRUD）
- 自訂流程只存在瀏覽器，無帳號、無資料庫

## 授權

MIT
