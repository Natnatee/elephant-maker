"use client";

import { useId, useRef, useState } from "react";
import TestFlash from "@/components/test-flash";

export default function ProjectFlash({ title }: { title: string }) {
  const headingId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [open, setOpen] = useState(false);

  function close() {
    if (busy.current) return;
    dialog.current?.close();
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="button primary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!dialog.current || dialog.current.open) return;
          dialog.current.showModal();
          setOpen(true);
          heading.current?.focus();
        }}
      >
        Flash
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] backdrop:bg-[var(--foreground)]/60"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
        }}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <h2
            ref={heading}
            id={headingId}
            tabIndex={-1}
            className="min-w-0 break-words text-2xl font-bold"
          >
            ติดตั้ง · {title}
          </h2>
          <button
            type="button"
            className="button secondary min-h-12 shrink-0 px-5 py-3 text-lg disabled:opacity-50"
            disabled={isBusy}
            onClick={close}
          >
            ปิดหน้าต่างแฟลช
          </button>
        </header>
        {open && (
          <div className="space-y-6 p-4 sm:p-6">
            <p className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-lg text-[var(--warning-text)]">
              นี่คือการแฟลชบอร์ดจริง ไม่ใช่ mock การติดตั้งจะล้าง Flash ทั้งหมด
              รวมโปรแกรมเดิม Wi-Fi และข้อมูลที่บันทึกไว้ ชุดเฟิร์มแวร์
              ESP32_C3_CHECK ที่เตรียมไว้ใช้ได้เฉพาะ localhost เท่านั้น บน
              production ให้เลือกไฟล์ .bin ในคอมเองผ่านหัวข้อขั้นสูง
            </p>
            <TestFlash
              embedded
              projectTitle={title}
              onBusyChange={(value) => {
                busy.current = value;
                setIsBusy(value);
              }}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
