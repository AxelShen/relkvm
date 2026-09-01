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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface text-signal">
          {status === "connecting" ? (
            <>
              <LoaderCircle className="size-6 animate-spin text-muted" />
              <p className="text-sm text-muted">WebRTC 連線 {host || "JetKVM"}…</p>
            </>
          ) : (
            <>
              <div className="text-xl tracking-widest text-muted">NO SIGNAL</div>
              <p className="px-4 text-center text-xs text-muted">
                {error ?? "真機模式：填 JetKVM IP 後按連線。需與裝置同一區網。"}
              </p>
            </>
          )}
        </div>
      )}
      <div className="kvm-scan pointer-events-none absolute inset-0" />
    </div>
  );
}
