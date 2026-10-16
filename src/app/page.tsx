import { ProjectExplorer } from "@/components/project-explorer";
import { getProjects, getProfileById, getProjectTags, getProjectDetails } from "@/lib/data";

export default function Home() {
  const projects = getProjects().map((project) => ({
    ...project,
    hasFlash: Boolean(project.flashDemo || getProjectDetails(project.id)?.firmwareReleases.length),
    has3d: Boolean(getProjectDetails(project.id)?.files.some((file) => file.kind === "model")),
    ownerName: getProfileById(project.ownerId)?.name ?? "Maker",
    tags: getProjectTags(project.id).map((tag) => tag.name),
  }));
  return (
    <main>
      <ProjectExplorer projects={projects} />
    </main>
  );
}
