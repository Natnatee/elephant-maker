import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSafeNextPath } from "@/lib/auth/redirect";

type Props = { searchParams: Promise<{ next?: string }> };

async function LegacySetupRedirect({ searchParams }: Props) {
  const { next } = await searchParams;
  return redirect(getSafeNextPath(next));
}

// Keep old bookmarks and previously issued auth links working without onboarding.
export default function SetupPage(props: Props) {
  return <Suspense fallback={<p role="status">กำลังดำเนินการต่อ…</p>}><LegacySetupRedirect {...props} /></Suspense>;
}
