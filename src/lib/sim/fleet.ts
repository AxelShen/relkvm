import type { BiosSettings, DutProfile } from "./types";

export const DUTS: DutProfile[] = [
  {
    id: "dut-a1",
    name: "DUT-A1",
    platform: "Whitley-WS",
    cpu: "Intel Xeon w7-2495X",
    cores: "24C / 48T",
    memory: "128 GB DDR5-5600",
    storage: "WD_BLACK SN850X 2TB",
    biosVersion: "F.22",
    biosTag: "RELEASE",
    biosDate: "08/31/2026",
    vendor: "American Megatrends",
    board: "REL-WS-W790",
    serial: "REL-A1-24-88421",
    jetkvm: { id: "7F3A", host: "192.168.7.22", fw: "0.4.8" },
  },
  {
    id: "dut-b2",
    name: "DUT-B2",
    platform: "Genoa-SP",
    cpu: "AMD EPYC 9354",
    cores: "32C / 64T",
    memory: "256 GB DDR5-4800",
    storage: "Samsung PM9A3 3.84TB",
    biosVersion: "3.14",
    biosTag: "RELEASE",
    biosDate: "07/12/2026",
    vendor: "American Megatrends",
    board: "REL-SP-H13",
    serial: "REL-B2-26-11003",
    jetkvm: { id: "9C21", host: "192.168.7.31", fw: "0.4.8" },
  },
  {
    id: "dut-c3",
    name: "DUT-C3",
    platform: "Meteor-U",
    cpu: "Intel Core Ultra 9 185H",
    cores: "16C / 22T",
    memory: "64 GB LPDDR5X",
    storage: "Kioxia XG10 1TB",
    biosVersion: "1.08",
    biosTag: "RELEASE",
    biosDate: "08/02/2026",
    vendor: "American Megatrends",
    board: "REL-NB-MU1",
    serial: "REL-C3-11-55209",
    jetkvm: { id: "2A08", host: "192.168.7.44", fw: "0.4.8" },
  },
];

export function defaultSettings(): BiosSettings {
  return {
    virtTech: true,
    hyperThreading: true,
    turboBoost: true,
    nxBit: true,
    above4g: true,
    vtd: true,
    sataMode: "AHCI",
    primaryDisplay: "PEG",
    usbLegacy: true,
    xhciHandoff: true,
    secureBoot: true,
    tpm: true,
    cfgLock: true,
    adminPw: false,
    csm: false,
    bootMode: "UEFI",
    fastBoot: false,
    quietBoot: false,
    boot1: "nvme",
  };
}

export function cloneSettings(s: BiosSettings): BiosSettings {
  return { ...s };
}
