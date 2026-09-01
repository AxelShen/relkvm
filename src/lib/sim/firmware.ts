import type {
  BiosItem,
  BiosSettings,
  BiosTab,
  ConsoleBuf,
  DutProfile,
  DutState,
} from "./types";
import { BOOT_LABEL } from "./types";

const onOff = (v: boolean) => (v ? "Enabled" : "Disabled");

export function tabItems(tab: BiosTab, p: DutProfile, s: BiosSettings): BiosItem[] {
  switch (tab) {
    case "main":
      return [
        info("vendor", "BIOS Vendor", p.vendor, "BIOS vendor string."),
        info("ver", "BIOS Version", `${p.biosVersion} ${p.biosTag}`, "RELEASE BIOS version under test."),
        info("date", "BIOS Date", p.biosDate, "Build date of this firmware image."),
        info("board", "Board Name", p.board, "Mainboard identifier."),
        {
          id: "sys-info",
          kind: "submenu",
          name: "System Information",
          help: "Processor, memory and chassis identity from SMBIOS.",
          children: [
            info("cpu", "Processor", p.cpu, "Installed CPU."),
            info("cores", "Core / Thread", p.cores, "Logical topology."),
            info("mem", "System Memory", p.memory, "Total DRAM size and speed."),
            info("serial", "Serial Number", p.serial, "Chassis serial."),
          ],
        },
        info("storage", "Primary Storage", p.storage, "Boot NVMe device."),
      ];
    case "advanced":
      return [
        {
          id: "cpu",
          kind: "submenu",
          name: "CPU Configuration",
          help: "Virtualization, SMT and turbo controls used by OS RELEASE gates.",
          children: [
            toggle("virtTech", "Intel Virtualization Technology", s.virtTech, "VT-x / AMD-V for the guest OS."),
            toggle("hyperThreading", "Hyper-Threading", s.hyperThreading, "SMT enable."),
            toggle("turboBoost", "Turbo Boost / Precision Boost", s.turboBoost, "Opportunistic frequency."),
            toggle("nxBit", "Execute Disable Bit", s.nxBit, "NX / XD bit."),
          ],
        },
        {
          id: "pci",
          kind: "submenu",
          name: "PCI Subsystem Settings",
          help: "Above 4G MMIO for large BARs.",
          children: [
            toggle("above4g", "Above 4G Decoding", s.above4g, "64-bit MMIO."),
          ],
        },
        {
          id: "usb",
          kind: "submenu",
          name: "USB Configuration",
          help: "USB hand-off used by JetKVM HID.",
          children: [
            toggle("usbLegacy", "Legacy USB Support", s.usbLegacy, "USB kbd/mouse before OS."),
            toggle("xhciHandoff", "XHCI Hand-off", s.xhciHandoff, "OS xHCI ownership."),
          ],
        },
      ];
    case "chipset":
      return [
        toggle("vtd", "VT-d / AMD-Vi", s.vtd, "IOMMU for directed I/O."),
        {
          id: "primaryDisplay",
          kind: "enum",
          name: "Primary Display",
          value: s.primaryDisplay,
          setting: "primaryDisplay",
          options: ["PEG", "IGFX", "PCI"],
          help: "Framebuffer source seen by JetKVM HDMI.",
        },
        {
          id: "sataMode",
          kind: "enum",
          name: "SATA Mode",
          value: s.sataMode,
          setting: "sataMode",
          options: ["AHCI", "RAID"],
          help: "Storage controller mode.",
        },
      ];
    case "boot":
      return [
        {
          id: "bootMode",
          kind: "enum",
          name: "Boot Mode",
          value: s.bootMode,
          setting: "bootMode",
          options: ["UEFI", "Legacy"],
          help: "RELEASE images boot UEFI only.",
        },
        toggle("fastBoot", "Fast Boot", s.fastBoot, "Skip USB/PS2 enumeration."),
        toggle("quietBoot", "Quiet Boot", s.quietBoot, "Hide POST diagnostics."),
        toggle("csm", "CSM Support", s.csm, "Compatibility support module."),
        {
          id: "boot1",
          kind: "enum",
          name: "Boot Option #1",
          value: BOOT_LABEL[s.boot1],
          setting: "boot1",
          options: ["shell", "nvme", "usb", "pxe"],
          help: "First boot target after Save & Exit.",
        },
      ];
    case "security":
      return [
        info("admin", "Administrator Password", s.adminPw ? "Installed" : "Not Installed", "Setup password."),
        toggle("secureBoot", "Secure Boot", s.secureBoot, "UEFI Secure Boot."),
        toggle("tpm", "TPM 2.0", s.tpm, "fTPM / dTPM presence."),
        toggle("cfgLock", "CFG Lock", s.cfgLock, "MSR 0xE2 lock."),
      ];
    case "exit":
      return [
        action("save-exit", "Save Changes and Exit", "Write NVRAM and reset."),
        action("discard-exit", "Discard Changes and Exit", "Reset without writing."),
        action("defaults", "Load Optimized Defaults", "Restore RELEASE defaults."),
        action("save", "Save Changes", "Write NVRAM, stay in Setup."),
        action("discard", "Discard Changes", "Reload last saved values."),
        action("override-shell", "Boot Override: UEFI Shell", "One-shot boot to EFI Shell."),
        action("override-nvme", "Boot Override: NVMe0", "One-shot boot to OS volume."),
        action("override-usb", "Boot Override: USB", "One-shot boot to virtual media."),
      ];
  }
}

function info(id: string, name: string, value: string, help: string): BiosItem {
  return { id, kind: "info", name, value, help };
}

function toggle(setting: keyof BiosSettings, name: string, value: boolean, help: string): BiosItem {
  return { id: setting, kind: "toggle", name, value: onOff(value), setting, help };
}

function action(action: BiosItem["action"], name: string, help: string): BiosItem {
  return { id: action ?? name, kind: "action", name, action, help };
}

export function emptyConsole(): ConsoleBuf {
  return { lines: [], input: "", history: [], histIndex: -1 };
}

export function shellBanner(p: DutProfile): string[] {
  return [
    "UEFI Interactive Shell v2.2",
    "EDK II",
    `UEFI v2.70 (${p.vendor}, 0x00050019)`,
    "",
    "Mapping table",
    "      FS0: Alias(s):HD0b:;BLK1:",
    "          PciRoot(0x0)/Pci(0x17,0x0)/Sata(0x0,0xFFFF,0x0)/HD(1,GPT,0xA1B2)",
    "      BLK0: Alias(s):",
    "          PciRoot(0x0)/Pci(0x17,0x0)/Sata(0x0,0xFFFF,0x0)",
    "",
    "Press ESC in 1 seconds to skip startup.nsh, any other key to continue.",
    "",
  ];
}

export function runShellCommand(state: DutState, raw: string): string[] {
  const p = state.profile;
  const line = raw.trim();
  if (!line) return [];
  const [cmd, ...rest] = line.split(/\s+/);
  const args = rest.join(" ");
  const c = cmd.toLowerCase();

  if (c === "help" || c === "?") {
    return [
      "ver         - UEFI / Shell version",
      "map         - device mappings",
      "memmap      - memory map",
      "pci         - PCI devices",
      "devices     - UEFI devices",
      "smbiosview  - SMBIOS tables  (-t 0|1|2)",
      "acpiview    - ACPI summary",
      "dmpstore    - NVRAM variables",
      "bcfg        - boot options",
      "relinfo     - RelKVM RELEASE identity",
      "cls         - clear screen",
      "reset       - warm reset",
      "exit        - leave Shell, continue boot",
    ];
  }
  if (c === "ver") {
    return [
      "UEFI Interactive Shell v2.2",
      "EDK II",
      `UEFI v2.70 (${p.vendor}, 0x00050019)`,
    ];
  }
  if (c === "map") {
    return [
      "Mapping table",
      "      FS0: Alias(s):HD0b:;BLK1:",
      "          PciRoot(0x0)/Pci(0x17,0x0)/Sata(0x0,0xFFFF,0x0)/HD(1,GPT,0xA1B2)",
      "      BLK0:",
      "          PciRoot(0x0)/Pci(0x17,0x0)/Sata(0x0,0xFFFF,0x0)",
      state.isoMounted ? "      FS1: Alias(s):USB0:   RelKVM Virtual Media" : "      USB:  (none)",
    ];
  }
  if (c === "memmap") {
    return [
      "Type        Start            End              Pages",
      "Available   0000000000001000 000000000009FFFF 0000009F",
      "Available   0000000000100000 000000007FFFFFFF 0007FF00",
      "Available   0000000100000000 000000047FFFFFFF 00380000",
      "Reserved    00000000000A0000 00000000000FFFFF 00000060",
      "ACPI NVS    000000007B000000 000000007B1FFFFF 00000200",
    ];
  }
  if (c === "pci") {
    return [
      "   00:00.0  Host Bridge",
      "   00:01.0  PCI-PCI Bridge  (PEG)",
      "   00:02.0  VGA Compatible   [HDMI → JetKVM]",
      "   00:14.0  USB xHCI",
      "   00:17.0  SATA AHCI",
      "   01:00.0  NVMe             " + p.storage,
    ];
  }
  if (c === "devices") {
    return [
      "PciRoot(0x0)",
      "  PciRoot(0x0)/Pci(0x2,0x0)   GOP / HDMI",
      "  PciRoot(0x0)/Pci(0x14,0x0)  USB",
      "  PciRoot(0x0)/Pci(0x17,0x0)  SATA/NVMe",
    ];
  }
  if (c === "smbiosview" || c === "smbios") {
    const t = args.includes("-t") ? args.replace(/.*-t\s*/, "").split(/\s+/)[0] : "0";
    if (t === "1") {
      return [
        "Type 1 : System Information",
        `  Manufacturer: RelKVM Labs`,
        `  Product Name: ${p.name}`,
        `  Version: ${p.platform}`,
        `  Serial Number: ${p.serial}`,
        `  UUID: 4c454c2d-${p.jetkvm.id.toLowerCase()}-2026-0001-aabbccddeeff`,
      ];
    }
    if (t === "2") {
      return [
        "Type 2 : Base Board Information",
        "  Manufacturer: RelKVM Labs",
        `  Product Name: ${p.board}`,
        `  Version: ${p.platform}`,
        `  Serial Number: ${p.serial}-MB`,
      ];
    }
    return [
      "Type 0 : BIOS Information",
      `  Vendor: ${p.vendor}`,
      `  BIOS Version: ${p.biosVersion}`,
      `  BIOS Release Date: ${p.biosDate}`,
      "  BIOS ROM Size: 32 MB",
      `  BIOS Characteristics: PCI, PNP, Upgradeable, UEFI`,
    ];
  }
  if (c === "acpiview" || c === "acpi") {
    return [
      "RSDP  @ 000000007B000000  ACPI 2.0",
      "XSDT  @ 000000007B000028",
      "  FACP APIC MCFG HPET SSDT TPM2 DMAR",
      `  OEM: RELKVM   Table count: 8`,
    ];
  }
  if (c === "dmpstore") {
    return [
      "SecureBoot                 : 0x01",
      "SetupMode                  : 0x00",
      "OsIndicationsSupported     : 0x0000000000000041",
      "BootOrder                  : Boot0001, Boot0002",
      "Boot0001                   : " + BOOT_LABEL[state.settings.boot1],
    ];
  }
  if (c === "bcfg") {
    return [
      "Option: 00. Variable: Boot0001",
      "  Desc    - " + BOOT_LABEL[state.settings.boot1],
      "Option: 01. Variable: Boot0002",
      "  Desc    - UEFI: Built-in EFI Shell",
    ];
  }
  if (c === "relinfo") {
    return [
      "RelKVM RELEASE probe",
      `  DUT            ${p.name}  ${p.serial}`,
      `  BIOS           ${p.biosVersion} ${p.biosTag}  ${p.biosDate}`,
      `  VT-x / AMD-V   ${state.settings.virtTech ? "Enabled" : "Disabled"}`,
      `  Secure Boot    ${state.settings.secureBoot ? "Enabled" : "Disabled"}`,
      `  TPM 2.0        ${state.settings.tpm ? "Enabled" : "Disabled"}`,
      `  Boot #1        ${BOOT_LABEL[state.settings.boot1]}`,
      "  RELINFO PASS",
    ];
  }
  if (c === "cls" || c === "clear") return ["__CLS__"];
  if (c === "reset" || c === "reboot") return ["__RESET__"];
  if (c === "exit") return ["__EXIT__"];
  if (c === "fs0:" || c === "fs1:") return [`Current directory is ${c.toUpperCase()}`];
  if (c === "ls" || c === "dir") {
    return ["  startup.nsh", "  EFI\\", "  reltest.efi"];
  }
  return [
    `'${cmd}' is not recognized as an internal or external command, operable program, or script file.`,
  ];
}

export function osBanner(p: DutProfile): string[] {
  return [
    `Linux version 6.8.0-relkvm (release@relkvm) (gcc 13.2.0)`,
    `DMI: RelKVM Labs ${p.name}/${p.board}, BIOS ${p.biosVersion} ${p.biosDate}`,
    `smp: Brought up 1 node, ${p.cores.split("/")[0].trim()}`,
    `pci 0000:00:02.0: [HDMI capture locked by JetKVM]`,
    `nvme0n1: ${p.storage}`,
    `EXT4-fs (nvme0n1p2): mounted filesystem with ordered data mode`,
    "",
    `RelKVM DUT OS 24.04 LTS   (RELEASE image)`,
    `${p.name.toLowerCase()} login: root   (autologin)`,
    "",
  ];
}

export function runOsCommand(state: DutState, raw: string): string[] {
  const p = state.profile;
  const s = state.settings;
  const line = raw.trim();
  if (!line) return [];
  const [cmd, ...rest] = line.split(/\s+/);
  const args = rest.join(" ");
  const full = `${cmd} ${args}`.trim();

  if (cmd === "help") {
    return [
      "uname  dmidecode  lscpu  free  lspci  mokutil  dmesg  reltest  reboot",
    ];
  }
  if (cmd === "uname") {
    return ["Linux " + p.name.toLowerCase() + " 6.8.0-relkvm #1 SMP x86_64 GNU/Linux"];
  }
  if (cmd === "dmidecode") {
    if (args.includes("bios") || args.includes("-t 0") || args.includes("-t bios")) {
      return [
        "# dmidecode 3.5",
        "BIOS Information",
        `        Vendor: ${p.vendor}`,
        `        Version: ${p.biosVersion}`,
        `        Release Date: ${p.biosDate}`,
        "        ROM Size: 32 MB",
      ];
    }
    return [
      `System Information`,
      `        Manufacturer: RelKVM Labs`,
      `        Product Name: ${p.name}`,
      `        Serial Number: ${p.serial}`,
    ];
  }
  if (cmd === "lscpu") {
    return [
      `Architecture:            x86_64`,
      `CPU(s):                  ${p.cores}`,
      `Model name:              ${p.cpu}`,
      `Virtualization:          ${s.virtTech ? "VT-x" : "off"}`,
      `Hypervisor vendor:       (none)`,
      `Flags:                   fpu vme de pse ${s.virtTech ? "vmx " : ""}${s.nxBit ? "nx " : ""}lm`,
    ];
  }
  if (cmd === "free") {
    return [
      "               total        used        free",
      `Mem:       ${p.memory.startsWith("256") ? "262144000" : p.memory.startsWith("64") ? "65536000" : "131072000"}     4200000   rest`,
    ];
  }
  if (cmd === "lspci") {
    return [
      "00:00.0 Host bridge: RelKVM Root Complex",
      "00:02.0 VGA compatible controller: GOP HDMI",
      "00:14.0 USB controller: xHCI",
      `01:00.0 Non-Volatile memory controller: ${p.storage}`,
    ];
  }
  if (cmd === "mokutil") {
    return [s.secureBoot ? "SecureBoot enabled" : "SecureBoot disabled"];
  }
  if (cmd === "dmesg") {
    return osBanner(p).slice(0, 6);
  }
  if (cmd === "cat" && args.includes("bios_version")) {
    return [p.biosVersion];
  }
  if (cmd === "reltest") {
    const checks = [
      { n: "bios_version", ok: Boolean(p.biosVersion), detail: p.biosVersion },
      { n: "virt", ok: s.virtTech, detail: s.virtTech ? "vmx/svm present" : "missing vmx" },
      { n: "secureboot", ok: s.secureBoot, detail: s.secureBoot ? "enabled" : "disabled" },
      { n: "tpm", ok: s.tpm, detail: s.tpm ? "TPM2 present" : "TPM off" },
      { n: "boot_uefi", ok: s.bootMode === "UEFI", detail: s.bootMode },
    ];
    const fail = checks.filter((x) => !x.ok);
    return [
      "RelKVM OS RELEASE agent  1.4",
      ...checks.map((x) => `  [${x.ok ? "PASS" : "FAIL"}] ${x.n}  ${x.detail}`),
      fail.length === 0 ? "RELTEST PASS" : "RELTEST FAIL",
    ];
  }
  if (cmd === "reboot" || full === "shutdown -r now") return ["__RESET__"];
  if (cmd === "clear") return ["__CLS__"];
  if (cmd === "echo") return [args];
  return [`-bash: ${cmd}: command not found`];
}

export function kernelLog(p: DutProfile, bootMs: number): string[] {
  const all = osBanner(p);
  const n = Math.min(all.length, Math.max(1, Math.floor((bootMs / 2800) * all.length)));
  return all.slice(0, n);
}
