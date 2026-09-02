import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones in the same group.
 *
 * Plain concatenation would leave `px-2 px-4` to be settled by CSS source order rather than by
 * call order, so a component's default padding could beat the override a caller passed in.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
