"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ElephantMark, Icon } from "./icons";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  function close() {
    setOpen(false);
  }
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          href="/"
          className="brand"
          aria-label="Elephant Maker หน้าหลัก"
          onClick={close}
        >
          <ElephantMark />
          <span>
            elephant<span className="brand-light">maker</span>
            <small>ไอเดียทำเอง ใช้ได้จริง</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="เมนูหลัก">
          <Link href="/#explore" className={pathname === "/" ? "active" : ""}>
            สำรวจโปรเจกต์
          </Link>
          <Link
            href="/submit/firmware-guide"
            className={pathname.includes("firmware-guide") ? "active" : ""}
          >
            คู่มือฝากเฟิร์มแวร์
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="login-link" href="/login">
            เข้าสู่ระบบ <span className="demo-dot">เดโม</span>
          </Link>
          <Link href="/submit" className="button primary compact">
            <Icon name="plus" size={17} />
            ฝากผลงาน
          </Link>
          <button
            className="mobile-toggle"
            aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          className="mobile-nav container"
          aria-label="เมนูมือถือ"
        >
          <Link href="/#explore" onClick={close}>
            สำรวจโปรเจกต์
          </Link>
          <Link href="/submit/firmware-guide" onClick={close}>
            คู่มือฝากเฟิร์มแวร์
          </Link>
          <Link href="/login" onClick={close}>
            เข้าสู่ระบบจำลอง
          </Link>
        </nav>
      )}
    </header>
  );
}
