import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


type Props = { params: Promise<{ id: string }> };

async function ProfileContent({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createClient(await cookies());
  // Public fields only. Email and Auth metadata are never part of this query.
  const { data: profile, error } = await supabase.from("profiles").select("id,name,bio").eq("id", id).maybeSingle();
  if (error) return <p role="alert">โหลดโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>;
  if (!profile) notFound();
  const { data: projects, error: projectsError } = await supabase.from("projects").select("id,title,slug,summary").eq("owner_id", profile.id).eq("status", "published").order("published_at", { ascending: false });
  return <>
    <section className="panel space-y-3 p-6">
      <h1 className="break-words text-3xl font-bold">{profile.name}</h1>

      {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}
    </section>
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">ผลงานที่เผยแพร่</h2>
      {projectsError ? <p role="alert">โหลดรายการผลงานไม่สำเร็จ กรุณาลองใหม่</p> : projects?.length ? <ul className="grid gap-4 sm:grid-cols-2">{projects.map((project) => <li key={project.id} className="panel p-5"><Link href={`/projects/${project.slug}`} className="space-y-2"><h3 className="font-semibold">{project.title}</h3><p className="muted text-sm">{project.summary}</p></Link></li>)}</ul> : <p className="muted">ยังไม่มีผลงานที่เผยแพร่</p>}
    </section>
  </>;
}

export default function PublicProfilePage(props: Props) {
  return <main className="container mx-auto max-w-4xl space-y-6 px-4 py-12"><Suspense fallback={<p role="status">กำลังโหลดโปรไฟล์…</p>}><ProfileContent {...props} /></Suspense></main>;
}
