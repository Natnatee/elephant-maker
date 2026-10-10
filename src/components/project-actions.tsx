"use client";

import { useState } from "react";

export interface ProjectActionsProps {
  title: string;
  summary: string;
  slug: string;
  ownerName?: string;
}

export function ProjectActions({
  title,
  summary,
  slug,
  ownerName,
}: ProjectActionsProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function copy(withText: boolean) {
    try {
      const url = new URL(`/projects/${slug}`, window.location.origin).href;
      await navigator.clipboard.writeText(
        withText
          ? `${title}\nผลงานตัวอย่าง ยังไม่ผ่านการตรวจสอบ\n${summary}\nโดย ${ownerName ?? "Elephant Maker"}\n${url}`
          : url,
      );
      setMessage(withText ? "คัดลอกข้อความพร้อมลิงก์แล้ว" : "คัดลอกลิงก์แล้ว");
    } catch {
      setMessage(
        "คัดลอกไม่สำเร็จ กรุณาคัดลอก URL จากแถบที่อยู่ (clipboard ต้องใช้ HTTPS หรือ localhost)",
      );
    }
  }

  async function downloadCard() {
    setBusy(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const styles = getComputedStyle(document.documentElement);
      const palette = (name: string) => styles.getPropertyValue(name).trim();
      context.fillStyle = palette("--share-background");
      context.fillRect(0, 0, 1200, 630);
      context.fillStyle = palette("--share-accent");
      context.fillRect(0, 0, 18, 630);
      context.font = "bold 27px sans-serif";
      context.fillText("ELEPHANT MAKER / SAMPLE PROJECT", 64, 90);
      context.fillStyle = palette("--share-foreground");
      context.font = "bold 54px sans-serif";
      // Wrap by grapheme to avoid splitting Thai combining marks; no remote images or fonts.
      const segments = new Intl.Segmenter("th", {
        granularity: "grapheme",
      }).segment(title);
      const lines: string[] = [];
      let line = "";
      for (const { segment } of segments) {
        if (context.measureText(line + segment).width > 1060 && line) {
          lines.push(line);
          line = segment;
        } else line += segment;
      }
      if (line) lines.push(line);
      lines.slice(0, 3).forEach((text, index) => {
        let visible = text;
        if (index === 2 && lines.length > 3) {
          while (context.measureText(visible + "…").width > 1060)
            visible = visible.slice(0, -1);
          visible += "…";
        }
        context.fillText(visible, 64, 210 + index * 82);
      });
      context.font = "22px sans-serif";
      context.fillStyle = palette("--share-muted");
      context.fillText(`โดย ${ownerName ?? "Elephant Maker"}`, 64, 452, 1060);
      context.font = "28px sans-serif";
      context.fillStyle = palette("--share-accent");
      context.fillText(
        "ผลงานตัวอย่าง · ไม่ใช่คู่มือที่ผ่านการตรวจสอบ",
        64,
        505,
      );
      context.font = "22px sans-serif";
      context.fillStyle = palette("--share-foreground");
      const url = new URL(`/projects/${slug}`, window.location.origin).href;
      context.fillText(url, 64, 563, 1060);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("Export failed")),
          "image/png",
        ),
      );
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${slug}-social-card.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage(
        "สร้างการ์ด PNG แล้ว หากไม่ดาวน์โหลดให้ตรวจการตั้งค่าเบราว์เซอร์",
      );
    } catch {
      setMessage("สร้างการ์ดไม่สำเร็จ ลองอีกครั้งหรือใช้ปุ่มคัดลอกลิงก์");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button secondary"
          onClick={() => copy(false)}
        >
          คัดลอกลิงก์
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => copy(true)}
        >
          คัดลอกข้อความแชร์
        </button>
        <button
          type="button"
          className="button secondary disabled:opacity-50"
          disabled={busy}
          onClick={downloadCard}
        >
          {busy ? "กำลังสร้าง…" : "ดาวน์โหลดการ์ด PNG"}
        </button>
      </div>
      <p role="status" className="muted min-h-6 text-sm">
        {message}
      </p>
    </div>
  );
}
