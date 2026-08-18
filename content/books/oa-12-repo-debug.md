---
module_id: oa-12-repo-debug
spine: OA Amazon
title: "Repo Debug — Localizar y Parchar"
subtitle: "Localizar y parchar bajo reloj"
source_canonical: "Mongoose documentation (schemas, save, markModified, populate); Express documentation; patrones reportados de la Etapa 2 (repo debug) de OAs de SDE intern de la industria"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Repo Debug — Localizar y Parchar

> **Pregunta raíz.** La segunda etapa común del OA no es un problema algorítmico — es un repositorio real, tipo CRUD sobre Node/Express/Mongoose, con bugs sembrados deliberadamente y una suite de pruebas que falla. Tu trabajo no es escribir código desde cero — es **localizar** el bug exacto (archivo, función, línea) y aplicar el **parche mínimo** que lo corrige, bajo un reloj que no perdona exploración sin dirección. La ventaja que tienes aquí es real y específica: llevas meses trabajando con Claude Code en producción, así que ya tienes intuición de cuándo una sugerencia de IA acierta y cuándo alucina — esa intuición es exactamente la habilidad que esta etapa evalúa, aplicada bajo presión de tiempo.

## Prólogo

Este módulo tiene una naturaleza mixta: parte estrategia de examen (cómo gestionar tu tiempo, cómo usar un asistente de IA que localiza pero no resuelve por ti), y parte conocimiento técnico específico de Mongoose (los bugs que realmente aparecen, una y otra vez, en este tipo de ejercicio). Ambas partes son igual de críticas — la estrategia sin el conocimiento técnico te deja perdido ante el bug real; el conocimiento técnico sin la estrategia te hace perder el tiempo que no tienes.

---

## 1. La trampa central — arreglar el frontend no basta

### 1.1 Por qué esto es lo primero que hay que internalizar

Los tests de este tipo de ejercicio verifican el **status code y el mensaje de la respuesta de la API**, no el frontend. Esto significa que un candidato que ve un bug visual o de comportamiento en la interfaz, y lo "arregla" ajustando el código del cliente (React, o lo que sea que renderice), **no mueve ni un solo test a verde** — porque el test nunca toca el frontend, solo hace peticiones HTTP directas contra los endpoints y verifica la respuesta cruda.

### 1.2 Dónde vive el bug real, casi siempre

El bug que hace fallar los tests vive en el **handler de la ruta** (el archivo que recibe la petición HTTP y decide qué hacer) **y/o en el service** (la capa que contiene la lógica de negocio real, si el repo sigue esa separación) — no en componentes de UI. Tu primer movimiento, sin excepción, debería ser **correr la suite de pruebas primero**, ver exactamente qué endpoint y qué comportamiento espera cada prueba que falla, y desde ahí navegar directo hacia el handler/service correspondiente — nunca empezar explorando el frontend "a ver qué encuentro".

---

## 2. Los bugs típicos — el catálogo que vale la pena tener en la cabeza

### 2.1 Comparación invertida (`===` por `!==`, o el operador lógico equivocado)

El bug más simple y, precisamente por eso, uno de los más fáciles de pasar por alto leyendo rápido bajo presión: una condición que debería ser "si es igual, rechaza" escrita como "si es igual, permite" (o viceversa). Al leer una condición bajo reloj, léela **en voz alta o palabra por palabra**, no la asumas por su forma general — `if (usuario.rol !== 'admin')` y `if (usuario.rol === 'admin')` se ven parecidos a primera vista y hacen exactamente lo opuesto.

### 2.2 `save()` faltante tras modificar un documento de Mongoose

**El error conceptual**: en Mongoose, modificar un campo de un documento ya recuperado de la base de datos (`documento.campo = nuevoValor`) **no persiste el cambio automáticamente** — necesitas llamar explícitamente `await documento.save()` para que el cambio efectivamente se escriba de vuelta a MongoDB. Un handler que modifica el documento en memoria, responde con éxito, pero nunca llama `.save()`, va a pasar una prueba superficial que solo verifica el status code de la respuesta, pero falla cualquier prueba que **verifique el estado real** de la base de datos después de la petición (por ejemplo, haciendo un `GET` posterior para confirmar que el cambio persistió).

```javascript
// BUG: modifica en memoria, nunca persiste
async function actualizarEstado(req, res) {
  const pedido = await Pedido.findById(req.params.id);
  pedido.estado = req.body.estado;
  // FALTA: await pedido.save();
  res.json(pedido);   // responde con el objeto "actualizado" que NUNCA se guardo
}
```

### 2.3 Off-by-one — el clásico, ahora en contexto de API

Paginación con `skip`/`limit` calculados con un índice desfasado en uno, un índice de arreglo que excluye el último elemento válido, o un bucle de validación que revisa un elemento de más o de menos — la misma trampa que ya conoces de tu entrenamiento algorítmico, aquí escondida en lógica de negocio en vez de en un algoritmo puro.

### 2.4 Objeto guardado nunca escrito de vuelta, o nunca vinculado a su relación

Un patrón específico de este tipo de ejercicio: un endpoint crea o modifica un sub-objeto (por ejemplo, un comentario que debería vincularse a un "issue" o "ticket" padre), pero el código nunca **agrega la referencia** de ese sub-objeto al arreglo/campo correspondiente del documento padre — el sub-objeto se guarda de forma aislada, existe en la base de datos, pero nunca aparece cuando consultas el padre porque nadie lo vinculó.

```javascript
// BUG: el comentario se guarda, pero nunca se agrega al array del issue padre
async function agregarComentario(req, res) {
  const comentario = new Comentario({ texto: req.body.texto, issueId: req.params.issueId });
  await comentario.save();
  // FALTA: buscar el issue padre, hacer issue.comentarios.push(comentario._id),
  // y await issue.save() -- sin esto, el comentario existe pero esta huerfano
  res.status(201).json(comentario);
}
```

### 2.5 `markModified()` olvidado en un subdocumento anidado

**El bug más específico de Mongoose de todo este catálogo, y el que más candidatos pierden por desconocimiento, no por descuido**: cuando modificas una propiedad **anidada dentro de un campo de tipo `Mixed` o de un objeto plano anidado** (no un subdocumento de schema propio, sino un campo declarado como `Schema.Types.Mixed` o un objeto genérico), Mongoose **no siempre detecta automáticamente** que ese campo cambió — porque su sistema de detección de cambios (change tracking) rastrea asignaciones directas a nivel de propiedad del documento, y una mutación profunda dentro de un objeto anidado puede no disparar esa detección. La solución es llamar explícitamente `documento.markModified('nombreDelCampo')` antes de `save()`, para forzar a Mongoose a reconocer que ese campo necesita persistirse.

```javascript
// BUG: mutacion profunda en un campo Mixed que Mongoose no detecta automaticamente
async function actualizarMetadata(req, res) {
  const pedido = await Pedido.findById(req.params.id);
  pedido.metadata.historial.push(req.body.evento);   // mutacion anidada
  // FALTA: pedido.markModified('metadata');
  await pedido.save();   // esto CORRE, pero puede no persistir el cambio real
  res.json(pedido);
}
```

**Por qué este bug es particularmente insidioso bajo reloj**: el código **no truena** — `save()` se ejecuta sin error, la respuesta HTTP parece correcta, y solo una prueba que verifica el estado persistido después expone que el cambio nunca se guardó. Si ves un campo de tipo `Mixed` o un objeto anidado genérico en el schema, y el bug involucra que algo "no se guarda" a pesar de que el código parece llamar `save()`, sospecha de esto inmediatamente.

### 2.6 `findByIdAndUpdate` sin `{ new: true }`

Por defecto, `findByIdAndUpdate` de Mongoose devuelve el documento **como estaba antes de la actualización**, no el documento actualizado — un handler que hace `const actualizado = await Modelo.findByIdAndUpdate(id, cambios)` y luego responde con `actualizado` está devolviendo datos **desactualizados** en la respuesta HTTP, aunque la base de datos sí se haya actualizado correctamente. Necesitas pasar explícitamente la opción `{ new: true }` para que el método devuelva el documento post-actualización.

```javascript
// BUG: devuelve el documento VIEJO en la respuesta
const actualizado = await Pedido.findByIdAndUpdate(id, { estado: nuevoEstado });
res.json(actualizado);   // esto NO refleja el cambio recien aplicado

// CORRECTO:
const actualizado = await Pedido.findByIdAndUpdate(id, { estado: nuevoEstado }, { new: true });
```

### 2.7 `populate()` olvidado o mal aplicado

Si un endpoint debe devolver un documento con sus referencias "expandidas" (por ejemplo, un pedido con los datos completos del cliente, no solo su ID), y el schema usa referencias (`ref` en el schema de Mongoose), olvidar encadenar `.populate('campoDeReferencia')` en la consulta deja el campo como un ID crudo en vez del objeto completo esperado — una prueba que verifica la estructura exacta de la respuesta va a fallar porque el campo tiene la forma equivocada (un string de ID en vez de un objeto anidado).

---

## 3. Estrategia bajo reloj — el proceso completo, paso a paso

### 3.1 Los primeros 10 minutos — exploración acotada, nunca más

Dedica un máximo de 10 minutos a explorar la estructura del repo antes de tocar nada: identifica dónde viven los modelos (schemas de Mongoose), los handlers de rutas, y los services si existen como capa separada. **No leas el código línea por línea buscando el bug todavía** — solo construye el mapa mental de dónde está cada pieza, para que cuando un test falle sepas inmediatamente a qué archivo ir.

### 3.2 Corre los tests primero, siempre

Antes de cualquier exploración de código, corre la suite completa y lee los mensajes de fallo con atención — el nombre de la prueba y el mensaje de aserción casi siempre te dicen exactamente qué endpoint y qué comportamiento esperado está fallando. Esta información es más valiosa que cualquier exploración manual del código.

### 3.3 El ciclo de trabajo, prueba por prueba

Para cada prueba que falla: pega el mensaje de error exacto (el nombre de la prueba, la aserción que falló, el stack trace si lo hay) al asistente de IA disponible, y pídele explícitamente **localización** — "¿en qué archivo, qué función, y aproximadamente qué líneas está el problema?" — no le pidas que resuelva el bug completo de una vez. **Lee tú mismo el código en esa ubicación específica**, entiende el bug con tus propios ojos (esto es exactamente donde tu intuición ya entrenada con Claude Code en producción distingue una localización correcta de una alucinación plausible pero equivocada), aplica el **parche mínimo** necesario, y vuelve a correr esa prueba específica antes de pasar a la siguiente.

### 3.4 Por qué "no regeneres archivos" es una regla, no una sugerencia

Pedirle al asistente que reescriba un archivo completo, en vez de un parche quirúrgico, arriesga introducir regresiones en partes del código que ya funcionaban correctamente — y bajo reloj, no tienes tiempo de volver a verificar todo lo que ya pasaba. El parche mínimo, quirúrgico, dirigido exactamente a la línea o función que el bug involucra, es la disciplina que preserva todo lo que ya funciona mientras arregla exactamente lo que falla.

### 3.5 Los últimos 5 minutos — la corrida final

Reserva, sin excepción, los últimos 5 minutos del tiempo asignado para una corrida completa de la suite — no solo de las pruebas específicas que fuiste arreglando una por una. **Lo que pasa localmente en tu entorno todavía tiene que pasar en el sandbox de evaluación**, y esos dos entornos no son necesariamente idénticos — verificar una corrida final completa es tu única defensa contra una diferencia de entorno que no habías anticipado.

### 3.6 Verde parcial ya es una victoria real

Si al final del tiempo asignado tienes 4 de 6 pruebas en verde, **eso ya avanza tu candidatura** — no necesitas las 6 para que el ejercicio tenga valor ante el reclutador. Esto tiene una consecuencia directa de gestión de tiempo: si un bug específico te está tomando desproporcionadamente más tiempo que los demás sin que logres localizarlo, **considera abandonarlo temporalmente y asegurar las pruebas más accesibles primero**, volviendo al bug difícil solo si te sobra tiempo — maximizar el número de pruebas en verde, no intentar resolver en orden estricto de aparición.

---

## Trampas OA

**Arreglar solo el frontend**: ya cubierto en profundidad en la sección 1 — la trampa conceptual más cara de toda esta etapa, porque puede consumir minutos completos sin mover un solo test.

**Confiar ciegamente en la localización de la IA sin verificar tú mismo**: tu ventaja específica es la intuición ya entrenada de cuándo una sugerencia acierta y cuándo alucina — úsala activamente. Si la localización que te da el asistente no encaja con lo que el mensaje de error específico describe, o si el código en esa ubicación no parece tener relación con el síntoma, no apliques el parche sugerido sin verificar — pide una segunda pasada con más contexto, o localiza tú mismo desde el stack trace.

**Regenerar archivos completos**: ya cubierto en 3.4 — arriesga regresiones en código que ya funcionaba.

**No correr la suite completa al final**: ya cubierto en 3.5 — verificar solo las pruebas que fuiste arreglando una por una, sin una corrida completa final, te deja ciego ante cualquier regresión que tu último parche haya introducido en algo que antes pasaba.

---

## Conexiones

**Con tu experiencia real de Claude Code en producción (AUCTORUM, Kee)**: este ejercicio evalúa, en miniatura y bajo reloj, exactamente la misma habilidad que ya practicas diariamente en tu trabajo real — usar un asistente de IA para acelerar localización y diagnóstico, mientras mantienes el juicio final humano sobre qué parche aplicar y por qué. La diferencia no es la habilidad en sí, es el tiempo comprimido y el contexto desconocido (un repo que nunca has visto, en vez de tu propio código) — pero el reflejo de "pide localización, verifica tú, aplica mínimo, re-verifica" es transferible directamente.

**Con la disciplina de "correcto y simple antes que optimizado"** de `oa-0-fundamentos`: aquí se traduce en "parche mínimo que hace pasar la prueba antes que una refactorización elegante que arriesga romper algo más" — la misma jerarquía invertida de valores bajo un examen cronometrado.

---

## Síntesis

1. Los tests verifican la API (status code, mensaje, estado persistido), no el frontend — arreglar solo la interfaz no mueve ningún test.
2. El catálogo de bugs típicos de Mongoose: comparación invertida, `save()` faltante, off-by-one, objeto guardado pero no vinculado a su relación padre, `markModified()` olvidado en campos `Mixed`/anidados, `findByIdAndUpdate` sin `{ new: true }`, `populate()` olvidado.
3. Estrategia: 10 minutos de exploración acotada, corre tests primero, ciclo de localización-vía-IA + verificación-propia + parche-mínimo + re-verificación por cada prueba, nunca regenerar archivos completos, 5 minutos finales reservados para una corrida completa.
4. Verde parcial (4/6) ya tiene valor real — gestiona tu tiempo para maximizar pruebas en verde, no para resolver en orden estricto.
5. Tu ventaja específica es la intuición ya entrenada de cuándo la IA acierta o alucina — verifica siempre antes de aplicar un parche sugerido.

---

## Lo que deberías poder hacer en 30 segundos

1. **Confirmar, ante cualquier bug visual aparente, que el fix necesario vive en el handler/service, no en el frontend** — antes de tocar cualquier archivo de cliente.
2. **Reconocer los seis patrones de bug de Mongoose** de la sección 2 con solo leer el mensaje de una prueba fallida.
3. **Articular el ciclo de trabajo completo** (localización vía IA → verificación propia → parche mínimo → re-verificación) sin dudar sobre el siguiente paso.
4. **Recordar reservar los últimos 5 minutos** para una corrida completa, sin excepción.

---

## Fuentes

- Mongoose, documentación oficial: schemas y `save()`: https://mongoosejs.com/docs/documents.html — `markModified()` y detección de cambios: https://mongoosejs.com/docs/api/document.html#Document.prototype.markModified() — `findByIdAndUpdate` y la opción `new`: https://mongoosejs.com/docs/api/model.html#Model.findByIdAndUpdate() — `populate()`: https://mongoosejs.com/docs/populate.html
- Express, documentación oficial de routing y manejo de peticiones: https://expressjs.com/en/guide/routing.html
- Nota de honestidad: la estrategia de gestión de tiempo (10 min exploración, 5 min corrida final, verde parcial con valor) y el catálogo de bugs específicos reflejan patrones ampliamente reportados de esta etapa de assessments técnicos de la industria — no una transcripción verificada de un repositorio específico de Amazon 2026. La disciplina de fondo (localizar antes de resolver, parche mínimo, verificar antes de confiar) es correcta y transferible sin importar el repo exacto que te toque.
