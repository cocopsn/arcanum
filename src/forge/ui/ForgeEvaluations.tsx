// N2: the bank's practice items (§9.5 «Evaluaciones»), each mounted with its lazy runner. Practice records evidence and
// never opens a gate; items whose bank check is still a stub carry «sin verificar». Extracted from ForgeCellPanel so
// Lecturas can mount it too (design poblar §5.5). One fix on the way: the ingestion stores each pending item as
// `<idBase>:<itemId>` (H25), which is the item's `id`, so the pending mark compares with `it.id` (it never matched
// `itemId`, and «· sin verificar» was never painted). A row with old pendings is revalidated before listing it
// (design evaluadores §5.7, H13): after this release no type is a stub, so the first revalidation empties it.
import { useEffect, useState } from "react";
import { ensureForgeBank, loadForgeBankItems } from "@/forge/loaders";
import { isSelectable, RUNNERS, type RunnerType } from "@/forge/ui/exercises/registry";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { FlowProps } from "@/forge/ui/flow-contract";

/** The pending mark of one item: the ingestion stores pending items by their full id (`<idBase>:<itemId>`). */
export function isPendingItem(it: Pick<ForgeBankItem, "id">, pendientes: readonly string[]): boolean {
  return pendientes.includes(it.id);
}

export function ForgeEvaluations({ code, cellId, readModel }: { code: string; cellId: string; readModel: FlowProps["readModel"] }) {
  const [bank, setBank] = useState<{ items: ForgeBankItem[]; pendientes: string[] } | null | "cargando">("cargando");
  const [open, setOpen] = useState<ForgeBankItem | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      let b = await loadForgeBankItems(code);
      if (!b || b.pendientes.length > 0) {
        const r = await ensureForgeBank(code);
        if (r.ok) b = (await loadForgeBankItems(code)) ?? b;
      }
      if (alive) setBank(b);
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  if (bank === "cargando") return <p className="text-[12px] text-text-muted">Cargando el banco…</p>;
  if (!bank) return <p className="text-[12px] text-text-muted">Banco no descargado · requiere conexión una vez</p>;
  const items = bank.items.filter(isSelectable);
  if (open && isSelectable(open)) {
    const Runner = RUNNERS[open.type as RunnerType];
    return <Runner item={open} cellCode={code} cellId={cellId} readModel={readModel} onClose={() => setOpen(null)} />;
  }
  if (!items.length) return <p className="text-[12px] text-text-muted">Sin evaluaciones de práctica en este banco</p>;
  return (
    <ul className="mt-1 space-y-1">
      {items.map((it) => (
        <li key={it.itemId}>
          <button type="button" onClick={() => setOpen(it)} className="min-h-11 w-full border border-[var(--forge-control)] px-3 text-left text-[12px] text-text" data-forge-eval={it.type}>
            <span className="forge-label mr-1.5 text-[10px] text-text-muted">{it.type}</span>
            {it.title}
            {isPendingItem(it, bank.pendientes) && <span className="ml-1 text-[11px] text-text-muted">· sin verificar</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
