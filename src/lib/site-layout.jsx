// One full HTML document per page: <html lang>, the page's head tags, and its body.
import PageHead from "../components/PageHead.jsx";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export function SiteDocument({ page, children }) {
  return (
    <html lang={page.lang} suppressHydrationWarning>
      <head>
        <PageHead nodes={page.head} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
