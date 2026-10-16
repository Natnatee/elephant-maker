import {
  isLocalTestFlashRequestAllowed,
  readLocalTestFlashFirmware,
} from "@/lib/test-flash-local";


const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function failure(status: number): Response {
  return Response.json(
    {
      error:
        status === 404
          ? "Not found"
          : status === 405
            ? "Method not allowed"
            : "Local firmware unavailable",
    },
    { status, headers: securityHeaders },
  );
}

export async function GET(request: Request): Promise<Response> {
  // Read request-time data even when the environment gate rejects production.
  const url = request.url;
  if (!isLocalTestFlashRequestAllowed(request, process.env))
    return failure(404);
  try {
    const { manifest, bytes } = await readLocalTestFlashFirmware();
    if (new URL(url).searchParams.get("download") === "1") {
      return new Response(new Uint8Array(bytes), {
        headers: {
          ...securityHeaders,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": 'attachment; filename="merged.bin"',
        },
      });
    }
    return Response.json(manifest, { headers: securityHeaders });
  } catch (error) {
    const missing =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT";
    return failure(missing ? 404 : 500);
  }
}

// Explicit handlers keep framework-generated method responses from omitting the security headers.
async function unsupported(request: Request): Promise<Response> {
  return failure(
    isLocalTestFlashRequestAllowed(request, process.env) ? 405 : 404,
  );
}

export const HEAD = unsupported;
export const OPTIONS = unsupported;
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
