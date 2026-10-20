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

export const RecapIcon = () => (
  <Icon>
    <rect x="5" y="3.5" width="14" height="17" rx="3" />
    <path d="M9 15.5h6M9 8.5l2 2 4-3.5" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon>
    <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />
  </Icon>
);

export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Icon>
);

export const SoundIcon = ({ on }: { on: boolean }) => (
  <Icon>
    <path d="M4 10v4h3.5L12 18V6L7.5 10z" />
    {on ? (
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
    ) : (
      <path d="M16 10l4 4M20 10l-4 4" />
    )}
  </Icon>
);

export const BellIcon = () => (
  <Icon>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const NumbersIcon = () => (
  <Icon>
    <path d="M4 18l5-6 4 3 7-8" />
    <path d="M15 7h5v5" />
  </Icon>
);

export const MailIcon = () => (
  <Icon>
    <rect x="3.5" y="5.5" width="17" height="13" rx="3" />
    <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
  </Icon>
);

export const AskIcon = () => (
  <Icon>
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0.5A2.5 2.5 0 0 1 5 13.5z" />
  </Icon>
);

export const DevicesIcon = () => (
  <Icon>
    <rect x="3" y="5" width="13" height="10" rx="2" />
    <path d="M2 18h15" />
    <rect x="17" y="9" width="5" height="10" rx="1.5" />
  </Icon>
);
