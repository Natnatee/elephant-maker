import Markdown from "react-markdown";
import { safeContentUrl } from "@/lib/project-content";

export function ProjectMarkdown({ content }: { content: string }) {
  return (
    <div className="project-markdown">
      <Markdown
        skipHtml
        urlTransform={(url) => safeContentUrl(url) ?? ""}
        components={{
          a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
          img: ({ src, alt }) => typeof src === "string" && src ? (
            // Article images can come from arbitrary hosts and have no fixed dimensions.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          ) : null,
        }}
      >{content}</Markdown>
    </div>
  );
}
