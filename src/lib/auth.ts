/**
 * User authentication with JWT sessions and bcrypt password hashing.
 * Uses in-memory store (like the rest of the app) for demo/dev purposes.
 * Replace the store with a database for production.
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vibetree-dev-secret-change-in-production";
const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 10;

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
  plan: "creator" | "pro" | "team";
}

export interface AuthPayload {
  userId: string;
  email: string;
}

const users = new Map<string, User>();
const emailIndex = new Map<string, string>();

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Register a new user. Returns the user (without password hash) or throws on duplicate email.
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<Omit<User, "passwordHash">> {
  const normalizedEmail = email.toLowerCase().trim();

  if (emailIndex.has(normalizedEmail)) {
    throw new Error("An account with this email already exists");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user: User = {
    id: generateUserId(),
    email: normalizedEmail,
    name: name || normalizedEmail.split("@")[0],
    passwordHash,
    createdAt: Date.now(),
    plan: "creator",
  };

  users.set(user.id, user);
  emailIndex.set(normalizedEmail, user.id);

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticate a user by email and password. Returns a signed JWT or throws.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: Omit<User, "passwordHash"> }> {
  const normalizedEmail = email.toLowerCase().trim();
  const userId = emailIndex.get(normalizedEmail);

  if (!userId) {
    throw new Error("Invalid email or password");
  }

  const user = users.get(userId);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const payload: AuthPayload = { userId: user.id, email: user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
}

/**
 * Verify a JWT token and return the payload, or null if invalid.
 */
export function verifyToken(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (!payload.userId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get a user by ID (without password hash).
 */
export function getUserById(
  userId: string
): Omit<User, "passwordHash"> | null {
  const user = users.get(userId);
  if (!user) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Extract and verify auth from a request's Authorization header.
 */
export function getAuthFromRequest(request: Request): AuthPayload | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return verifyToken(match[1]);
}
