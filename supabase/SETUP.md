# เปิดใช้ Supabase จริง (Free plan)

**Schema 10 ตาราง + RLS + private bucket ถูกสร้างบน Supabase cloud ผ่าน MCP แล้ว** โปรเจกต์ `cjrzxvpdayjxopwjbjer` apply migration ลบ username version `20261017090152` แล้วตามที่ผู้ใช้ยืนยัน ผู้ใช้ตั้งค่า Google OAuth แล้ว แต่ยังไม่ได้ตรวจยืนยันค่า Auth/provider ปัจจุบันซ้ำ ไม่มี Facebook login ไม่มี admin/service-role key หรือ provider secret ใน repository

## 1. สร้างตารางและสิทธิ์

1. Migration รวม `20261017090152_remove_member_usernames.sql` apply บน remote แล้วตามที่ผู้ใช้ยืนยัน คอลัมน์ username ถูกลบแล้ว ไม่ต้องรันซ้ำ
2. หากสร้างโปรเจกต์ใหม่ ใช้ migration ใน `supabase/migrations/` ตามลำดับชื่อไฟล์ ผ่าน CLI หรือ SQL Editor (ครั้งเดียวต่อ migration)
3. ตรวจ Table Editor: 10 ตาราง: `profiles`, `projects`, `steps`, `step_files`, `materials`, `files`, `firmware_releases`, `firmware_parts`, `tags`, `project_tags`
4. ตรวจ Storage: bucket `project-assets` ต้องเป็น **Private**

ตรวจบน cloud แล้ว: RLS เปิดทุกตาราง, bucket เป็น private, seed เฉพาะแท็ก ไม่มีผลงานสมมติหรือผู้ใช้ทดสอบบน cloud

ขั้นตอนรองรับข้อความอย่างเดียวหรือไฟล์อย่างเดียวผ่าน `step_files` ชื่อขั้นตอนเว้นว่างได้ การเผยแพร่แบบ `ready` ต้องมีอย่างน้อย 1 ขั้นตอน และทุกขั้นตอนมีคำอธิบายที่ไม่ว่างหรือไฟล์แนบ ไม่บังคับวัสดุ รุ่นอุปกรณ์ หรือ `compatibility_notes` ช่องติดต่อโปรเจกต์เป็น optional JSON (`line`/`facebook`/`github`) ค่าเริ่มต้น `{}`

ไฟล์รองรับ image/video/text/document/model/source/firmware: metadata จำกัด 50 MiB ยกเว้น firmware 16 MiB; bucket จำกัด 50 MiB และเพิ่ม MP4/WebM/QuickTime/Markdown ทั้งนี้ UI อัปโหลดจริงยังไม่เชื่อมต่อ

Migration อยู่ใน transaction ถ้ามี error จะไม่ apply บางส่วน อย่ารันซ้ำถ้าสำเร็จแล้ว ถ้ามีตารางชื่อเดียวกันอยู่ก่อน ให้ตรวจ schema ก่อน ไม่ลบทิ้งเพื่อหลบ error

RLS: คนทั่วไปอ่านเฉพาะงานเผยแพร่ สมาชิกดู/แก้เฉพาะร่างตัวเอง Child rows และ Storage ตรวจทั้งเจ้าของเดิมและเจ้าของปลายทาง โปรไฟล์สาธารณะเก็บชื่อ/ประวัติ/ช่องติดต่อที่ตั้งใจเผยแพร่ ไม่เก็บ email/token/admin role

**ห้ามรัน `supabase/tests/rls.sql` บน cloud/production** ใช้เฉพาะ DB local ที่ทิ้งได้ เพราะทดสอบด้วยผู้ใช้และ role จำลอง

## 2. Name / Email / Password และสถานะ Auth

ผู้ใช้ตั้งค่า Google OAuth แล้ว เอกสารนี้ยังไม่ได้ตรวจยืนยัน live Auth/provider settings ปัจจุบันซ้ำ จึงไม่ใช้ค่าที่เคยตรวจเป็นสถานะปัจจุบัน การสมัครด้วยอีเมลต้องยืนยันอีเมลตามข้อกำหนดการใช้งาน และไม่ควรปิด email confirmation

Migration `20261017090152_remove_member_usernames.sql` apply remote แล้วตามที่ผู้ใช้ยืนยัน โดยลบคอลัมน์ username พร้อม constraints/indexes และ trigger/function ล็อก username คงชื่อ/bio/avatar/contacts และข้อมูลโปรไฟล์เดิม ไม่เปลี่ยน RLS ส่วน `20261017001204_member_usernames.sql` เก็บเป็นประวัติ migration เท่านั้น ห้ามแก้หรือ apply ซ้ำ

- สมัครด้วย **Name + Email + Password** ใช้ชื่อแสดงผลช่องเดียว รองรับภาษาไทยและชื่อซ้ำ ไม่ต้อง claim username
- Trigger อ่านชื่อจาก metadata ตามลำดับ `name`, `display_name`, `full_name` ล้าง control characters/ช่องว่างรอบชื่อ และจำกัด 100 ตัวอักษร หากไม่มีชื่อใช้ `Maker` ไม่ใช้ username หรือ Auth email เป็นชื่อสำรอง
- Google ใช้ชื่อเดิมจาก provider โดยตรงและ avatar HTTPS ที่ปลอดภัย ไม่ต้องผ่านหน้า setup เพื่อจองชื่อ
- หน้าสาธารณะใช้ `/u/UUID` โดย UUID คือ `profiles.id` ของสมาชิกภายใน ไม่ใช่ username หรือ email; ห้ามนำ Auth email ไปแสดงหรือเติมใน public profile อัตโนมัติ
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

ผู้ใช้ตั้งค่าแล้ว ขั้นตอนด้านล่างเก็บไว้สำหรับตรวจสอบหรือตั้งค่าใหม่ ไม่ใช่ผลยืนยัน live settings ปัจจุบัน

1. ใน Google Cloud Console ตั้ง OAuth consent screen เลือกข้อมูลจำเป็นและเพิ่มตัวเองเป็น test user ถ้าแอปยังอยู่ Testing
2. สร้าง OAuth Client ID ชนิด **Web application**
3. Authorized JavaScript origins ใส่ `http://localhost:3000` และ `https://elephant-maker.vercel.app` (origin เท่านั้น ไม่มี path); หากเปลี่ยน production domain ให้แก้ให้ตรง
4. Authorized redirect URI ของ Google ต้องตรง Supabase callback ของโปรเจกต์นี้ทุกตัวอักษร ไม่ใช่ app callback:

```text
https://cjrzxvpdayjxopwjbjer.supabase.co/auth/v1/callback
```

5. Supabase → **Authentication → Providers → Google** เปิดใช้งาน ใส่ Client ID และ Client Secret ที่ Google ออกให้
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

อย่าใช้ wildcard ทั้ง domain ใน production โดยไม่จำเป็น และลบ local URL เมื่อไม่ใช้ Google ยังใช้ Supabase callback ในหัวข้อ 3 ไม่ใช่ URL ของ Vercel

รายการนี้เป็นค่าที่ต้องตั้งใน Dashboard ยังไม่ได้เปลี่ยนการตั้งค่าบน Supabase หรือ Vercel อัตโนมัติ

**สอง callback คนละหน้าที่:** Google ส่งกลับ Supabase `/auth/v1/callback`; Supabase ส่งกลับเว็บเรา `/auth/callback` ซึ่งแลก PKCE code เป็น session

## 5. ช่องทางที่ไม่รองรับ

ไม่มี Facebook login ส่วน key `facebook` ใน contact JSON (`line`/`facebook`/`github`) ใช้เก็บลิงก์ติดต่อสาธารณะเท่านั้น ไม่เกี่ยวกับการเข้าสู่ระบบ และยังคงรองรับ

TikTok: ปุ่มปิดไว้ ยังไม่มี integration และไม่ถือว่ารองรับโดยตรงผ่าน Supabase

## 6. ทดลองใช้งาน

ถ้าเพิ่งแก้ `.env.local` ให้ restart `pnpm dev` แล้ว:

รายการต่อไปนี้ใช้ตรวจสอบ signup/confirmation/recovery และ Google กับบริการ Auth และอีเมลจริง:

1. สมัคร Name/Email/Password → รับเมล → ยืนยันใน browser เดิม → session สำเร็จ; ตรวจชื่อภาษาไทยคงเดิม
2. สมัครด้วยชื่อแสดงผลซ้ำได้ และยังต้องยืนยันอีเมลก่อนใช้งาน
3. ทดสอบ Google ที่ผู้ใช้ตั้งค่าแล้ว: `/login` → Google → `/account` โดยใช้ชื่อเดิม ไม่ต้อง setup/claim; ตรวจ `profiles.id` ตรง Authentication user และ OAuth name/avatar ปลอดภัย
4. แก้ชื่อแสดงผลได้ รวมชื่อซ้ำ; `/u/UUID` ไม่แสดงอีเมล Auth
5. ขอ reset password → เปิด recovery link → `/account/password` → ตั้งรหัสผ่านใหม่; หากใช้ token-hash template ทดสอบทั้ง email/signup และ recovery ตามชนิดที่ route อนุญาต
6. กดออกจากระบบ → กลับ `/login`; เปิด `/account` โดยไม่ล็อกอิน → ต้องถูกส่งกลับ `/login?next=/account`

หาก Google เข้าสู่ระบบไม่สำเร็จ ให้ตรวจ provider settings และ callback/redirect allowlist ปัจจุบันใน Dashboard โดยไม่จำลองว่าเข้าสู่ระบบสำเร็จ

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

PGlite รัน migration และ SQL RLS tests จริงใน PostgreSQL จำลอง พร้อมตรวจ rollback แต่ไม่ได้ทดสอบ Supabase Auth/Storage HTTP API เต็มระบบ OAuth login จริงต้องทดสอบกับ Google ที่ผู้ใช้ตั้งค่าไว้
