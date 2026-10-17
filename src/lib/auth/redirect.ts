const DEFAULT_NEXT = "/account";
const INTERNAL_ORIGIN = "https://internal.invalid";

export function getPostAuthPath(value: string | null | undefined): string {
  const next = getSafeNextPath(value);
  return new URL(next, INTERNAL_ORIGIN).pathname === "/account/password"
    ? "/account/password"
    : `/account/setup?next=${encodeURIComponent(next)}`;
}

export function getSafeNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    return DEFAULT_NEXT;
  }
  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== INTERNAL_ORIGIN ||
      decodedPath.startsWith("//") ||
      /[\\\u0000-\u001f\u007f-\u009f]/u.test(decodeURIComponent(value)) ||
      /^\/(?:auth|login)(?:\/|$)/i.test(decodedPath) ||
      /^\/account\/setup(?:\/|$)/i.test(decodedPath)
    ) {
      return DEFAULT_NEXT;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_NEXT;
  }
}
