// Serves the admin dashboard at the root of admin.heytribe.app.
export const config = { matcher: ["/", "/index.html"] };

export default function middleware(request) {
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host === "admin.heytribe.app") {
    return new Response(null, {
      headers: { "x-middleware-rewrite": new URL("/admin/index.html", request.url).toString() },
    });
  }
}
