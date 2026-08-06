import { clsx, type ClassValue } from "clsx";

/** Merge class names conditionally. Thin wrapper kept in one place so every
 * component composes classes the same way. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
