import type { ModuleRM, Edge } from "@/core/read-model";

// Order a goal's topics into a single Duolingo-style path (Bloque 4). Pure:
// topological order over the goal's prereq edges (Kahn), ties broken by title for
// determinism. A cycle can't occur (the projector enforces a DAG), but if data is
// malformed we degrade by appending leftovers (never throw, never drop a topic).

export function orderTopics(modules: ModuleRM[], edges: Edge[]): ModuleRM[] {
  const live = modules.filter((m) => !m.archived);
  const ids = new Set(live.map((m) => m.id));
  const byId = new Map(live.map((m) => [m.id, m]));

  // in-degree + adjacency restricted to THIS goal's modules
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const m of live) indeg.set(m.id, 0);
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }

  const byTitle = (a: string, b: string) => byId.get(a)!.title.localeCompare(byId.get(b)!.title);
  const ready = live.filter((m) => (indeg.get(m.id) ?? 0) === 0).map((m) => m.id).sort(byTitle);
  const out: ModuleRM[] = [];
  const seen = new Set<string>();

  while (ready.length) {
    const id = ready.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id)!);
    const next: string[] = [];
    for (const to of adj.get(id) ?? []) {
      indeg.set(to, (indeg.get(to) ?? 1) - 1);
      if ((indeg.get(to) ?? 0) === 0) next.push(to);
    }
    next.sort(byTitle);
    ready.push(...next);
    ready.sort(byTitle);
  }

  // degrade gracefully: append anything not reached (malformed data) — never drop
  for (const m of live) if (!seen.has(m.id)) out.push(m);
  return out;
}
