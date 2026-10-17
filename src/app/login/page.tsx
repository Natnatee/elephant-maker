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
    <main className="auth-page">
      <div className="auth-shell">
        <Suspense fallback={<p role="status" className="auth-loading">กำลังเตรียมการเข้าสู่ระบบ…</p>}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
