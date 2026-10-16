import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug, getProjectDetails, getProjects } from "@/lib/data";
import { ProjectActions } from "@/components/project-actions";
import { StepGuide } from "@/components/step-guide";
import ProjectFlash from "@/components/project-flash";

type Props = { params: Promise<{ slug: string }> };
const difficultyLabels = {
  beginner: "เริ่มต้น",
  intermediate: "ปานกลาง",
  advanced: "ขั้นสูง",
};
const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function generateStaticParams() {
  return getProjects().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  return {
    title: project.title,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
      type: "article",
      locale: "th_TH",
    },
  };
}

export default function ProjectPage({ params }: Props) {
  return (
    <main className="bg-[var(--background)] py-8 text-[var(--foreground)] sm:py-12">
      <div className="container space-y-8">
        <Link href="/" className="button secondary">
          ← กลับไปสำรวจผลงาน
        </Link>
        <Suspense fallback={<ProjectSkeleton />}>
          <ProjectContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

function ProjectSkeleton() {
  return (
    <section
      className="panel overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">กำลังโหลดรายละเอียดโปรเจกต์</span>
      <div aria-hidden="true" className="grid lg:grid-cols-2">
        <div className="min-h-64 bg-[var(--surface-soft)] sm:min-h-96" />
        <div className="space-y-5 p-6 sm:p-9">
          <div className="h-5 w-32 rounded bg-[var(--surface-soft)]" />
          <div className="h-10 w-4/5 rounded bg-[var(--surface-soft)]" />
          <div className="h-10 w-3/5 rounded bg-[var(--surface-soft)]" />
          <div className="h-20 rounded bg-[var(--surface-soft)]" />
          <div className="h-12 w-48 rounded bg-[var(--accent-soft)]" />
        </div>
      </div>
    </section>
  );
}

async function ProjectContent({ params }: Props) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  const details = getProjectDetails(project.id);
  if (!details) notFound();
  const { owner, steps, materials, files, firmwareReleases, tags } = details;
  const hasFlashDemo = project.flashDemo === "esp32-c3-check";

  return (
    <>
      <section
        className="panel grid overflow-hidden lg:grid-cols-2"
        aria-labelledby="project-title"
      >
        <div className="relative min-h-64 bg-[var(--accent-soft)] sm:min-h-96">
          <Image
            src={project.cover}
            alt={
              hasFlashDemo
                ? `รูปบอร์ด ESP32-C3 SuperMini · ${project.title}`
                : `ภาพประกอบแนวคิด ${project.title}`
            }
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            unoptimized
            preload
            className={
              hasFlashDemo
                ? "object-contain bg-[var(--surface)] p-5"
                : "object-cover"
            }
          />
        </div>
        <div className="space-y-5 p-6 sm:p-9">
          <p className="eyebrow">{project.category} · SAMPLE PROJECT</p>
          <div className="flex flex-wrap gap-2">
            <span className="badge">ผลงานตัวอย่าง</span>
            <span className="badge">
              {project.readiness === "showcase"
                ? "โชว์แนวคิด · ยังไม่พร้อมทำตาม"
                : "พร้อมทำตาม · ต้องตรวจสอบก่อนใช้"}
            </span>
          </div>
          <h1
            id="project-title"
            className="text-3xl font-bold leading-tight sm:text-4xl"
          >
            {project.title}
          </h1>
          <p className="muted leading-relaxed">{project.summary}</p>
          <dl className="grid grid-cols-3 gap-3 border-y border-[var(--border)] py-4 text-sm">
            <div>
              <dt className="muted">งบประมาณ</dt>
              <dd className="mt-1 font-semibold">
                {currency.format(project.budget)}
              </dd>
            </div>
            <div>
              <dt className="muted">เวลาโดยประมาณ</dt>
              <dd className="mt-1 font-semibold">
                {project.durationMinutes} นาที
              </dd>
            </div>
            <div>
              <dt className="muted">ระดับ</dt>
              <dd className="mt-1 font-semibold">
                {difficultyLabels[project.difficulty]}
              </dd>
            </div>
          </dl>
          <p className="muted text-sm">
            งบและเวลาเป็นตัวเลขสมมติ ไม่ใช่ผลการทดสอบจริง
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="badge">
                #{tag.name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {hasFlashDemo && <ProjectFlash title={project.title} />}
            <a
              href="#guide-start"
              className={`button ${hasFlashDemo ? "secondary" : "primary"}`}
            >
              {hasFlashDemo ? "ดูขั้นตอนติดตั้ง ↓" : "สำรวจขั้นตอนตัวอย่าง →"}
            </a>
          </div>
          <ProjectActions
            title={project.title}
            summary={project.summary}
            slug={project.slug}
            ownerName={owner?.name}
          />
        </div>
      </section>

      <aside
        className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-6 text-[var(--warning-text)]"
        aria-label="ข้อจำกัดของตัวอย่าง"
      >
        <h2 className="font-bold">
          {hasFlashDemo
            ? "โปรเจกต์ตัวอย่าง แต่การแฟลชเขียนบอร์ดจริง"
            : "เรียนรู้จากแนวคิด ไม่ใช่คู่มือลงมือจริง"}
        </h2>
        <p className="mt-2 leading-relaxed">
          {hasFlashDemo
            ? "ข้อมูลผู้สร้าง งบ และเวลาเป็น mock ส่วนเครื่องมือแฟลชใช้ Web Serial จริงและล้างข้อมูลทั้งหมดใน Flash ชุด ESP32_C3_CHECK ที่เตรียมไว้เปิดเฉพาะ localhost ไม่เผยแพร่ไฟล์ที่อาจฝังรหัส Wi-Fi บน Vercel"
            : "ทุกผลงานในชุดนี้เป็นข้อมูลสาธิต ยังไม่ผ่านการทดสอบหรือรับรองความปลอดภัย ไฟล์และเฟิร์มแวร์เป็นเพียงเมทาดาทา ไม่มีไบนารีที่ใช้งานได้"}
        </p>
      </aside>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          <section
            id="guide-start"
            className="panel space-y-5 p-6 sm:p-8"
            aria-labelledby="materials-title"
          >
            <h2 id="materials-title" className="section-heading">
              วัสดุและงบประมาณตัวอย่าง
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-120 text-left text-sm">
                <caption className="sr-only">
                  รายการวัสดุสมมติ ราคาต่อรายการ ไม่ใช่ใบเสนอราคา
                </caption>
                <thead className="border-b border-[var(--border)]">
                  <tr>
                    <th scope="col" className="py-3 pr-4">
                      รายการ
                    </th>
                    <th scope="col" className="px-3 py-3">
                      จำนวน
                    </th>
                    <th scope="col" className="py-3 text-right">
                      รวมประมาณ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr
                      key={material.id}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="py-4 pr-4">
                        {material.name}
                        {material.note && (
                          <p className="muted mt-1 text-xs">{material.note}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4">
                        {material.quantity} {material.unit}
                      </td>
                      <td className="whitespace-nowrap py-4 text-right">
                        {currency.format(material.estimatedCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!materials.length && <p className="muted">ยังไม่มีรายการวัสดุ</p>}
          </section>

          <section
            className="panel space-y-5 p-6 sm:p-8"
            aria-labelledby="steps-title"
          >
            <h2 id="steps-title" className="section-heading">
              {hasFlashDemo ? "ขั้นตอนติดตั้ง ESP32-C3" : "สำรวจขั้นตอนแนวคิด"}
            </h2>
            <StepGuide key={project.id} steps={steps} />
          </section>

          <section
            className="panel space-y-5 p-6 sm:p-8"
            aria-labelledby="firmware-title"
          >
            <h2 id="firmware-title" className="section-heading">
              ไฟล์และเฟิร์มแวร์
            </h2>
            <p className="muted">
              {hasFlashDemo
                ? "กดปุ่มแฟลชด้านบนเพื่อเปิดขั้นตอนใน modal ระบบขอสิทธิ์พอร์ตเมื่อคุณกดเชื่อมต่อเท่านั้น ชุดสำเร็จรูปใช้บน localhost ส่วนบน Vercel ต้องเลือกไฟล์ในคอมผ่านหัวข้อขั้นสูง"
                : "ข้อมูลเดโมเท่านั้น ปิดการดาวน์โหลดและแฟลช ไม่มีการขอสิทธิ์ Serial หรือเชื่อมต่อฮาร์ดแวร์"}
            </p>
            {files.length ? (
              <ul className="space-y-3">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-4"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-medium">{file.name}</p>
                      <p className="muted text-sm">
                        {file.kind} · {file.license} · ไม่มีไฟล์จริง
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button secondary cursor-not-allowed opacity-50"
                      disabled
                    >
                      ดาวน์โหลดไม่ได้ · เดโม
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {hasFlashDemo
                  ? "ไม่ได้เปิดดาวน์โหลดเฟิร์มแวร์ส่วนตัวจากหน้ารายละเอียดนี้"
                  : "ไม่มีไฟล์ดาวน์โหลดสำหรับแนวคิดนี้"}
              </p>
            )}
            {firmwareReleases.map((release) => (
              <div
                key={release.id}
                className="space-y-4 rounded-2xl border border-[var(--border)] p-5"
              >
                <h3 className="font-semibold">
                  Firmware {release.version} · DEMO
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="inline font-semibold">Chip: </dt>
                    <dd className="inline">{release.chip}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">Board: </dt>
                    <dd className="inline">{release.board}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">License: </dt>
                    <dd className="inline">{release.license}</dd>
                  </div>
                </dl>
                <p className="muted text-sm">{release.notes}</p>
                <ul className="space-y-2 text-sm">
                  {release.parts.map((part) => (
                    <li key={part.id} className="break-all">
                      {part.file?.name ?? "ไม่มีไฟล์ที่อ้างอิง"} · Offset{" "}
                      <code>{part.offset}</code> (สมมติ ไม่ใช่คำแนะนำการแฟลช)
                    </li>
                  ))}
                </ul>
                <fieldset
                  disabled
                  className="space-y-2 rounded-xl bg-[var(--surface-soft)] p-4"
                >
                  <legend className="px-1 font-semibold">
                    เช็กลิสต์ก่อนใช้งานจริง · เดโมปิดไว้
                  </legend>
                  {[
                    "ตรวจรุ่นบอร์ดและชิปให้ตรงกัน",
                    "ตรวจสิทธิ์ใช้งานและ SHA-256 ของไฟล์จริง",
                    "ตรวจวงจรป้องกันและแหล่งจ่ายกับผู้เชี่ยวชาญ",
                    "ยืนยันขั้นตอนสำรองและกู้คืนที่ผ่านการทดสอบ",
                  ].map((label) => (
                    <label
                      key={label}
                      className="flex items-start gap-3 text-sm"
                    >
                      <input type="checkbox" className="mt-1" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <button
                  type="button"
                  disabled
                  className="button primary cursor-not-allowed opacity-50"
                >
                  แฟลชไม่ได้ · ไม่มีไบนารีจริง
                </button>
              </div>
            ))}
          </section>
        </div>

        <div className="space-y-8">
          <section
            className="panel space-y-4 p-6"
            aria-labelledby="safety-title"
          >
            <h2 id="safety-title" className="section-heading">
              ความปลอดภัยก่อนเสมอ
            </h2>
            <ul className="list-disc space-y-3 pl-5 leading-relaxed">
              {project.safetyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
          <section
            className="panel space-y-4 p-6"
            aria-labelledby="skills-title"
          >
            <h2 id="skills-title" className="section-heading">
              ทักษะที่เกี่ยวข้อง
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.skills.map((skill) => (
                <span className="badge" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </section>
          {owner && (
            <section
              className="panel space-y-4 p-6"
              aria-labelledby="author-title"
            >
              <p className="eyebrow">ผู้แบ่งปันแนวคิด · โปรไฟล์สมมติ</p>
              <div className="flex items-center gap-3">
                <Image
                  src={owner.avatar}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="rounded-full bg-[var(--accent-soft)] object-cover"
                />
                <h2 id="author-title" className="font-semibold">
                  {owner.name}
                </h2>
              </div>
              <p className="muted leading-relaxed">{owner.bio}</p>
              {owner.contacts && (
                <dl className="space-y-2 text-sm">
                  {Object.entries(owner.contacts).map(([channel, value]) => (
                    <div key={channel}>
                      <dt className="font-semibold">{channel}</dt>
                      <dd className="break-all">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {project.publishedAt && (
                <p className="muted text-sm">
                  เผยแพร่{" "}
                  {new Intl.DateTimeFormat("th-TH", {
                    dateStyle: "long",
                    timeZone: "Asia/Bangkok",
                  }).format(new Date(project.publishedAt))}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
