import { describe, it, expect } from "vitest";
import { stripOldImages, type VisionMessage } from "@/lib/visionTestUtils";

function userMsg(text: string, imageData: string = "base64data"): VisionMessage {
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "image", source: { type: "base64", media_type: "image/png", data: imageData } },
    ],
  };
}

function asstMsg(text: string): VisionMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
  };
}

describe("stripOldImages", () => {
  it("strips images from all user turns except the last one", () => {
    const messages: VisionMessage[] = [
      userMsg("Step 1", "img1"),
      asstMsg('{"action":"tap"}'),
      userMsg("Step 2", "img2"),
      asstMsg('{"action":"tap"}'),
      userMsg("Step 3", "img3"),
      asstMsg('{"action":"tap"}'),
      userMsg("Step 4", "img4"),
      asstMsg('{"action":"tap"}'),
      userMsg("Step 5", "img5"),
    ];
    const result = stripOldImages(messages);

    const userTurns = result.filter((m) => m.role === "user");
    expect(userTurns).toHaveLength(5);

    // First 4 user turns must have no image block
    for (let i = 0; i < 4; i++) {
      const content = userTurns[i].content;
      const images = content.filter((b) => b.type === "image");
      expect(images).toHaveLength(0);
    }

    // Last user turn must still have its image block
    const lastUser = userTurns[4];
    const lastImages = lastUser.content.filter((b) => b.type === "image");
    expect(lastImages).toHaveLength(1);
    expect((lastImages[0] as { type: "image"; source: { data: string } }).source.data).toBe("img5");
  });

  it("leaves the last user turn with its image block", () => {
    const messages: VisionMessage[] = [
      userMsg("First", "first.png"),
      asstMsg("{}"),
      userMsg("Last", "last.png"),
    ];
    const result = stripOldImages(messages);

    const lastUser = result[result.length - 1];
    expect(lastUser.role).toBe("user");
    const imageBlocks = lastUser.content.filter((b) => b.type === "image");
    expect(imageBlocks).toHaveLength(1);
    expect((imageBlocks[0] as { type: "image"; source: { data: string } }).source.data).toBe("last.png");
  });

  it("leaves all assistant turns unchanged", () => {
    const messages: VisionMessage[] = [
      userMsg("U1", "i1"),
      asstMsg("A1"),
      userMsg("U2", "i2"),
      asstMsg("A2"),
      userMsg("U3", "i3"),
    ];
    const result = stripOldImages(messages);

    expect(result[1]).toEqual(asstMsg("A1"));
    expect(result[3]).toEqual(asstMsg("A2"));
  });

  it("preserves all text blocks in all user turns", () => {
    const messages: VisionMessage[] = [
      userMsg("Text one", "img1"),
      asstMsg("{}"),
      userMsg("Text two", "img2"),
      asstMsg("{}"),
      userMsg("Text three", "img3"),
    ];
    const result = stripOldImages(messages);

    const userTurns = result.filter((m) => m.role === "user");
    expect(userTurns[0].content.find((b) => b.type === "text")).toEqual({ type: "text", text: "Text one" });
    expect(userTurns[1].content.find((b) => b.type === "text")).toEqual({ type: "text", text: "Text two" });
    expect(userTurns[2].content.find((b) => b.type === "text")).toEqual({ type: "text", text: "Text three" });
  });
});
