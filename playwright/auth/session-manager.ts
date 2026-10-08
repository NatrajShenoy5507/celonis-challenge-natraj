import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

interface SessionMetadata {
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function isStorageState(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !Array.isArray(value.cookies) ||
    !Array.isArray(value.origins)
  ) {
    return false;
  }

  const validCookies = value.cookies.every(
    (cookie) =>
      isRecord(cookie) &&
      typeof cookie.name === "string" &&
      typeof cookie.value === "string" &&
      typeof cookie.domain === "string" &&
      typeof cookie.path === "string" &&
      typeof cookie.expires === "number" &&
      typeof cookie.httpOnly === "boolean" &&
      typeof cookie.secure === "boolean" &&
      typeof cookie.sameSite === "string",
  );
  const validOrigins = value.origins.every(
    (origin) =>
      isRecord(origin) &&
      typeof origin.origin === "string" &&
      Array.isArray(origin.localStorage) &&
      origin.localStorage.every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.name === "string" &&
          typeof entry.value === "string",
      ),
  );

  return validCookies && validOrigins;
}

export class SessionManager {
  readonly storageStatePath: string;

  private readonly metadataPath: string;

  constructor(authDirectory: string) {
    this.storageStatePath = path.join(authDirectory, "user.json");
    this.metadataPath = path.join(authDirectory, "session-meta.json");
  }

  ensureAuthDirectory(): void {
    mkdirSync(path.dirname(this.storageStatePath), { recursive: true });
  }

  hasFreshState(ttlHours: number): boolean {
    if (
      !existsSync(this.storageStatePath) ||
      !existsSync(this.metadataPath)
    ) {
      return false;
    }

    const metadata = parseJsonFile(this.metadataPath);
    const storageState = parseJsonFile(this.storageStatePath);
    if (
      !isRecord(metadata) ||
      typeof metadata.createdAt !== "string" ||
      !isStorageState(storageState)
    ) {
      return false;
    }

    const createdAt = Date.parse(metadata.createdAt);
    if (!Number.isFinite(createdAt)) {
      return false;
    }

    const ageMilliseconds = Date.now() - createdAt;
    return (
      ageMilliseconds >= 0 &&
      ageMilliseconds < ttlHours * 60 * 60 * 1000
    );
  }

  saveMetadata(): void {
    this.ensureAuthDirectory();
    const metadata: SessionMetadata = {
      createdAt: new Date().toISOString(),
    };
    writeFileSync(this.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  }
}
