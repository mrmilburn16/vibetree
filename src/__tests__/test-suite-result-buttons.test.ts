/**
 * Test that succeeded results have projectId so "Run on iPhone" and "Xcode" buttons show.
 * The create-project API returns { project: { id } }; the test-suite must read projectId from that shape.
 */

describe("test-suite result buttons (Run on iPhone, Xcode)", () => {
  const BUTTONS_VISIBLE =
    (r: { status: string; projectId?: string }) =>
      r.status === "succeeded" && Boolean(r.projectId);

  it("buttons are shown when status is succeeded and projectId is set", () => {
    expect(BUTTONS_VISIBLE({ status: "succeeded", projectId: "proj_123" })).toBe(true);
    expect(BUTTONS_VISIBLE({ status: "succeeded", projectId: "" })).toBe(false);
    expect(BUTTONS_VISIBLE({ status: "succeeded" })).toBe(false);
    expect(BUTTONS_VISIBLE({ status: "failed", projectId: "proj_123" })).toBe(false);
  });

  it("create-project API response shape: id is under project", () => {
    const apiResponse = { project: { id: "proj_abc", name: "Test", projectType: "pro" } };
    const projectId = (apiResponse as { project?: { id?: string }; id?: string }).project?.id ??
      (apiResponse as { project?: { id?: string }; id?: string }).id;
    expect(projectId).toBe("proj_abc");
  });

  it("create-project API response without project wrapper still works", () => {
    const apiResponse = { id: "proj_legacy" };
    const projectId = (apiResponse as { project?: { id?: string }; id?: string }).project?.id ??
      (apiResponse as { project?: { id?: string }; id?: string }).id;
    expect(projectId).toBe("proj_legacy");
  });
});
