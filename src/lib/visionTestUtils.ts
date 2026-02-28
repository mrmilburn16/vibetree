/**
 * Shared types and helpers for the vision test loop (builds + test-suite).
 * Kept in a module so stripOldImages can be unit tested.
 */

export type VisionMessage = {
  role: "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }
  >;
};

/**
 * Returns a copy of the messages array with image blocks removed from all user
 * turns except the last one. Used before sending to the API to reduce payload
 * size (only the current screenshot is sent).
 */
export function stripOldImages(msgs: VisionMessage[]): VisionMessage[] {
  const lastUserIdx = msgs.map((m, i) => (m.role === "user" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  return msgs.map((msg, index) => {
    if (msg.role === "user" && index !== lastUserIdx) {
      return { ...msg, content: msg.content.filter((block) => block.type !== "image") };
    }
    return msg;
  });
}
