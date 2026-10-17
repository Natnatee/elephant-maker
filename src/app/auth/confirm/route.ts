import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let target = "/login?error=confirmation_failed";
  if (tokenHash && (type === "email" || type === "signup" || type === "recovery")) {
    try {
      const supabase = await createClient(await cookies());
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) target = type === "recovery" ? "/account/password" : getPostAuthPath(url.searchParams.get("next"));
    } catch {
      // Tokens and provider messages must not be included in errors or redirects.
    }
  }
  return new Response(null, {
    status: 303,
    headers: { Location: new URL(target, url.origin).toString(), "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
