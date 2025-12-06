/**
 * Git Worktree Manager for isolated agent execution
 * Provides ephemeral environments with shared node_modules and .env
 */

import { join, resolve } from "path";

export class WorktreeManager {
  private rootDir: string;
  private worktreesDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    this.worktreesDir = join(this.rootDir, ".markdown-agent", "worktrees");
  }

  /**
   * Ensure the worktree storage directory exists
   */
  async init() {
    const dir = Bun.file(this.worktreesDir);
    if (!(await dir.exists())) {
      await Bun.write(join(this.worktreesDir, ".gitignore"), "*\n");
    }
  }

  /**
   * Create a new isolated worktree
   * Returns the absolute path to the worktree directory
   */
  async create(branchName: string): Promise<string> {
    // Sanitize branch name for folder usage
    const folderId = branchName.replace(/[^a-zA-Z0-9-]/g, "_");
    const path = join(this.worktreesDir, folderId);

    // 1. Create Worktree
    // -B forces creation/reset of branch to HEAD
    // This allows re-running the same task branch from a clean state
    const proc = Bun.spawn(
      ["git", "worktree", "add", "-B", branchName, path, "HEAD"],
      { stdout: "ignore", stderr: "pipe" }
    );

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      // If folder exists but is not a worktree, try to clean up
      if (stderr.includes("already exists")) {
        await this.cleanup(path);
        // Retry once
        const retry = Bun.spawn(
          ["git", "worktree", "add", "-B", branchName, path, "HEAD"],
          { stdout: "ignore", stderr: "pipe" }
        );
        const retryCode = await retry.exited;
        if (retryCode !== 0) {
          const retryErr = await new Response(retry.stderr).text();
          throw new Error(`Git worktree failed after retry: ${retryErr}`);
        }
      } else {
        throw new Error(`Git worktree failed: ${stderr}`);
      }
    }

    // 2. Optimization: Symlink node_modules
    // Agents need to run scripts/tests without 'npm install' every time
    const rootNodeModules = join(this.rootDir, "node_modules");
    const nodeModulesFile = Bun.file(rootNodeModules);
    if (await nodeModulesFile.exists()) {
      try {
        const { symlink } = await import("fs/promises");
        await symlink(rootNodeModules, join(path, "node_modules"));
      } catch {
        // Ignore symlink errors (already exists)
      }
    }

    // 3. Environment: Copy .env
    // Agents usually need secrets
    const rootEnv = join(this.rootDir, ".env");
    const envFile = Bun.file(rootEnv);
    if (await envFile.exists()) {
      await Bun.write(join(path, ".env"), envFile);
    }

    return path;
  }

  /**
   * Remove the worktree folder
   * We DO NOT delete the branch - user needs to review/merge it
   */
  async cleanup(path: string) {
    // Git worktree remove is safer than rm -rf
    const proc = Bun.spawn(
      ["git", "worktree", "remove", "--force", path],
      { stdout: "ignore", stderr: "ignore" }
    );
    await proc.exited;
  }

  /**
   * Commit changes in worktree
   * Safety net: Ensure agent work isn't lost when folder is removed
   */
  async autoCommit(path: string, message: string) {
    // Execute git inside the worktree
    const add = Bun.spawn(["git", "add", "."], { cwd: path });
    await add.exited;

    const commit = Bun.spawn(
      ["git", "commit", "-m", message, "--allow-empty"],
      { cwd: path }
    );
    await commit.exited;
  }

  /**
   * List all active worktrees
   */
  async list(): Promise<string[]> {
    const proc = Bun.spawn(["git", "worktree", "list", "--porcelain"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;

    // Parse porcelain output for worktree paths
    const paths: string[] = [];
    for (const line of output.split("\n")) {
      if (line.startsWith("worktree ")) {
        const wtPath = line.slice("worktree ".length);
        // Only include our managed worktrees
        if (wtPath.includes(".markdown-agent/worktrees")) {
          paths.push(wtPath);
        }
      }
    }
    return paths;
  }

  /**
   * Clean up all managed worktrees
   */
  async cleanupAll() {
    const worktrees = await this.list();
    for (const wt of worktrees) {
      await this.cleanup(wt);
    }
  }
}
