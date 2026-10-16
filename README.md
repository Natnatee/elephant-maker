# Elephant Maker

ต้นแบบเว็บแบ่งปัน DIY ของคนไทย: **ฝากง่าย แชร์สะดวก เปิดแล้วทำตามทีละขั้น**

เว็บจริง (Vercel): https://elephant-maker.vercel.app/

บันทึกสถานะล่าสุดและงานถัดไป: [PROGRESS.md](./PROGRESS.md)

ตั้ง Environment Variable บน Vercel: `NEXT_PUBLIC_SITE_URL=https://elephant-maker.vercel.app` แล้ว redeploy เพื่อให้ metadata ใช้ URL เว็บจริง

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
- `/projects/test-esp32c3` — การ์ด mock **เทสesp32c3** ใช้รูปบอร์ดจริง ปุ่มแฟลชเปิด modal เลือกบอร์ด → BOOT/RESET → ตรวจ → ติดตั้ง → RESET
- `/submit` — ฟอร์ม 3 ขั้น เลือกรูปปก ดูตัวอย่าง บันทึกและเปิดร่างใน localStorage
- `/submit/firmware-guide` — คู่มือเตรียม binary และข้อมูล manifest โดยไม่เดา offset
- `/login` — Google/Facebook OAuth จริงผ่าน Supabase (ต้องเปิด provider ใน Dashboard); TikTok ปิดไว้
- `/account` — ตรวจสมาชิกจาก Supabase แสดงโปรไฟล์และร่างของบัญชี
- `/login/demo` — sandbox สมาชิกจำลองเดิม ไม่มีสิทธิ์เข้าถึงข้อมูลจริง

## ทดลองแฟลช ESP32-C3

เปิด `/test-flash` บน Chrome/Edge บนคอม ผ่าน HTTPS หรือ localhost เป็นพื้นที่ทดลอง ยังไม่ใช่ระบบติดตั้งสำหรับคนทั่วไปที่ผ่านการทดสอบฮาร์ดแวร์แล้ว

1. เลือกบอร์ด `ESP32-C3 SuperMini` จากการ์ดภาพถ่ายอ้างอิง (ตำแหน่งปุ่มอาจต่างตามล็อต ให้ตรวจชื่อ BOOT / RST บนบอร์ดจริง) เลือกโปรเจกต์ `ESP32_C3_CHECK` แล้วกด **เลือกโปรเจกต์นี้** ระบบโหลดชุดที่เตรียมไว้ในเครื่องและตรวจ SHA-256 ไม่ต้องเลือกหลายไฟล์หรือกรอก offset (ยังมีตัวเลือกไฟล์เองในหัวข้อขั้นสูง)
2. เสียบ USB สายข้อมูล ปิด Serial Monitor กด BOOT ค้าง → กดแล้วปล่อย RESET → ปล่อย BOOT แล้วเลือกพอร์ตในเว็บ
3. ระบบตรวจ ESP32-C3, revision, Flash ขนาดตรงกัน และสถานะ security ก่อนอนุญาตติดตั้ง ตัวช่วยตรวจทำงานใน RAM ไม่เขียน Flash แต่หยุดโปรแกรมเดิมชั่วคราว และปรับ watchdog แบบ volatile เพื่อรองรับ native USB
4. ยืนยัน **ล้าง Flash ทั้งหมด** แล้วติดตั้ง ระบบตรวจ image XOR checksum และ SHA256/partition MD5 เมื่อมี ก่อนเขียน และตรวจ MD5 จาก Flash หลังเขียน ไม่แก้ eFuse
5. เมื่อเขียนและตรวจข้อมูลผ่าน แสดงขั้นตอนหลังติดตั้งชัดเจน: กดแล้วปล่อย RESET **โดยไม่กด BOOT** เพื่อเริ่มโปรแกรม แล้วตรวจ LED/Serial ด้วยตัวเอง หากยังไม่เริ่มให้ถอดเสียบ USB การเขียนผ่านไม่ได้รับรองวงจรหรือการทำงาน 100%

คำแนะนำตามบอร์ดอยู่ใน `src/lib/flash-boards.ts` แยก error ชุดไฟล์, การเชื่อมต่อ และการเขียน: ปัญหาเข้าโหมดดาวน์โหลดแนะนำ BOOT → RESET → ปล่อย BOOT; ปัญหาเปิดพอร์ตแนะนำปิด Serial Monitor ส่วนปัญหาระหว่างเขียนต้องถือว่าอาจเขียนไปแล้วบางส่วน ไม่แสดงว่า Flash ยังไม่เปลี่ยน

ไฟล์ไม่อัปโหลดขึ้นเซิร์ฟเวอร์ ไม่ build firmware และไม่อ่าน `secrets.h` อัตโนมัติ โปรเจกต์ `ESP32_C3_CHECK` ฝังข้อมูล Wi-Fi ใน binary ได้ จึงต้องเปลี่ยนเป็นข้อมูลทดสอบก่อนแจกไฟล์ ไฟล์แบบ OTA-only ต้องมี ota_0 และ otadata ที่อยู่ในไฟล์เป็น FF เพื่อให้เริ่มจาก ota_0 หลังล้างทั้งหมด

### เตรียมชุดจากผล build (ทำครั้งเดียว หรือเมื่อ firmware เปลี่ยน)

รันใน `ESP32_C3_CHECK` หลัง build เพื่อสร้าง metadata ของ offset จริง:

```bash
pio project metadata --json-output-path .pio/build/esp32c3/project-metadata.json
```

รันใน `elephant-maker`:

```bash
pnpm prepare:test-flash "C:\MCU\ESP32\ESP32_C3_CHECK\.pio\build\esp32c3"
pnpm dev --hostname 127.0.0.1
```

เปิด http://localhost:3000/test-flash ชุดจริงเก็บใน `.local-firmware/esp32-c3-check/` ซึ่งกันออกจาก Git และ Vercel ไม่ใช่ `public/` API `/api/test-flash/esp32-c3-check` เปิดเฉพาะ development ที่ loopback พร้อม same-origin header และตรวจ SHA-256 ทุกครั้ง **production และ Vercel ปฏิเสธเสมอ** จึงไม่เผยไฟล์ที่อาจมี Wi-Fi credentials

ตัวเตรียมไฟล์อ่าน offset bootloader/table จาก PlatformIO metadata และ app จาก partition table ตรวจ image checksums/hashes ก่อนสร้าง merged binary โดยเว้น otadata เป็น FF ไม่มี boot_app0 และไม่มีไฟล์จากบอร์ดจริง ไม่รับ app-only, encrypted partitions หรือ app สำรองอื่น

หน้า experimental นี้มีโปรเจกต์ทดสอบ local หนึ่งรายการ ยังไม่ใช่ระบบรายการ firmware ที่เผยแพร่ให้คนทั่วไป บน Vercel ยังใช้ไฟล์จากคอมในหัวข้อขั้นสูงได้ แต่ไม่มีชุด private ให้ดาวน์โหลด

ทดสอบ UI โดยไม่เข้าถึงฮาร์ดแวร์:

```bash
# Modal บนการ์ดโปรเจกต์ (ขณะ pnpm dev ทำงาน; mock API/picker ไม่แตะฮาร์ดแวร์)
pnpm --package=playwright --shell-mode dlx "node tests/browser-project-flash.mjs"
# Production privacy + synthetic firmware (หลัง pnpm build)
pnpm --package=playwright --shell-mode dlx "node tests/with-test-server.mjs"
# Development + ชุดจริงในเครื่อง (หลังเตรียมชุด และไม่มี pnpm dev อีกตัว)
pnpm --package=playwright --shell-mode dlx "node tests/with-test-server.mjs --dev"
```

## สิ่งที่เป็น mock

ข้อมูลสมาชิกและผลงานทั้งหมดเป็นตัวอย่าง ไม่ใช่ผลงานจริงหรือคู่มือที่ผ่านการทดสอบ โดยเฉพาะตัวอย่าง K-Line **ไม่ควรนำไปเชื่อมต่อ ECU จริง**

- หน้าโปรเจกต์ยังอ่าน mock JSON ฟอร์มยังไม่ส่งงานเข้า DB และไม่มีการเผยแพร่งานจริง
- ร่างเก็บเฉพาะเบราว์เซอร์นั้น ไม่ซิงก์ และอาจหายเมื่อเคลียร์ข้อมูล
- รูป/ไบนารีที่เลือกเก็บเพียง metadata ไม่อัปโหลด ไม่เก็บ bytes ใน localStorage; รูป preview ต้องเลือกใหม่เมื่อเปิดร่าง
- ไฟล์ในโปรเจกต์เป็น metadata ไม่มี URL ดาวน์โหลด ไม่มี binary ใช้งานจริง
- ปุ่มแฟลชในหน้าโปรเจกต์ตัวอย่างอื่นยังปิดไว้; **เทสesp32c3** และ `/test-flash` ใช้เครื่องมือ Web Serial จริง ต้องยืนยันล้างข้อมูลก่อนติดตั้ง modal ใช้ native dialog และไม่ให้ปิดระหว่างโหลดชุด/ตรวจบอร์ด/เขียน รวมถึงช่วง cleanup
- บัญชีจำลองไม่ใช่ระบบสิทธิ์หรือการยืนยันตัวตน ไม่มี token
- ภาพประกอบ SVG อยู่ใน `public/images` รูปบอร์ดที่ผู้ใช้ให้มาอยู่ใน `public/board/esp32c3Supermini.webp` ไม่โหลดภาพหรือฟอนต์ภายนอก

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
