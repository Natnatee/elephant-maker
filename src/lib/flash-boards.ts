export const SUPERMINI_BOARD = {
  id: "esp32-c3-supermini",
  name: "ESP32-C3 SuperMini",
  chip: "ESP32-C3",
  flashSize: "4 MB",
  image: "/board/esp32c3Supermini.webp",
  prepareSteps: [
    "เสียบสาย USB ที่ส่งข้อมูลได้ และปิด Serial Monitor",
    "กด BOOT ค้างไว้ อย่าเพิ่งปล่อย",
    "ขณะกด BOOT ค้าง ให้กดแล้วปล่อย RESET",
    "ปล่อย BOOT แล้วกด “เลือกพอร์ตและตรวจบอร์ด” ในเว็บ",
  ],
  afterFlash: "กดแล้วปล่อย RESET โดยไม่ต้องกด BOOT เพื่อเริ่มโปรแกรม",
} as const;

export type FlashErrorStage = "file" | "connect" | "flash";

export function explainFlashError(error: unknown, stage: FlashErrorStage) {
  const detail = error instanceof Error ? error.message : "ไม่ทราบสาเหตุ";
  const thaiDetail = /[\u0e00-\u0e7f]/.test(detail)
    ? detail
    : "ดูรายละเอียดในหัวข้อแก้ปัญหา";
  if (stage === "file")
    return `ทำต่อไม่ได้: ${thaiDetail} — ตรวจชุดเฟิร์มแวร์ก่อน ยังไม่ได้เขียน Flash`;
  if (stage === "flash")
    return `ติดตั้งยังไม่สำเร็จ: ${thaiDetail} — อาจเขียนไปแล้วบางส่วน ห้ามถือว่าพร้อมใช้งาน เข้าโหมด BOOT ตามขั้นตอน แล้วเชื่อมต่อเพื่อติดตั้งใหม่`;
  if (/open|access|in use|busy|NetworkError/i.test(detail))
    return "เปิดพอร์ตไม่ได้ — ปิด Serial Monitor และโปรแกรมอื่นที่ใช้บอร์ด ตรวจสาย USB แล้วเข้าโหมด BOOT ตามขั้นตอนก่อนลองอีกครั้ง ยังไม่ได้เขียน Flash";
  if (
    /connect|sync|serial data|timed? ?out|timeout|packet|head of/i.test(detail)
  )
    return "เชื่อมต่อกับโหมดดาวน์โหลดไม่สำเร็จ — กด BOOT ค้าง → กดแล้วปล่อย RESET → ปล่อย BOOT จากนั้นเลือกพอร์ตของบอร์ดอีกครั้ง ยังไม่ได้เขียน Flash";
  return `ตรวจบอร์ดไม่ผ่าน: ${thaiDetail} — ยังไม่ได้เขียน Flash หากรุ่นชิป ขนาด Flash หรือการป้องกันไม่ตรง อย่าฝืนติดตั้ง`;
}
