export type Accessory = "scarf" | "witchHat";

/** A little seasonal outfit: a witch hat the week before Halloween, a scarf through winter. */
export function seasonalAccessory(date: Date): Accessory | null {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 9 && day >= 24) return "witchHat";
  if (month === 11 || month === 0 || month === 1) return "scarf";
  return null;
}
