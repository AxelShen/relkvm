"use client";

import { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";
import { getJetKvmSession } from "@/lib/jetkvm/session";
import { useLab } from "@/lib/lab-store";

export function LiveHdmi() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const status = useLab((s) => s.liveStatus);
  const error = useLab((s) => s.liveError);
  const host = useLab((s) => s.liveHost);
  const power = useLab((s) => s.power);
  const connectLive = useLab((s) => s.connectLive);
  const connecting = status === "connecting";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    return getJetKvmSession().attachVideo(el);
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-kvm-post">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      {status !== "connected" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface px-4 text-signal">
          {connecting ? (
            <>
              <LoaderCircle className="size-6 animate-spin text-muted" />
              <p className="text-sm text-muted">WebRTC 連線 {host || "JetKVM"}…</p>
            </>
          ) : (
            <>
              <div className="text-xl tracking-widest text-muted">NO SIGNAL</div>
              <p className="max-w-sm text-center text-xs text-muted">
                {error ?? "真機尚未連線。填 IP 後按連線，電源才會送到 ATX。"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void connectLive()}
                  className="inline-flex h-12 min-w-32 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg"
                >
                  連線 JetKVM
                </button>
                <button
                  type="button"
                  onClick={() => power("on")}
                  className="inline-flex h-12 min-w-32 items-center justify-center rounded-md border border-border px-5 text-sm"
                >
                  ATX 短按
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="kvm-scan pointer-events-none absolute inset-0" />
    </div>
  );
}