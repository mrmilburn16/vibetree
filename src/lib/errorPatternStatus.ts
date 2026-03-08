/**
 * Error pattern status (Open / Fixed / Wontfix / Regression) stored in Firestore.
 * Used on admin/builds to track which common errors are being worked on.
 */

import crypto from "crypto";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { normalizeCompilerErrorForGrouping } from "@/lib/buildResultsLog";
import type { BuildResult } from "@/lib/buildResultsLog";

const COLLECTION = "error_pattern_status";

export type ErrorPatternStatusValue = "Open" | "Fixed" | "Wontfix" | "Regression";

export type ErrorPatternStatusDoc = {
  error: string;
  status: ErrorPatternStatusValue;
  fixedAt: string | null;
  updatedAt: string;
};

function getDb() {
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}

function docIdForError(normalizedError: string): string {
  return crypto.createHash("sha256").update(normalizedError).digest("hex").slice(0, 32);
}

/** Get status for a single normalized error, or all statuses. */
export async function getErrorPatternStatuses(normalizedErrors?: string[]): Promise<Record<string, ErrorPatternStatusDoc>> {
  const db = getDb();
  if (!db) return {};
  try {
    if (normalizedErrors && normalizedErrors.length > 0) {
      const uniqErrors = [...new Set(normalizedErrors)];
      const out: Record<string, ErrorPatternStatusDoc> = {};
      for (const normalizedError of uniqErrors) {
        const id = docIdForError(normalizedError);
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (doc.exists && doc.data()) {
          const d = doc.data()!;
          const error = (d.error as string) ?? normalizedError;
          out[normalizedError] = {
            error,
            status: (d.status as ErrorPatternStatusValue) || "Open",
            fixedAt: typeof d.fixedAt === "string" ? d.fixedAt : null,
            updatedAt: (d.updatedAt as string) ?? new Date().toISOString(),
          };
        }
      }
      return out;
    }
    const snap = await db.collection(COLLECTION).get();
    const out: Record<string, ErrorPatternStatusDoc> = {};
    for (const doc of snap.docs) {
      const d = doc.data();
      const error = (d.error as string) ?? "";
      out[error] = {
        error,
        status: (d.status as ErrorPatternStatusValue) || "Open",
        fixedAt: typeof d.fixedAt === "string" ? d.fixedAt : null,
        updatedAt: (d.updatedAt as string) ?? new Date().toISOString(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Set status for a normalized error. When setting to Fixed, fixedAt is set to now. */
export async function setErrorPatternStatus(
  normalizedError: string,
  status: ErrorPatternStatusValue
): Promise<ErrorPatternStatusDoc | null> {
  const db = getDb();
  if (!db) return null;
  const id = docIdForError(normalizedError);
  const now = new Date().toISOString();
  const fixedAt = status === "Fixed" ? now : null;
  const payload = {
    error: normalizedError,
    status,
    fixedAt,
    updatedAt: now,
  };
  try {
    await db.collection(COLLECTION).doc(id).set(payload, { merge: true });
    return { ...payload, fixedAt };
  } catch {
    return null;
  }
}

/** For each Fixed error that appears in a build after its fixedAt, mark as Regression. */
export async function reconcileRegressions(builds: BuildResult[]): Promise<Record<string, ErrorPatternStatusDoc>> {
  const db = getDb();
  if (!db) return {};
  const statuses = await getErrorPatternStatuses();
  const fixedEntries = Object.entries(statuses).filter(([, s]) => s.status === "Fixed" && s.fixedAt);
  const now = new Date().toISOString();

  for (const [error, doc] of fixedEntries) {
    const fixedAtTime = doc.fixedAt ? new Date(doc.fixedAt).getTime() : 0;
    const hasRegression = builds.some((b) => {
      if (new Date(b.timestamp).getTime() <= fixedAtTime) return false;
      const allErrors = [
        ...b.compilerErrors,
        ...(b.errorHistory ?? []).flatMap((e) => e.errors ?? []),
      ];
      return allErrors.some((e) => normalizeCompilerErrorForGrouping(e) === error);
    });
    if (hasRegression) {
      try {
        const id = docIdForError(error);
        await db.collection(COLLECTION).doc(id).set(
          {
            error,
            status: "Regression" as const,
            fixedAt: null,
            updatedAt: now,
          },
          { merge: true }
        );
        statuses[error] = {
          error,
          status: "Regression",
          fixedAt: null,
          updatedAt: now,
        };
      } catch {
        // ignore
      }
    }
  }
  return statuses;
}
