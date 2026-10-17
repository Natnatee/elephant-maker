"use client";

import { useActionState } from "react";
import { completeProfile, updateDisplayName, type AccountActionState } from "@/app/account/actions";

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3";

export function UsernameSetupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(completeProfile, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-2">
        <span className="font-semibold">Username</span>
        <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={24} required disabled={pending} className={inputClass} aria-describedby="username-help" />
      </label>
      <p id="username-help" className="text-sm text-[var(--muted)]">ใช้ a–z, 0–9 และ _ ยาว 3–24 ตัว ระบบจะเปลี่ยนเป็นตัวพิมพ์เล็ก ชื่อนี้ใช้ในลิงก์โปรไฟล์และเปลี่ยนภายหลังไม่ได้ ส่วนชื่อที่แสดงแก้ไขได้</p>
      {state.error && <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>}
      <button type="submit" disabled={pending} className="button primary w-full disabled:opacity-60">{pending ? "กำลังบันทึก…" : "บันทึกและดำเนินการต่อ"}</button>
    </form>
  );
}

export function DisplayNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(updateDisplayName, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-2">
        <span className="font-semibold">ชื่อที่แสดง</span>
        <input name="name" defaultValue={name} maxLength={100} required disabled={pending} className={inputClass} autoComplete="nickname" />
      </label>
      <p className="text-sm text-[var(--muted)]">ใช้เป็นชื่อผู้เขียนและชื่อบนโปรไฟล์ เปลี่ยนได้โดยไม่กระทบ Username</p>
      {state.error && <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-[var(--success)]">{state.success}</p>}
      <button type="submit" disabled={pending} className="button secondary disabled:opacity-60">{pending ? "กำลังบันทึก…" : "บันทึกชื่อ"}</button>
    </form>
  );
}
