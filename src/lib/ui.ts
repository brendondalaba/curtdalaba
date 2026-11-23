// Shared class strings for the bd-style patterns in docs/DESIGN.md.

const button =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 font-medium text-sm transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

export const buttonPrimary = `${button} bg-primary text-primary-foreground hover:bg-primary/90 aria-disabled:pointer-events-none aria-disabled:opacity-50`;

export const buttonSecondary = `${button} bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground`;

export const buttonDanger = `${button} bg-danger text-danger-foreground hover:bg-danger/90`;

export const buttonGhost = `${button} hover:bg-accent hover:text-accent-foreground`;

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base placeholder:text-muted-foreground aria-invalid:border-danger md:text-sm";

export const labelClass = "font-medium text-sm leading-none";

export const cardClass =
  "rounded-xl border bg-surface p-6 text-sm text-surface-foreground";

/** Card title (h2/h3 inside a card). */
export const cardTitleClass = "font-semibold leading-none";
