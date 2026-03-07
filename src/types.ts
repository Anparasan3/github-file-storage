export interface GitHubStorageOptions {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

export interface GitHubFile {
  name: string;
  download_url: string;
  sha: string;
}