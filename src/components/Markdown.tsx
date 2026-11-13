// Just enough markdown for persona replies: paragraphs and **bold**. Text is
// escaped first, so a reply can never inject HTML into the page.

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n|\n(?=\*\*)/)
    .map((block) => `<p>${escape(block.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function Markdown({ text }: { text: string }) {
  return <div className="reply" dangerouslySetInnerHTML={{ __html: toHtml(text) }} />;
}
