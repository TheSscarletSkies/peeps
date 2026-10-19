import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
  </Icon>
);

export const TodoIcon = () => (
  <Icon>
    <circle cx="6" cy="7" r="1.6" />
    <circle cx="6" cy="12" r="1.6" />
    <circle cx="6" cy="17" r="1.6" />
    <path d="M10.5 7H19M10.5 12H19M10.5 17H19" />
  </Icon>
);

export const WriteIcon = () => (
  <Icon>
    <path d="M5 19l1-4L16 5l3 3L9 18z" />
    <path d="M14 7l3 3" />
  </Icon>
);

export const TokensIcon = () => (
  <Icon>
    <path d="M5 19V11M12 19V5M19 19v-5" />
  </Icon>
);

export const ProductsIcon = () => (
  <Icon>
    <path d="M4 14c0-4 3.6-7 8-7s8 3 8 7c0 3-3.6 5-8 5s-8-2-8-5z" />
    <path d="M10 7.5q2-3 4 0" />
  </Icon>
);
