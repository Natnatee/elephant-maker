import type { Metadata } from "next";
import TestFlash from "@/components/test-flash";

export const metadata: Metadata = {
  title: "ทดลองแฟลช ESP32-C3 | Elephant Maker",
  robots: { index: false, follow: false },
};

export default function TestFlashPage() {
  return (
    <main className="container py-8">
      <h1 className="text-3xl font-bold">ทดลองแฟลช ESP32-C3</h1>
      <p className="mt-3 mb-6 text-lg text-[var(--muted)]">
        เลือกไฟล์ → เชื่อมต่อและตรวจบอร์ด → ยืนยันติดตั้ง
      </p>
      <TestFlash />
    </main>
  );
}
