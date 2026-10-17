import { Suspense } from "react";
import AuthLogin from "@/components/auth-login";
import { getSafeNextPath } from "@/lib/auth/redirect";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AuthLogin
      next={getSafeNextPath(
        typeof params.next === "string" ? params.next : undefined,
      )}
      error={typeof params.error === "string" ? params.error : undefined}
    />
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="container mx-auto min-h-screen max-w-2xl space-y-6 bg-[var(--background)] px-4 py-12 text-[var(--foreground)] sm:px-8">
      <header className="space-y-3">
        <p className="text-sm font-bold text-[var(--brand)]">ELEPHANT MAKER</p>
        <h1 className="text-3xl font-bold">เข้าสู่ระบบบัญชีผู้สร้าง</h1>
        <p className="text-[var(--muted)]">
          เข้าสู่ระบบหรือสมัครสมาชิกด้วยอีเมล หรือใช้ Google / Facebook
                    เพื่อจัดการข้อมูลสมาชิกและร่างผลงานของคุณ
        </p>
      </header>
      <Suspense fallback={<p role="status">กำลังเตรียมการเข้าสู่ระบบ…</p>}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
