import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/data";

export const alt = "Elephant Maker — sample project, not a validated guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  // Slugs are English in this dataset, so the image needs no fetched Thai font.
  const title = project.slug.replace(/-/g, " ");
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#172b45",
        color: "#fff7ed",
        padding: "64px",
        borderLeft: "18px solid #f97316",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: "#fb923c",
          letterSpacing: 4,
        }}
      >
        ELEPHANT MAKER
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 72,
          fontWeight: 700,
          textTransform: "capitalize",
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", fontSize: 28, color: "#fdba74" }}>
          SAMPLE PROJECT / SIMULATION ONLY
        </div>
        <div style={{ display: "flex", fontSize: 24 }}>
          Not a validated guide. No usable firmware included.
        </div>
      </div>
    </div>,
    size,
  );
}
