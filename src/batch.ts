/**
 * Batch Orchestrator - Swarm execution of multiple agents
 * Dispatches jobs across parallel, isolated git worktrees
 */

import { WorktreeManager } from "./worktree";
import { resolve } from "path";

/**
 * The Batch Manifest Schema
 * JSON input must match this structure
 */
export interface BatchJob {
  /** Path to the agent file (e.g. "agents/CODER.md") */
  agent: string;

  /**
   * Git Branch for isolation
   * If string: use that branch
   * If true: auto-generate branch name
   * If undefined/false: run in current directory (shared context)
   */
  branch?: string | boolean;

  /** Template variables for the agent */
  vars?: Record<string, string>;

  /** Override model */
  model?: string;

  /** Override runner */
  runner?: string;
}

export interface BatchOptions {
  concurrency?: number;
  verbose?: boolean;
}

export interface BatchResult {
  index: number;
  job: BatchJob;
  output: string;
  exitCode: number;
  branchName?: string;
  error?: string;
  duration?: number;
}

export async function runBatch(
  jobs: BatchJob[],
  options: BatchOptions
): Promise<BatchResult[]> {
  const concurrency = options.concurrency || 4;
  const wtManager = new WorktreeManager();
  await wtManager.init();

  const results: BatchResult[] = [];
  const queue = jobs.map((job, index) => ({ job, index }));
  const active: Promise<void>[] = [];

  // Identify self to spawn recursive processes
  const execPath = process.argv[0]; // bun
  const scriptPath = process.argv[1]; // src/index.ts or binary
  const originalCwd = process.cwd();

  async function worker(item: { job: BatchJob; index: number }) {
    const { job, index } = item;
    const startTime = Date.now();

    // Determine isolation strategy
    let branchName: string | undefined;
    if (job.branch === true) {
      branchName = `agent/batch-${Date.now()}-${index}`;
    } else if (typeof job.branch === "string") {
      branchName = job.branch;
    }

    let worktreePath = originalCwd;
    let isIsolated = false;

    try {
      // 1. Setup Environment
      if (branchName) {
        if (options.verbose) {
          console.error(`[Job ${index}] Creating worktree: ${branchName}`);
        }
        worktreePath = await wtManager.create(branchName);
        isIsolated = true;
      }

      // 2. Resolve Agent Path
      // CRITICAL: Resolve against ORIGINAL CWD
      // This allows editing agent files locally without committing first
      const agentPath = resolve(originalCwd, job.agent);

      // 3. Build Command
      const args = [scriptPath, agentPath];

      // Inject Vars
      if (job.vars) {
        for (const [key, value] of Object.entries(job.vars)) {
          args.push(`--${key}`, String(value));
        }
      }

      // Overrides
      if (job.model) args.push("--model", job.model);
      if (job.runner) args.push("--runner", job.runner);

      // 4. Execute
      if (options.verbose) {
        console.error(
          `[Job ${index}] Spawning in ${isIsolated ? branchName : "cwd"}`
        );
      }

      const proc = Bun.spawn([execPath, ...args], {
        cwd: worktreePath, // Execution happens inside the isolated folder
        env: { ...process.env, FORCE_COLOR: "1" },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0 && options.verbose) {
        console.error(`[Job ${index}] Stderr: ${stderr}`);
      }

      // 5. Auto-Commit (only if isolated and successful)
      if (isIsolated && exitCode === 0) {
        await wtManager.autoCommit(
          worktreePath,
          `feat: Auto-commit from ${job.agent}`
        );
      }

      const duration = Date.now() - startTime;

      results.push({
        index,
        job,
        output: (stdout + stderr).trim(),
        exitCode,
        branchName,
        duration,
      });
    } catch (err) {
      console.error(`[Job ${index}] Failed:`, err);
      results.push({
        index,
        job,
        output: "",
        exitCode: 1,
        error: (err as Error).message,
        duration: Date.now() - startTime,
      });
    } finally {
      // 6. Cleanup Worktree (keep the branch!)
      if (isIsolated && worktreePath !== originalCwd) {
        await wtManager.cleanup(worktreePath);
      }
    }
  }

  // Concurrency Loop
  while (queue.length > 0 || active.length > 0) {
    while (queue.length > 0 && active.length < concurrency) {
      const item = queue.shift()!;
      const promise = worker(item).then(() => {
        active.splice(active.indexOf(promise), 1);
      });
      active.push(promise);
    }
    if (active.length > 0) await Promise.race(active);
  }

  return results.sort((a, b) => a.index - b.index);
}

/**
 * Format batch results as XML summary
 */
export function formatBatchResults(results: BatchResult[]): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const jobXml = results
    .map((r) => {
      const status = r.exitCode === 0 ? "success" : "failed";
      const branch = r.branchName ? ` branch="${escapeXml(r.branchName)}"` : "";
      const err = r.error ? ` error="${escapeXml(r.error)}"` : "";
      const duration = r.duration ? ` duration_ms="${r.duration}"` : "";
      return `  <job index="${r.index}" agent="${escapeXml(r.job.agent)}" status="${status}"${branch}${duration}${err}>
${escapeXml(r.output)}
  </job>`;
    })
    .join("\n");

  const succeeded = results.filter((r) => r.exitCode === 0).length;
  const failed = results.filter((r) => r.exitCode !== 0).length;

  return `<batch_summary total="${results.length}" succeeded="${succeeded}" failed="${failed}">
${jobXml}
</batch_summary>`;
}

/**
 * Parse and validate batch manifest from string
 */
export function parseBatchManifest(input: string): BatchJob[] {
  // Try to extract JSON from markdown code blocks
  let jsonStr = input.trim();

  // Handle ```json ... ``` blocks
  const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  // Normalize single object to array
  if (!Array.isArray(parsed)) {
    if (typeof parsed === "object" && parsed !== null) {
      return [parsed as BatchJob];
    }
    throw new Error("Manifest must be a JSON array or object");
  }

  // Validate each job has required 'agent' field
  for (let i = 0; i < parsed.length; i++) {
    const job = parsed[i];
    if (!job.agent || typeof job.agent !== "string") {
      throw new Error(`Job ${i}: missing required 'agent' field`);
    }
  }

  return parsed as BatchJob[];
}
