import { notFound } from "next/navigation";
import { loadPage } from "../../../lib/pages.js";
import { SiteDocument } from "../../../lib/site-layout.jsx";
export { viewport } from "../../../lib/site-layout.jsx";

export default async function Layout({ children, params }) {
  const page = loadPage("en", (await params).slug);
  if (!page) notFound();
  return <SiteDocument page={page}>{children}</SiteDocument>;
}
