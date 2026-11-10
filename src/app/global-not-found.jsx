// Any address that isn't a page: the site's own 404 page, with a real 404 status.
import { loadPage } from "../lib/pages.js";
import { SiteDocument } from "../lib/site-layout.jsx";
import PageBody from "../components/PageBody.jsx";
export { viewport } from "../lib/site-layout.jsx";

export default function GlobalNotFound() {
  const page = loadPage("en", "404.html");
  return <SiteDocument page={page}><PageBody html={page.body} /></SiteDocument>;
}
