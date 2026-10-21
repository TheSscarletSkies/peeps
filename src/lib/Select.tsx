import { useEffect, useId, useRef, useState } from "react";

export interface Choice {
  value: string;
  label: string;
}

/**
 * A dropdown drawn by peeps, so its list matches the theme instead of the system's grey one.
 * The button carries `id`, so a `<label htmlFor>` names it like a native select.
 */
export function Select({
  id,
  value,
  options,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  options: Choice[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [upward, setUpward] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);

  const show = () => {
    const box = wrap.current?.getBoundingClientRect();
    // Open upward near the bottom of the window, where a list would be cut off.
    setUpward(
      Boolean(box && window.innerHeight - box.bottom < 220 && box.top > 220),
    );
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  return (
    <span
      ref={wrap}
      className={`select${className ? ` ${className}` : ""}`}
      data-value={value}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="select__button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) return show();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((now) =>
              Math.min(options.length - 1, Math.max(0, now + step)),
            );
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            pick(active);
          }
        }}
      >
        {current?.label ?? value}
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className={upward ? "select__list select__list--up" : "select__list"}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active || undefined}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                pick(index);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
