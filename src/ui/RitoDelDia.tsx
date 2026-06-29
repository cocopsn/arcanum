"use client";

export function RitoDelDia({ pending }: { pending: boolean }) {
  return (
    <section
      className="rounded-[var(--r-md)] border bg-surface p-4"
      style={{ borderColor: pending ? "var(--rank)" : "var(--line)" }}
    >
      <div className="text-[11px] uppercase tracking-[0.2em] text-text-faint">
        Rito del día
      </div>
      {pending ? (
        <p className="mt-1.5 font-display text-[15px] leading-snug text-text">
          Aún no dejas marca hoy. Topa un muro, supéralo, sella el insight.
        </p>
      ) : (
        <p className="mt-1.5 font-display text-[15px] leading-snug text-rank">
          Rito cumplido. La llama sigue viva.
        </p>
      )}
    </section>
  );
}
