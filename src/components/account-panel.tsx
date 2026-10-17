import Link from "next/link";
import { DisplayNameForm } from "./member-profile-form";

export type AccountProfile = {
  id: string;
  name: string | null;

  bio: string | null;
  avatar: string | null;
  contacts: unknown;
};
export type AccountProject = {
  title: string;
  slug: string;
  status: string;
  owner_id: string;
};

export function getAccountInitials(name: string): string {
  return (
    Array.from(name.trim()).slice(0, 2).join("").toLocaleUpperCase() || "EM"
  );
}

export default function AccountPanel({
  member,
  profile,
  projects,
  profileError,
  projectsError,
}: {
  member: { id: string; email?: string };
  profile: AccountProfile | null;
  projects: AccountProject[];
  profileError?: string;
  projectsError?: string;
}) {
  const name = profile?.name || "สมาชิก Elephant Maker";
  return (
    <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[var(--accent-foreground)]"
        >
          {getAccountInitials(name)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{name}</h2>
          {profile && <Link className="text-sm text-[var(--brand)] underline" href={`/u/${profile.id}`}>ดูโปรไฟล์สาธารณะ ↗</Link>}
          <p className="break-all text-sm text-[var(--muted)]">
            {member.email || "บัญชีที่ยืนยันตัวตนแล้ว"}
          </p>
        </div>
      </div>
      {profileError ? (
        <p
          role="alert"
          className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]"
        >
          {profileError}
        </p>
      ) : profile ? (
        <p className="whitespace-pre-wrap">
          {profile.bio || "ยังไม่ได้เพิ่มประวัติผู้สร้าง"}
        </p>
      ) : (
        <p className="text-[var(--muted)]">ยังไม่มีข้อมูลโปรไฟล์ในฐานข้อมูล</p>
      )}
      {profile && <DisplayNameForm name={name} />}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">ร่างผลงานของคุณ</h3>
        {projectsError ? (
          <p
            role="alert"
            className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-4 text-[var(--warning-text)]"
          >
            {projectsError}
          </p>
        ) : projects.length ? (
          <ul className="space-y-3">
            {projects.map((project, index) => (
              <li
                key={`${project.slug}-${index}`}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"
              >
                <p className="font-semibold">
                  {project.title || "ผลงานยังไม่มีชื่อ"}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  สถานะ: ร่าง · {project.slug}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[var(--muted)]">
            ยังไม่มีร่างผลงานในบัญชีนี้
            ร่างในเครื่องไม่ได้ถูกอัปโหลดโดยอัตโนมัติ
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/submit"
          className="rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)]"
        >
          สร้างผลงาน
        </Link>
        <Link href="/account/password" className="button secondary">เปลี่ยนรหัสผ่าน</Link>
        <form method="post" action="/auth/signout">
          <button
            type="submit"
            className="rounded-xl border border-[var(--border)] px-5 py-3 font-semibold text-[var(--danger)]"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>
    </section>
  );
}
