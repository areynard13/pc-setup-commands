import "./style.css";
import { SECTIONS } from "./sections";
import { generate, type Selection } from "./generate";
import type { Shell } from "./types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- render ----
$("groups").innerHTML = SECTIONS.map((s) => `
  <section class="card">
    <div class="head">
      <strong>${s.title}</strong>
      <span><a href="#" data-all="${s.id}:1">all</a> · <a href="#" data-all="${s.id}:0">none</a></span>
    </div>
    ${s.fields ? `<div class="fields">${s.fields
      .map((f) => `<input type="text" id="f-${f.id}" placeholder="${f.placeholder}">`).join("")}</div>` : ""}
    <div class="items">${s.items.map((i) => `
      <label class="item">
        <input type="checkbox" id="c-${s.id}-${i.id}" ${i.defaultOn === false ? "" : "checked"}>
        <span><code>${i.label}</code><small>${i.desc ?? ""}</small></span>
      </label>`).join("")}</div>
  </section>`).join("");

// ---- logic ----
const HINTS: Partial<Record<Shell, string>> = {
  ps: "If PowerShell refuses to load your profile, run: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned",
  fish: "Paste these lines directly in fish. Make sure bash is installed (it is on Arch).",
};

function update() {
  const shell = $<HTMLSelectElement>("shell").value as Shell;
  const fields: Record<string, string> = {};
  for (const s of SECTIONS)
    for (const f of s.fields ?? [])
      fields[f.id] = $<HTMLInputElement>(`f-${f.id}`).value.replace(/["`$\\]/g, "").trim();

  const selection: Selection = {};
  for (const s of SECTIONS)
    selection[s.id] = new Set(
      s.items.filter((i) => $<HTMLInputElement>(`c-${s.id}-${i.id}`).checked).map((i) => i.id)
    );

  $("out").textContent = generate(shell, fields, selection);

  const hint = HINTS[shell];
  $("hint").textContent = hint ?? "";
  $("hint").hidden = !hint;
}

// ---- events ----
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>("[data-all]");
  if (!a) return;
  e.preventDefault();
  const [sid, v] = a.dataset.all!.split(":");
  SECTIONS.find((s) => s.id === sid)!.items.forEach(
    (i) => ($<HTMLInputElement>(`c-${sid}-${i.id}`).checked = v === "1")
  );
  update();
});
document.addEventListener("input", update);
document.addEventListener("change", update);

$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("out").textContent ?? "");
    $("msg").textContent = "Copied ✓";
  } catch {
    $("msg").textContent = "Copy manually";
  }
  setTimeout(() => ($("msg").textContent = ""), 2000);
};

update();
