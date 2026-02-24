import { describe, it, expect } from "vitest";
import {
  registerUser,
  loginUser,
  verifyToken,
  getUserById,
} from "../auth";

describe("auth", () => {
  const testEmail = `test_${Date.now()}@example.com`;
  const testPassword = "securePassword123";

  it("registers a new user", async () => {
    const user = await registerUser(testEmail, testPassword, "Test User");
    expect(user.email).toBe(testEmail.toLowerCase());
    expect(user.name).toBe("Test User");
    expect(user.id).toMatch(/^user_/);
    expect(user.plan).toBe("creator");
    expect("passwordHash" in user).toBe(false);
  });

  it("rejects duplicate email registration", async () => {
    await expect(registerUser(testEmail, testPassword)).rejects.toThrow(
      "already exists"
    );
  });

  it("rejects short passwords", async () => {
    await expect(
      registerUser(`short_${Date.now()}@test.com`, "12345")
    ).rejects.toThrow("at least 6");
  });

  it("logs in with correct credentials", async () => {
    const { token, user } = await loginUser(testEmail, testPassword);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(user.email).toBe(testEmail.toLowerCase());
  });

  it("rejects login with wrong password", async () => {
    await expect(loginUser(testEmail, "wrongpassword")).rejects.toThrow(
      "Invalid email or password"
    );
  });

  it("rejects login with nonexistent email", async () => {
    await expect(
      loginUser("nonexistent@test.com", testPassword)
    ).rejects.toThrow("Invalid email or password");
  });

  it("verifies a valid token", async () => {
    const { token } = await loginUser(testEmail, testPassword);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.email).toBe(testEmail.toLowerCase());
    expect(payload!.userId).toMatch(/^user_/);
  });

  it("rejects an invalid token", () => {
    expect(verifyToken("invalid.token.here")).toBeNull();
  });

  it("retrieves a user by ID", async () => {
    const registered = await registerUser(
      `getbyid_${Date.now()}@test.com`,
      testPassword
    );
    const found = getUserById(registered.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe(registered.email);
    expect("passwordHash" in found!).toBe(false);
  });

  it("returns null for nonexistent user ID", () => {
    expect(getUserById("nonexistent_id")).toBeNull();
  });
});
