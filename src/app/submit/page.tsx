import SubmitForm from "@/components/submit-form";

export default function SubmitPage() {
  return (
    <main className="container mx-auto min-h-screen max-w-4xl space-y-6 bg-[var(--background)] px-4 py-10 text-[var(--foreground)] sm:px-8">
      <header className="space-y-3">
        <p className="eyebrow text-sm font-bold tracking-wide text-[var(--accent)]">
          ELEPHANT MAKER • LOCAL DRAFT
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          แบ่งปันไอเดีย เริ่มจากร่างของคุณ
        </h1>
        <p className="muted">
          เล่าโปรเจกต์ เขียนคู่มือ และเตรียมข้อมูลไฟล์ใน 3 ขั้นตอน —
          ยังไม่ใช่การเผยแพร่จริง
        </p>
      </header>
      <SubmitForm />
    </main>
  );
}
