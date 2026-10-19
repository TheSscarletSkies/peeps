import { Hub } from "./hub/Hub";
import { useSnapshot } from "./lib/useSnapshot";
import { Tray } from "./tray/Tray";

/** The peeps window loads with `?view=home`; everything else is the notch tray. */
function isHomeView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "home";
}

export function App() {
  const snapshot = useSnapshot();
  if (!snapshot) return null;
  return isHomeView() ? (
    <Hub snapshot={snapshot} />
  ) : (
    <Tray snapshot={snapshot} />
  );
}
