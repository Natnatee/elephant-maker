"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Project } from "@/lib/types";
import { Icon, type IconName } from "./icons";

import { ProjectCardActions } from "./project-card-actions";

type CardProject = Project & { ownerName: string; tags: string[]; hasFlash: boolean; has3d: boolean };
const categories: { label: string; icon: IconName }[] = [
  { label: "ทั้งหมด", icon: "cube" },
  { label: "ยานยนต์", icon: "car" },
  { label: "บ้านและสวน", icon: "leaf" },
  { label: "งานพิมพ์ 3D", icon: "cube" },
  { label: "อิเล็กทรอนิกส์", icon: "chip" },
];
export function ProjectExplorer({ projects }: { projects: CardProject[] }) {
  const [category, setCategory] = useState("ทั้งหมด");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [budget, setBudget] = useState("");
  const [readiness, setReadiness] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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
  const filtered = Boolean(
    search ||
    category !== "ทั้งหมด" ||
    difficulty ||
    budget ||
    readiness ||
    tag,
  );
  const activeFilterCount = [difficulty, budget, readiness, tag].filter(
    Boolean,
  ).length;
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
      className="gallery-explorer"
      aria-labelledby="explore-title"
    >
      <div className="gallery-toolbar">
        <div className="search-box">
          <Icon name="search" size={23} />
          <label className="sr-only" htmlFor="project-search">
            ค้นหาโปรเจกต์
          </label>
          <input
            id="project-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาโปรเจกต์ เช่น K-Line, รดน้ำต้นไม้"
          />
          {search && (
            <button
              className="clear-search"
              onClick={() => setSearch("")}
              aria-label="ล้างคำค้น"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <Link href="/submit" className="button primary upload-button">
          <Icon name="plus" />
          ฝากผลงาน
        </Link>
      </div>

      <div className="category-tabs" role="group" aria-label="หมวดโปรเจกต์">
        {categories.map((item) => (
          <button
            key={item.label}
            className={`category-tab${category === item.label ? " selected" : ""}`}
            aria-pressed={category === item.label}
            onClick={() => setCategory(item.label)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="gallery-heading">
        <div className="gallery-title">
          <h1 id="explore-title">
            {category === "ทั้งหมด" ? "โปรเจกต์ทั้งหมด" : category}
          </h1>
          <span className="badge">ข้อมูลตัวอย่าง</span>
        </div>
        <div className="gallery-controls">
          <button
            type="button"
            className={`button secondary filter-toggle${showFilters || activeFilterCount ? " selected" : ""}`}
            aria-expanded={showFilters}
            aria-controls="project-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            ตัวกรอง{activeFilterCount ? ` (${activeFilterCount})` : ""}{" "}
            <span aria-hidden="true">{showFilters ? "−" : "+"}</span>
          </button>
          <label className="sort-select">
            <span className="sr-only">เรียงโปรเจกต์</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="featured">แนะนำก่อน</option>
              <option value="newest">ใหม่ล่าสุด</option>
              <option value="budget">งบน้อยก่อน</option>
            </select>
          </label>
        </div>
      </div>

      {showFilters && (
        <div id="project-filters" className="filter-panel">
          <label>
            ความยาก
            <select
              aria-label="กรองระดับความยาก"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="">ทุกระดับ</option>
              <option value="beginner">เริ่มต้น</option>
              <option value="intermediate">ปานกลาง</option>
              <option value="advanced">ขั้นสูง</option>
            </select>
          </label>
          <label>
            งบประมาณ
            <select
              aria-label="กรองงบประมาณ"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            >
              <option value="">ทุกงบประมาณ</option>
              <option value="500">ไม่เกิน 500 บาท</option>
              <option value="1000">ไม่เกิน 1,000 บาท</option>
              <option value="3000">ไม่เกิน 3,000 บาท</option>
            </select>
          </label>
          <label>
            ความพร้อม
            <select
              aria-label="กรองความพร้อม"
              value={readiness}
              onChange={(event) => setReadiness(event.target.value)}
            >
              <option value="">ทุกผลงาน</option>
              <option value="ready">ตัวอย่างคู่มือครบ</option>
              <option value="showcase">โชว์แนวคิด</option>
            </select>
          </label>
          <label>
            บอร์ด / แท็ก
            <select
              aria-label="กรองบอร์ดหรือแท็ก"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            >
              <option value="">ทุกแท็ก</option>
              {allTags.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className={`results-heading${filtered ? " has-filters" : ""}`}>
        <p
          role="status"
          aria-live="polite"
          className={filtered ? "" : "sr-only"}
        >
          พบ {results.length} โปรเจกต์
        </p>
        {filtered && (
          <button type="button" className="text-button" onClick={reset}>
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>

      {results.length ? (
        <div className="project-grid">
          {results.map((project, index) => (
            <article className="project-card" key={project.id}>
              <Link
                href={`/projects/${project.slug}`}
                className="project-card-link"
              >
                <div className="card-image">
                  <Image
                    src={project.cover}
                    alt={
                      project.flashDemo
                        ? `รูปบอร์ด ESP32-C3 SuperMini · ${project.title}`
                        : `ภาพประกอบ ${project.title}`
                    }
                    fill
                    sizes="(max-width: 599px) 100vw, (max-width: 1023px) 50vw, (max-width: 1399px) 33vw, 25vw"
                    unoptimized
                    loading={index < 4 ? "eager" : "lazy"}
                    className={
                      project.flashDemo
                        ? "object-contain bg-[var(--surface)] p-3"
                        : "object-cover"
                    }
                  />
                  {(project.hasFlash || project.has3d) && (
                    <div className="card-capabilities">
                      {project.hasFlash && <span>Flash</span>}
                      {project.has3d && <span>3D</span>}
                    </div>
                  )}
                </div>
                <div className="card-body">
                  <h2 title={project.title}>{project.title}</h2>
                </div>
              </Link>
              <div className="card-footer">
                <p className="card-author" title={project.ownerName}>{project.ownerName}</p>
                <ProjectCardActions id={project.id} title={project.title} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" size={32} />
          <h2>ยังไม่พบไอเดียที่ตรงกับคำค้น</h2>
          <p>ลองค้นด้วยคำสั้น ๆ หรือเปลี่ยนตัวกรอง</p>
          <button className="button secondary" onClick={reset}>
            ดูโปรเจกต์ทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}
