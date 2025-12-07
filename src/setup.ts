import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const SHELL_SNIPPET = `
# markdown-agent: Treat .md files as executable agents
alias -s md='_handle_md'
_handle_md() {
  local file="$1"
  shift
  # Pass file and any remaining args (--model, --silent, etc.) to handler
  if command -v ma &>/dev/null; then
    ma "$file" "$@"
  else
    echo "markdown-agent not installed. Install with: bun add -g markdown-agent"
    echo "Attempting to install now..."
    if command -v bun &>/dev/null; then
      bun add -g markdown-agent && ma "$file" "$@"
    elif command -v npm &>/dev/null; then
      npm install -g markdown-agent && ma "$file" "$@"
    else
      echo "Neither bun nor npm found. Please install markdown-agent manually."
      return 1
    fi
  fi
}
`.trim();

interface ShellConfig {
  name: string;
  path: string;
  exists: boolean;
}

/**
 * Find potential shell config files
 */
function findShellConfigs(): ShellConfig[] {
  const home = homedir();
  const candidates = [
    { name: ".zshrc", path: join(home, ".zshrc") },
    { name: ".config/zsh/.zshrc", path: join(home, ".config", "zsh", ".zshrc") },
    { name: ".zprofile", path: join(home, ".zprofile") },
    { name: ".bashrc", path: join(home, ".bashrc") },
    { name: ".bash_profile", path: join(home, ".bash_profile") },
    { name: ".config/fish/config.fish", path: join(home, ".config", "fish", "config.fish") },
  ];

  return candidates.map((c) => ({
    ...c,
    exists: existsSync(c.path),
  }));
}

/**
 * Check if snippet is already installed in a config file
 */
async function isAlreadyInstalled(configPath: string): Promise<boolean> {
  try {
    const content = await Bun.file(configPath).text();
    return content.includes("alias -s md=") || content.includes("_handle_md");
  } catch {
    return false;
  }
}

/**
 * Append snippet to config file
 */
async function appendToConfig(configPath: string): Promise<void> {
  const file = Bun.file(configPath);
  const existing = (await file.exists()) ? await file.text() : "";
  const newContent = existing.endsWith("\n")
    ? `${existing}\n${SHELL_SNIPPET}\n`
    : `${existing}\n\n${SHELL_SNIPPET}\n`;
  await Bun.write(configPath, newContent);
}

/**
 * Interactive setup wizard
 */
export async function runSetup(): Promise<void> {
  console.error("\n📝 markdown-agent Shell Setup\n");
  console.error("This will configure your shell to treat .md files as executable agents.");
  console.error("After setup, you can run: ./TASK.md instead of: ma TASK.md\n");

  const configs = findShellConfigs();
  const existingConfigs = configs.filter((c) => c.exists);

  if (existingConfigs.length === 0) {
    console.error("No shell config files found. Creating ~/.zshrc...\n");
    existingConfigs.push({ name: ".zshrc", path: join(homedir(), ".zshrc"), exists: false });
  }

  // Show the snippet that will be added
  console.error("The following will be added to your shell config:\n");
  console.error("─".repeat(60));
  console.error(SHELL_SNIPPET);
  console.error("─".repeat(60));
  console.error();

  // Check for existing installations
  for (const config of existingConfigs) {
    if (await isAlreadyInstalled(config.path)) {
      console.error(`✅ Already installed in ${config.name}`);
      console.error("\nTo apply changes, run: source ~/" + config.name);
      return;
    }
  }

  // Show available config files
  console.error("Available shell config files:");
  existingConfigs.forEach((c, i) => {
    console.error(`  ${i + 1}. ${c.name} ${c.exists ? "" : "(will create)"}`);
  });
  console.error(`  ${existingConfigs.length + 1}. Copy to clipboard (manual install)`);
  console.error(`  ${existingConfigs.length + 2}. Cancel`);
  console.error();

  // Prompt for selection
  process.stdout.write("Select option [1]: ");

  const input = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      data = chunk.toString().trim();
      resolve(data);
    });
    // Handle if stdin is not interactive
    if (!process.stdin.isTTY) {
      resolve("1");
    }
  });

  const choice = parseInt(input) || 1;

  if (choice === existingConfigs.length + 2) {
    console.error("Setup cancelled.");
    return;
  }

  if (choice === existingConfigs.length + 1) {
    // Copy to clipboard
    const proc = Bun.spawn(["pbcopy"], {
      stdin: "pipe",
    });
    proc.stdin.write(SHELL_SNIPPET);
    proc.stdin.end();
    await proc.exited;
    console.error("\n✅ Copied to clipboard!");
    console.error("Paste into your shell config file and run: source ~/.zshrc");
    return;
  }

  const selectedConfig = existingConfigs[choice - 1];
  if (!selectedConfig) {
    console.error("Invalid selection.");
    return;
  }

  // Append to selected config
  await appendToConfig(selectedConfig.path);
  console.error(`\n✅ Added to ${selectedConfig.name}`);
  console.error(`\nTo apply changes now, run:\n  source ${selectedConfig.path}`);
  console.error("\nThen try:\n  ./examples/auto-detect.md --dry-run");
}

/**
 * Get the shell snippet for display or manual copy
 */
export function getShellSnippet(): string {
  return SHELL_SNIPPET;
}
