/**
 * Unique ID generator for messages, investigation traces, and UI items.
 * Combines timestamp, monotonic counter, and random entropy to prevent
 * React key collisions across fast rerenders and identical timestamps.
 */

let counter = 0;

export function generateMessageId(prefix: "user" | "msg" | "init" = "msg"): string {
  counter += 1;
  const timestamp = Date.now();
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${counter}_${randomPart}`;
}
