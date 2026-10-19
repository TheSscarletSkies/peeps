import { useSnapshot } from "./lib/useSnapshot";
import { Tray } from "./tray/Tray";

export function App() {
  const snapshot = useSnapshot();
  return snapshot ? <Tray snapshot={snapshot} /> : null;
}
