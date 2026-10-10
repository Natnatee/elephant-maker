"use client";

import Link from "next/link";
import { useState } from "react";

const KEY = "elephant-maker:mock-identity:v1";
const providers = ["Google", "Facebook", "TikTok"] as const;
type Provider = (typeof providers)[number];

export default function MockLogin() {
  const [identity, setIdentity] = useState<Provider | null>(null);
  const [message, setMessage] = useState("");
  function restore() {
    try {
      const saved = localStorage.getItem(KEY);
      if (providers.some((provider) => provider === saved)) {
        setIdentity(saved as Provider);
        setMessage(`เปิดบัญชีจำลอง ${saved} แล้ว — ไม่ใช่การเข้าสู่ระบบจริง`);
      } else setMessage("ยังไม่มีบัญชีจำลองที่บันทึกไว้");
    } catch {
      setMessage("เบราว์เซอร์ไม่อนุญาตให้อ่านข้อมูลบัญชีจำลอง");
    }
  }
  function choose(provider: Provider) {
    try {
      localStorage.setItem(KEY, provider);
      setIdentity(provider);
      setMessage(
        `เลือกผู้ใช้จำลอง ${provider} แล้ว — ไม่ใช่การเข้าสู่ระบบจริง`,
      );
    } catch {
      setMessage("เก็บบัญชีจำลองไม่ได้ เบราว์เซอร์อาจปิดกั้น localStorage");
    }
  }
  function logout() {
    try {
      localStorage.removeItem(KEY);
      setIdentity(null);
      setMessage("ออกจากบัญชีจำลองแล้ว ร่างผลงานในเครื่องยังอยู่");
    } catch {
      setMessage("ล้างบัญชีจำลองไม่ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์");
    }
  }
  return (
    <section className="panel space-y-5 rounded-2xl border border-slate-200 bg-[#fffcf5] p-6">
      <div className="rounded-xl bg-orange-100 p-4 text-sm leading-6">
        <strong>โหมดสาธิตเท่านั้น • ไม่มี OAuth หรือระบบยืนยันตัวตน</strong>
        <p>
          เก็บแค่ชื่อผู้ให้บริการที่เลือกใน localStorage ไม่มี token
          ไม่ตรวจสิทธิ์ ไม่ใช่ระบบรักษาความปลอดภัย และไม่ส่งข้อมูลให้ Google,
          Facebook หรือ TikTok
        </p>
      </div>
      <button
        type="button"
        onClick={restore}
        className="button secondary rounded-xl border border-slate-300 px-4 py-3"
      >
        เปิดบัญชีจำลองที่เคยเลือก (Demo)
      </button>
      <div className="grid gap-3">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            aria-pressed={identity === provider}
            onClick={() => choose(provider)}
            className={`button secondary rounded-xl border p-4 text-left font-semibold focus-visible:outline-2 focus-visible:outline-orange-600 ${identity === provider ? "border-orange-700 bg-orange-100" : "border-slate-300 bg-white"}`}
          >
            ทดลองเลือก {provider}{" "}
            <span className="badge text-sm">
              (Demo{identity === provider ? " • เลือกอยู่" : ""})
            </span>
            {provider === "TikTok" && (
              <span className="muted mt-1 block text-sm font-normal">
                การเชื่อมต่อในอนาคตเท่านั้น ไม่ใช่การรองรับ TikTok จริงผ่าน
                Supabase
              </span>
            )}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {message}
      </p>
      {identity && (
        <div className="space-y-3">
          <p>ผู้ใช้จำลอง: Maker · {identity}</p>
          <button
            type="button"
            className="button secondary rounded-xl border border-slate-300 px-4 py-3"
            onClick={logout}
          >
            ออกจากบัญชีจำลอง
          </button>
        </div>
      )}
      <Link
        href="/submit"
        className="button primary inline-block rounded-xl bg-orange-700 px-5 py-3 font-semibold text-white"
      >
        ไปสร้างร่างในเครื่อง (ไม่ต้องล็อกอิน)
      </Link>
    </section>
  );
}
