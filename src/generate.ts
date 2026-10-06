import { SECTIONS } from "./sections";
import type { Fields, Shell } from "./types";

export type Selection = Record<string, Set<string>>;

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

export function generate(shell: Shell, fields: Fields, selection: Selection): string {
  // resolve dependencies (e.g. gacp -> acp)
  for (const s of SECTIONS)
    for (const i of s.items)
      if (i.needs && selection[s.id].has(i.id)) {
        const [sid, iid] = i.needs.split(":");
        selection[sid].add(iid);
      }

  const out: string[] = [];
  for (const s of SECTIONS) {
    const items = s.items.filter((i) => selection[s.id].has(i.id));
    if (items.length) out.push(`# ${s.title}`, ...s.build(items, shell, fields), "");
  }

  const script = out.join("\n").trim();
  if (!script) return "Nothing selected.";

  // Fish has no heredocs, so the (bash-syntax) script is run through bash.
  if (shell === "fish") {
    return [
      "# Fish: the script is encoded and executed by bash (fish has no heredocs).",
      `bash -c "$(echo ${toBase64(script)} | base64 -d)"`,
      "source ~/.config/fish/config.fish",
    ].join("\n");
  }
  return script;
}
