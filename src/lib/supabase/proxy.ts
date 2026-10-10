import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const authHeaders: Record<string, string> = {};
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        const previousCookies = response.cookies.getAll();
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // SSR 0.12 sends cache headers on the first write only. Preserve them across later writes.
        Object.assign(authHeaders, headers);
        Object.entries(authHeaders).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // Creating the client alone does not refresh sessions. Verify/refresh before returning cookies.
  // This is session maintenance, not authorization: protected queries still need RLS and claims checks.
  await supabase.auth.getClaims();
  return response;
}
