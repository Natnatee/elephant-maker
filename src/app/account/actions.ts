"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { displayNameError } from "@/lib/auth/validation";

export type AccountActionState = { error?: string; success?: string };

export async function updateDisplayName(_previous: AccountActionState, form: FormData): Promise<AccountActionState> {
  const name = String(form.get("name") ?? "").trim();
  const invalid = displayNameError(name);
  if (invalid) return { error: invalid };
  const store = await cookies();
  let profileId: string;
  try {
    const supabase = await createClient(store);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "กรุณาเข้าสู่ระบบใหม่ก่อนแก้ไขชื่อ" };
    const { data, error } = await supabase.from("profiles").update({ name }).eq("id", user.id).select("id").maybeSingle();
    if (error || !data) return { error: "บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่" };
    profileId = user.id;
  } catch {
    return { error: "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่" };
  }
  revalidatePath("/account");
  revalidatePath(`/u/${profileId}`);
  return { success: "บันทึกชื่อแล้ว" };
}
