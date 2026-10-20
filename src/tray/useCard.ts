import { useEffect, useRef, useState, type RefObject } from "react";

/** Tracks an element's height so the window can be sized to fit it. */
export function useHeight(
  element: RefObject<HTMLElement | null>,
  active: boolean,
): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const observer = new ResizeObserver(() =>
      setHeight(Math.ceil(target.getBoundingClientRect().height)),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [element, active]);
  return height;
}

/** Cards close when the user clicks elsewhere or presses Escape. */
export function useCloseOnLeave(onClose: () => void) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const close = () => latest.current();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
