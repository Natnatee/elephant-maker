import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "@/components/password-form";

async function PasswordContent() {
  const supabase = await createClient(await cookies());
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/account/password");
  return <section className="panel space-y-5 p-6"><h1 className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1><PasswordForm /></section>;
}

export default function PasswordPage() {
  return <main className="container mx-auto max-w-xl px-4 py-12"><Suspense fallback={<p role="status">กำลังตรวจสอบลิงก์และบัญชี…</p>}><PasswordContent /></Suspense></main>;
}
