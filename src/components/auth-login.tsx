"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { normalizeUsername, usernameError, passwordError } from "@/lib/auth/validation";

type Mode = "login" | "register" | "forgot";

function authError(error: { code?: string; status?: number }) {
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
    return "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
  }
  if (error.code === "weak_password") return "รหัสผ่านไม่ปลอดภัยเพียงพอ กรุณาใช้รหัสผ่านที่คาดเดายากขึ้น";
  if (error.code === "email_not_confirmed") return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ โดยตรวจสอบกล่องจดหมายและสแปม";
  return "ทำรายการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}

export default function AuthLogin({ next, error }: { next?: string; error?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  function changeMode(value: Mode) {
    if (busy.current) return;
    if (passwordInput.current) passwordInput.current.value = "";
    setMode(value);
    setMessage("");
    setFailed(false);
  }

  function callbackUrl(path: string) {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", path);
    return callback.toString();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const username = normalizeUsername(String(form.get("username") ?? ""));
    setMessage("");
    setFailed(false);
    if (mode === "register") {
      const validation = usernameError(username) || passwordError(password);
      if (validation) {
        setFailed(true);
        setMessage(validation);
        return;
      }
    }
    busy.current = true;
    setPending(mode);
    let navigating = false;
    try {
      const supabase = createClient();
      const auth = supabase.auth;
      if (mode === "register") {
        const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
        if (lookupError) {
          setFailed(true);
          setMessage("ตรวจสอบ Username ไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
          return;
        }
        if (existing) {
          setFailed(true);
          setMessage("Username นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น");
          return;
        }
      }
      if (mode === "forgot") {
        const { error } = await auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl("/account/password"),
        });
        if (error) {
          setFailed(true);
          setMessage(authError(error));
          return;
        }
        setMessage("หากอีเมลนี้สามารถรับลิงก์ตั้งรหัสผ่านได้ ระบบจะส่งคำแนะนำให้ กรุณาตรวจสอบกล่องจดหมายและสแปม");
        return;
      }
      const { data, error } = mode === "register"
        ? await auth.signUp({
            email,
            password,
            options: {
              data: { username, name: username },
              emailRedirectTo: callbackUrl(getSafeNextPath(next)),
            },
          })
        : await auth.signInWithPassword({ email, password });
      if (error) {
        if (mode === "register" && (error.code === "user_already_exists" || error.code === "email_exists")) {
          setMessage("กรุณาตรวจสอบอีเมลเพื่อดำเนินการต่อ หากมีบัญชีอยู่แล้วสามารถเข้าสู่ระบบหรือขอตั้งรหัสผ่านใหม่ได้");
        } else {
          setFailed(true);
          setMessage(authError(error));
        }
        return;
      }
      if (data.session) {
        const destination = new URL("/account/setup", window.location.origin);
        destination.searchParams.set("next", getSafeNextPath(next));
        window.location.assign(destination.toString());
        navigating = true;
      } else if (mode === "register") {
        setMessage("กรุณาตรวจสอบอีเมลเพื่อดำเนินการต่อ หากมีบัญชีอยู่แล้วสามารถเข้าสู่ระบบหรือขอตั้งรหัสผ่านใหม่ได้");
      } else {
        setFailed(true);
        setMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    } catch {
      setFailed(true);
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง");
    } finally {
      if (passwordInput.current) passwordInput.current.value = "";
      if (!navigating) {
        busy.current = false;
        setPending(null);
      }
    }
  }

  async function signIn(provider: "google" | "facebook") {
    if (busy.current) return;
    busy.current = true;
    setPending(provider);
    setMessage("");
    setFailed(false);
    let navigating = false;
    try {
      const { url, publishableKey } = getSupabaseConfig();
      const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(15000),
      });
      if (!settingsResponse.ok) {
        setFailed(true);
        setMessage(authError({ status: settingsResponse.status }));
        return;
      }
      const settings = (await settingsResponse.json()) as { external?: Record<string, boolean> };
      if (!settings.external?.[provider]) {
        setFailed(true);
        setMessage(`ยังไม่เปิดใช้งาน ${provider === "google" ? "Google" : "Facebook"} กรุณาใช้อีเมลหรือช่องทางอื่น`);
        return;
      }
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl(getSafeNextPath(next)), skipBrowserRedirect: true },
      });
      if (error) {
        setFailed(true);
        setMessage(authError(error));
      } else if (data.url) {
        window.location.assign(data.url);
        navigating = true;
      } else {
        setFailed(true);
        setMessage("เริ่มเข้าสู่ระบบไม่ได้ กรุณาลองอีกครั้ง");
      }
    } catch {
      setFailed(true);
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง");
    } finally {
      if (!navigating) {
        busy.current = false;
        setPending(null);
      }
    }
  }

  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 disabled:opacity-60";
  const buttonClass = "rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)] disabled:opacity-60";

  return (
    <section aria-label="บัญชีผู้สร้าง" aria-busy={pending !== null} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="grid grid-cols-2 gap-2" aria-label="เลือกเข้าสู่ระบบหรือสมัครสมาชิก">
        {(["login", "register"] as const).map((value) => (
          <button key={value} type="button" disabled={pending !== null} aria-pressed={mode === value} onClick={() => changeMode(value)} className={`rounded-xl px-4 py-2 font-semibold disabled:opacity-60 ${mode === value ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted)]"}`}>
            {value === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error === "signout_failed" ? "ออกจากระบบไม่สำเร็จ กรุณากลับไปหน้าบัญชีแล้วลองอีกครั้ง" : "เข้าสู่ระบบไม่สำเร็จหรือลิงก์หมดอายุ กรุณาลองใหม่"}
        </p>
      )}
      {mode === "forgot" && <h2 className="font-semibold">ตั้งรหัสผ่านใหม่</h2>}
      <form key={mode} onSubmit={submit} className="space-y-4">
        <fieldset disabled={pending !== null} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">อีเมล</span>
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </label>
          {mode !== "forgot" && (
            <label className="block space-y-2">
              <span id="auth-password-label" className="text-sm font-medium">รหัสผ่าน</span>
              <input aria-labelledby="auth-password-label" ref={passwordInput} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={mode === "register" ? 128 : undefined} aria-describedby={mode === "register" ? "register-password-help" : undefined} className={inputClass} />
              {mode === "register" && <span id="register-password-help" className="block text-xs text-[var(--muted)]">8–128 ตัวอักษร</span>}
            </label>
          )}
          {mode === "register" && (
            <label className="block space-y-2">
              <span id="auth-username-label" className="text-sm font-medium">Username</span>
              <input aria-labelledby="auth-username-label" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required aria-describedby="register-username-help" className={inputClass} />
              <span id="register-username-help" className="block text-xs text-[var(--muted)]">3–24 ตัวอักษร ใช้ a–z, 0–9 และ _ ใช้เป็นชื่อแสดงเริ่มต้น Username เปลี่ยนภายหลังไม่ได้ แต่ชื่อที่แสดงแก้ไขได้</span>
            </label>
          )}
          <button type="submit" className={`${buttonClass} w-full`}>
            {pending === mode ? "กำลังดำเนินการ…" : mode === "register" ? "สมัครสมาชิก" : mode === "forgot" ? "ส่งลิงก์ตั้งรหัสผ่าน" : "เข้าสู่ระบบ"}
          </button>
        </fieldset>
      </form>
      {message && <p role={failed ? "alert" : "status"} aria-live="polite" className={`text-sm ${failed ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{message}</p>}
      <button type="button" disabled={pending !== null} onClick={() => changeMode(mode === "forgot" ? "login" : "forgot")} className="text-sm text-[var(--brand)] disabled:opacity-60">
        {mode === "forgot" ? "กลับไปเข้าสู่ระบบ" : "ลืมรหัสผ่าน?"}
      </button>
      {mode !== "forgot" && (
        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-center text-sm text-[var(--muted)]">หรือดำเนินการต่อด้วย</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["google", "facebook"] as const).map((provider) => (
              <button key={provider} type="button" disabled={pending !== null} onClick={() => signIn(provider)} className={buttonClass}>
                {pending === provider ? "กำลังเชื่อมต่อ…" : provider === "google" ? "Google" : "Facebook"}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
