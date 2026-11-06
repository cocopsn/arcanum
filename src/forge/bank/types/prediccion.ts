import { fail, getSection, listItems, okData, sectionText, type ForgeBlock, type SchemaResult } from "./_shared";

// a · prediccion (§9.3 a). Schema only: `escala:` optional (2 to 5 increasing integers in [50, 100]; default
// 50 70 90), ### Opciones (≥ 2, exactly one [x], none empty), ### Justificación (not empty).

export interface PrediccionData {
  escala: number[];
  opciones: string[];
  /** index of the option marked [x] */
  correcta: number;
  justificacion: string;
}

export const lines = ["escala"] as const;

export const DEFAULT_ESCALA = [50, 70, 90];

export function parse(b: ForgeBlock): SchemaResult<PrediccionData> {
  let escala = DEFAULT_ESCALA;
  if (b.lines.escala !== undefined) {
    const nums = b.lines.escala.split(/[\s,]+/).filter(Boolean).map(Number);
    if (nums.length < 2 || nums.length > 5 || nums.some((n) => !Number.isInteger(n) || n < 50 || n > 100)) {
      return fail("escala: debe tener de 2 a 5 enteros entre 50 y 100");
    }
    for (let i = 1; i < nums.length; i++) if (nums[i]! <= nums[i - 1]!) return fail("escala: los valores deben ser crecientes");
    escala = nums;
  }
  const op = getSection(b, "opciones");
  if (!op) return fail("falta ### Opciones");
  const raw = listItems(op.body);
  if (raw.length < 2) return fail("### Opciones necesita al menos 2 opciones");
  let correcta = -1;
  let marked = 0;
  const opciones = raw.map((o, i) => {
    const m = o.match(/^\[\s*[xX]\s*\]\s*(.*)$/);
    if (m) {
      marked++;
      correcta = i;
      return m[1]!.trim();
    }
    return o.replace(/^\[\s*\]\s*/, "").trim();
  });
  if (marked !== 1) return fail("### Opciones necesita exactamente una opción marcada [x]");
  if (opciones.some((o) => !o)) return fail("### Opciones tiene una opción vacía");
  const justificacion = sectionText(getSection(b, "justificacion"));
  if (!justificacion) return fail("falta ### Justificación");
  return okData({ escala, opciones, correcta, justificacion });
}
