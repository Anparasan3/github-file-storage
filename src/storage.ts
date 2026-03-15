import { GitHubStorageOptions, GitHubFile } from "./types";
import { z } from "zod";
const fileNameSchema = z.string().regex(/^[a-zA-Z0-9_.-]+$/, {
  message:
    "File name must not contain spaces or special characters except _ . -",
});

export class GitHubStorage {
  private token: string;
  private owner: string;
  private repo: string;
  private path: string;

  constructor(options: GitHubStorageOptions) {
    this.token = options.token;
    this.owner = options.owner;
    this.repo = options.repo;
    this.path = options.path;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
    };
  }

  async list({ path }: { path?: string } = {}): Promise<GitHubFile[]> {
    const targetPath = path ?? this.path;
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${targetPath}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error("Failed to fetch files");
    return res.json();
  }

  async fetchFile({
    fileName,
    path,
  }: {
    fileName: string;
    path?: string;
  }): Promise<GitHubFile> {
    fileNameSchema.parse(fileName);
    const targetPath = path ?? this.path;
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${targetPath}/${fileName}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error("Failed to fetch file");
    return res.json();
  }

  async upload({
    base64,
    fileName,
    message,
    path,
  }: {
    base64: string;
    fileName: string;
    message?: string;
    path?: string;
  }) {
    fileNameSchema.parse(fileName);
    const targetPath = path ?? this.path;
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${targetPath}/${fileName}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          message: message ?? `Upload ${fileName}`,
          content: base64,
        }),
      },
    );
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  }

  async delete({
    fileName,
    sha,
    message,
    path,
  }: {
    fileName: string;
    sha: string;
    message?: string;
    path?: string;
  }) {
    fileNameSchema.parse(fileName);
    const targetPath = path ?? this.path;
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${targetPath}/${fileName}`,
      {
        method: "DELETE",
        headers: this.headers(),
        body: JSON.stringify({
          message: message ?? `Delete ${fileName}`,
          sha,
        }),
      },
    );
    if (!res.ok) throw new Error("Delete failed");
    return res.json();
  }
}
