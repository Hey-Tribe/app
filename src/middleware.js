// Serves the admin dashboard at the root of admin.heytribe.app.
import { NextResponse } from "next/server";
export const config = { matcher: ["/", "/index.html"] };

export function middleware(request) {
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host === "admin.heytribe.app") return NextResponse.rewrite(new URL("/admin/index.html", request.url));
}
