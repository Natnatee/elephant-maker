# เปิดใช้ Supabase จริง (Free plan)

**Schema 10 ตาราง + RLS + private bucket ถูกสร้างบน Supabase cloud ผ่าน MCP แล้ว** โปรเจกต์ `cjrzxvpdayjxopwjbjer` ใช้ migration versions ตรงกับไฟล์ใน repository ส่วน Google/Facebook ยังต้องตั้ง provider ใน Dashboard ไม่มี admin/service-role key หรือ provider secret ใน repository

## 1. สร้างตารางและสิทธิ์

1. **โปรเจกต์ปัจจุบันไม่ต้องรัน SQL ซ้ำ** Migration ถูก apply แล้ว
2. หากสร้างโปรเจกต์ใหม่ ใช้ migration ใน `supabase/migrations/` ตามลำดับชื่อไฟล์ ผ่าน CLI หรือ SQL Editor (ครั้งเดียวต่อ migration)
3. ตรวจ Table Editor: 10 ตาราง: `profiles`, `projects`, `steps`, `step_files`, `materials`, `files`, `firmware_releases`, `firmware_parts`, `tags`, `project_tags`
4. ตรวจ Storage: bucket `project-assets` ต้องเป็น **Private**

ตรวจบน cloud แล้ว: RLS เปิดทุกตาราง, bucket เป็น private, seed เฉพาะแท็ก ไม่มีผลงานสมมติหรือผู้ใช้ทดสอบบน cloud

ขั้นตอนรองรับข้อความอย่างเดียวหรือไฟล์อย่างเดียวผ่าน `step_files` ชื่อขั้นตอนเว้นว่างได้ การเผยแพร่แบบ `ready` ต้องมีอย่างน้อย 1 ขั้นตอน และทุกขั้นตอนมีคำอธิบายที่ไม่ว่างหรือไฟล์แนบ ไม่บังคับวัสดุ รุ่นอุปกรณ์ หรือ `compatibility_notes` ช่องติดต่อโปรเจกต์เป็น optional JSON (`line`/`facebook`/`github`) ค่าเริ่มต้น `{}`

ไฟล์รองรับ image/video/text/document/model/source/firmware: metadata จำกัด 50 MiB ยกเว้น firmware 16 MiB; bucket จำกัด 50 MiB และเพิ่ม MP4/WebM/QuickTime/Markdown ทั้งนี้ UI อัปโหลดจริงยังไม่เชื่อมต่อ

Migration อยู่ใน transaction ถ้ามี error จะไม่ apply บางส่วน อย่ารันซ้ำถ้าสำเร็จแล้ว ถ้ามีตารางชื่อเดียวกันอยู่ก่อน ให้ตรวจ schema ก่อน ไม่ลบทิ้งเพื่อหลบ error

RLS: คนทั่วไปอ่านเฉพาะงานเผยแพร่ สมาชิกดู/แก้เฉพาะร่างตัวเอง Child rows และ Storage ตรวจทั้งเจ้าของเดิมและเจ้าของปลายทาง โปรไฟล์สาธารณะเก็บชื่อ/ประวัติ/ช่องติดต่อที่ตั้งใจเผยแพร่ ไม่เก็บ email/token/admin role

**ห้ามรัน `supabase/tests/rls.sql` บน cloud/production** ใช้เฉพาะ DB local ที่ทิ้งได้ เพราะทดสอบด้วยผู้ใช้และ role จำลอง

## 2. ตั้ง Google OAuth

1. ใน Google Cloud Console ตั้ง OAuth consent screen เลือกข้อมูลจำเป็นและเพิ่มตัวเองเป็น test user ถ้าแอปยังอยู่ Testing
2. สร้าง OAuth Client ID ชนิด **Web application**
3. Authorized redirect URI ของ Google เป็น Supabase callback:

```text
https://cjrzxvpdayjxopwjbjer.supabase.co/auth/v1/callback
```

4. Supabase → **Authentication → Providers → Google** เปิดใช้งาน ใส่ Client ID และ Client Secret ที่ Google ออกให้
5. Client Secret ใส่เฉพาะ Supabase Dashboard ห้ามใส่ `NEXT_PUBLIC_*`, Git หรือแชต

## 3. ตั้ง URL กลับมาที่เว็บ

Supabase → **Authentication → URL Configuration**:

- Site URL สำหรับ local: `http://localhost:3000`
- Redirect URLs สำหรับ local: `http://localhost:3000/**` เพื่อรองรับ `/auth/callback?next=/account`

เมื่อ deploy ให้เปลี่ยน Site URL และ `NEXT_PUBLIC_SITE_URL` เป็น HTTPS ของเว็บจริง และจำกัด Redirect URLs เฉพาะ origin/เส้นทาง callback ที่ต้องใช้ เช่น `https://your-domain.example/auth/callback**` เพื่อรองรับ query string ของ `next` อย่าใช้ wildcard ทั้ง domain ใน production โดยไม่จำเป็น และลบ local URL เมื่อไม่ใช้

**สอง callback คนละหน้าที่:** Google/Facebook ส่งกลับ Supabase `/auth/v1/callback`; Supabase ส่งกลับเว็บเรา `/auth/callback` ซึ่งแลก PKCE code เป็น session

## 4. Facebook / TikTok

Facebook: ตั้งแอปใน Meta for Developers เปิด Facebook Login ใส่ Supabase callback URL เดียวกับข้างบนใน Valid OAuth Redirect URIs แล้วใส่ App ID/Secret ใน Supabase Facebook provider ขั้นตอน review/โหมดแอปขึ้นกับเงื่อนไข Meta ปัจจุบัน ช่วงทดลองให้ใช้บัญชีที่เป็น tester/developer ของแอป

TikTok: ปุ่มปิดไว้ ยังไม่มี integration และไม่ถือว่ารองรับโดยตรงผ่าน Supabase

## 5. ทดลองใช้งาน

ถ้าเพิ่งแก้ `.env.local` ให้ restart `pnpm dev` แล้ว:

1. `/login` → Google → ยืนยันตัวตน → `/account`
2. ตรวจ `profiles` ว่าสร้างชื่อผู้ใช้ให้อัตโนมัติ โดย `id` ตรงกับ Authentication user
3. กดออกจากระบบ → กลับ `/login`
4. เปิด `/account` โดยไม่ล็อกอิน → ต้องถูกส่งกลับ `/login?next=/account`

หาก provider ยังไม่เปิด ปุ่มจะแจ้งวิธีตั้งค่าในหน้าเว็บ ไม่จำลองว่าเข้าสู่ระบบสำเร็จ หาก DB ยังไม่ได้ migration หน้าบัญชีจะแจ้งว่า schema ยังไม่พร้อม ไม่กลบเป็นรายการว่างสำเร็จ

## สิ่งที่ยังไม่ใช่ production

- หน้าโปรเจกต์ยังเป็น JSON และฟอร์มฝากงานยังเป็น local draft **ไม่ได้เขียนงานเข้า Supabase อัตโนมัติ**
- Storage bucket/policies พร้อมจาก migration แต่ยังไม่เปิด flow อัปโหลดจริง
- ไม่เปิดแฟลชเฟิร์มแวร์ และไม่ import ตัวอย่าง K-Line เป็นงานรับรอง
- งานรถต้องมี workflow ตรวจคุณภาพ/ความปลอดภัยก่อนเปิดจริง
- Signed URL อาจใช้ได้จนหมดอายุแม้ถอนเผยแพร่ ใช้ TTL สั้น
- Node.js 20 ยัง build ผ่าน แต่ Supabase SDK แจ้ง deprecation ควรใช้ **Node.js 22+**

## การทดสอบ local ที่ทำได้โดยไม่มี Supabase CLI

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm --package=@electric-sql/pglite --shell-mode dlx "node tests/schema-smoke.mjs"
```

PGlite รัน migration และ SQL RLS tests จริงใน PostgreSQL จำลอง พร้อมตรวจ rollback แต่ไม่ได้ทดสอบ Supabase Auth/Storage HTTP API เต็มระบบ OAuth login จริงต้องทดสอบหลังตั้ง Dashboard
