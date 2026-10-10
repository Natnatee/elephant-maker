import MockLogin from "@/components/mock-login";

export default function LoginPage() {
  return (
    <main className="container mx-auto min-h-screen max-w-2xl space-y-6 bg-[#fff9ed] px-4 py-12 text-[#152b46] sm:px-8">
      <header className="space-y-3">
        <p className="eyebrow text-sm font-bold text-orange-800">
          ELEPHANT MAKER • DEMO
        </p>
        <h1 className="text-3xl font-bold">ลองเลือกบัญชีผู้สร้าง</h1>
        <p className="muted">จำลองประสบการณ์เข้าใช้งาน โดยไม่เชื่อมบัญชีจริง</p>
      </header>
      <MockLogin />
    </main>
  );
}
