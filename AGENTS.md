# AGENTS.md

This file defines the conventions, patterns, and rules for this project. Follow these guidelines precisely when reading, writing, or modifying any code.

---

## Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Package:** `github-file-storage` — uses the GitHub Contents API to upload, read, update, and delete files stored in a GitHub repository
- **Testing:** Bun's built-in test runner (`bun:test`)

---

## Project Structure

```
src/
  core/
    client.ts          ← GitHub API HTTP client (auth, base URL, headers)
    encoder.ts         ← Base64 encode / decode helpers
    errors.ts          ← Typed error classes
  operations/
    upload.ts          ← Upload a file to the repository
    download.ts        ← Download / read a file from the repository
    update.ts          ← Update an existing file (requires SHA)
    delete.ts          ← Delete a file from the repository
    list.ts            ← List files in a directory path
  interfaces/
    config.ts          ← GitHubStorageConfig and related interfaces
    file.ts            ← FileRecord, UploadPayload, DeletePayload, etc.
    response.ts        ← Raw GitHub API response shapes
  index.ts             ← Public API barrel export

tests/
  core/
    client.test.ts
    encoder.test.ts
    errors.test.ts
  operations/
    upload.test.ts
    download.test.ts
    update.test.ts
    delete.test.ts
    list.test.ts

bunfig.toml            ← Bun config
tsconfig.json
package.json
.env.example
```

---

## TypeScript Conventions

### Strict Mode — Always On

`tsconfig.json` must have `"strict": true`. Never disable strictness to work around a type error — fix the type instead.

### Interfaces Over Types

Always use `interface` for object shapes. Use `type` only for unions, intersections, or utility aliases.

```ts
// Preferred
interface UploadPayload {
  path: string;
  content: string | Buffer;
  message: string;
  branch?: string;
}

// Avoid for object shapes
type UploadPayload = {
  path: string;
  content: string | Buffer;
  message: string;
};
```

### No `any` — Ever

Never use `any`. Use `unknown` for genuinely uncertain values, then narrow explicitly. Use `never` where a code path should be unreachable.

```ts
// Avoid
function parseResponse(data: any) {}

// Preferred
function parseResponse(data: unknown): GitHubFileResponse {
  if (!isGitHubFileResponse(data)) {
    throw new InvalidResponseError("Unexpected response shape");
  }
  return data;
}
```

### Explicit Return Types

All exported functions must have explicit return types. Internal helpers may omit them only when the return type is trivially obvious from the implementation.

```ts
// Required on all public functions
export async function uploadFile(
  config: GitHubStorageConfig,
  payload: UploadPayload
): Promise<FileRecord> { ... }
```

---

## Interfaces

All interfaces live in `src/interfaces/`. One file per domain — never define interfaces inline in operation files.

```ts
// src/interfaces/config.ts

export interface GitHubStorageConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  committer: CommitterInfo;
}

export interface CommitterInfo {
  name: string;
  email: string;
}
```

```ts
// src/interfaces/file.ts

export interface UploadPayload {
  path: string;
  content: string | Buffer;
  message: string;
  branch?: string;
}

export interface UpdatePayload extends UploadPayload {
  sha: string; // required by GitHub API to update an existing file
}

export interface DeletePayload {
  path: string;
  sha: string;
  message: string;
  branch?: string;
}

export interface FileRecord {
  path: string;
  sha: string;
  size: number;
  downloadUrl: string;
  encodedContent: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir" | "symlink";
  downloadUrl: string | null;
}
```

```ts
// src/interfaces/response.ts
// Raw shapes returned by the GitHub Contents API — map these to internal interfaces

export interface GitHubFileResponse {
  type: "file";
  encoding: "base64";
  size: number;
  name: string;
  path: string;
  content: string;
  sha: string;
  url: string;
  download_url: string | null;
}

export interface GitHubDirectoryResponse {
  type: "file" | "dir" | "symlink";
  size: number;
  name: string;
  path: string;
  sha: string;
  url: string;
  download_url: string | null;
}

export interface GitHubWriteResponse {
  content: GitHubFileResponse;
  commit: {
    sha: string;
    message: string;
  };
}
```

---

## Code Splitting

Each operation — upload, download, update, delete, list — lives in its own file under `src/operations/`. No operation file imports from another operation file. They all import only from `src/core/` and `src/interfaces/`.

```ts
// src/operations/upload.ts

import { buildHeaders, buildUrl } from "@/core/client";
import { encodeBase64 } from "@/core/encoder";
import { GitHubApiError } from "@/core/errors";
import type { GitHubStorageConfig } from "@/interfaces/config";
import type { UploadPayload, FileRecord } from "@/interfaces/file";
import type { GitHubWriteResponse } from "@/interfaces/response";

export async function uploadFile(
  config: GitHubStorageConfig,
  payload: UploadPayload,
): Promise<FileRecord> {
  const url = buildUrl(config, payload.path);
  const branch = payload.branch ?? config.branch;

  const body = {
    message: payload.message,
    content: encodeBase64(payload.content),
    branch,
    committer: config.committer,
  };

  const response = await fetch(url, {
    method: "PUT",
    headers: buildHeaders(config.token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new GitHubApiError(
      `Upload failed: ${response.status}`,
      response.status,
    );
  }

  const data: GitHubWriteResponse = await response.json();

  return {
    path: data.content.path,
    sha: data.content.sha,
    size: data.content.size,
    downloadUrl: data.content.download_url ?? "",
    encodedContent: data.content.content,
  };
}
```

```ts
// src/operations/download.ts

import { buildHeaders, buildUrl } from "@/core/client";
import { decodeBase64 } from "@/core/encoder";
import { GitHubApiError, FileNotFoundError } from "@/core/errors";
import type { GitHubStorageConfig } from "@/interfaces/config";
import type { FileRecord } from "@/interfaces/file";
import type { GitHubFileResponse } from "@/interfaces/response";

export async function downloadFile(
  config: GitHubStorageConfig,
  path: string,
): Promise<FileRecord & { decoded: string }> {
  const url = buildUrl(config, path);

  const response = await fetch(url, {
    headers: buildHeaders(config.token),
  });

  if (response.status === 404) {
    throw new FileNotFoundError(path);
  }

  if (!response.ok) {
    throw new GitHubApiError(
      `Download failed: ${response.status}`,
      response.status,
    );
  }

  const data: GitHubFileResponse = await response.json();

  return {
    path: data.path,
    sha: data.sha,
    size: data.size,
    downloadUrl: data.download_url ?? "",
    encodedContent: data.content,
    decoded: decodeBase64(data.content),
  };
}
```

---

## Core Layer

### Client (`src/core/client.ts`)

Builds the base URL and headers for every GitHub API request. All operation files use these helpers — never construct URLs or headers manually in an operation.

```ts
// src/core/client.ts

import type { GitHubStorageConfig } from "@/interfaces/config";

const GITHUB_API_BASE = "https://api.github.com";

export function buildUrl(config: GitHubStorageConfig, path: string): string {
  return `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`;
}

export function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}
```

### Encoder (`src/core/encoder.ts`)

All Base64 operations go through this module — never use `Buffer` or `btoa` inline in operation files.

```ts
// src/core/encoder.ts

export function encodeBase64(input: string | Buffer): string {
  if (typeof input === "string") {
    return Buffer.from(input, "utf-8").toString("base64");
  }
  return input.toString("base64");
}

export function decodeBase64(encoded: string): string {
  const cleaned = encoded.replace(/\n/g, "");
  return Buffer.from(cleaned, "base64").toString("utf-8");
}
```

### Errors (`src/core/errors.ts`)

All error types are defined here. Never throw raw `Error` objects from operation files — always use a typed error class.

```ts
// src/core/errors.ts

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class FileNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResponseError";
  }
}

export class MissingShaError extends Error {
  constructor(public readonly path: string) {
    super(`SHA is required to update or delete: ${path}`);
    this.name = "MissingShaError";
  }
}
```

---

## Public API Barrel

The `src/index.ts` barrel is the only file consumers import. It re-exports everything cleanly — internal modules are never imported directly by users of the package.

```ts
// src/index.ts

export { uploadFile } from "@/operations/upload";
export { downloadFile } from "@/operations/download";
export { updateFile } from "@/operations/update";
export { deleteFile } from "@/operations/delete";
export { listFiles } from "@/operations/list";

export type { GitHubStorageConfig, CommitterInfo } from "@/interfaces/config";
export type {
  UploadPayload,
  UpdatePayload,
  DeletePayload,
  FileRecord,
  DirectoryEntry,
} from "@/interfaces/file";

export {
  GitHubApiError,
  FileNotFoundError,
  InvalidResponseError,
  MissingShaError,
} from "@/core/errors";
```

---

## Testing Conventions

### File Naming

Every source file has a corresponding test file. The test file lives in `tests/` mirroring the `src/` structure, with the `.test.ts` suffix.

```
src/operations/upload.ts      →   tests/operations/upload.test.ts
src/core/encoder.ts           →   tests/core/encoder.test.ts
src/core/errors.ts            →   tests/core/errors.test.ts
```

### Test Runner

Use Bun's built-in test runner exclusively. Never install Jest, Vitest, or any other test framework.

```ts
import { describe, it, expect, beforeEach, mock } from "bun:test";
```

### Test Structure

Each test file follows the same structure: imports, mocks, a `describe` block named after the module, grouped by function.

```ts
// tests/operations/upload.test.ts

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { uploadFile } from "@/operations/upload";
import { GitHubApiError } from "@/core/errors";
import type { GitHubStorageConfig } from "@/interfaces/config";
import type { UploadPayload } from "@/interfaces/file";

const mockConfig: GitHubStorageConfig = {
  owner: "test-owner",
  repo: "test-repo",
  branch: "main",
  token: "ghp_testtoken",
  committer: { name: "Test Bot", email: "bot@test.com" },
};

const mockPayload: UploadPayload = {
  path: "images/photo.png",
  content: "hello world",
  message: "add photo.png",
};

const mockWriteResponse = {
  content: {
    path: "images/photo.png",
    sha: "abc123",
    size: 11,
    download_url:
      "https://raw.githubusercontent.com/test-owner/test-repo/main/images/photo.png",
    content: "aGVsbG8gd29ybGQ=",
  },
  commit: {
    sha: "commitsha456",
    message: "add photo.png",
  },
};

describe("uploadFile", () => {
  beforeEach(() => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockWriteResponse), { status: 201 }),
      ),
    );
  });

  it("returns a FileRecord on success", async () => {
    const result = await uploadFile(mockConfig, mockPayload);

    expect(result.path).toBe("images/photo.png");
    expect(result.sha).toBe("abc123");
    expect(result.size).toBe(11);
  });

  it("throws GitHubApiError when the API returns a non-ok status", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("Unprocessable Entity", { status: 422 })),
    );

    expect(uploadFile(mockConfig, mockPayload)).rejects.toBeInstanceOf(
      GitHubApiError,
    );
  });

  it("sends the correct Authorization header", async () => {
    const calls: Request[] = [];
    global.fetch = mock((req: Request) => {
      calls.push(req);
      return Promise.resolve(
        new Response(JSON.stringify(mockWriteResponse), { status: 201 }),
      );
    });

    await uploadFile(mockConfig, mockPayload);

    expect(calls[0].headers.get("Authorization")).toBe("Bearer ghp_testtoken");
  });
});
```

### Test Coverage Rules

Every exported function must have tests covering at minimum these three scenarios:

1. **Happy path** — correct inputs produce the expected output
2. **API error** — a non-2xx response throws the correct typed error
3. **Input edge case** — an empty string, missing field, or boundary value

### Running Tests

```bash
bun test                        # run all tests
bun test tests/operations/      # run a specific folder
bun test --watch                # watch mode during development
bun test --coverage             # generate coverage report
```

---

## Bun Conventions

### Script Aliases (`package.json`)

```json
{
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target bun",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "typecheck": "tsc --noEmit",
    "lint": "bunx @biomejs/biome check src"
  }
}
```

### Environment Variables

Load env variables from `.env` using Bun's built-in support — never use `dotenv`.

```ts
// Bun automatically loads .env
const config: GitHubStorageConfig = {
  owner: Bun.env.GITHUB_OWNER ?? "",
  repo: Bun.env.GITHUB_REPO ?? "",
  branch: Bun.env.GITHUB_BRANCH ?? "main",
  token: Bun.env.GITHUB_TOKEN ?? "",
  committer: {
    name: Bun.env.COMMITTER_NAME ?? "Storage Bot",
    email: Bun.env.COMMITTER_EMAIL ?? "bot@storage.dev",
  },
};
```

### `.env.example`

```env
GITHUB_OWNER=your-username
GITHUB_REPO=your-storage-repo
GITHUB_BRANCH=main
GITHUB_TOKEN=ghp_yourpersonalaccesstoken
COMMITTER_NAME=Storage Bot
COMMITTER_EMAIL=bot@yourdomain.com
```

---

## What to Avoid

- Never use `any` — use `unknown` and narrow, or define a proper interface.
- Never define interfaces inline inside operation or test files — all interfaces live in `src/interfaces/`.
- Never construct GitHub API URLs or headers manually outside of `src/core/client.ts`.
- Never use `btoa` / `atob` directly — always go through `src/core/encoder.ts`.
- Never throw raw `new Error()` from operation files — use a typed error class from `src/core/errors.ts`.
- Never let one operation file import from another operation file — they are independent modules.
- Never install an external test framework — Bun's built-in `bun:test` is the only test runner.
- Never use `dotenv` — Bun loads `.env` natively.
- Never use `export default` outside of `src/index.ts` — use named exports everywhere.
- Never skip a `.test.ts` file for a new source file — every module must be tested.
