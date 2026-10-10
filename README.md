# Elephant Maker

ต้นแบบเว็บแบ่งปัน DIY ของคนไทย: **ฝากง่าย แชร์สะดวก เปิดแล้วทำตามทีละขั้น**

## เริ่มใช้งาน

ใช้ Node.js 20.9+ และ pnpm

```bash
pnpm install
pnpm dev
```

เปิด http://localhost:3000

```bash
pnpm test          # relational mock data และ draft validation
pnpm typecheck
pnpm lint
pnpm build
```

### ทดสอบการกดใช้งานในเบราว์เซอร์

ขณะเปิด `pnpm dev` อยู่ สามารถรันทดสอบ search, guide, ภาพแชร์, wizard, mock login และเมนูมือถือได้:

```bash
pnpm --package=playwright --shell-mode dlx "node tests/browser-smoke.mjs"
```

ใช้ Microsoft Edge ที่ติดตั้งใน Windows เป็นค่าเริ่มต้น ไม่เพิ่ม dependency ในแอป แต่ครั้งแรก pnpm จะดาวน์โหลด Playwright ลง cache เปลี่ยน browser channel ได้ด้วย `PLAYWRIGHT_CHANNEL` และ URL ด้วย `TEST_BASE_URL`

## หน้าเว็บ

- `/` — การ์ดโปรเจกต์ ค้นหาชื่อ/ปัญหา/แท็ก หมวด งบ ความยาก ความพร้อม และเรียงลำดับ
- `/projects/k-line-read-only-demo` — ตัวอย่างหน้าคู่มือ วัสดุ ผู้สร้าง ขั้นตอน และแชร์
- `/submit` — ฟอร์ม 3 ขั้น เลือกรูปปก ดูตัวอย่าง บันทึกและเปิดร่างใน localStorage
- `/submit/firmware-guide` — คู่มือเตรียม binary และข้อมูล manifest โดยไม่เดา offset
- `/login` — เลือกบัญชีจำลอง Google/Facebook/TikTok ไม่ใช่ OAuth จริง

## สิ่งที่เป็น mock

ข้อมูลสมาชิกและผลงานทั้งหมดเป็นตัวอย่าง ไม่ใช่ผลงานจริงหรือคู่มือที่ผ่านการทดสอบ โดยเฉพาะตัวอย่าง K-Line **ไม่ควรนำไปเชื่อมต่อ ECU จริง**

- ไม่มี Supabase/backend persistence และไม่มีการเผยแพร่งานจริง
- ร่างเก็บเฉพาะเบราว์เซอร์นั้น ไม่ซิงก์ และอาจหายเมื่อเคลียร์ข้อมูล
- รูป/ไบนารีที่เลือกเก็บเพียง metadata ไม่อัปโหลด ไม่เก็บ bytes ใน localStorage; รูป preview ต้องเลือกใหม่เมื่อเปิดร่าง
- ไฟล์ในโปรเจกต์เป็น metadata ไม่มี URL ดาวน์โหลด ไม่มี binary ใช้งานจริง
- ปุ่มแฟลชถูกปิด ไม่ใช้ Web Serial และไม่เชื่อมต่ออุปกรณ์
- บัญชีจำลองไม่ใช่ระบบสิทธิ์หรือการยืนยันตัวตน ไม่มี token
- ภาพทั้งหมดเป็น SVG ใน `public/images` ไม่โหลดภาพหรือฟอนต์ภายนอก

## โครงสร้าง

```text
src/app/          Next.js App Router, metadata และ OG image
src/components/   หน้า explorer, wizard, guide, share และ mock login
src/data/mock-db.json
src/lib/types.ts  relational schema (TypeScript)
src/lib/data.ts   query layer สำหรับข้อมูลเผยแพร่
src/lib/drafts.ts validation และ local draft storage
public/images/    ภาพประกอบในเครื่อง
tests/mock.test.mjs
```

ตาราง mock: `profiles`, `projects`, `steps`, `materials`, `files`, `firmwareReleases`, `firmwareParts`, `tags`, `project_tags`

สถานะ `draft/published` แยกจากความพร้อม `showcase/ready` และ `ready` **ไม่ใช่การรับรองความปลอดภัย** ฟอร์มร่างอนุญาตข้อมูลไม่ครบ; ก่อนระบบจริงเผยแพร่ต้องมีรูป สิทธิ์การใช้ ข้อมูลความปลอดภัย และ validation ฝั่ง server ตามประเภทงาน

## การแชร์และ deploy

หน้ารายละเอียดมีคัดลอกลิงก์/ข้อความ พร้อมดาวน์โหลดการ์ด PNG ที่มีเครดิตผู้สร้าง และ OG image อัตโนมัติ ภาพ OG ตอนนี้ใช้ชื่อ slug ภาษาอังกฤษเพื่อไม่ต้องโหลดฟอนต์ไทยภายนอก ส่วนข้อความแชร์และการ์ด PNG เป็นภาษาไทย

ตั้ง `NEXT_PUBLIC_SITE_URL` เป็น URL HTTPS จริงก่อน build/deploy เพื่อให้ absolute metadata URL ถูกต้อง (ค่าเริ่มต้น localhost) ตัวอย่างอยู่ใน `.env.example` ลิงก์ localhost แชร์ให้คนอื่นไม่ได้และแพลตฟอร์มอาจแคชพรีวิว

## ขั้นต่อไป: Supabase

เปลี่ยน query layer เป็น PostgreSQL + Auth + Storage โดยคง UI เป็นหลัก เพิ่ม server validation, RLS, private draft assets และ versioned firmware พร้อม checksum/manifest ที่ทดสอบจริง Google/Facebook และ TikTok ต้องตรวจ provider/เงื่อนไข OAuth ปัจจุบันก่อนเชื่อมต่อ ไม่ถือว่า TikTok รองรับโดยตรงเพียงเพราะเดโมมีปุ่ม

ก่อนเปิดการแฟลชจริง: ทดสอบ HTTPS/Web Serial/บอร์ด/ไดรเวอร์ ตรวจ firmware trust และผลของการลบข้อมูล รวมถึงเกณฑ์ moderation ของงานรถ มีเพียงไฟล์ `.bin` หรือ chip detection ไม่พอยืนยันความเข้ากันได้
