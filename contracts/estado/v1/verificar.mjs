#!/usr/bin/env node
// Gate portátil del contrato de estado v1. Se copia CON el contrato a cada repo y se corre ahí:
//   node contracts/estado/v1/verificar.mjs
// Sale 1 (rojo, nombrando la causa) si:
//   · la copia no es idéntica a la canónica (la huella del directorio no coincide con HUELLA);
//   · el validador aprueba una fixture inválida o rechaza una válida;
//   · un error de validación no NOMBRA el campo que lo causó;
//   · el autoexamen falla: con el esquema ABIERTO (additionalProperties:true) la fixture del campo
//     extra tendría que pasar — si no pasa, el gate no está midiendo el cierre del esquema.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarRespuesta } from './validar.mjs'
import { firmarToken, verificarToken } from './token.mjs'

const DIR = dirname(fileURLToPath(import.meta.url))
const fallos = []

export function huellaDe(dir) {
  const archivos = readdirSync(dir).filter((f) => f !== 'HUELLA' && !f.startsWith('.') && f !== '__pycache__').sort()
  const h = createHash('sha256')
  for (const f of archivos) {
    // Se normaliza el fin de línea: git en Windows puede convertir LF→CRLF al sacar la copia.
    const contenido = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')
    h.update(`${f}\n${createHash('sha256').update(contenido).digest('hex')}\n`)
  }
  return h.digest('hex')
}

// Sólo en el repo CANÓNICO (Auctorum): `--sellar` reescribe HUELLA tras cambiar el contrato.
// En una copia, sellar a mano es exactamente la divergencia que este gate existe para impedir.
if (process.argv.includes('--sellar')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(DIR, 'HUELLA'), `${huellaDe(DIR)}\n`)
  console.log(`HUELLA sellada: ${huellaDe(DIR).slice(0, 12)}`)
  process.exit(0)
}

// 1 · paridad por huella
const declarada = readFileSync(join(DIR, 'HUELLA'), 'utf8').trim()
const medida = huellaDe(DIR)
if (declarada !== medida) fallos.push(`la copia del contrato NO es la canónica: HUELLA ${declarada.slice(0, 12)} ≠ medida ${medida.slice(0, 12)}`)

// 2 · fixtures
const esquemas = JSON.parse(readFileSync(join(DIR, 'esquemas.json'), 'utf8'))
const fixtures = JSON.parse(readFileSync(join(DIR, 'fixtures.json'), 'utf8'))
for (const fx of fixtures) {
  const errores = validarRespuesta(esquemas, fx.esquema, fx.respuesta)
  if (fx.valido && errores.length) fallos.push(`«${fx.caso}» debía ser válida y dio: ${errores.join('; ')}`)
  if (!fx.valido && !errores.length) fallos.push(`«${fx.caso}» debía ser RECHAZADA y el validador la aprobó`)
  if (!fx.valido && fx.debe_nombrar && !errores.some((e) => e.startsWith(fx.debe_nombrar))) {
    fallos.push(`«${fx.caso}»: el error no nombra ${fx.debe_nombrar} (dijo: ${errores.join('; ')})`)
  }
}

// 3 · autoexamen (red-check incorporado): abrir el esquema debe dejar pasar el campo extra
const abierto = JSON.parse(JSON.stringify(esquemas))
abierto.respuestas.salud.additionalProperties = true
const extra = fixtures.find((f) => f.caso === 'salud con campo extra')
if (!extra || validarRespuesta(abierto, 'salud', extra.respuesta).some((e) => e.includes('no permitido'))) {
  fallos.push('autoexamen: con el esquema abierto el campo extra siguió rechazado — el gate no mide el cierre')
}

// 4 · tokens: un caso por motivo
const L = 'x'.repeat(40)
const ahora = Date.parse('2026-11-04T18:00:00Z')
const ok = firmarToken({ iss: 'kee', aud: 'med', ahora }, L)
const casos = [
  ['válido', ok, { ok: true }],
  ['audiencia equivocada', firmarToken({ iss: 'kee', aud: 'primus', ahora }, L), { status: 401, motivo: 'audiencia' }],
  ['vencido', firmarToken({ iss: 'kee', aud: 'med', ahora: ahora - 3600_000 }, L), { status: 401, motivo: 'vencido' }],
  ['otro emisor', firmarToken({ iss: 'intruso', aud: 'med', ahora }, L), { status: 401, motivo: 'emisor_desconocido' }],
  ['firma con otra llave', firmarToken({ iss: 'kee', aud: 'med', ahora }, 'y'.repeat(40)), { status: 401, motivo: 'firma' }],
  ['sin scope', firmarToken({ iss: 'kee', aud: 'med', scope: 'otra:cosa', ahora }, L), { status: 403, motivo: 'sin_scope' }],
  ['sin token', null, { status: 401, motivo: 'sin_token' }],
]
for (const [nombre, tok, esperado] of casos) {
  const r = verificarToken(tok, { audiencia: 'med', llaves: { kee: L }, ahora })
  const bien = esperado.ok ? r.ok === true : r.ok === false && r.status === esperado.status && r.motivo === esperado.motivo
  if (!bien) fallos.push(`token «${nombre}»: esperado ${JSON.stringify(esperado)}, dio ${JSON.stringify(r)}`)
}

if (fallos.length) {
  console.error(`contrato estado/v1: ${fallos.length} fallo(s)`)
  for (const f of fallos) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`contrato estado/v1: copia canónica (${medida.slice(0, 12)}), ${fixtures.length} fixtures y ${casos.length} casos de token en verde`)
