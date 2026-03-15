import { describe, it, expect, beforeEach, vi } from "bun:test";
import { GitHubStorage } from "./storage";

const options = {
  token: "test-token",
  owner: "test-owner",
  repo: "test-repo",
  path: "test-path",
};

describe("GitHubStorage", () => {
  let storage: GitHubStorage;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new GitHubStorage(options);
    fetchMock = vi.fn();
    // @ts-ignore
    globalThis.fetch = fetchMock;
  });

  it("list() should return files", async () => {
    const files = [{ name: "file.txt", download_url: "url", sha: "sha" }];
    fetchMock.mockResolvedValue({ ok: true, json: () => files });
    const result = await storage.list();
    expect(result).toBe(files);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("list() with custom path", async () => {
    const files = [{ name: "file2.txt", download_url: "url2", sha: "sha2" }];
    fetchMock.mockResolvedValue({ ok: true, json: () => files });
    const result = await storage.list({ path: "other-path" });
    expect(result).toBe(files);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("list() should throw on error", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(storage.list()).rejects.toThrow("Failed to fetch files");
  });

  it("fetchFile() should fetch a file", async () => {
    const file = { name: "file.txt", download_url: "url", sha: "sha" };
    fetchMock.mockResolvedValue({ ok: true, json: () => file });
    const result = await storage.fetchFile({ fileName: "file.txt" });
    expect(result).toBe(file);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("fetchFile() should throw on error", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(storage.fetchFile({ fileName: "file.txt" })).rejects.toThrow(
      "Failed to fetch file",
    );
  });

  it("upload() should upload file", async () => {
    const response = { content: { name: "file.txt" } };
    fetchMock.mockResolvedValue({ ok: true, json: () => response });
    const result = await storage.upload({
      base64: "base64data",
      fileName: "file.txt",
    });
    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("upload() should use custom message", async () => {
    const response = { content: { name: "file.txt" } };
    fetchMock.mockResolvedValue({ ok: true, json: () => response });
    await storage.upload({
      base64: "base64data",
      fileName: "file.txt",
      message: "Custom commit",
    });
    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1].body).message).toBe("Custom commit");
  });

  it("upload() should throw on error", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(
      storage.upload({ base64: "base64", fileName: "file.txt" }),
    ).rejects.toThrow("Upload failed");
  });

  it("delete() should delete file", async () => {
    const response = { commit: { message: "deleted" } };
    fetchMock.mockResolvedValue({ ok: true, json: () => response });
    const result = await storage.delete({ fileName: "file.txt", sha: "sha" });
    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("delete() should use custom message", async () => {
    const response = { commit: { message: "deleted" } };
    fetchMock.mockResolvedValue({ ok: true, json: () => response });
    await storage.delete({
      fileName: "file.txt",
      sha: "sha",
      message: "Custom delete",
    });
    const call = fetchMock.mock.calls[0];
    expect(JSON.parse(call[1].body).message).toBe("Custom delete");
  });

  it("delete() should throw on error", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(
      storage.delete({ fileName: "file.txt", sha: "sha" }),
    ).rejects.toThrow("Delete failed");
  });

  it("upload() should throw on invalid file name", async () => {
    await expect(
      storage.upload({ base64: "b", fileName: "bad name.txt" }),
    ).rejects.toThrow();
    await expect(
      storage.upload({ base64: "b", fileName: "bad@file.txt" }),
    ).rejects.toThrow();
    await expect(
      storage.upload({ base64: "b", fileName: "good_file-1.txt" }),
    ).resolves.toBeDefined();
  });

  it("delete() should throw on invalid file name", async () => {
    await expect(
      storage.delete({ fileName: "bad name.txt", sha: "sha" }),
    ).rejects.toThrow();
    await expect(
      storage.delete({ fileName: "bad@file.txt", sha: "sha" }),
    ).rejects.toThrow();
    await expect(
      storage.delete({ fileName: "good_file-1.txt", sha: "sha" }),
    ).resolves.toBeDefined();
  });

  it("fetchFile() should throw on invalid file name", async () => {
    await expect(
      storage.fetchFile({ fileName: "bad name.txt" }),
    ).rejects.toThrow();
    await expect(
      storage.fetchFile({ fileName: "bad@file.txt" }),
    ).rejects.toThrow();
    await expect(
      storage.fetchFile({ fileName: "good_file-1.txt" }),
    ).resolves.toBeDefined();
  });
});
