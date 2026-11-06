import { duplicates, structuralCheck } from "./_structural";

// REAL ingestion check of `recuperacion` (§9.3 o): spans inside the texts; at least one unanswerable question; at
// least one contradictory pair; at least one document expired at `corte`; the injected span exists. Also: the key
// covers exactly the questions and cites documents that exist. Nothing executes.
export const check = structuralCheck("recuperacion", (item) => {
  const { corte, corpus, preguntas, clave, contradicciones, inyeccion } = item.data;
  const out: string[] = [];
  for (const id of duplicates(corpus.map((d) => d.id))) out.push(`id de documento repetido «${id}»`);
  for (const id of duplicates(preguntas.map((p) => p.id))) out.push(`id de pregunta repetido «${id}»`);
  const docs = new Map(corpus.map((d) => [d.id, d]));
  const spanOk = (doc: string, inicio: number, fin: number, what: string) => {
    const d = docs.get(doc);
    if (!d) return out.push(`${what} cita el documento «${doc}», que no existe`);
    if (!(inicio >= 0 && fin > inicio && fin <= d.texto.length)) out.push(`${what}: el tramo [${inicio}, ${fin}) cae fuera del texto de «${doc}»`);
  };
  const qids = new Set(preguntas.map((p) => p.id));
  for (const k of Object.keys(clave)) if (!qids.has(k)) out.push(`la clave responde «${k}», que no es una pregunta`);
  let sinRespuesta = 0;
  for (const p of preguntas) {
    const k = clave[p.id];
    if (!k) {
      out.push(`la pregunta «${p.id}» no tiene clave`);
      continue;
    }
    if ("abstenerse" in k) sinRespuesta++;
    else for (const s of k.spans) spanOk(s.doc, s.inicio, s.fin, `la clave de «${p.id}»`);
  }
  if (sinRespuesta === 0) out.push("necesita al menos una pregunta sin respuesta posible (abstenerse)");
  if (contradicciones.length === 0) out.push("necesita al menos un par de documentos contradictorios");
  for (const [a, b] of contradicciones) {
    if (!docs.has(a) || !docs.has(b)) out.push(`el par contradictorio [${a}, ${b}] cita un documento que no existe`);
  }
  const corteMs = Date.parse(corte);
  const vencidos = corpus.filter((d) => d.vigente_hasta !== undefined && Date.parse(d.vigente_hasta) < corteMs);
  if (vencidos.length === 0) out.push("necesita al menos un documento vencido a la fecha de corte");
  spanOk(inyeccion.doc, inyeccion.inicio, inyeccion.fin, "la inyección");
  if (inyeccion.obediencia.length === 0) out.push("la inyección necesita al menos una cadena de obediencia");
  return out;
});
