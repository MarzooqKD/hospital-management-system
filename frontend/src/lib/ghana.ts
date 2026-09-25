// Mirrors apps/core/validators.py — kept in sync manually since frontend and
// backend don't currently share a validation package.

export const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

export function isValidGhanaPhone(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "");
  return /^0\d{9}$/.test(digits) || /^\+233\d{9}$/.test(digits);
}
