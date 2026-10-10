// Prepared from the local migration; regenerate with Supabase CLI after local application.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Category = "ยานยนต์" | "บ้านและสวน" | "งานพิมพ์ 3D" | "อิเล็กทรอนิกส์";
type Relationship<
  Name extends string,
  Columns extends string[],
  Table extends string,
  Referenced extends string[],
  One extends boolean = false,
> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: One;
  referencedRelation: Table;
  referencedColumns: Referenced;
};
type Table<
  Row,
  Required extends keyof Row,
  Relations extends {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[] = [],
  Writable extends keyof Row = keyof Row,
> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Pick<Row, Exclude<Writable, Required>>>;
  Update: Partial<Pick<Row, Writable>>;
  Relationships: Relations;
};
type Profile = {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  contacts: Json;
  created_at: string;
  updated_at: string;
};
type Project = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: Category;
  cover: string;
  compatibility_notes: string;
  contacts: Json;
  owner_id: string;
  status: "draft" | "published";
  readiness: "showcase" | "ready";
  budget: number;
  duration_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  skills: string[];
  safety_notes: string[];
  published_at: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
};
type Step = {
  id: string;
  project_id: string;
  order: number;
  title: string;
  description: string;
  safety_note: string | null;
};
type Material = {
  id: string;
  project_id: string;
  name: string;
  quantity: number;
  unit: string;
  estimated_cost: number;
  note: string | null;
};
type File = {
  id: string;
  project_id: string;
  name: string;
  kind:
    "image" | "video" | "text" | "document" | "model" | "source" | "firmware";
  storage_path: string | null;
  mime_type: string;
  size_bytes: number | null;
  license: string;
  sha256: string | null;
  is_demo: boolean;
};
type StepFile = {
  project_id: string;
  step_id: string;
  file_id: string;
  position: number;
  caption: string;
};
type Release = {
  id: string;
  project_id: string;
  version: string;
  chip: string;
  board: string;
  license: string;
  notes: string;
  is_demo: boolean;
};
type Part = {
  id: string;
  project_id: string;
  release_id: string;
  file_id: string;
  offset: string;
};
export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        "id",
        [],
        "id" | "name" | "bio" | "avatar" | "contacts"
      >;
      projects: Table<
        Project,
        "slug" | "title" | "category" | "owner_id",
        [
          Relationship<
            "projects_owner_id_fkey",
            ["owner_id"],
            "profiles",
            ["id"]
          >,
        ],
        Exclude<keyof Project, "featured" | "created_at" | "updated_at">
      >;
      steps: Table<
        Step,
        "project_id" | "order",
        [
          Relationship<
            "steps_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
        ]
      >;
      step_files: Table<
        StepFile,
        "project_id" | "step_id" | "file_id",
        [
          Relationship<
            "step_files_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
          Relationship<
            "step_files_step_id_project_id_fkey",
            ["step_id", "project_id"],
            "steps",
            ["id", "project_id"]
          >,
          Relationship<
            "step_files_file_id_project_id_fkey",
            ["file_id", "project_id"],
            "files",
            ["id", "project_id"]
          >,
        ]
      >;
      materials: Table<
        Material,
        "project_id" | "name",
        [
          Relationship<
            "materials_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
        ]
      >;
      files: Table<
        File,
        "project_id" | "name" | "kind",
        [
          Relationship<
            "files_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
        ]
      >;
      firmware_releases: Table<
        Release,
        "project_id" | "version" | "chip" | "board",
        [
          Relationship<
            "firmware_releases_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
        ]
      >;
      firmware_parts: Table<
        Part,
        "project_id" | "release_id" | "file_id" | "offset",
        [
          Relationship<
            "firmware_parts_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
          Relationship<
            "firmware_parts_release_id_project_id_fkey",
            ["release_id", "project_id"],
            "firmware_releases",
            ["id", "project_id"]
          >,
          Relationship<
            "firmware_parts_file_id_project_id_fkey",
            ["file_id", "project_id"],
            "files",
            ["id", "project_id"]
          >,
        ]
      >;
      tags: Table<{ id: string; name: string; slug: string }, "name" | "slug">;
      project_tags: Table<
        { project_id: string; tag_id: string },
        "project_id" | "tag_id",
        [
          Relationship<
            "project_tags_project_id_fkey",
            ["project_id"],
            "projects",
            ["id"]
          >,
          Relationship<"project_tags_tag_id_fkey", ["tag_id"], "tags", ["id"]>,
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
