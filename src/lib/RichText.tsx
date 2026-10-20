import { Fragment } from "react";

import { parseRich, type Span } from "./rich";

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, index) =>
        span.bold ? (
          <strong key={index}>{span.text}</strong>
        ) : span.code ? (
          <code key={index}>{span.text}</code>
        ) : (
          <Fragment key={index}>{span.text}</Fragment>
        ),
      )}
    </>
  );
}

/** An agent's reply with its light Markdown shown as styling, never as HTML. */
export function RichText({ text }: { text: string }) {
  const blocks = parseRich(text);
  return (
    <>
      {blocks.map((block, index) =>
        block.kind === "item" ? (
          <span key={index} className="rich__item">
            <Spans spans={block.spans} />
          </span>
        ) : (
          <Fragment key={index}>
            <Spans spans={block.spans} />
            {index < blocks.length - 1 && <br />}
          </Fragment>
        ),
      )}
    </>
  );
}
