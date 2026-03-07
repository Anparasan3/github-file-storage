import { GitHubStorageOptions, GitHubFile } from "./types";

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

  async list(): Promise<GitHubFile[]> {
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}`,
      { headers: this.headers() }
    );

    if (!res.ok) throw new Error("Failed to fetch files");

    return res.json();
  }

  async upload(base64: string, fileName: string) {
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}/${fileName}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          message: `Upload ${fileName}`,
          content: base64,
        }),
      }
    );

    if (!res.ok) throw new Error("Upload failed");

    return res.json();
  }

  async delete(fileName: string, sha: string) {
    const res = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.path}/${fileName}`,
      {
        method: "DELETE",
        headers: this.headers(),
        body: JSON.stringify({
          message: `Delete ${fileName}`,
          sha,
        }),
      }
    );

    if (!res.ok) throw new Error("Delete failed");

    return res.json();
  }
}