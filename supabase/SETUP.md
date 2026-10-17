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

## 2. Email / Password / Username และสถานะ Auth

สถานะ public Auth settings ที่ตรวจแล้วของโปรเจกต์ `cjrzxvpdayjxopwjbjer`: `email=true`, `disable_signup=false`, `mailer_autoconfirm=false`, `google=false`, `facebook=false` หมายถึงสมัครด้วยอีเมลได้และ **ต้องยืนยันอีเมล** ส่วน Google/Facebook ยังไม่เปิด ไม่ใช่ค่าที่เอกสารนี้เปลี่ยนให้อัตโนมัติ

Migration `20261017001204_member_usernames.sql` apply บน remote ที่ตรงกับ configured project แล้ว และ security advisors ไม่มีรายการเตือน ห้าม apply ซ้ำ

- สมัครด้วย **Email + Password + Username** ส่ง username ใน user metadata; trigger อ่านเฉพาะเมื่อ trusted `raw_app_meta_data.provider = email` แล้ว trim/lower ก่อนบันทึก
- Username ต้องตรง `^[a-z0-9_]{3,24}$`, ไม่ซ้ำ และไม่เป็น `admin`, `administrator`, `root`, `support`, `system`, `elephantmaker`; DB unique constraint ป้องกันการแย่งชื่อพร้อมกัน
- หากไม่ได้ระบุชื่อแสดงผล ค่าเริ่มต้น `name = username`; หลัง claim แล้ว username เปลี่ยนหรือล้างไม่ได้ (validation trigger บังคับทุก role) แต่ **display name (`name`) แก้ได้**
- โปรไฟล์เดิม/OAuth มี username เป็น `null`; Google เข้าใช้ครั้งแรกให้ไป `/account/setup` เพื่อ claim username ก่อนใช้งานต่อ DB ไม่ใช้ OAuth metadata username
- หน้าสาธารณะใช้ `/u/username` **ไม่ใช่ email**; ห้ามนำอีเมล Auth ไปแสดงหรือบันทึกใน public profile โดยอัตโนมัติ
- Dashboard → Authentication → Email/password settings: แนะนำ minimum password length **8** ให้ตรงกับแอป; UI จำกัดสูงสุด **128** ตัวอักษร ค่านี้เป็นข้อกำหนด/คำแนะนำ ไม่ใช่ผลยืนยันว่า Dashboard ตั้งไว้แล้ว

### Production SMTP และการยืนยันอีเมล

ตั้ง custom SMTP ใน Supabase Dashboard → Authentication → Email / SMTP Settings ก่อน production เพราะบริการส่งเมล default จำกัดปริมาณและผู้รับ เหมาะกับการทดลอง ไม่ควรพึ่งเป็น production mailer ตั้ง sender/domain ที่ยืนยันแล้วและ DNS ตามผู้ให้บริการ (SPF/DKIM และ DMARC ตามความเหมาะสม) ทดสอบทั้ง confirmation และ recovery พร้อมตรวจ rate limits เก็บ SMTP credentials เฉพาะ Dashboard/secret manager ไม่ใส่ Git, browser env หรือเอกสาร

**ห้ามปิด email confirmation** เพื่อแก้ปัญหาส่งเมล ให้แก้ SMTP, redirect allowlist หรือ template แทน

ค่าเริ่มต้น signup ใช้ PKCE กับลิงก์ `{{ .ConfirmationURL }}` และ `emailRedirectTo` ชี้ `/auth/callback` ที่ allowlist แล้ว ผู้ใช้ต้องเปิดเมลใน **browser/profile เดียวกับที่สมัคร** เพื่อให้มี PKCE verifier สำหรับแลก code เป็น session

ทางเลือก: แอปรองรับ `/auth/confirm` แล้ว สามารถใช้ token-hash email template เพื่อ verify OTP ฝั่ง server แทน code exchange:

```html
<!-- Confirm signup -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>
```

Recovery template ใช้รูปแบบเดียวกันแต่ `type=recovery`; เมื่อ verify สำเร็จ route ส่งไป `/account/password` โดยไม่ต้องใส่ `next` ส่วน signup/email ส่งเข้าสู่ account flow ตามแอป Route `verifyOtp` ในแอปใช้ allowlist เฉพาะ `email`, `signup`, `recovery` ไม่ส่งค่าชนิดใดก็ได้จาก query เข้า API และไม่ log token

Password reset flow ฝั่งแอป: `resetPasswordForEmail` กำหนด `redirectTo` เป็น app origin + `/auth/callback?next=/account/password` โดย callback ตรวจ `next` เป็นเส้นทางภายในที่อนุญาต ก่อนส่งไปตั้งรหัสผ่านใหม่

## 3. ตั้ง Google OAuth

1. ใน Google Cloud Console ตั้ง OAuth consent screen เลือกข้อมูลจำเป็นและเพิ่มตัวเองเป็น test user ถ้าแอปยังอยู่ Testing
2. สร้าง OAuth Client ID ชนิด **Web application**
3. Authorized JavaScript origins ใส่ `http://localhost:3000` และ `https://elephant-maker.vercel.app` (origin เท่านั้น ไม่มี path); หากเปลี่ยน production domain ให้แก้ให้ตรง
4. Authorized redirect URI ของ Google ต้องตรง Supabase callback ของโปรเจกต์นี้ทุกตัวอักษร ไม่ใช่ app callback:

```text
https://cjrzxvpdayjxopwjbjer.supabase.co/auth/v1/callback
```

5. Supabase → **Authentication → Providers → Google** เปิดใช้งาน ใส่ Client ID และ Client Secret ที่ Google ออกให้ (ขณะตรวจยัง `google=false`; ต้องตั้ง credentials และเปิดเอง)
6. Client Secret ใส่เฉพาะ Supabase Dashboard ห้ามใส่ `NEXT_PUBLIC_*`, Git หรือแชต

## 4. ตั้ง URL กลับมาที่เว็บ

Supabase → **Authentication → URL Configuration**:

- Site URL สำหรับ local: `http://localhost:3000`
- Redirect URLs สำหรับ local: `http://localhost:3000/auth/callback**` เพื่อรองรับ callback และ query เช่น `?next=/account/password`
- หากใช้ token-hash templates เพิ่ม `http://localhost:3000/auth/confirm**`

เว็บจริง (Vercel): https://elephant-maker.vercel.app/

ค่าที่ต้องตั้งสำหรับ production:

- Supabase Site URL: `https://elephant-maker.vercel.app`
- Supabase Redirect URLs: `https://elephant-maker.vercel.app/auth/callback**` เพื่อรองรับ query string ของ `next` รวม recovery
- หากใช้ token-hash templates เพิ่ม `https://elephant-maker.vercel.app/auth/confirm**`
- `.SiteURL` ใน email templates ใช้ Site URL ที่ตั้งใน Dashboard: production ต้องชี้ production; หากทดลอง template `.SiteURL` บน local ให้ใช้โปรเจกต์ทดสอบที่ตั้ง Site URL เป็น local
- Vercel Environment Variable: `NEXT_PUBLIC_SITE_URL=https://elephant-maker.vercel.app` แล้ว redeploy

อย่าใช้ wildcard ทั้ง domain ใน production โดยไม่จำเป็น และลบ local URL เมื่อไม่ใช้ Google/Facebook ยังใช้ Supabase callback ในหัวข้อ 3 ไม่ใช่ URL ของ Vercel

รายการนี้เป็นค่าที่ต้องตั้งใน Dashboard ยังไม่ได้เปลี่ยนการตั้งค่าบน Supabase หรือ Vercel อัตโนมัติ

**สอง callback คนละหน้าที่:** Google/Facebook ส่งกลับ Supabase `/auth/v1/callback`; Supabase ส่งกลับเว็บเรา `/auth/callback` ซึ่งแลก PKCE code เป็น session

## 5. Facebook / TikTok

Facebook: ตั้งแอปใน Meta for Developers เปิด Facebook Login ใส่ Supabase callback URL เดียวกับข้างบนใน Valid OAuth Redirect URIs แล้วใส่ App ID/Secret ใน Supabase Facebook provider ขั้นตอน review/โหมดแอปขึ้นกับเงื่อนไข Meta ปัจจุบัน ช่วงทดลองให้ใช้บัญชีที่เป็น tester/developer ของแอป

TikTok: ปุ่มปิดไว้ ยังไม่มี integration และไม่ถือว่ารองรับโดยตรงผ่าน Supabase

## 6. ทดลองใช้งาน

ถ้าเพิ่งแก้ `.env.local` ให้ restart `pnpm dev` แล้ว:

แอปมี signup/setup/confirmation/recovery routes แล้ว รายการต่อไปนี้ยังต้องทดสอบกับบริการ Auth และอีเมลจริงหลังตั้งค่า Dashboard:

1. สมัคร Email/Password/Username → รับเมล → ยืนยันใน browser เดิม → session สำเร็จ; ตรวจ username ถูก trim/lower และ display name เริ่มต้นเท่ากับ username
2. ทดสอบชื่อซ้ำ/ชื่อสงวน/รูปแบบผิดต้องถูกปฏิเสธ และยังต้องยืนยันอีเมลก่อนใช้งาน
3. หลังเปิด Google provider: `/login` → Google → `/account/setup` เมื่อยังไม่มี username → claim ครั้งเดียว → `/account`; ตรวจ `profiles.id` ตรง Authentication user และ OAuth name/avatar ปลอดภัย
4. แก้ display name ได้ แต่เปลี่ยน username หลัง claim ไม่ได้; `/u/username` ไม่แสดงอีเมล Auth
5. ขอ reset password → เปิด recovery link → `/account/password` → ตั้งรหัสผ่านใหม่; หากใช้ token-hash template ทดสอบทั้ง email/signup และ recovery ตามชนิดที่ route อนุญาต
6. กดออกจากระบบ → กลับ `/login`; เปิด `/account` โดยไม่ล็อกอิน → ต้องถูกส่งกลับ `/login?next=/account`

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
