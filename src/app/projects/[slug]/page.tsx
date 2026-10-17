import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug, getProjectDetails, getProjects } from "@/lib/data";
import { ProjectMarkdown } from "@/components/project-markdown";
import { projectArticle, safeContentUrl } from "@/lib/project-content";
import ProjectFlash from "@/components/project-flash";
import { ProjectGallery } from "@/components/project-gallery";
import { ProjectCardActions } from "@/components/project-card-actions";

type Props = { params: Promise<{ slug: string }> };
const difficultyLabels = { beginner: "เริ่มต้น", intermediate: "ปานกลาง", advanced: "ขั้นสูง" };
const currency = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

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
    openGraph: { title: project.title, description: project.summary, type: "article", locale: "th_TH" },
  };
}

export default function ProjectPage({ params }: Props) {
  return (
    <main className="project-detail-page">
      <div className="container project-detail-container">
        <Link href="/" className="project-back-link">← กลับไปสำรวจผลงาน</Link>
        <Suspense fallback={<ProjectSkeleton />}>
          <ProjectContent params={params} />
        </Suspense>
      </div>
    </main>
  );
}

function ProjectSkeleton() {
  return (
    <section className="panel project-detail-hero" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">กำลังโหลดรายละเอียดโปรเจกต์</span>
      <div aria-hidden="true" className="aspect-[4/3] bg-[var(--surface-soft)]" />
      <div aria-hidden="true" className="project-hero-info"><div className="h-10 rounded bg-[var(--surface-soft)]" /></div>
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
  const hasFlash = hasFlashDemo || firmwareReleases.length > 0;
  const models = files.filter((file) => file.kind === "model");
  const downloadableModels = models.filter((file) => safeContentUrl(file.url) && !file.isDemo);
    const article = projectArticle(project.articleMarkdown, steps);
    const references = (project.references ?? []).filter((reference) => safeContentUrl(reference.url));
  const related = getProjects()
    .filter((item) => item.id !== project.id)
    .map((item) => {
      const itemDetails = getProjectDetails(item.id);
      return {
        project: item,
        details: itemDetails,
        score: Number(item.category === project.category) * 2 + (itemDetails?.tags.filter((tag) => tags.some((current) => current.id === tag.id)).length ?? 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <>
      <section className="panel project-detail-hero" aria-labelledby="project-title">
        <ProjectGallery cover={project.cover} title={project.title} contain={hasFlashDemo} images={project.images} />
        <div className="project-hero-info">
          <p className="project-hero-category">{project.category}</p>
          <h1 id="project-title">{project.title}</h1>
          <p className="project-hero-summary">{project.summary}</p>
          <div className="project-hero-meta">
            <span>{owner?.name ?? "Maker"}</span>
            <span>{difficultyLabels[project.difficulty]}</span>
            <span>{project.durationMinutes} นาที</span>
          </div>
          {!!tags.length && <div className="project-hero-tags">{tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>}
          {(hasFlash || models.length > 0) && (
            <div className="project-hero-buttons">
              {hasFlashDemo ? <ProjectFlash title={project.title} /> : hasFlash ? <button type="button" className="button primary" disabled title="ยังไม่มีเฟิร์มแวร์ที่พร้อมแฟลช">Flash</button> : null}
              {models.length > 0 && (downloadableModels.length === 1 ? (
                <a className="button primary" href={safeContentUrl(downloadableModels[0].url)} download>Download 3D</a>
              ) : downloadableModels.length > 1 ? (
                <details className="project-model-downloads">
                  <summary className="button primary">Download 3D</summary>
                  <ul>{downloadableModels.map((file) => <li key={file.id}><a href={safeContentUrl(file.url)} download>{file.name}</a></li>)}</ul>
                </details>
              ) : <button type="button" className="button primary" disabled title="ไฟล์ 3D เป็นข้อมูลเดโม ยังไม่มีไฟล์จริง">Download 3D</button>)}
            </div>
          )}
          <p className="project-demo-note">ข้อมูลโปรเจกต์ตัวอย่าง{!hasFlashDemo && hasFlash ? " · เฟิร์มแวร์ยังไม่พร้อมแฟลช" : ""}{models.length > 0 && !downloadableModels.length ? " · ไฟล์ 3D ยังดาวน์โหลดไม่ได้" : ""}</p>
        </div>
      </section>

      <div className="project-detail-columns">
        <div className="project-detail-content">
          <section className="panel project-content-section" aria-labelledby="overview-title">
            <h2 id="overview-title" className="section-heading">ภาพรวมโปรเจกต์</h2>
            <p className="muted leading-relaxed">{project.summary}</p>
            {!!project.skills.length && <div className="flex flex-wrap gap-2">{project.skills.map((skill) => <span className="badge" key={skill}>{skill}</span>)}</div>}
          </section>

          <section id="guide-start" className="panel project-content-section" aria-labelledby="materials-title">
            <h2 id="materials-title" className="section-heading">อุปกรณ์ที่ต้องใช้</h2>
            {materials.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-120 text-left text-sm">
                <caption className="sr-only">รายการอุปกรณ์และราคาประมาณต่อรายการ ข้อมูลตัวอย่าง ไม่ใช่ใบเสนอราคา</caption>
                <thead className="border-b border-[var(--border)]"><tr><th scope="col" className="py-3 pr-4">รายการ</th><th scope="col" className="px-3 py-3">จำนวน</th><th scope="col" className="py-3 text-right">ราคาประมาณ</th></tr></thead>
                <tbody>{materials.map((material) => <tr key={material.id} className="border-b border-[var(--border)]"><td className="py-4 pr-4">{safeContentUrl(material.url) ? <a className="project-material-link" href={safeContentUrl(material.url)} target="_blank" rel="noopener noreferrer">{material.name} ↗</a> : material.name}{material.note && <p className="muted mt-1 text-xs">{material.note}</p>}</td><td className="whitespace-nowrap px-3 py-4">{material.quantity} {material.unit}</td><td className="whitespace-nowrap py-4 text-right">{currency.format(material.estimatedCost)}</td></tr>)}</tbody>
              </table>
              <p className="project-demo-note">ราคาเป็นข้อมูลตัวอย่าง อาจแตกต่างตามร้านและช่วงเวลา</p>
            </div> : <p className="muted">ยังไม่มีรายการอุปกรณ์</p>}
          </section>

          <section className="panel project-content-section" aria-labelledby="steps-title">
            <h2 id="steps-title" className="section-heading">ขั้นตอนการทำ</h2>
            {project.safetyNotes.length > 0 && <blockquote className="project-article-warning"><strong>ก่อนเริ่มทำ</strong><ul>{project.safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></blockquote>}
            {article ? <ProjectMarkdown content={article} /> : <p className="muted">ยังไม่มีรายละเอียดขั้นตอนการทำ</p>}
          </section>

          {references.length > 0 && <section className="panel project-content-section" aria-labelledby="references-title">
            <h2 id="references-title" className="section-heading">แหล่งอ้างอิง</h2>
            <ul className="project-reference-list">{references.map((reference, index) => <li key={`${index}-${reference.url}`}><a href={safeContentUrl(reference.url)} target="_blank" rel="noopener noreferrer">{reference.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul>
          </section>}
        </div>

        <aside className="project-related" aria-labelledby="related-title">
          <h2 id="related-title" className="project-related-title">โปรเจกต์ที่เกี่ยวข้อง</h2>
          {related.map(({ project: item, details: itemDetails }) => <article className="project-card" key={item.id}>
            <Link href={`/projects/${item.slug}`} className="project-card-link">
              <div className="card-image"><Image src={item.cover} alt={item.title} fill sizes="(min-width: 1100px) 300px, (min-width: 600px) 50vw, 100vw" unoptimized className={item.flashDemo ? "object-contain bg-[var(--surface)] p-3" : "object-cover"} />
                {(item.flashDemo || itemDetails?.firmwareReleases.length || itemDetails?.files.some((file) => file.kind === "model")) ? <div className="card-capabilities">{(item.flashDemo || !!itemDetails?.firmwareReleases.length) && <span>Flash</span>}{itemDetails?.files.some((file) => file.kind === "model") && <span>3D</span>}</div> : null}
              </div>
              <div className="card-body"><h2 title={item.title}>{item.title}</h2></div>
            </Link>
            <div className="card-footer"><p className="card-author" title={itemDetails?.owner?.name}>{itemDetails?.owner?.name ?? "Maker"}</p><ProjectCardActions id={item.id} title={item.title} /></div>
          </article>)}
          {!related.length && <p className="muted">ยังไม่มีโปรเจกต์ที่เกี่ยวข้อง</p>}
        </aside>
      </div>
    </>
  );
}
