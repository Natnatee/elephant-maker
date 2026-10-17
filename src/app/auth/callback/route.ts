import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = () =>
    Response.redirect(new URL("/login?error=oauth_failed", url.origin), 303);
  let response: Response;
  try {
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) {
      response = failure();
    } else {
      const supabase = await createClient(await cookies());
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      response = error
        ? failure()
        : Response.redirect(
            new URL(getPostAuthPath(url.searchParams.get("next")), url.origin),
            303,
          );
    }
  } catch {
    response = failure();
  }
  // Response.redirect creates immutable headers; copy them before adding cache policy.
  return new Response(null, {
    status: response.status,
    headers: {
      Location: response.headers.get("Location")!,
      "Cache-Control": "no-store",
    },
  });
}
