"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordError } from "@/lib/auth/validation";

export default function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const password = String(form.get("password") ?? "");
    const invalid = passwordError(password);
    if (invalid || password !== form.get("confirmation")) {
      setError(invalid ?? "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("ลิงก์หรือเซสชันหมดอายุ กรุณาขอลิงก์ตั้งรหัสผ่านใหม่");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.code === "same_password" ? "กรุณาใช้รหัสผ่านที่ต่างจากเดิม" : error.code === "weak_password" ? "รหัสผ่านไม่ปลอดภัยเพียงพอ กรุณาเลือกรหัสผ่านใหม่" : "ตั้งรหัสผ่านไม่สำเร็จ กรุณาขอลิงก์ใหม่หรือเข้าสู่ระบบอีกครั้ง");
        return;
      }
      element.reset();
      setSaved(true);
    } catch {
      setError("เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  if (saved) return <div className="space-y-4"><p role="status">บันทึกรหัสผ่านใหม่แล้ว</p><a href="/account" className="button primary">ไปที่บัญชีของฉัน</a></div>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        <label className="block space-y-2"><span>รหัสผ่านใหม่</span><input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="w-full rounded-xl border border-[var(--border)] p-3" /></label>
        <label className="block space-y-2"><span>ยืนยันรหัสผ่านใหม่</span><input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className="w-full rounded-xl border border-[var(--border)] p-3" /></label>
        <p className="muted text-sm">ใช้รหัสผ่าน 8–128 ตัวอักษร และไม่ใช้ซ้ำกับบริการอื่น</p>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="button primary w-full" type="submit">{pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
      </fieldset>
    </form>
  );
}
