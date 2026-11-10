import { loadPage } from "../../../lib/pages.js";
import PageBody from "../../../components/PageBody.jsx";

export default function Page() {
  return <PageBody html={loadPage("en", "index.html").body} />;
}
