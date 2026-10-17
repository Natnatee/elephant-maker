"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { normalizeUsername, usernameError, displayNameError } from "@/lib/auth/validation";

export type AccountActionState = { error?: string; success?: string };

export async function completeProfile(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const invalid = usernameError(username);
  if (invalid) return { error: invalid };
  const next = getSafeNextPath(String(form.get("next") ?? ""));
  const store = await cookies();
  try {
    const supabase = await createClient(store);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "กรุณาเข้าสู่ระบบใหม่ก่อนเลือก Username" };
    const { data: profile, error: profileError } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return { error: "อ่านโปรไฟล์ไม่ได้ กรุณาลองใหม่หรือติดต่อผู้ดูแล" };
    if (!profile.username) {
      const { data, error } = await supabase.from("profiles").update({ username }).eq("id", user.id).is("username", null).select("username").maybeSingle();
      if (error) return { error: error.code === "23505" ? "Username นี้มีคนใช้แล้ว กรุณาเลือกชื่ออื่น" : "บันทึก Username ไม่สำเร็จ กรุณาลองใหม่" };
      if (!data) return { error: "โปรไฟล์มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่" };
    }
  } catch {
    return { error: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/account");
  redirect(next);
}

export async function updateDisplayName(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const name = String(form.get("name") ?? "").trim();
  const invalid = displayNameError(name);
  if (invalid) return { error: invalid };
  const store = await cookies();
  let username: string | null = null;
  try {
    const supabase = await createClient(store);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "กรุณาเข้าสู่ระบบใหม่ก่อนแก้ไขชื่อ" };
    const { data, error } = await supabase.from("profiles").update({ name }).eq("id", user.id).select("username").maybeSingle();
    if (error || !data) return { error: "บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่" };
    username = data.username;
  } catch {
    return { error: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/account");
  if (username) revalidatePath(`/u/${username}`);
  return { success: "บันทึกชื่อที่แสดงแล้ว" };
}
