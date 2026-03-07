# GitHub File Storage

A simple library to store files in a GitHub repository. It uses the GitHub API to create commits with the uploaded files.
## Installation

```bash
npm install github-file-storage

# or
yarn add github-file-storage

```
# Usage
```
import { GitHubStorage } from "github-file-storage";

const storage = new GitHubStorage({
  token: process.env.GITHUB_TOKEN,
  owner: "myuser",
  repo: "image-storage",
  path: "images"
});

await storage.upload(file);
const images = await storage.list();
await storage.delete("hero.png");
```