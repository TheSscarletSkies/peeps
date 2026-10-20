import type { ReactNode } from "react";

/** A small ⓘ that reveals a detail on click, keeping the screen calm. */
export function Info({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="info">
      <summary aria-label={label}>i</summary>
      <p>{children}</p>
    </details>
  );
}
