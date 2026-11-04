// Tokens del contrato de estado v1 para llamadas FUERA de Azure (Vercel, la laptop): JWT HS256
// con una llave por PAR emisor→receptor, vida máxima de 15 minutos y `scope` explícito.
// Dentro de Azure se usa Entra con identidad administrada (sin secretos); eso NO vive aquí.
// PURO salvo `node:crypto`. Gemelo en Python: `token.py`. Mismas reglas, mismas pruebas.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const SCOPE_LECTURA = 'estado:leer'
export const VIDA_MAXIMA_S = 900
const HOLGURA_S = 60

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const desb64u = (s) => Buffer.from(s, 'base64url')

function hmac(datos, secreto) {
  return createHmac('sha256', secreto).update(datos).digest()
}

/** Firma un token. `secreto` es la llave del par (≥32 bytes). */
export function firmarToken({ iss, aud, scope = SCOPE_LECTURA, vidaS = 300, ahora = Date.now() }, secreto) {
  if (!secreto || secreto.length < 32) throw new Error('llave del par ausente o corta')
  if (vidaS > VIDA_MAXIMA_S) throw new Error('vida mayor que la permitida')
  const iat = Math.floor(ahora / 1000)
  const cab = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const cuerpo = b64u(JSON.stringify({ iss, aud, scope, iat, exp: iat + vidaS }))
  return `${cab}.${cuerpo}.${b64u(hmac(`${cab}.${cuerpo}`, secreto))}`
}

/**
 * Verifica un token. `llaves` = { [emisor]: secreto } SÓLO de los emisores autorizados a llamar a
 * ESTE receptor. Devuelve { ok:true, emisor } o { ok:false, status, motivo }. El motivo es un
 * vocabulario cerrado (no ecoa nada del token).
 *   401: sin token · malformado · algoritmo · emisor desconocido · firma · vencido · vida excesiva · audiencia
 *   403: token válido sin el scope pedido
 */
export function verificarToken(token, { audiencia, llaves, scope = SCOPE_LECTURA, ahora = Date.now() }) {
  const no = (status, motivo) => ({ ok: false, status, motivo })
  if (!token || typeof token !== 'string') return no(401, 'sin_token')
  const partes = token.split('.')
  if (partes.length !== 3) return no(401, 'malformado')
  let cab, cuerpo
  try {
    cab = JSON.parse(desb64u(partes[0]).toString('utf8'))
    cuerpo = JSON.parse(desb64u(partes[1]).toString('utf8'))
  } catch {
    return no(401, 'malformado')
  }
  if (cab?.alg !== 'HS256') return no(401, 'algoritmo')
  const secreto = typeof cuerpo?.iss === 'string' && Object.hasOwn(llaves, cuerpo.iss) ? llaves[cuerpo.iss] : null
  if (!secreto) return no(401, 'emisor_desconocido')
  const esperada = hmac(`${partes[0]}.${partes[1]}`, secreto)
  const dada = desb64u(partes[2])
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) return no(401, 'firma')
  const t = Math.floor(ahora / 1000)
  if (typeof cuerpo.exp !== 'number' || typeof cuerpo.iat !== 'number') return no(401, 'malformado')
  if (cuerpo.exp < t - HOLGURA_S) return no(401, 'vencido')
  if (cuerpo.iat > t + HOLGURA_S) return no(401, 'vencido')
  if (cuerpo.exp - cuerpo.iat > VIDA_MAXIMA_S) return no(401, 'vida_excesiva')
  if (cuerpo.aud !== audiencia) return no(401, 'audiencia')
  const scopes = typeof cuerpo.scope === 'string' ? cuerpo.scope.split(' ') : []
  if (!scopes.includes(scope)) return no(403, 'sin_scope')
  return { ok: true, emisor: cuerpo.iss }
}

/** Lee `Authorization: Bearer …` sin lanzar. */
export function tokenDeCabecera(valor) {
  if (typeof valor !== 'string') return null
  const m = /^Bearer\s+([A-Za-z0-9_.-]+)$/.exec(valor.trim())
  return m ? m[1] : null
}
