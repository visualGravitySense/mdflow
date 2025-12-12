/**
 * OpenCode CLI adapter
 *
 * Print mode: Use 'run' subcommand for non-interactive execution
 * Interactive mode: Remove subcommand (TUI is the default)
 */

import type { ToolAdapter, CommandDefaults, AgentFrontmatter } from "../types";

export const opencodeAdapter: ToolAdapter = {
  name: "opencode",

  getDefaults(): CommandDefaults {
    return {
      _subcommand: "run", // Use 'run' subcommand for non-interactive mode
    };
  },

  applyInteractiveMode(frontmatter: AgentFrontmatter): AgentFrontmatter {
    const result = { ...frontmatter };
    // Remove _subcommand (TUI is default without run subcommand)
    delete result._subcommand;
    return result;
  },
};

export default opencodeAdapter;
