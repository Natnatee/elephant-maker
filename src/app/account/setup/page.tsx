import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { UsernameSetupForm } from "@/components/member-profile-form";

type Props = { searchParams: Promise<{ next?: string }> };

async function SetupContent({ searchParams }: Props) {
  const { next: requestedNext } = await searchParams;
  const next = getSafeNextPath(requestedNext);
  const store = await cookies();
  const supabase = await createClient(store);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: profile, error } = await supabase.from("profiles").select("name,username").eq("id", user.id).maybeSingle();
  if (error || !profile) return <p role="alert" className="text-[var(--danger)]">ยังอ่านโปรไฟล์ไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลเพื่อตรวจสอบโครงสร้างฐานข้อมูล</p>;
  if (profile.username) redirect(next);
  return (
    <section className="panel space-y-5 p-6">
      <h1 className="text-2xl font-bold">เลือก Username ของคุณ</h1>
      <p className="muted">สวัสดี {profile.name} เลือกชื่อเฉพาะสำหรับลิงก์โปรไฟล์อีกอย่างเดียวก็พร้อมใช้งานครับ</p>
      <UsernameSetupForm next={next} />
      <form method="post" action="/auth/signout"><button type="submit" className="text-sm text-[var(--muted)] underline">ออกจากระบบ</button></form>
    </section>
  );
}

export default function SetupPage(props: Props) {
  return <main className="container mx-auto max-w-xl px-4 py-12"><Suspense fallback={<p role="status">กำลังตรวจสอบโปรไฟล์…</p>}><SetupContent {...props} /></Suspense></main>;
}
