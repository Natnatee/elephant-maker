# Elephant Maker

ต้นแบบเว็บแบ่งปัน DIY ของคนไทย: **ฝากง่าย แชร์สะดวก เปิดแล้วทำตามทีละขั้น**

## เริ่มใช้งาน

แนะนำ Node.js 22+ และ pnpm (Node.js 20 ยัง build ผ่าน แต่ Supabase SDK แจ้ง deprecation)

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
- `/login` — Google/Facebook OAuth จริงผ่าน Supabase (ต้องเปิด provider ใน Dashboard); TikTok ปิดไว้
- `/account` — ตรวจสมาชิกจาก Supabase แสดงโปรไฟล์และร่างของบัญชี
- `/login/demo` — sandbox สมาชิกจำลองเดิม ไม่มีสิทธิ์เข้าถึงข้อมูลจริง

## สิ่งที่เป็น mock

ข้อมูลสมาชิกและผลงานทั้งหมดเป็นตัวอย่าง ไม่ใช่ผลงานจริงหรือคู่มือที่ผ่านการทดสอบ โดยเฉพาะตัวอย่าง K-Line **ไม่ควรนำไปเชื่อมต่อ ECU จริง**

- หน้าโปรเจกต์ยังอ่าน mock JSON ฟอร์มยังไม่ส่งงานเข้า DB และไม่มีการเผยแพร่งานจริง
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

## เปลี่ยนสีธีม

แก้ palette ใน `:root` ของ `src/app/globals.css` จุดเดียว:

- `--background`, `--surface`, `--surface-soft` — พื้นหลัง
- `--foreground`, `--muted` — ตัวอักษร
- `--brand` — สีแบรนด์/โลโก้/แบนเนอร์
- `--accent`, `--accent-hover`, `--accent-foreground` — ปุ่มและจุดเน้น
- `--border` — เส้นขอบ
- `--warning-*`, `--danger-*`, `--success*` — สีสถานะแยกจากแบรนด์
- `--share-*` — สีภาพแชร์ อ้างอิงสีแบรนด์โดยค่าเริ่มต้น

หน้าเว็บและโลโก้ใช้ CSS variables; การ์ด PNG อ่านค่าจาก CSS ของเบราว์เซอร์ ส่วน OG image อ่าน palette เดียวกันผ่าน `src/lib/theme.ts` เพราะตัว renderer ไม่มี CSS cascade สีในไฟล์ภาพประกอบ `public/images/*.svg` เป็นสีของชิ้นงาน ไม่ใช่สี UI จึงไม่เปลี่ยนตามธีม

## การแชร์และ deploy

หน้ารายละเอียดมีคัดลอกลิงก์/ข้อความ พร้อมดาวน์โหลดการ์ด PNG ที่มีเครดิตผู้สร้าง และ OG image อัตโนมัติ ภาพ OG ตอนนี้ใช้ชื่อ slug ภาษาอังกฤษเพื่อไม่ต้องโหลดฟอนต์ไทยภายนอก ส่วนข้อความแชร์และการ์ด PNG เป็นภาษาไทย

ตั้ง `NEXT_PUBLIC_SITE_URL` เป็น URL HTTPS จริงก่อน build/deploy เพื่อให้ absolute metadata URL ถูกต้อง (ค่าเริ่มต้น localhost) ตัวอย่างอยู่ใน `.env.example` ลิงก์ localhost แชร์ให้คนอื่นไม่ได้และแพลตฟอร์มอาจแคชพรีวิว

## Supabase: เชื่อมต่อพื้นฐานแล้ว

ติดตั้ง `@supabase/supabase-js` และ `@supabase/ssr` แล้ว ตั้งค่าใน `.env.local` (ไม่ commit):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

ไม่ต้องใช้รหัส DB หรือ service-role key กับ client เหล่านี้ Publishable key ใช้ใน browser ได้ แต่ทุกตารางที่เปิดให้เข้าถึงต้องมี RLS/policies ที่ถูกต้อง

- Browser: `import { createClient } from '@/lib/supabase/client'` แล้วเรียก `createClient()`
- Server: `import { createClient } from '@/lib/supabase/server'` แล้วเรียก `await createClient()` ใน Server Component/Action/Route Handler
- `src/proxy.ts` และ `src/lib/supabase/proxy.ts` refresh session ด้วย `getClaims()` ส่ง cookies กลับทั้ง request และ response และคง cache headers จาก SSR

Next.js 16 ใช้ **proxy.ts** แทน middleware.ts การสร้าง client เพียงอย่างเดียวไม่ refresh session จึงต้องเรียก `getClaims()` ด้วย Proxy นี้ยังไม่ใช่ route protection ต้องตรวจ claims/สิทธิ์และ RLS ในส่วนที่อ่าน/เขียนข้อมูลสมาชิกเสมอ อย่าใช้ `getSession()` เป็นหลักฐานยืนยันตัวตนฝั่ง server

เปิด `cacheComponents`/`partialPrefetching` อยู่ ดังนั้นเมื่อใช้ server client ในหน้า ให้เรียกจาก child component ใต้ `<Suspense>` และอย่า cache ข้อมูล session ข้ามผู้ใช้

**OAuth จริงพร้อมแล้ว แต่ cloud ยังต้องตั้งค่า** มี migration 10 ตาราง (รวม `step_files`) พร้อม RLS, profile trigger, private Storage bucket/policies และ typed clients แล้ว และ apply บน Supabase cloud ผ่าน MCP แล้ว แต่ Google/Facebook provider ยังต้องตั้งใน Dashboard ดูขั้นตอนภาษาไทยที่ [supabase/SETUP.md](supabase/SETUP.md)

Schema รองรับขั้นตอนข้อความอย่างเดียวหรือไฟล์อย่างเดียว ชื่อขั้นตอนเว้นว่างได้ `ready` ต้องมีอย่างน้อยหนึ่งขั้นตอนและทุกขั้นตอนมีคำอธิบายที่ไม่ว่างหรือไฟล์แนบ ไม่บังคับวัสดุ รุ่นอุปกรณ์ หรือ `compatibility_notes`; `contacts` โปรเจกต์เป็น optional JSON (`line`/`facebook`/`github`) ไฟล์ทั่วไปจำกัด 50 MiB และ firmware 16 MiB โดย bucket จำกัด 50 MiB รองรับวิดีโอและ Markdown ด้วย UI อัปโหลดยังไม่เชื่อมต่อ Remote รอผู้ดูแลงานหลัก apply ผ่าน MCP และยืนยันผล ไม่ถือว่า apply แล้ว

`/account` ตรวจผู้ใช้ผ่าน `getUser()` และอ่านเฉพาะโปรไฟล์/ร่างของตนเอง Callback ตรวจปลายทางภายในเว็บและแลก PKCE code; signout รับ POST พร้อมตรวจ Origin หน้า login ตรวจ provider settings ก่อน redirect และ TikTok ยังปิดไว้

หน้าโปรเจกต์ยังใช้ JSON และฟอร์มยังเป็น local draft ไม่อัปโหลดงานหรือไฟล์เข้า DB อัตโนมัติ ไม่มี service-role key ในแอป

### ตรวจ schema และ RLS ในเครื่อง

```bash
pnpm --package=@electric-sql/pglite --shell-mode dlx "node tests/schema-smoke.mjs"
```

รัน migration และ `supabase/tests/rls.sql` ใน PostgreSQL จำลอง ตรวจ owner/nonowner/anon, storage path, composite FK และ rollback โดยไม่ใช้ DB credentials การทดสอบนี้ไม่แทนการทดสอบ Supabase Auth/Storage API จริง รายละเอียด security assumptions อยู่ใน [supabase/README.md](supabase/README.md)

ก่อนเปิดการแฟลชจริง: ทดสอบ HTTPS/Web Serial/บอร์ด/ไดรเวอร์ ตรวจ firmware trust และผลของการลบข้อมูล รวมถึงเกณฑ์ moderation ของงานรถ มีเพียงไฟล์ `.bin` หรือ chip detection ไม่พอยืนยันความเข้ากันได้
