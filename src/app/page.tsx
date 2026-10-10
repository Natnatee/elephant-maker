import { ProjectExplorer } from "@/components/project-explorer";
import { getProjects, getProfileById, getProjectTags } from "@/lib/data";

export default function Home() {
  const projects = getProjects().map((project) => ({
    ...project,
    ownerName: getProfileById(project.ownerId)?.name ?? "Maker",
    tags: getProjectTags(project.id).map((tag) => tag.name),
  }));
  return (
    <main>
      <ProjectExplorer projects={projects} />
    </main>
  );
}
