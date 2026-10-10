import mockDb from "@/data/mock-db.json";
import type { Database, ProjectDetails, ProjectStatus } from "@/lib/types";

// JSON imports widen string literals; this boundary keeps the relational contract explicit.
export const db = mockDb as Database;

export function getProjects(status: ProjectStatus = "published") {
  return db.projects.filter((project) => project.status === status);
}

export function getProjectBySlug(slug: string) {
  return db.projects.find(
    (project) => project.slug === slug && project.status === "published",
  );
}

export function getProfileById(id: string) {
  return db.profiles.find((profile) => profile.id === id);
}

export function getProjectTags(id: string) {
  const tagIds = new Set(
    db.project_tags
      .filter((row) => row.projectId === id)
      .map((row) => row.tagId),
  );
  return db.tags.filter((tag) => tagIds.has(tag.id));
}

export function getProjectDetails(id: string): ProjectDetails | undefined {
  const project = db.projects.find(
    (row) => row.id === id && row.status === "published",
  );
  if (!project) return undefined;
  const files = db.files.filter((row) => row.projectId === id);
  return {
    project,
    owner: getProfileById(project.ownerId),
    steps: db.steps
      .filter((row) => row.projectId === id)
      .sort((a, b) => a.order - b.order),
    materials: db.materials.filter((row) => row.projectId === id),
    files,
    firmwareReleases: db.firmwareReleases
      .filter((row) => row.projectId === id)
      .map((release) => ({
        ...release,
        parts: db.firmwareParts
          .filter((part) => part.releaseId === release.id)
          .map((part) => ({
            ...part,
            file: files.find((file) => file.id === part.fileId),
          })),
      })),
    tags: getProjectTags(id),
  };
}
