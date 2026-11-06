import type { Lang, TestCase } from "@/lib/exercise";
import { codeTrio, fail, getSection, ITEM_ID_RE, okData, rubricOf, type ForgeBlock, type SchemaResult } from "./_shared";

// i · retencion (§9.3 i). Schema only: `dias: N` (1 to 120), `variante_de: <item id or "mision">`,
// `forma: defensa | codigo`; the statement is the variant; with forma codigo, ### Firma, ### Casos and
// ### Solución as in code; with forma defensa, ### Rúbrica. Distinct id and content hash are the owner's check.

export type RetencionData =
  | { dias: number; varianteDe: string; forma: "defensa"; rubrica: string[] }
  | {
      dias: number;
      varianteDe: string;
      forma: "codigo";
      firma: Partial<Record<Lang, string>>;
      casos: TestCase[];
      solucion: Partial<Record<Lang, string>>;
      functionName: Partial<Record<Lang, string>>;
    };

export const lines = ["dias", "variante_de", "forma"] as const;

export function parse(b: ForgeBlock): SchemaResult<RetencionData> {
  const dias = Number(b.lines.dias);
  if (b.lines.dias === undefined || !Number.isInteger(dias) || dias < 1 || dias > 120) return fail("dias: debe ser un entero entre 1 y 120");
  const varianteDe = b.lines.variante_de;
  if (!varianteDe || (varianteDe !== "mision" && !ITEM_ID_RE.test(varianteDe))) return fail("variante_de: debe ser el id de un ítem o «mision»");
  if (b.lines.forma === "defensa") {
    const rubrica = rubricOf(getSection(b, "rubrica"));
    if (rubrica.length === 0) return fail("con forma defensa falta ### Rúbrica");
    return okData({ dias, varianteDe, forma: "defensa", rubrica });
  }
  if (b.lines.forma === "codigo") {
    const trio = codeTrio(b);
    if (!trio.ok) return trio;
    return okData({ dias, varianteDe, forma: "codigo", ...trio.data });
  }
  return fail("forma: debe ser defensa o codigo");
}
