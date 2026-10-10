import Link from "next/link";
import { Icon } from "@/components/icons";
export default function NotFound() {
  return (
    <main className="container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="eyebrow">404 / IDEA NOT FOUND</span>
      <h1 className="mt-4 text-3xl font-bold">ยังไม่พบโปรเจกต์นี้</h1>
      <p className="muted mt-4 max-w-md">
        ลิงก์อาจไม่ถูกต้อง หรือผลงานยังเป็นร่างที่ไม่ได้เผยแพร่
        ลองกลับไปหาไอเดียอื่นกันครับ
      </p>
      <Link className="button primary mt-7" href="/">
        สำรวจโปรเจกต์ <Icon name="arrow" />
      </Link>
    </main>
  );
}
