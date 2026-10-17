"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { displayNameError, passwordError } from "@/lib/auth/validation";
import { ElephantMark } from "@/components/icons";
import GoogleMark from "@/components/google-mark";
import "./auth-login.css";

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
    const name = String(form.get("name") ?? "");
    setMessage("");
    setFailed(false);
    if (mode === "register") {
      const validation = displayNameError(name) || passwordError(password);
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
              data: { name: name.trim() },
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
        const destination = new URL(getSafeNextPath(next), window.location.origin);
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

  async function signIn() {
      const provider = "google";
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
        setMessage("ยังไม่เปิดใช้งาน Google กรุณาใช้อีเมล");
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

  const title = mode === "register" ? "สร้างบัญชีของคุณ" : mode === "forgot" ? "ลืมรหัสผ่าน?" : "ยินดีต้อนรับกลับ";
  const subtitle = mode === "register" ? "เริ่มสร้างสรรค์ไปกับ Elephant Maker" : mode === "forgot" ? "เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ทางอีเมล" : "เข้าสู่ระบบเพื่อสร้างสรรค์ผลงานต่อ";

  return (
    <section aria-labelledby="auth-title" aria-busy={pending !== null} className="auth-card">
      <header className="auth-header">
        <ElephantMark size={56} />
        <p className="auth-brand">ELEPHANT MAKER</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
      </header>
      {error && <p role="alert" className="auth-notice auth-error">{error === "signout_failed" ? "ออกจากระบบไม่สำเร็จ กรุณากลับไปหน้าบัญชีแล้วลองอีกครั้ง" : "เข้าสู่ระบบไม่สำเร็จหรือลิงก์หมดอายุ กรุณาลองใหม่"}</p>}
      {mode !== "forgot" && (
        <>
          <button type="button" disabled={pending !== null} onClick={() => signIn()} className="auth-google">
            <GoogleMark />
            {pending === "google" ? "กำลังเชื่อมต่อ…" : "ดำเนินการต่อด้วย Google"}
          </button>
          <div className="auth-divider"><span>หรือใช้อีเมล</span></div>
        </>
      )}
      <form key={mode} onSubmit={submit}>
        <fieldset disabled={pending !== null} className="auth-fields">
          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-name">ชื่อที่แสดง</label>
              <input id="auth-name" name="name" type="text" autoComplete="name" required maxLength={100} placeholder="ชื่อของคุณ" />
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-email">อีเมล</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required placeholder="you@example.com" />
          </div>
          {mode !== "forgot" && (
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">รหัสผ่าน</label>
                {mode === "login" && <button type="button" className="auth-link" onClick={() => changeMode("forgot")}>ลืมรหัสผ่าน?</button>}
              </div>
              <input id="auth-password" ref={passwordInput} name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required minLength={mode === "register" ? 8 : undefined} maxLength={mode === "register" ? 128 : undefined} aria-describedby={mode === "register" ? "auth-password-help" : undefined} />
              {mode === "register" && <p id="auth-password-help" className="auth-help">ใช้รหัสผ่าน 8–128 ตัวอักษร</p>}
            </div>
          )}
          <button type="submit" className="auth-submit">
            {pending === mode ? "กำลังดำเนินการ…" : mode === "register" ? "สร้างบัญชี" : mode === "forgot" ? "ส่งลิงก์ตั้งรหัสผ่าน" : "เข้าสู่ระบบ"}
          </button>
        </fieldset>
      </form>
      {message && <p role={failed ? "alert" : "status"} aria-live="polite" className={`auth-notice ${failed ? "auth-error" : "auth-success"}`}>{message}</p>}
      <footer className="auth-footer">
        {mode !== "forgot" && <span>{mode === "login" ? "ยังไม่มีบัญชี?" : "มีบัญชีแล้ว?"} </span>}
        <button type="button" disabled={pending !== null} className="auth-link" onClick={() => changeMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "สมัครสมาชิก" : mode === "forgot" ? "กลับไปเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
        </button>
      </footer>
    </section>
  );
}
