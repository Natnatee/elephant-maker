import Link from "next/link";

export default function FirmwareGuidePage() {
  return (
    <main className="container mx-auto min-h-screen max-w-3xl space-y-6 bg-[var(--background)] px-4 py-10 text-[var(--foreground)] sm:px-8">
      <header className="space-y-3">
        <p className="eyebrow text-sm font-bold text-[var(--accent)]">
          MAKER HANDBOOK • ESP32
        </p>
        <h1 className="text-3xl font-bold">
          เตรียม firmware อย่างเข้าใจ ก่อนแบ่งปัน
        </h1>
        <p className="muted">
          คู่มือเริ่มต้นสำหรับ Arduino IDE และ ESP-IDF —
          หน้านี้ไม่อัปโหลดไฟล์และไม่แฟลชบอร์ด
        </p>
      </header>
      <aside className="panel rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)] p-5">
        <strong>ห้ามเดา offset หรือใช้ manifest ของคนละ build</strong>
        <p className="mt-2">
          ชิป บอร์ด flash size และ partition layout ต้องตรงกัน
          ไฟล์ผิดหรือตำแหน่งผิดอาจทำให้บูตไม่ได้หรือเขียนทับข้อมูล
          สำรองข้อมูลสำคัญและทดลองกับบอร์ดทดสอบก่อน
        </p>
      </aside>
      <section className="panel space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="section-heading text-xl font-bold">
          1. ESP32 กับ Arduino IDE
        </h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            ติดตั้งแพ็กเกจบอร์ด ESP32 ที่ตรงกับโครงการ เลือกรุ่นบอร์ดและตั้งค่า
            flash size, partition scheme และตัวเลือกอื่นให้ถูกต้อง จดเวอร์ชัน
            IDE, ESP32 core และไลบรารีที่ใช้
          </li>
          <li>
            เปิด sketch แล้ว Verify ให้ผ่าน จากนั้นใช้เมนู Sketch → Export
            Compiled Binary ชื่อเมนูอาจต่างตามเวอร์ชัน IDE
          </li>
          <li>
            ตรวจไฟล์ที่สร้างในโฟลเดอร์ sketch หรือ build ตามข้อความผลลัพธ์
            อย่าสรุปว่าไฟล์ application .bin คือ merged image ที่รวม bootloader
            และ partition table แล้ว
          </li>
          <li>
            เปิด verbose output สำหรับ compile/upload ใน Preferences
            และตรวจคำสั่งแฟลชจาก build ของคุณ หากทดลอง upload
            ให้ใช้บอร์ดทดสอบที่ตรงรุ่นเพื่อบันทึกไฟล์และตำแหน่งจริง ไม่มี offset
            สากลสำหรับ ESP32 ทุกบอร์ด
          </li>
          <li>
            หากต้องการ merged binary ใช้เครื่องมือและคำสั่ง merge ของ toolchain
            เวอร์ชันนั้น โดยอ้างอิงไฟล์และ offset จาก build จริง
            ยืนยันตำแหน่งเริ่มแฟลชใน manifest และทดสอบไฟล์ merged แยกต่างหาก
          </li>
        </ol>
      </section>
      <section className="panel space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="section-heading text-xl font-bold">2. ESP-IDF</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            เปิด environment ของ ESP-IDF เวอร์ชันที่โครงการใช้ ตรวจ target chip
            และ configuration ให้ตรงกับบอร์ด การเปลี่ยน target
            อาจรีเซ็ตการตั้งค่าบางส่วน
          </li>
          <li>
            รัน <code className="rounded bg-[var(--surface-soft)] px-1">idf.py build</code>{" "}
            ในโครงการ แล้วตรวจผล build และ partition table
          </li>
          <li>
            ตรวจ <code>build/flash_args</code> และ{" "}
            <code>build/flasher_args.json</code>{" "}
            หากเวอร์ชันที่ใช้สร้างไฟล์เหล่านี้ พร้อมคำสั่งแฟลชที่ build แสดง
            ไฟล์เหล่านี้เป็นแหล่งอ้างอิงสำหรับคู่ offset/ไฟล์และตัวเลือกแฟลช
            ไม่ควรคัดลอกจากโครงการอื่น
          </li>
          <li>
            จัดไฟล์ bootloader, partition table, application
            และไฟล์อื่นตามรายการของ build หากชื่อหรือรูปแบบ manifest ต่างกัน
            ให้ใช้เอกสารของ ESP-IDF เวอร์ชันที่ติดตั้ง
          </li>
          <li>
            ทดสอบการแฟลชและบูตบนบอร์ดตรงรุ่นด้วย workflow ของ ESP-IDF เช่น{" "}
            <code>idf.py -p PORT flash monitor</code> โดยแทน <code>PORT</code>{" "}
            ด้วยพอร์ตจริง ตรวจ log และการทำงานของอุปกรณ์
            ไม่ใช่แค่เห็นคำสั่งสำเร็จ
          </li>
        </ol>
      </section>
      <section className="panel space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="section-heading text-xl font-bold">
          3. Checklist ก่อนแนบข้อมูลในร่าง
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            ระบุชิป บอร์ด เวอร์ชัน firmware และ toolchain รวมถึง flash size และ
            partition layout ในคู่มือ
          </li>
          <li>
            มี manifest ที่ตรงกับไฟล์จริง ระบุรูปแบบ merged หรือ multipart,
            ชื่อไฟล์, offset และตัวเลือกแฟลช หากเป็น merged
            ต้องระบุตำแหน่งเริ่มที่ถูกต้องด้วย
          </li>
          <li>
            ตรวจว่าไม่มี Wi-Fi password, API key หรือข้อมูลส่วนตัวฝังอยู่ใน
            firmware
          </li>
          <li>
            ทดสอบ manifest กับไฟล์ชุดเดียวกันบนบอร์ดทดสอบ
            พร้อมขั้นตอนสำรองและกู้คืน หลีกเลี่ยงการ erase flash
            หากไม่เข้าใจผลกระทบ
          </li>
          <li>
            ฟอร์มต้นแบบรับเฉพาะ .bin ขนาดมากกว่า 0 และไม่เกิน 16 MiB ต่อไฟล์
            การตรวจนามสกุล/ขนาด/รูปแบบ hex ไม่ได้ยืนยันว่า binary
            ถูกต้องหรือช่วงหน่วยความจำไม่ทับกัน
          </li>
        </ul>
        <p className="muted text-sm">
          ฟอร์มบันทึกแค่ชื่อไฟล์ ขนาด และ offset ของ multipart ไม่เก็บ binary
          หรือ manifest จริง หลังเปิดร่างให้ตรวจไฟล์ต้นฉบับอีกครั้ง
          ไม่มีเซิร์ฟเวอร์อัปโหลดหรือแฟลช และไม่มีการเผยแพร่ผลงาน
        </p>
      </section>
      <Link
        className="button secondary inline-block rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 font-semibold"
        href="/submit"
      >
        กลับไปฟอร์ม แล้วกดเปิดร่างที่บันทึกไว้
      </Link>
      <p className="muted text-sm">
        ก่อนออกจากฟอร์ม ให้กดบันทึกร่างตอนนี้เพื่อไม่ให้ข้อมูลที่ยังไม่บันทึกหาย
      </p>
    </main>
  );
}
