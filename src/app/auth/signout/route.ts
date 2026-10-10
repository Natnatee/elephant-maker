import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin) {
    return new Response("ไม่อนุญาตคำขอออกจากระบบจากแหล่งอื่น", {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  let destination = "/login";
  try {
    const supabase = await createClient(await cookies());
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) destination = "/login?error=signout_failed";
  } catch {
    destination = "/login?error=signout_failed";
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL(destination, origin).toString(),
      "Cache-Control": "no-store",
    },
  });
}
