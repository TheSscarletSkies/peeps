/** A run of text and how it is styled. */
export interface Span {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export type Block =
  { kind: "line"; spans: Span[] } | { kind: "item"; spans: Span[] };

/** Reads the little Markdown agents write: **bold**, `code` and "- " or "1. " lists. */
export function parseRich(text: string): Block[] {
  return text.split("\n").map((line) => {
    const item = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    return item
      ? { kind: "item", spans: spans(item[1] ?? "") }
      : { kind: "line", spans: spans(line) };
  });
}

function spans(line: string): Span[] {
  const out: Span[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const at = match.index;
    if (at > last) out.push({ text: line.slice(last, at) });
    if (match[1] !== undefined) out.push({ text: match[1], bold: true });
    else out.push({ text: match[2] ?? "", code: true });
    last = at + match[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}
