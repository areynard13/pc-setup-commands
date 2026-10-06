import type { Item, Section, Shell, Fields } from "./types";

const RC: Record<string, string> = {
  bash: "~/.bashrc",
  zsh: "~/.zshrc",
  fish: "~/.config/fish/config.fish",
};

const ACP = String.raw`acp = "!f() { git add . && git status && printf '\\n\\nCommit and push ? (Y/n) : ' && read ans && if [ \"$ans\" = Y ] || [ \"$ans\" = y ] || [ -z \"$ans\" ]; then git commit -m \"$*\" && git push; else echo Aborted.; fi; }; f"`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const gitAlias = (id: string, val: string): Item => ({
  id, label: id, desc: val,
  cmd: () => [`git config --global alias.${id} "${val}"`],
});

const shellAlias = (id: string, git: string, extra: Partial<Item> = {}): Item => ({
  id, label: id, desc: `git ${git}`, ...extra,
  rc: (shell) =>
    shell === "ps"
      ? [
          ...(extra.psConflict ? [`Remove-Item Alias:${id} -Force -ErrorAction SilentlyContinue`] : []),
          `function ${id} { git ${git} @args }`,
        ]
      : shell === "fish"
        ? [`alias ${id} 'git ${git}'`]
        : [`alias ${id}='git ${git}'`],
});

/** Package installed through pacman (Arch), brew (macOS), apt (Debian/Ubuntu) or winget (Windows). */
const pkg = (
  id: string, label: string, desc: string,
  p: { pacman: string; brew: string; apt: string; winget: string },
): Item => ({
  id, label, desc, defaultOn: false,
  cmd: (shell) =>
    shell === "ps"
      ? [`winget install --id ${p.winget} -e`]
      : [
          `if command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed --noconfirm ${p.pacman};`,
          `elif command -v brew >/dev/null 2>&1; then brew install ${p.brew};`,
          `else sudo apt install -y ${p.apt}; fi`,
        ],
});

/** Installer that differs between Unix shells and PowerShell. */
const installer = (
  id: string, label: string, desc: string,
  unix: string[], ps: string[],
): Item => ({
  id, label, desc, defaultOn: false,
  cmd: (shell) => (shell === "ps" ? ps : unix),
});

const standardBuild = (items: Item[], shell: Shell, f: Fields) =>
  items.flatMap((i) => i.cmd!(shell, f));

/** Appends the items' `rc` lines to the shell config file (.bashrc / .zshrc / config.fish / $PROFILE). */
const rcBuild = (items: Item[], shell: Shell) => {
  const body = items.flatMap((i) => i.rc!(shell));
  if (shell === "ps") {
    return [
      "if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }",
      "Add-Content -Path $PROFILE -Value @'", "", ...body, "'@", ". $PROFILE",
    ];
  }
  const rc = RC[shell];
  if (shell === "fish") {
    // Runs inside bash (see generate.ts); fish reloads the file at the end.
    return ["mkdir -p ~/.config/fish", `cat >> ${rc} <<'EOF'`, "", ...body, "EOF"];
  }
  return [`cat >> ${rc} <<'EOF'`, "", ...body, "EOF", `source ${rc}`];
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
export const SECTIONS: Section[] = [
  {
    id: "install",
    title: "Installations",
    build: standardBuild,
    items: [
      installer("node", "node", "Node.js LTS (fnm on Linux/macOS, installer on Windows)",
        [
          "curl -fsSL https://fnm.vercel.app/install | bash",
          "# Restart your terminal, then run: fnm install --lts",
        ],
        ["winget install --id OpenJS.NodeJS.LTS -e"]),
      installer("bun", "bun", "JavaScript runtime & package manager",
        ["curl -fsSL https://bun.sh/install | bash"],
        ['powershell -c "irm bun.sh/install.ps1 | iex"']),
      installer("pnpm", "pnpm", "Fast Node package manager",
        ["curl -fsSL https://get.pnpm.io/install.sh | sh -"],
        ["winget install --id pnpm.pnpm -e"]),
      installer("uv", "uv", "Python package & version manager",
        ["curl -LsSf https://astral.sh/uv/install.sh | sh"],
        ['powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"']),
      installer("rust", "rust", "Rust toolchain (rustup)",
        ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"],
        ["winget install --id Rustlang.Rustup -e"]),
      installer("docker", "docker", "Docker (Desktop on macOS / Windows)",
        [
          'if [ "$(uname)" = "Darwin" ]; then brew install --cask docker;',
          'elif command -v pacman >/dev/null 2>&1; then sudo pacman -S --needed --noconfirm docker docker-compose && sudo systemctl enable --now docker && sudo usermod -aG docker "$USER";',
          'else curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker "$USER"; fi',
        ],
        ["winget install --id Docker.DockerDesktop -e"]),
      pkg("git", "git", "Git itself",
        { pacman: "git", brew: "git", apt: "git", winget: "Git.Git" }),
      pkg("gh", "gh", "GitHub CLI",
        { pacman: "github-cli", brew: "gh", apt: "gh", winget: "GitHub.cli" }),
      pkg("go", "go", "Go language",
        { pacman: "go", brew: "go", apt: "golang-go", winget: "GoLang.Go" }),
      pkg("jq", "jq", "JSON processor",
        { pacman: "jq", brew: "jq", apt: "jq", winget: "jqlang.jq" }),
      pkg("rg", "ripgrep", "Very fast code search (rg)",
        { pacman: "ripgrep", brew: "ripgrep", apt: "ripgrep", winget: "BurntSushi.ripgrep.MSVC" }),
    ],
  },

  {
    id: "gitconfig",
    title: "Git configuration",
    build: standardBuild,
    fields: [
      { id: "name", placeholder: "Your name" },
      { id: "email", placeholder: "you@example.com" },
    ],
    items: [
      {
        id: "user", label: "user.name / email", desc: "Uses the fields above",
        cmd: (_s, f) => [
          `git config --global user.name "${f.name || "Your Name"}"`,
          `git config --global user.email "${f.email || "you@example.com"}"`,
        ],
      },
      { id: "branch", label: "init.defaultBranch", desc: "main",
        cmd: () => ["git config --global init.defaultBranch main"] },
      { id: "autopush", label: "push.autoSetupRemote", desc: "true",
        cmd: () => ["git config --global push.autoSetupRemote true"] },
      { id: "pull", label: "pull.rebase", desc: "false",
        cmd: () => ["git config --global pull.rebase false"] },
      { id: "prune", label: "fetch.prune", desc: "Remove deleted remote branches on fetch",
        cmd: () => ["git config --global fetch.prune true"] },
      { id: "crlf", label: "core.autocrlf", desc: "true on Windows, input elsewhere",
        cmd: (shell) => [`git config --global core.autocrlf ${shell === "ps" ? "true" : "input"}`] },
      { id: "rerere", label: "rerere.enabled", desc: "Remember conflict resolutions",
        cmd: () => ["git config --global rerere.enabled true"] },
      { id: "editor", label: "core.editor", desc: "VS Code (code --wait)", defaultOn: false,
        cmd: () => ['git config --global core.editor "code --wait"'] },
      {
        id: "excludes", label: "Global .gitignore", desc: ".DS_Store, Thumbs.db, .env, .idea/, *.log",
        cmd: (shell) => {
          const content = [".DS_Store", "Thumbs.db", ".env", ".idea/", "*.log"];
          return [
            ...(shell === "ps"
              ? ['Set-Content -Path "$HOME\\.gitignore_global" -Value @\'', ...content, "'@"]
              : ["cat > ~/.gitignore_global <<'EOF'", ...content, "EOF"]),
            'git config --global core.excludesfile "$HOME/.gitignore_global"',
          ];
        },
      },
    ],
  },

  {
    id: "gitalias",
    title: "Git aliases",
    build: standardBuild,
    items: [
      {
        id: "acp", label: "acp", desc: "add . + status + confirm + commit + push",
        cmd: (shell) =>
          shell === "ps"
            ? ['Add-Content -Path "$HOME\\.gitconfig" -Value @\'', "", "[alias]", "\t" + ACP, "'@"]
            : ["cat >> ~/.gitconfig <<'EOF'", "", "[alias]", "\t" + ACP, "EOF"],
      },
      gitAlias("st", "status"),
      gitAlias("co", "checkout"),
      gitAlias("br", "branch"),
      gitAlias("ci", "commit"),
      gitAlias("unstage", "reset HEAD --"),
      gitAlias("last", "log -1 HEAD"),
      gitAlias("lg", "log --oneline --graph --decorate --all"),
    ],
  },

  {
    id: "ssh",
    title: "SSH & GitHub",
    build: standardBuild,
    items: [
      {
        id: "sshkey", label: "SSH key (ed25519)", desc: "Generates a key using your email", defaultOn: false,
        cmd: (shell, f) => [
          `ssh-keygen -t ed25519 -C "${f.email || "you@example.com"}"`,
          shell === "ps" ? 'Get-Content "$HOME\\.ssh\\id_ed25519.pub"' : "cat ~/.ssh/id_ed25519.pub",
          "# Add the public key above at https://github.com/settings/ssh/new",
        ],
      },
      {
        id: "ghlogin", label: "gh auth login", desc: "Log in to GitHub (installs gh)", defaultOn: false,
        needs: "install:gh",
        cmd: () => ["gh auth login"],
      },
    ],
  },

  {
    id: "shellalias",
    title: "Terminal aliases",
    build: rcBuild,
    items: [
      shellAlias("gaa", "add *"),
      shellAlias("gacp", "acp", { needs: "gitalias:acp" }),
      shellAlias("gb", "branch"),
      shellAlias("gl", "log", { psConflict: true }),
      shellAlias("gp", "push", { psConflict: true }),
      shellAlias("gpl", "pull"),
    ],
  },

  {
    id: "extras",
    title: "Terminal extras",
    build: rcBuild,
    items: [
      {
        id: "ll", label: "ll", desc: "Detailed file listing",
        rc: (shell) => shell === "ps"
          ? ["function ll { Get-ChildItem -Force @args }"]
          : shell === "fish"
            ? ["alias ll 'ls -lah'"]
            : ["alias ll='ls -lah'"],
      },
      {
        id: "up", label: ".. and ...", desc: "Go up one / two folders",
        rc: (shell) => shell === "ps"
          ? ["function .. { Set-Location .. }", "function ... { Set-Location ..\\.. }"]
          : shell === "fish"
            ? ["abbr -a .. 'cd ..'", "abbr -a ... 'cd ../..'"]
            : ["alias ..='cd ..'", "alias ...='cd ../..'"],
      },
      {
        id: "mkcd", label: "mkcd", desc: "Create a folder and enter it",
        rc: (shell) => shell === "ps"
          ? ["function mkcd { param($d) New-Item -ItemType Directory -Force $d | Out-Null; Set-Location $d }"]
          : shell === "fish"
            ? ["function mkcd", "    mkdir -p $argv[1]; and cd $argv[1]", "end"]
            : ['mkcd() { mkdir -p "$1" && cd "$1"; }'],
      },
      {
        id: "history", label: "Better history", desc: "Bigger, shared history",
        rc: (shell) =>
          shell === "ps"
            ? ["Set-PSReadLineOption -PredictionSource History"]
            : shell === "fish"
              ? ["# fish already keeps a large, shared history"]
              : shell === "zsh"
                ? ["HISTSIZE=10000", "SAVEHIST=10000", "setopt SHARE_HISTORY"]
                : ["export HISTSIZE=10000", "export HISTFILESIZE=20000", "shopt -s histappend"],
      },
    ],
  },
];
