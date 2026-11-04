// Validador del contrato de estado v1 (Milla 12). PURO: sin dependencias, sin red, sin `fs`.
// Se copia por huella a cada repo que expone o consume el contrato; su gemelo en Python es
// `validar.py` y los dos se prueban contra las MISMAS fixtures (`fixtures/`).
//
// Implementa exactamente el subconjunto de JSON Schema que usa `esquemas.json`:
// type, enum, pattern, required, properties, additionalProperties (false | esquema),
// propertyNames, maxProperties, items, maxItems, minimum, maximum, anyOf y $ref a `definiciones`.
// Una palabra clave desconocida LANZA: un validador que ignora lo que no entiende aprueba de más.

const CONOCIDAS = new Set([
  'type', 'enum', 'pattern', 'required', 'properties', 'additionalProperties', 'propertyNames',
  'maxProperties', 'items', 'maxItems', 'minimum', 'maximum', 'anyOf', '$ref',
])

function tipoDe(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function cumpleTipo(v, t) {
  const real = tipoDe(v)
  if (t === 'number') return real === 'number' || real === 'integer'
  return real === t
}

function validarNodo(esquemas, esq, v, ruta, errores) {
  if (esq.$ref) {
    const def = esquemas.definiciones[esq.$ref]
    if (!def) throw new Error(`$ref desconocido: ${esq.$ref}`)
    return validarNodo(esquemas, def, v, ruta, errores)
  }
  for (const k of Object.keys(esq)) {
    if (!CONOCIDAS.has(k)) throw new Error(`palabra clave no soportada: ${k} en ${ruta}`)
  }
  if (esq.anyOf) {
    const ok = esq.anyOf.some((alt) => {
      const e = []
      validarNodo(esquemas, alt, v, ruta, e)
      return e.length === 0
    })
    if (!ok) errores.push(`${ruta}: no cumple ninguna alternativa`)
    return
  }
  if (esq.type && !cumpleTipo(v, esq.type)) {
    errores.push(`${ruta}: se esperaba ${esq.type}, llegó ${tipoDe(v)}`)
    return
  }
  if (esq.enum && !esq.enum.includes(v)) errores.push(`${ruta}: valor fuera del vocabulario`)
  if (esq.pattern && typeof v === 'string' && !new RegExp(esq.pattern).test(v)) {
    errores.push(`${ruta}: no cumple el patrón`)
  }
  if (typeof v === 'number') {
    if (esq.minimum !== undefined && v < esq.minimum) errores.push(`${ruta}: menor que ${esq.minimum}`)
    if (esq.maximum !== undefined && v > esq.maximum) errores.push(`${ruta}: mayor que ${esq.maximum}`)
    if (!Number.isFinite(v)) errores.push(`${ruta}: no es finito`)
  }
  if (Array.isArray(v)) {
    if (esq.maxItems !== undefined && v.length > esq.maxItems) errores.push(`${ruta}: más de ${esq.maxItems} elementos`)
    if (esq.items) v.forEach((x, i) => validarNodo(esquemas, esq.items, x, `${ruta}[${i}]`, errores))
  }
  if (tipoDe(v) === 'object') {
    const llaves = Object.keys(v)
    if (esq.maxProperties !== undefined && llaves.length > esq.maxProperties) {
      errores.push(`${ruta}: más de ${esq.maxProperties} llaves`)
    }
    for (const r of esq.required ?? []) if (!(r in v)) errores.push(`${ruta}.${r}: falta`)
    const props = esq.properties ?? {}
    for (const k of llaves) {
      if (esq.propertyNames) validarNodo(esquemas, esq.propertyNames, k, `${ruta}{${k}}`, errores)
      if (k in props) validarNodo(esquemas, props[k], v[k], `${ruta}.${k}`, errores)
      else if (esq.additionalProperties === false) errores.push(`${ruta}.${k}: campo no permitido por el contrato`)
      else if (esq.additionalProperties && typeof esq.additionalProperties === 'object') {
        validarNodo(esquemas, esq.additionalProperties, v[k], `${ruta}.${k}`, errores)
      } else if (esq.additionalProperties === undefined && esq.type === 'object') {
        // Todo objeto del contrato es cerrado: un esquema que olvidó declararlo falla aquí, no en prod.
        errores.push(`${ruta}.${k}: objeto sin additionalProperties declarado`)
      }
    }
  }
}

/**
 * Valida `respuesta` contra el esquema `nombre` (salud|version|despliegues|metricas|eventos|costos).
 * Devuelve la lista de errores; vacía = válida. Los mensajes nombran la RUTA del campo, nunca su
 * valor: un error de validación no debe convertirse en el canal por el que sale el dato.
 */
export function validarRespuesta(esquemas, nombre, respuesta) {
  const esq = esquemas.respuestas[nombre]
  if (!esq) throw new Error(`respuesta desconocida: ${nombre}`)
  const errores = []
  validarNodo(esquemas, esq, respuesta, nombre, errores)
  return errores
}

/**
 * Busca marcadores prohibidos (canarios) en cualquier cadena o llave de la respuesta.
 * Devuelve las RUTAS donde aparecieron. Es la segunda línea: el esquema cerrado impide el texto
 * libre; el canario prueba que ningún dato sembrado se coló por un campo con patrón laxo.
 */
export function buscarCanarios(respuesta, marcadores) {
  const hallazgos = []
  const bajos = marcadores.map((m) => m.toLowerCase())
  const visitar = (v, ruta) => {
    if (typeof v === 'string') {
      const s = v.toLowerCase()
      if (bajos.some((m) => s.includes(m))) hallazgos.push(ruta)
    } else if (Array.isArray(v)) v.forEach((x, i) => visitar(x, `${ruta}[${i}]`))
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (bajos.some((m) => k.toLowerCase().includes(m))) hallazgos.push(`${ruta}{${k}}`)
        visitar(x, `${ruta}.${k}`)
      }
    }
  }
  visitar(respuesta, '$')
  return hallazgos
}
