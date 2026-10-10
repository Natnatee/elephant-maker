"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/lib/types";
import { Icon, type IconName } from "./icons";

type CardProject = Project & { ownerName: string; tags: string[] };
const categories: { label: string; icon: IconName }[] = [
  { label: "ทั้งหมด", icon: "spark" },
  { label: "ยานยนต์", icon: "car" },
  { label: "บ้านและสวน", icon: "leaf" },
  { label: "งานพิมพ์ 3D", icon: "cube" },
  { label: "อิเล็กทรอนิกส์", icon: "chip" },
];
const difficultyLabels = {
  beginner: "เริ่มต้น",
  intermediate: "ปานกลาง",
  advanced: "ขั้นสูง",
};
export function ProjectExplorer({ projects }: { projects: CardProject[] }) {
  const [category, setCategory] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [budget, setBudget] = useState("");
  const [readiness, setReadiness] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("featured");
  const allTags = [...new Set(projects.flatMap((p) => p.tags))];
  const results = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("th-TH");
    return projects
      .filter(
        (p) =>
          (category === "ทั้งหมด" || p.category === category) &&
          (!term ||
            [p.title, p.summary, p.category, ...p.tags, ...p.skills]
              .join(" ")
              .toLocaleLowerCase("th-TH")
              .includes(term)) &&
          (!difficulty || p.difficulty === difficulty) &&
          (!budget || p.budget <= Number(budget)) &&
          (!readiness || p.readiness === readiness) &&
          (!tag || p.tags.includes(tag)),
      )
      .sort((a, b) =>
        sort === "budget"
          ? a.budget - b.budget
          : sort === "newest"
            ? (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
            : Number(b.featured) - Number(a.featured),
      );
  }, [projects, search, category, difficulty, budget, readiness, tag, sort]);
  const filtered = !!(
    search ||
    category !== "ทั้งหมด" ||
    difficulty ||
    budget ||
    readiness ||
    tag
  );
  function reset() {
    setSearch("");
    setCategory("ทั้งหมด");
    setDifficulty("");
    setBudget("");
    setReadiness("");
    setTag("");
  }
  return (
    <section
      id="explore"
      className="container explore-section"
      aria-labelledby="explore-title"
    >
      <div className="explore-heading">
        <div>
          <p className="eyebrow">EXPLORE & MAKE IT YOURS</p>
          <h2 id="explore-title">เริ่มจากสิ่งที่อยากแก้ไข</h2>
          <p className="muted">หาไอเดียที่ตรงกับคุณ แล้วค่อย ๆ ลงมือทำ</p>
        </div>
        <span className="collection-label">
          <span className="little-dot" />
          คอลเลกชันเริ่มต้น
        </span>
      </div>
      <div className="search-box">
        <Icon name="search" size={23} />
        <label className="sr-only" htmlFor="project-search">
          ค้นหาโปรเจกต์
        </label>
        <input
          id="project-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="อยากแก้ปัญหาอะไร? ลอง ‘อ่านข้อมูลรถ’ หรือ ‘รดน้ำต้นไม้’"
        />
        {search && (
          <button
            className="clear-search"
            onClick={() => setSearch("")}
            aria-label="ล้างคำค้น"
          >
            <Icon name="close" size={18} />
          </button>
        )}
        <span className="search-hint">ค้นหาจากปัญหา ชื่อ หรือแท็ก</span>
      </div>
      <div className="category-tabs" role="group" aria-label="หมวดโปรเจกต์">
        {categories.map((item) => (
          <button
            key={item.label}
            className={
              category === item.label ? "category-tab selected" : "category-tab"
            }
            aria-pressed={category === item.label}
            onClick={() => setCategory(item.label)}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
            {item.label === "ทั้งหมด" && <span>{projects.length}</span>}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <div className="filter-selects">
          <label>
            <span>ระดับ</span>
            <select
              aria-label="กรองระดับความยาก"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">ทุกระดับ</option>
              <option value="beginner">เริ่มต้น</option>
              <option value="intermediate">ปานกลาง</option>
              <option value="advanced">ขั้นสูง</option>
            </select>
          </label>
          <label>
            <span>งบ</span>
            <select
              aria-label="กรองงบประมาณ"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              <option value="">ทุกงบประมาณ</option>
              <option value="500">ไม่เกิน 500 บาท</option>
              <option value="1000">ไม่เกิน 1,000 บาท</option>
              <option value="3000">ไม่เกิน 3,000 บาท</option>
            </select>
          </label>
          <label>
            <span>สถานะ</span>
            <select
              aria-label="กรองความพร้อม"
              value={readiness}
              onChange={(e) => setReadiness(e.target.value)}
            >
              <option value="">ทุกผลงาน</option>
              <option value="ready">ตัวอย่างคู่มือครบ</option>
              <option value="showcase">โชว์แนวคิด</option>
            </select>
          </label>
          <button
            className="advanced-toggle"
            aria-expanded={advanced}
            aria-controls="advanced-filters"
            onClick={() => setAdvanced(!advanced)}
          >
            {advanced ? "−" : "+"} ตัวกรองเพิ่มเติม
          </button>
        </div>
        <label className="sort-select">
          <span className="sr-only">เรียงโปรเจกต์</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">แนะนำก่อน</option>
            <option value="newest">ใหม่ล่าสุด</option>
            <option value="budget">งบน้อยก่อน</option>
          </select>
        </label>
      </div>
      {advanced && (
        <div id="advanced-filters" className="advanced-filters">
          <label htmlFor="tag-filter">บอร์ด / เทคโนโลยี / แท็ก</label>
          <select
            id="tag-filter"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">ทุกแท็ก</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <p>ข้อมูลตัวอย่างยังไม่มีผลการทดสอบจากผู้ใช้จริง</p>
        </div>
      )}
      <div className="results-heading">
        <p role="status" aria-live="polite">
          พบ <strong>{results.length}</strong> โปรเจกต์
          {category !== "ทั้งหมด" ? ` · ${category}` : "ที่รอให้คุณลอง"}
        </p>
        {filtered && (
          <button className="text-button" onClick={reset}>
            ล้างตัวกรองทั้งหมด
          </button>
        )}
        <span className="muted results-demo">
          ทั้งหมดเป็นผลงานสมมติสำหรับทดลองหน้าเว็บ
        </span>
      </div>
      {results.length ? (
        <div className="project-grid">
          {results.map((project) => (
            <article className="project-card" key={project.id}>
              <Link
                href={`/projects/${project.slug}`}
                className="project-card-link"
              >
                <div
                  className={`card-image category-${project.category === "ยานยนต์" ? "auto" : project.category === "บ้านและสวน" ? "garden" : "other"}`}
                >
                  <Image
                    src={project.cover}
                    alt={`ภาพประกอบ ${project.title}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                    unoptimized
                    className="object-cover"
                  />
                  <span className="card-category">{project.category}</span>
                  <span
                    className={`card-readiness ${project.readiness === "ready" ? "ready" : "showcase"}`}
                  >
                    {project.readiness === "ready" ? (
                      <>
                        <Icon name="book" size={13} />
                        ตัวอย่างคู่มือครบ
                      </>
                    ) : (
                      "โชว์แนวคิด"
                    )}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-tags">
                    {project.tags.slice(0, 2).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <h3>{project.title}</h3>
                  <p className="card-summary">{project.summary}</p>
                  <div className="card-meta">
                    <span>
                      <Icon name="wallet" size={16} />
                      {project.budget.toLocaleString("th-TH")} บาท
                    </span>
                    <span>
                      <Icon name="clock" size={16} />
                      {project.durationMinutes >= 60
                        ? `${Math.round(project.durationMinutes / 6) / 10} ชม.`
                        : `${project.durationMinutes} นาที`}
                    </span>
                    <span className="difficulty">
                      <i className={`difficulty-dot ${project.difficulty}`} />
                      {difficultyLabels[project.difficulty]}
                    </span>
                  </div>
                  <div className="card-footer">
                    <span className="card-author">
                      <span className="avatar-initial">
                        {project.ownerName.slice(0, 1)}
                      </span>
                      {project.ownerName}
                    </span>
                    <span className="card-open">
                      ดูโปรเจกต์ <Icon name="arrow" size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" size={32} />
          <h3>ยังไม่พบไอเดียที่ตรงกับคำค้น</h3>
          <p>ลองค้นด้วยคำสั้น ๆ หรือขยายงบและหมวดที่เลือก</p>
          <button className="button secondary" onClick={reset}>
            ดูโปรเจกต์ทั้งหมด
          </button>
        </div>
      )}
      <div className="explore-bottom">
        <span className="muted">ไอเดียดี ๆ ไม่จำเป็นต้องเริ่มจากสิ่งใหญ่</span>
        <Link href="/submit">
          มีไอเดียอื่น? มาแบ่งปันกัน <Icon name="arrow" size={17} />
        </Link>
      </div>
    </section>
  );
}
