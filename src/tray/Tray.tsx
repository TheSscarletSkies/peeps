import { useEffect, useState } from "react";

import { notch as loadNotch } from "../lib/bridge";
import type { Notch, Snapshot } from "../lib/types";
import { usePrefs } from "../life/prefs";
import { usePetEvents } from "../life/usePetEvents";
import { FloatTray } from "./FloatTray";
import { NotchTray } from "./NotchTray";
import { residentsOf } from "./shared";

/** Pets live in the notch on MacBooks and float anywhere on other screens, unless the user picks. */
export function Tray({ snapshot }: { snapshot: Snapshot }) {
  const [notch, setNotch] = useState<Notch | null>(null);
  const [prefs] = usePrefs();
  const { celebrating, arriving } = usePetEvents(snapshot.pets, true);

  useEffect(() => {
    void loadNotch().then(setNotch);
  }, []);

  // Pets take their spots once the screen is measured, so they never start squeezed.
  if (!notch) return null;

  const residents = residentsOf(snapshot, celebrating, arriving);
  const floating =
    prefs.place === "float" || (prefs.place === "auto" && notch.width === 0);

  return floating ? (
    <FloatTray snapshot={snapshot} residents={residents} />
  ) : (
    <NotchTray snapshot={snapshot} notch={notch} residents={residents} />
  );
}
