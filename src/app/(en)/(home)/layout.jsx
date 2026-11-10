import { loadPage } from "../../../lib/pages.js";
import { SiteDocument } from "../../../lib/site-layout.jsx";
export { viewport } from "../../../lib/site-layout.jsx";

export default function Layout({ children }) {
  return <SiteDocument page={loadPage("en", "index.html")}>{children}</SiteDocument>;
}
