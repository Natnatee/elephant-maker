export type Category =
  "ยานยนต์" | "บ้านและสวน" | "งานพิมพ์ 3D" | "อิเล็กทรอนิกส์";
export type ProjectStatus = "draft" | "published";
export type Readiness = "showcase" | "ready";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: Category;
  cover: string;
  ownerId: string;
  status: ProjectStatus;
  readiness: Readiness;
  budget: number;
  durationMinutes: number;
  difficulty: Difficulty;
  skills: string[];
  safetyNotes: string[];
  publishedAt: string | null;
  featured: boolean;
  flashDemo?: "esp32-c3-check";
}

export interface Profile {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  contacts?: { line?: string; facebook?: string; github?: string };
}
export interface Step {
  id: string;
  projectId: string;
  order: number;
  title: string;
  description: string;
  safetyNote?: string;
}
export interface Material {
  id: string;
  projectId: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number;
  note?: string;
}
export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  kind: "document" | "model" | "source" | "firmware";
  url: string | null;
  sizeBytes: number | null;
  mimeType: string;
  license: string;
  sha256: string | null;
  isDemo: boolean;
}
export interface FirmwareRelease {
  id: string;
  projectId: string;
  version: string;
  chip: string;
  board: string;
  license: string;
  notes: string;
  isDemo: boolean;
}
export interface FirmwarePart {
  id: string;
  releaseId: string;
  fileId: string;
  offset: string;
}
export interface Tag {
  id: string;
  name: string;
  slug: string;
}
export interface ProjectTag {
  projectId: string;
  tagId: string;
}
export interface Database {
  projects: Project[];
  profiles: Profile[];
  steps: Step[];
  materials: Material[];
  files: ProjectFile[];
  firmwareReleases: FirmwareRelease[];
  firmwareParts: FirmwarePart[];
  tags: Tag[];
  project_tags: ProjectTag[];
}
export interface ProjectDetails {
  project: Project;
  owner: Profile | undefined;
  steps: Step[];
  materials: Material[];
  files: ProjectFile[];
  firmwareReleases: (FirmwareRelease & {
    parts: (FirmwarePart & { file: ProjectFile | undefined })[];
  })[];
  tags: Tag[];
}
