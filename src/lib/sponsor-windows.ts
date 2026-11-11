function hourLabel(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock}${suffix}`;
}

export const SPONSOR_WINDOWS = Array.from({ length: 24 }, (_, start) => ({
  start,
  label: `${hourLabel(start)}–${hourLabel((start + 12) % 24)}`,
}));

export function windowLabel(start: number | null | undefined) {
  if (start == null || start < 0 || start > 23) return "";
  return SPONSOR_WINDOWS[start]?.label ?? "";
}

/** Whether the sponsor's 12-hour window is open at the given local hour. */
export function windowIsOpen(start: number | null | undefined, hour: number) {
  if (start == null || start < 0 || start > 23) return false;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  const end = (start + 12) % 24;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
