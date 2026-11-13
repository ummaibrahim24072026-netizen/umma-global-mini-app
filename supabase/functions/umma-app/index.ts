const OWNER = "ummaibrahim24072026-netizen";
const REPOSITORY = "umma-global-mini-app";
const REF = "feature/share-app";
const PREFIX = "/functions/v1/umma-app";
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPOSITORY}/${REF}`;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  if (url.pathname === PREFIX) {
    return Response.redirect(new URL(PREFIX + "/", url), 308);
  }

  if (!url.pathname.startsWith(PREFIX + "/")) {
    return new Response("Not found", { status: 404 });
  }

  let path: string;
  try {
    path = decodeURIComponent(url.pathname.slice(PREFIX.length + 1));
  } catch {
    return new Response("Bad path", { status: 400 });
  }

  if (!path || path.endsWith("/")) path += "index.html";
  const segments = path.split("/");
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    segments.some((part) => !part || part === "." || part === ".." || part.startsWith(".")) ||
    /^(supabase|\.github|node_modules|tests|scripts)(\/|$)/i.test(path) ||
    /^(README|LICENSE|package-lock|package|tsconfig)(\.|$)/i.test(path)
  ) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(`${RAW}/${path}${url.search}`, {
    headers: { "Accept": "*/*" },
  }).catch(() => null);

  if (!upstream) return new Response("Upstream unavailable", { status: 502 });
  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? "Not found" : "Unable to load app asset", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const extension = path.includes(".") ? "." + path.split(".").pop()!.toLowerCase() : "";
  const headers = new Headers({
    "Content-Type": TYPES[extension] || "application/octet-stream",
    "Cache-Control": path === "index.html" ? "no-cache" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers,
  });
});
