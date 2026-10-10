import MockLogin from "@/components/mock-login";
import Link from "next/link";
export default function DemoLoginPage() {
  return (
    <main className="container max-w-2xl space-y-6 py-12">
      <p className="eyebrow">UX SANDBOX · ไม่ใช่บัญชีจริง</p>
      <h1 className="text-3xl font-bold">ทดลองหน้าสมาชิกเดิม</h1>
      <p className="muted">
        บัญชีในหน้านี้ไม่ให้สิทธิ์เข้าถึง Supabase และไม่ใช่ระบบล็อกอิน
      </p>
      <Link className="button secondary" href="/login">
        ไปเข้าสู่ระบบจริง
      </Link>
      <MockLogin />
    </main>
  );
}
