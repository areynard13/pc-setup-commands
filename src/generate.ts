import { SECTIONS } from "./sections";
import type { Fields, Shell } from "./types";

export type Selection = Record<string, Set<string>>;

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
  return out.join("\n").trim() || "Nothing selected.";
}
