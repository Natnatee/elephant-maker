"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

const changeEvent = "elephant-maker:card-action";
const memory = new Map<string, string>();
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}
function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}
function useSavedAction(key: string) {
  const active = useSyncExternalStore(subscribe, () => read(key) === "1", () => false);
  function toggle() {
    const value = read(key) === "1" ? "" : "1";
    memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Keep actions usable for this session when browser storage is disabled.
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return [active, toggle] as const;
}

export function ProjectCardActions({ id, title }: { id: string; title: string }) {
  const [liked, toggleLike] = useSavedAction(`elephant-maker:like:${id}`);
  const [bookmarked, toggleBookmark] = useSavedAction(`elephant-maker:bookmark:${id}`);
  return (
    <div className="card-actions">
      <button type="button" className="card-action card-like" aria-label={`ถูกใจ ${title}`} aria-pressed={liked} onClick={toggleLike}>
        <Icon name="like" size={20} />
        <span>{liked ? 1 : 0}</span>
      </button>
      <span className="card-views" aria-label="ยอดเข้าชม 0 ครั้ง" title="ยังไม่ได้เชื่อมต่อยอดเข้าชมจริง">
        <Icon name="eye" size={20} /> 0
      </span>
      <button type="button" className="card-action card-bookmark" aria-label={`${bookmarked ? "ยกเลิกบันทึก" : "บันทึก"} ${title}`} aria-pressed={bookmarked} onClick={toggleBookmark}>
        <Icon name="bookmark" size={20} style={{ fill: bookmarked ? "currentColor" : "none" }} />
      </button>
    </div>
  );
}
