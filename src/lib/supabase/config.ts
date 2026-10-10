export function getSupabaseConfig() {
  // Literal env access is required for Next.js to include public values in browser bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Configure .env.local and restart Next.js.",
    );
  }
  return { url, publishableKey };
}
