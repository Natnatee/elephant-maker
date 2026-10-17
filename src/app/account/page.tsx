import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AccountPanel, {
  type AccountProfile,
  type AccountProject,
} from "@/components/account-panel";
import { createClient } from "@/lib/supabase/server";

function dataError(
  error: { code?: string } | null,
  subject: string,
): string | undefined {
  if (!error) return undefined;
  if (
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(
      error.code || "",
    )
  ) {
    return `ยังอ่าน${subject}ไม่ได้: โครงสร้างฐานข้อมูลยังไม่พร้อม กรุณาใช้ migration สำหรับ profiles / projects และตรวจสอบ schema ก่อน`;
  }
  return `อ่าน${subject}ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและนโยบายสิทธิ์ RLS แล้วลองใหม่`;
}

async function AccountContent() {
  // Read request cookies outside error handling so prerender suspension is preserved.

  const store = await cookies();
  let supabase;
  try {
    supabase = await createClient(store);
  } catch {
    return (
      <p role="alert" className="text-[var(--danger)]">
        ระบบบัญชียังไม่พร้อม กรุณาตั้งค่า Supabase แล้วลองใหม่
      </p>
    );
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=/account");

  const [profileResult, projectsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,username,bio,avatar,contacts")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("title,slug,status,owner_id")
      .eq("owner_id", user.id)
      .eq("status", "draft"),
  ]);

  if (!profileResult.error && profileResult.data && !profileResult.data.username) redirect("/account/setup");

  return (
    <AccountPanel
      member={{ id: user.id, email: user.email }}
      profile={
        profileResult.error
          ? null
          : (profileResult.data as AccountProfile | null)
      }
      projects={
        projectsResult.error
          ? []
          : ((projectsResult.data || []) as AccountProject[])
      }
      profileError={dataError(profileResult.error, "ข้อมูลโปรไฟล์")}
      projectsError={dataError(projectsResult.error, "ร่างผลงาน")}
    />
  );
}

export default function AccountPage() {
  return (
    <main className="container mx-auto min-h-screen max-w-3xl space-y-6 bg-[var(--background)] px-4 py-12 text-[var(--foreground)] sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-bold text-[var(--brand)]">ELEPHANT MAKER</p>
        <h1 className="text-3xl font-bold">บัญชีของฉัน</h1>
        <p className="text-[var(--muted)]">
          ข้อมูลสมาชิกและร่างผลงานที่บันทึกในบัญชี
        </p>
      </header>
      <Suspense fallback={<p role="status">กำลังตรวจสอบบัญชีและโหลดข้อมูล…</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}
