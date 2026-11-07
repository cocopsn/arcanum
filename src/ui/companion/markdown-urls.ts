// Transformación de URL del markdown del compañero (design §15). ReactMarkdown pasa cada href/src por esta función
// antes de pintar; sólo se dejan pasar los enlaces https: y las citas internas #cita-P1…#cita-P8. Todo lo demás
// (javascript:, data:, vbscript:, relativos, protocolos raros) se vuelve "" y no llega al DOM. Pura, sin dependencias:
// es una costura sustituible con vi.mock para el red-check de §15 («un enlace javascript: se pintó»).

/** Una cita interna válida: #cita-P seguido de un dígito 1-8. */
export const CITA_RE = /^#cita-P[1-8]$/;

/**
 * Deja pasar sólo `https:` (parseable con base) y `#cita-P[1-8]`; cualquier otra cosa → "". No usa trucos de cadena:
 * construye un `URL` con una base para clasificar el protocolo, así `JAVASCRIPT:` (mayúsculas) o espacios iniciales no
 * escapan. Un `#cita-Pn` llega como href relativo; se compara literal.
 */
export function transformarUrl(url: string): string {
  if (typeof url !== "string") return "";
  const bruto = url.trim();
  if (CITA_RE.test(bruto)) return bruto;
  let u: URL;
  try {
    u = new URL(bruto, "https://arcanum.invalid/");
  } catch {
    return "";
  }
  // Sólo https: y sólo si la URL original traía su propio protocolo (no un relativo resuelto contra la base).
  if (u.protocol === "https:" && /^https:\/\//i.test(bruto)) return u.href;
  return "";
}
