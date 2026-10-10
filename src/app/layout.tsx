import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ElephantMark } from "@/components/icons";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Elephant Maker — ไอเดียทำเอง ใช้แก้ปัญหาได้จริง",
    template: "%s | Elephant Maker",
  },
  description:
    "พื้นที่แบ่งปันโปรเจกต์ DIY ของคนไทย รวมคู่มือ อุปกรณ์ และไฟล์ในที่เดียว ฝากง่าย แชร์สะดวก ทำตามเป็นขั้นตอน",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <a className="skip-link" href="#main-content">
          ข้ามไปเนื้อหา
        </a>
        <SiteHeader />
        <div id="main-content" tabIndex={-1} className="site-content">
          {children}
        </div>
        <footer className="site-footer">
          <div className="container footer-inner">
            <div className="brand">
              <ElephantMark size={32} />
              <span>
                elephant<span className="brand-light">maker</span>
              </span>
            </div>
            <p>แบ่งปันสิ่งที่คุณทำ ให้เป็นสิ่งที่ใคร ๆ ก็ทำได้</p>
            <Link href="/submit">เริ่มแบ่งปันผลงาน ↗</Link>
          </div>
          <div className="container footer-note">
            ต้นแบบเพื่อทดลอง UX · ข้อมูลและสมาชิกเป็นเดโม ·
            ยังไม่มีการอัปโหลดหรือแฟลชจริง
          </div>
        </footer>
      </body>
    </html>
  );
}
