"use client";

import { useActionState } from "react";
import { updateDisplayName, type AccountActionState } from "@/app/account/actions";

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3";


export function DisplayNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(updateDisplayName, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-2">
        <span className="font-semibold">ชื่อ</span>
        <input name="name" defaultValue={name} maxLength={100} required disabled={pending} className={inputClass} autoComplete="nickname" />
      </label>
      <p className="text-sm text-[var(--muted)]">ใช้ชื่อเดียวกันบนโปรไฟล์และผลงาน รองรับชื่อไทย ชื่อซ้ำได้ และเปลี่ยนได้ภายหลัง</p>
      {state.error && <p role="alert" className="text-sm text-[var(--danger)]">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-[var(--success)]">{state.success}</p>}
      <button type="submit" disabled={pending} className="button secondary disabled:opacity-60">{pending ? "กำลังบันทึก…" : "บันทึกชื่อ"}</button>
    </form>
  );
}
