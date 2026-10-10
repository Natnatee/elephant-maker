"use client";

import { useState } from "react";
import type { Step } from "@/lib/types";

export interface StepGuideProps {
  steps: Step[];
}

export function StepGuide({ steps }: StepGuideProps) {
  const [index, setIndex] = useState(0);
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return <p className="muted">ยังไม่มีขั้นตอนตัวอย่าง</p>;

  return (
    <div className="space-y-5">
      <p className="muted text-sm">
        ขั้นตอนแนวคิดเท่านั้น ไม่ใช่คู่มือที่ผ่านการตรวจสอบ
      </p>
      <ol className="flex flex-wrap gap-2" aria-label="เลือกขั้นตอน">
        {steps.map((item, position) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={position === index ? "step" : undefined}
              onClick={() => setIndex(position)}
              className={`button ${position === index ? "primary" : "secondary"}`}
            >
              <span className="sr-only">ขั้นตอน </span>
              {position + 1}
              <span className="sr-only">: {item.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="rounded-2xl bg-[var(--surface-soft)] p-5 text-[var(--foreground)]"
      >
        <p className="eyebrow">
          ขั้นตอน {index + 1} / {steps.length}
        </p>
        <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
        <p className="mt-3 leading-relaxed">{step.description}</p>
        {step.safetyNote && (
          <p className="mt-4 font-semibold text-[var(--warning-text)]">
            ข้อควรระวัง: {step.safetyNote}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          className="button secondary disabled:cursor-not-allowed disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
        >
          ← ก่อนหน้า
        </button>
        <button
          type="button"
          className="button primary disabled:cursor-not-allowed disabled:opacity-40"
          disabled={index === steps.length - 1}
          onClick={() =>
            setIndex((value) => Math.min(steps.length - 1, value + 1))
          }
        >
          ถัดไป →
        </button>
      </div>
    </div>
  );
}
