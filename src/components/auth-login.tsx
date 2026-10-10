"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSafeNextPath } from "@/lib/auth/redirect";

export default function AuthLogin({
  next,
  error,
}: {
  next?: string;
  error?: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const busy = useRef(false);

  async function signIn(provider: "google" | "facebook") {
    if (busy.current) return;
    busy.current = true;
    setPending(provider);
    setMessage("");
    try {
      const { url, publishableKey } = getSupabaseConfig();
      const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!settingsResponse.ok)
        throw new Error("Auth configuration unavailable");
      const settings = (await settingsResponse.json()) as {
        external?: Record<string, boolean>;
      };
      if (!settings.external?.[provider]) {
        setMessage(
          `ยังไม่ได้เปิด ${provider === "google" ? "Google" : "Facebook"} ใน Supabase Dashboard → Authentication → Providers กรุณาตั้งค่า provider ก่อน`,
        );
        return;
      }
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", getSafeNextPath(next));
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });
      if (error) {
        setMessage(
          "เริ่มเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบว่าเปิดผู้ให้บริการใน Supabase Dashboard และตั้งค่า Redirect URL แล้ว จากนั้นลองอีกครั้ง",
        );
      }
    } catch {
      setMessage(
        "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบเครือข่ายและการตั้งค่า Supabase แล้วลองอีกครั้ง",
      );
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-sm text-[var(--warning-text)]">
        การเข้าสู่ระบบจริงต้องเปิด Google / Facebook และตั้งค่า OAuth ใน
        Supabase Dashboard ก่อน หากยังไม่ได้ตั้งค่า จะไม่สามารถเข้าสู่ระบบได้
      </p>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error === "signout_failed"
            ? "ออกจากระบบไม่สำเร็จ กรุณากลับไปหน้าบัญชีแล้วลองอีกครั้ง"
            : "เข้าสู่ระบบไม่สำเร็จหรือลิงก์หมดอายุ กรุณาลองใหม่ และตรวจสอบการตั้งค่า OAuth"}
        </p>
      )}
      <div className="grid gap-3">
        {(["google", "facebook"] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={pending !== null}
            onClick={() => signIn(provider)}
            className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)] disabled:opacity-60"
          >
            {pending === provider
              ? "กำลังเชื่อมต่อ…"
              : `เข้าสู่ระบบด้วย ${provider === "google" ? "Google" : "Facebook"}`}
          </button>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-[var(--danger)]"
      >
        {message}
      </p>
      <p className="text-sm text-[var(--muted)]">
        เมื่อเลือกผู้ให้บริการ คุณจะไปยืนยันตัวตนกับ Google หรือ Facebook
      </p>
    </section>
  );
}
