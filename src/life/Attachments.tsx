import { fileName } from "./drops";

/** Dropped files waiting to go out with a note or message. */
export function Attachments({
  paths,
  onRemove,
}: {
  paths: string[];
  onRemove: (path: string) => void;
}) {
  if (paths.length === 0) return null;
  return (
    <ul className="attachments" aria-label="Attached files">
      {paths.map((path) => (
        <li key={path} title={path}>
          <span>{fileName(path)}</span>
          <button
            type="button"
            aria-label={`Remove ${fileName(path)}`}
            onClick={() => onRemove(path)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
