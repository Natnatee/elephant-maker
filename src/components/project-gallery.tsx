"use client";

import Image from "next/image";
import { useState } from "react";


export type ProjectGalleryProps = {
  cover: string;
  title: string;
  contain?: boolean;
  images?: { src: string; alt: string; kind?: "image" | "model" }[];
};

export function ProjectGallery({ cover, title, contain = false, images = [] }: ProjectGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = [{ src: cover, alt: title, kind: "image" as const }, ...images];
  const activeIndex = selectedIndex < items.length ? selectedIndex : 0;
  const active = items[activeIndex];

  return (
    <div className="project-gallery">
      <div className="project-gallery-main">
        <Image
          src={active.src}
          alt={active.alt}
          fill
          unoptimized
          sizes="100vw"
          className={contain || active.kind === "model" ? "project-gallery-contain" : "project-gallery-cover"}
        />
        {active.kind === "model" && <span className="project-gallery-label">ชิ้นส่วน 3D</span>}
      </div>
      {images.length > 0 && (
        <div className="project-gallery-thumbnails" aria-label={`รูปภาพ ${title}`}>
          {items.map((item, index) => (
            <button
              key={`${index}-${item.src}`}
              type="button"
              className={`project-gallery-thumbnail${index === activeIndex ? " selected" : ""}`}
              aria-pressed={index === activeIndex}
              aria-label={`${item.alt || title}${item.kind === "model" ? " — ชิ้นส่วน 3D" : ""} (${index + 1})`}
              onClick={() => setSelectedIndex(index)}
            >
              <Image src={item.src} alt="" fill unoptimized sizes="96px" className="project-gallery-cover" />
              {item.kind === "model" && <span className="project-gallery-label">ชิ้นส่วน 3D</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
