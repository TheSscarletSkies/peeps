import type { UpdateReady } from "../lib/types";

export interface UpdateCardText {
  title: string;
  action: string;
  busy: boolean;
  error: string | null;
}

/**
 * What the Settings card says about a new version, or null for no card. The browser preview has
 * no installed app to update, so it never shows one.
 */
export function updateCard(
  update: UpdateReady | null,
  inApp: boolean,
): UpdateCardText | null {
  if (!inApp || !update) return null;
  return {
    title: `peeps ${update.version} is ready`,
    action: update.installing ? "Updating…" : "Restart to update",
    busy: update.installing,
    error: update.error,
  };
}
