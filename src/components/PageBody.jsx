// The page's own markup. `display: contents` keeps the wrapper out of the layout, so the page's CSS sees the same
// structure as before the move to Next.js.
export default function PageBody({ html }) {
  return <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
