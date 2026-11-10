import { notFound } from "next/navigation";
import { loadPage, pageFiles } from "../../../lib/pages.js";
import PageBody from "../../../components/PageBody.jsx";

export const dynamicParams = false;
export function generateStaticParams() {
  return pageFiles("en").map(slug => ({ slug }));
}

export default async function Page({ params }) {
  const page = loadPage("en", (await params).slug);
  if (!page) notFound();
  return <PageBody html={page.body} />;
}
