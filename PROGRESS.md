# ความคืบหน้า Elephant Maker

อัปเดต: 2026-10-14

เว็บจริง: https://elephant-maker.vercel.app/

เอกสารนี้บันทึกสถานะโค้ดใน workspace ไม่ได้ยืนยันว่าการแก้ล่าสุด deploy ขึ้น Vercel แล้ว และไม่ได้ commit Git ให้ผู้ใช้

## สิ่งที่ทำแล้ว

### หน้าเว็บและข้อมูลตัวอย่าง

- หน้าแรกเป็น card-first ไม่มี hero มี sidebar ซ้ายบนคอม และเมนูมือถือ
- ตัวอักษรการ์ดอ่านง่าย ลดรายละเอียดรก ซ่อน filters หลังปุ่ม
- ธีมฟ้า–ขาวผ่าน CSS variables ใน `src/app/globals.css`
- หน้าเข้าสู่ระบบจริงเหลือ Google/Facebook ไม่มีปุ่ม TikTok ซ่อน Next.js dev indicator และใช้ไอคอนช้างเป็นไอคอนเว็บ
- เพิ่ม mock project **เทสesp32c3**: `/projects/test-esp32c3` การ์ดหน้าแรกใช้รูปที่ผู้ใช้ให้มา `public/board/esp32c3Supermini.webp`
- mock DB มี 7 published projects และ 1 draft; ไม่ได้นำ mock projects ขึ้น Supabase
- รูปเดียวกันใช้ในการเลือก ESP32-C3 SuperMini สำหรับแฟลช ระบุตำแหน่งปุ่มอาจต่างตามล็อต ให้ดูสกรีน BOOT / RST บนบอร์ดจริง

### แฟลช ESP32-C3

- `/test-flash` เป็นพื้นที่ทดลองแยก และหน้า **เทสesp32c3** มีปุ่ม **แฟลช ESP32-C3** เปิด native dialog modal
- Modal ใช้เครื่องมือแฟลชตัวเดียวกับ `/test-flash` ไม่คัดลอก logic ไม่ขอสิทธิ์พอร์ตหรือเริ่มเขียนเองเมื่อเปิด
- โฟลว: เลือกบอร์ดจากรูป → เตรียม firmware → เข้า BOOT → เลือกพอร์ตและตรวจ → ยืนยันล้าง Flash → ติดตั้ง/ตรวจ MD5 → กด RESET โดยไม่กด BOOT
- เข้า BOOT สำหรับ SuperMini: เสียบ USB สายข้อมูลและปิด Serial Monitor → กด BOOT ค้าง → กดแล้วปล่อย RESET → ปล่อย BOOT → กดปุ่มเว็บเพื่อเลือกพอร์ต
- อ่านชิปจริง, revision, ขนาด Flash และสถานะ security ก่อนเปิดให้ติดตั้ง; ไม่แฟลชโปรแกรมทดสอบทับเพื่อระบุรุ่น
- ตัวช่วยทำงานใน RAM ชั่วคราวและปรับ RTC watchdog แบบ volatile เพื่อรองรับ C3 native USB ไม่แก้ eFuse
- ใช้ `esptool-js` 0.7.0, `spark-md5` และ Web Serial ผ่าน Chrome/Edge บนคอม
- รับ merged binary ที่ offset 0 มี bootloader, partition table ที่ 0x8000 และ factory หรือ ota_0 app; ไม่รับ app-only, encrypted partitions, populated otadata หรือ alternate app images
- ตรวจโครงสร้าง, XOR checksum และ SHA-256/partition MD5 เมื่อมี ก่อนเขียน; ตรวจ MD5 จาก Flash หลังเขียน
- การติดตั้งทดลองใช้ **eraseAll: true** ล้าง Flash ทั้งหมด ต้องยืนยันก่อน รวมโปรแกรมเดิมและข้อมูล NVS/Wi-Fi ไม่แก้ eFuse
- ไม่รองรับบอร์ดที่เปิด Secure Boot / Secure Download หรือมีค่า flash encryption counter ที่หน้านี้ปฏิเสธ ไม่มีทางเลือกฝืนการป้องกัน
- Modal กันปุ่มปิดและ Escape ตลอดงาน async จน cleanup เสร็จ; idle ปิดได้และคืน focus ไปปุ่มเปิด
- แยกคำแนะนำเมื่อไฟล์ผิด, เปิดพอร์ตไม่ได้, เข้า download mode ไม่สำเร็จ และเขียนล้มเหลว โดยกรณีเขียนล้มเหลวถือว่าอาจเขียนไปแล้วบางส่วน

### ชุด binary จริงจาก ESP32_C3_CHECK

- โปรเจกต์ต้นทาง: `C:\MCU\ESP32\ESP32_C3_CHECK`
- พบ build artifacts แล้ว: bootloader.bin, partitions.bin, firmware.bin และ firmware.elf ใน `.pio/build/esp32c3/`
- อ่าน metadata ของ PlatformIO และ partition table ไม่เดา offset: bootloader `0x0`, partitions `0x8000`, ota_0 app `0x10000`
- เตรียม merged binary จริงขนาด 1,002,528 bytes สำหรับ Flash 4 MB พร้อม manifest/hash และตรวจ integrity ผ่าน
- ชุดอยู่ใน `.local-firmware/esp32-c3-check/` **ไม่ใช่ public/** มี `.gitignore`, `.vercelignore` และ `outputFileTracingExcludes` กันออกจาก Git/การ deploy; ตรวจ production trace แล้วไม่รวมไฟล์ส่วนตัว
- API `/api/test-flash/esp32-c3-check` ให้ไฟล์เฉพาะ development + loopback + header/same-origin checks; production/Vercel ปฏิเสธ ตรวจ SHA-256 ใหม่ทุก request และไม่ cache
- โปรแกรมต้นทางใช้ข้อมูล Wi-Fi จาก secrets.h ซึ่งอาจฝังใน binary จึงไม่เผยแพร่ชุดนี้ขึ้นเว็บสาธารณะ ไม่อ่านหรือบันทึกค่า secrets ในเอกสาร
- **ผู้ใช้รายงานว่าแฟลชและใช้งานได้ และถือว่ารอบทดลองผ่านแล้ว** Agent ไม่ได้เรียกแฟลชบอร์ดจากเทอร์มินอลเอง และไม่รับรองการทำงาน 100% ทุกบอร์ด

### ระยะห่าง UI ล่าสุด

- Panel ในหน้าแฟลช/modal มี padding 16px บนมือถือ / 24px บนคอม
- ปุ่มแฟลชกับดูขั้นตอน และกลุ่มปุ่มเชื่อมต่อ มี flex-wrap/gap 12px
- ส่วนขั้นสูงและรายละเอียดแก้ปัญหามี padding และช่องว่างใต้ summary
- ไม่เพิ่ม padding ให้ `.panel` ทั้งเว็บ และไม่แก้ logic แฟลชในงาน spacing
- เพิ่ม browser assertions วัด padding/gap จริง รวมมือถือและการไม่ overflow

## Backend / Auth ที่มีอยู่

- Supabase project: `cjrzxvpdayjxopwjbjer` มี schema, RLS และ private project-assets bucket แล้ว
- มี Google/Facebook OAuth flow, PKCE callback, session refresh, account และ signout พร้อม Origin check
- การมีโค้ด OAuth ไม่ได้ยืนยันว่า provider credentials และ URL settings บน Dashboard ตั้งครบแล้ว ต้องตรวจการล็อกอินจริงอีกครั้ง
- หน้าโปรเจกต์ยังอ่าน mock JSON; submit ยังบันทึกร่าง/metadata ใน localStorage ไม่อัปโหลดไฟล์หรือสร้างผลงานจริงใน Supabase
- คู่มือ Dashboard อยู่ใน `supabase/SETUP.md`; มีบันทึก production URL แล้ว แต่ไม่ได้แก้ Dashboard โดย MCP อัตโนมัติ

## Validation ล่าสุด

- `pnpm test`: **108/108 ผ่าน**
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: ผ่าน
- Browser smoke ของ gallery, guides, forms, auth และ mobile: ผ่าน
- Browser test `/test-flash` กับชุดจริงในเครื่อง: ผ่าน (mock port picker ไม่แตะฮาร์ดแวร์)
- Browser test project modal: ผ่าน ครอบคลุมภาพ/การ์ด, focus/Escape, busy close protection, synthetic firmware/API, cancelled picker, responsive spacing และ mobile scrolling
- Production test: API ไม่เผยชุดส่วนตัว และ trace ไม่มี `.local-firmware`
- `git diff --check`: ผ่าน มีเพียงคำเตือน LF/CRLF
- Build มีคำเตือน Supabase SDK เรื่อง Node 20; แนะนำ Node 22+

## งานถัดไป / ข้อจำกัด

1. เตรียม firmware ที่ไม่ฝัง credentials และสิทธิ์แจกชัดเจน ก่อนเปิดชุดติดตั้งให้คนทั่วไปบน Vercel
2. ทำรายการ firmware releases จริง, upload/download ที่ปลอดภัย และ manifest/hash จาก backend; ปัจจุบันมีเพียงหนึ่งชุดทดสอบ local
3. เพิ่ม profile รูป/คู่มือเฉพาะรุ่นบอร์ดหลังทดสอบจริง; ตรวจชิปตรงไม่ได้แปลว่าทราบยี่ห้อบอร์ดหรือผัง GPIO
4. ระบบ **อ่าน/สำรองจากบอร์ด** ยังไม่ได้ทำ เป็นงานแยกจากแฟลช
5. ตรวจ OAuth providers / production URL settings และ login round-trip จริง
6. เชื่อม submit/project data เข้ากับ Supabase แทน mock/localStorage
7. การ deploy การแก้ล่าสุดและการ commit ยังเป็นงานที่ต้องสั่งแยก

## คำสั่งทำงานต่อ

หลัง build firmware ใหม่ ให้สร้าง metadata ในโปรเจกต์ MCU:

```bash
pio project metadata --json-output-path .pio/build/esp32c3/project-metadata.json
```

ใน elephant-maker:

```bash
pnpm prepare:test-flash "C:\MCU\ESP32\ESP32_C3_CHECK\.pio\build\esp32c3"
pnpm dev --hostname 127.0.0.1
```

เปิด http://localhost:3000/projects/test-esp32c3 หรือ http://localhost:3000/test-flash

ทดสอบ UI ขณะ dev server ทำงาน (ไม่แฟลชฮาร์ดแวร์):

```bash
pnpm --package=playwright --shell-mode dlx "node tests/browser-project-flash.mjs"
pnpm --package=playwright --shell-mode dlx "node tests/browser-test-flash.mjs --local-package"
```

อย่า upload/flash ผ่าน terminal โดยไม่ขออนุญาตผู้ใช้ อย่า commit หรือเผยแพร่ `.local-firmware` และ secrets
