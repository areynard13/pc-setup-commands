import type { Item, Section, Shell, Fields } from "./types";

const RC: Record<string, string> = { bash: "~/.bashrc", zsh: "~/.zshrc" };

const ACP = String.raw`acp = "!f() { git add . && git status && printf '\\n\\nCommit and push ? (Y/n) : ' && read ans && if [ \"$ans\" = Y ] || [ \"$ans\" = y ] || [ -z \"$ans\" ]; then git commit -m \"$*\" && git push; else echo Aborted.; fi; }; f"`;

// ---- helpers ----
const gitAlias = (id: string, val: string): Item => ({
  id, label: id, desc: val,
  cmd: () => [`git config --global alias.${id} "${val}"`],
});

const shellAlias = (id: string, git: string, extra: Partial<Item> = {}): Item => ({
  id, label: id, desc: `git ${git}`, git, ...extra,
});

const standardBuild = (items: Item[], shell: Shell, f: Fields) =>
  items.flatMap((i) => i.cmd!(shell, f));

// ---- data ----
export const SECTIONS: Section[] = [
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
    id: "shellalias",
    title: "Terminal aliases",
    items: [
      shellAlias("gaa", "add *"),
      shellAlias("gacp", "acp", { needs: "gitalias:acp" }),
      shellAlias("gb", "branch"),
      shellAlias("gl", "log", { psConflict: true }),
      shellAlias("gp", "push", { psConflict: true }),
      shellAlias("gpl", "pull"),
    ],
    build: (items, shell) => {
      if (shell === "ps") {
        const body = items.flatMap((i) => [
          ...(i.psConflict ? [`Remove-Item Alias:${i.id} -Force -ErrorAction SilentlyContinue`] : []),
          `function ${i.id} { git ${i.git} @args }`,
        ]);
        return [
          "if (!(Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }",
          "Add-Content -Path $PROFILE -Value @'", "", ...body, "'@", ". $PROFILE",
        ];
      }
      const rc = RC[shell];
      return [
        `cat >> ${rc} <<'EOF'`, "",
        ...items.map((i) => `alias ${i.id}='git ${i.git}'`),
        "EOF", `source ${rc}`,
      ];
    },
  },
];
