import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
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
        <div className="app-body">
          <div id="main-content" tabIndex={-1} className="site-content">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
