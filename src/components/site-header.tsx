"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ElephantMark, Icon } from "./icons";

const navigation = [
  { href: "/#explore", label: "สำรวจโปรเจกต์", icon: "cube" },
  { href: "/account", label: "ผลงานของฉัน", icon: "book" },
  { href: "/submit", label: "ฝากผลงาน", icon: "plus" },
  { href: "/submit/firmware-guide", label: "คู่มือเฟิร์มแวร์", icon: "chip" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    if (open) toggleRef.current?.focus();
  }

  function isActive(href: string) {
    if (href === "/#explore") return pathname === "/";
    if (href === "/submit") {
      return (
        (pathname === "/submit" || pathname.startsWith("/submit/")) &&
        !pathname.startsWith("/submit/firmware-guide")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const accountHref = signedIn ? "/account" : "/login";
  const accountLabel = signedIn ? "บัญชีของฉัน" : "เข้าสู่ระบบ";

  function navigationLinks(mobile = false) {
    return navigation.map(({ href, label, icon }, index) => (
      <Link
        key={href}
        href={href}
        ref={mobile && index === 0 ? firstLinkRef : undefined}
        className={`sidebar-link${isActive(href) ? " active" : ""}`}
        aria-current={isActive(href) ? "page" : undefined}
        onClick={close}
      >
        <Icon name={icon} size={22} />
        <span>{label}</span>
      </Link>
    ));
  }

  function accountLink() {
    return (
      <Link href={accountHref} className="sidebar-account" onClick={close}>
        <Icon name="arrow" size={22} />
        <span>{accountLabel}</span>
      </Link>
    );
  }

  return (
    <>
      <aside className="site-sidebar">
        <Link
          href="/"
          className="brand sidebar-brand"
          aria-label="ElephantMaker หน้าหลัก"
        >
          <ElephantMark size={40} />
          <span>ElephantMaker</span>
        </Link>
        <nav className="sidebar-nav" aria-label="เมนูหลัก">
          {navigationLinks()}
        </nav>
        <div className="sidebar-bottom">{accountLink()}</div>
      </aside>

      <header className="mobile-header">
        <Link
          href="/"
          className="brand"
          aria-label="ElephantMaker หน้าหลัก"
          onClick={close}
        >
          <ElephantMark size={40} />
          <span>ElephantMaker</span>
        </Link>
        <button
          ref={toggleRef}
          type="button"
          className="mobile-menu-toggle"
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => (open ? close() : setOpen(true))}
        >
          <Icon name={open ? "close" : "menu"} size={24} />
        </button>
      </header>

      {open && (
        <>
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="ปิดเมนู"
            onClick={close}
          />
          <nav id="mobile-nav" className="mobile-nav" aria-label="เมนูมือถือ">
            {navigationLinks(true)}
            <div className="sidebar-bottom">{accountLink()}</div>
          </nav>
        </>
      )}
    </>
  );
}
