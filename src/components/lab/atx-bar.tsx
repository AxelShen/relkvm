"use client";

import { Power, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useLab } from "@/lib/lab-store";

export function AtxBar({ className }: { className?: string }) {
  const power = useLab((s) => s.power);
  const running = useLab((s) => s.running);
  const mode = useLab((s) => s.mode);
  const dutPower = useLab((s) => s.duts[s.activeId].power);
  const liveStatus = useLab((s) => s.liveStatus);
  const off = dutPower === "off";
  const liveReady = mode !== "live" || liveStatus === "connected";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button
        variant={off ? "primary" : "outline"}
        disabled={running}
        onClick={() => power(mode === "live" ? "on" : off ? "on" : "off")}
      >
        <Power className="size-4" />
        {mode === "live" ? "ATX 短按" : off ? "電源" : "關機"}
      </Button>
      <Button variant="outline" disabled={running} onClick={() => power("cycle")}>
        <RotateCcw className="size-4" />
        重置
      </Button>
      {mode === "live" && (
        <Button variant="danger" disabled={running} onClick={() => power("off")}>
          長按關機
        </Button>
      )}
      {mode === "live" && !liveReady && (
        <span className="self-center text-xs text-fail">先連上 JetKVM，電源才會送到主機板</span>
      )}
    </div>
  );
}
