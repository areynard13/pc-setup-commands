export type Shell = "bash" | "zsh" | "ps";
export type Fields = Record<string, string>;

export interface Item {
  id: string;
  label: string;
  desc?: string;
  needs?: string;          // "sectionId:itemId"
  defaultOn?: boolean;     // false = unchecked by default (default: true)
  psConflict?: boolean;    // PowerShell built-in alias to remove first
  cmd?: (shell: Shell, fields: Fields) => string[];  // standalone commands
  rc?: (shell: Shell) => string[];                   // lines appended to .bashrc / .zshrc / $PROFILE
}

export interface Section {
  id: string;
  title: string;
  fields?: { id: string; placeholder: string }[];
  items: Item[];
  build: (items: Item[], shell: Shell, fields: Fields) => string[];
}
