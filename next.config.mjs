// HeyTribe on Next.js. Website pages come from content/ (see src/lib/pages.js); the app, admin and sitter pages,
// styles, scripts and images are static files in public/. Security headers and redirects stay in vercel.json.
/** @type {import('next').NextConfig} */
export default {
  // page addresses end in .html and the Spanish home is /es/, so don't add or strip trailing slashes
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  experimental: { globalNotFound: true },
  outputFileTracingIncludes: { "/**": ["./content/**/*.html"] },
  async rewrites() {
    return [
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/", destination: "/app/index.html" },
      { source: "/admin", destination: "/admin/index.html" },
      { source: "/admin/", destination: "/admin/index.html" },
      { source: "/sitter", destination: "/sitter/index.html" },
      { source: "/sitter/", destination: "/sitter/index.html" },
      { source: "/es/", destination: "/es" },
      { source: "/index.html", destination: "/" },
      { source: "/.well-known/apple-app-site-association", destination: "/api/aasa" },
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }
    ];
  }
};
