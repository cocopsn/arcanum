---
module_id: cb000000-0000-4000-8000-00000000000f
spine: FrED
title: Ejercicios — AutoCard · síntesis de capability cards
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-7-autocard.md)
version: 1
---

# AutoCard · síntesis de capability cards

Banco de defensa a_mano: cada pregunta te pide justificar POR QUÉ una decisión de AutoCard es la correcta, QUÉ se rompe si la cambias, y CÓMO se implementa el mecanismo de confianza. Todo está anclado a lo que el dossier realmente deduce, etapa por etapa.

## El problema es epistémico, no sintáctico
type: multiple_choice

Una card generada pasa el validador de schema a la perfección: todos los campos presentes, tipos correctos, JSON válido. ¿Por qué esto NO resuelve el problema central de investigación de AutoCard?

### Opciones
- Porque el validador de schema es probabilístico y a veces deja pasar campos malformados.
- [x] Porque el validador comprueba la FORMA de la card, no si los números dentro de ella corresponden a los límites físicos reales del dispositivo — un envelope sintácticamente perfecto de `[-200, 200]` para un joint cuyo límite real es `[-118, 120]` es un agujero de seguridad disfrazado de card válida.
- Porque el JSON no es un formato adecuado para capability cards y hay que usar un formato binario firmado.
- Porque la card debe firmarse criptográficamente antes de que el validador confíe en ella.

### Justificación
El corazón del libro (§1.1) es que generar una card con la forma correcta es un problema resuelto — cualquier modelo con generación estructurada produce JSON sintácticamente válido. La dificultad real es epistémica: `[-118,120]` y `[-200,200]` son indistinguibles para cualquier verificación de schema (ambos son JSON válido, ambos pasan), pero solo uno declara el límite seguro real. Ahí vive el riesgo — "parece correcta" y "es correcta" son afirmaciones distintas. El validador es DETERMINISTA, no probabilístico (por eso el primer distractor invierte el hecho); el formato JSON y la firma criptográfica son irrelevantes al problema de si los números son correctos.

## Qué se codifica a mano y qué se delega
type: multiple_choice

Según la política de delegación del propio dossier, ¿por qué la Etapa 1 (ingesta: PDF → schema estructurado) se delega a técnicas estándar mientras que el gate de verificación de twin se codifica a mano, línea por línea?

### Opciones
- Porque la ingesta es técnicamente más difícil de programar que el gate, así que necesita una librería especializada.
- Porque el gate no puede automatizarse en absoluto y siempre requiere que un humano lo ejecute a mano.
- [x] Porque la ingesta produce un input mejor para las etapas siguientes pero no determina, por sí misma, si una card es segura — y la política del dossier es que todo componente que determina la confiabilidad del sistema se escribe a mano para poder defenderlo de primer principio ante un revisor.
- Porque RAG y la extracción de schema están prohibidos en sistemas de seguridad crítica.

### Justificación
El criterio del §2.2 y §4 es exacto: si un componente no cambia tu entendimiento del problema central ni determina la confiabilidad del sistema, se delega (ingesta = infraestructura de soporte con técnicas ya establecidas como RAG y extracción estructurada). El gate, en cambio, es "literalmente el mecanismo que decide si confías en algo externo" (§2.3.2) — determina la confiabilidad, así que va a mano. El primer distractor invierte la dificultad (la ingesta está "resuelta", no es lo difícil); el segundo confunde "codificado a mano" con "ejecutado a mano" — el gate es CÓDIGO automático que tú escribes; el cuarto inventa una prohibición que el dossier nunca declara (de hecho recomienda RAG para la ingesta).

## Match rate antes que sanity probes — el orden y su costo
type: complexity

El gate de verificación de twin ejecuta primero el Paso A (match rate, comparación de metadatos) y solo ejecuta el Paso B (sanity probes) si el Paso A supera el umbral. ¿Qué principio de costo justifica este orden específico, y no el inverso ni ambos a la vez?

### Opciones
- El orden es arbitrario: cualquier secuencia produce el mismo resultado con el mismo costo total.
- [x] El Paso A es barato (comparar metadatos estructurados, sin ejecutar nada) pero superficial; el Paso B es caro (ejecutar comandos reales contra el twin) pero verifica comportamiento real — ejecutar el trabajo caro SOLO sobre candidatos que ya pasaron el filtro barato evita gastar la verificación costosa en twins que ya fallaron la rápida.
- El Paso B debe correr primero para "calentar" el twin antes de poder leer sus metadatos en el Paso A.
- Las sanity probes son menos confiables que el match rate, así que solo se usan para desempatar cuando el match rate queda justo en el umbral.

### Justificación
El §2.3.2 lo deduce como optimización de costo: A no ejecuta nada (comparación de metadatos → barato y superficial); B ejecuta 3–5 comandos de resultado documentado conocido contra el twin (→ caro pero verifica lo que importa: comportamiento, no solo declaración). Correr B condicionado a que A pase es no malgastar el trabajo más caro en candidatos ya descartados por el filtro rápido. El orden NO es arbitrario ni de mismo costo (primer distractor); no hay ningún "calentamiento" (invención del tercero); y las probes no son un desempate — verifican algo estrictamente distinto y más importante que el match rate (que el twin se COMPORTA según su schema, no solo que lo DECLARA), por lo que el cuarto distractor subestima su rol.

## Traza del loop de refinamiento dirigido
type: trace

Una card candidata tiene tres campos con scores de confianza: A = 0.9, B = 0.5, C = 0.95. El umbral de aceptación es 0.7, el máximo de iteraciones es 2, y el score global se agrega con `min`. En la iteración 1, regenerar el campo débil produce un nuevo score de 0.8. Traza el loop de `refinar_card` (§3.3): ¿qué campo(s) se regeneran, cuál es el score global tras la iteración 1, y corre una segunda iteración?

### Opciones
- Se regeneran los tres campos (A, B, C) porque cada iteración regenera la card completa; el score global pasa a 0.8 y el loop corre siempre las 2 iteraciones.
- Se regeneran B y A (los dos más bajos); el score global pasa a 0.9 y el loop continúa a una segunda iteración.
- [x] Solo se regenera B (0.5 < 0.7); tras mejorar a 0.8 ningún campo queda bajo 0.7, así que el score global es `min(0.9, 0.8, 0.95) = 0.8` y el loop PARA temprano — no consume la segunda iteración.
- Solo se regenera B; el score global pasa a 0.8; pero el loop corre siempre las 2 iteraciones sin importar el estado de los campos.

### Justificación
`campos_bajo_umbral(0.7)` devuelve solo B (0.5 < 0.7; A = 0.9 y C = 0.95 están por encima). El refinamiento es DIRIGIDO: regenera únicamente B, preservando el trabajo ya confiable de A y C en vez de arriesgar que una regeneración completa degrade por azar un campo que ya estaba bien (§3.3). B mejora a 0.8; en la siguiente vuelta del `while`, `debiles` queda vacío y el loop hace `break` antes de gastar la segunda iteración. El score global es `min(0.9, 0.8, 0.95) = 0.8` — la agregación más conservadora: la card es tan confiable como su campo más débil. Los distractores que regeneran "la card completa" o "los dos más bajos" contradicen la disciplina de refinamiento dirigido; los que corren "siempre las 2 iteraciones" ignoran la condición de salida temprana (`if not debiles: break`).

## Score alto vs. score bien calibrado
type: multiple_choice

Un campo recibe consistentemente un score de confianza de 0.9. ¿Qué evidencia adicional necesitas antes de poder afirmar que tu scoring está bien CALIBRADO, y no solamente que es alto?

### Opciones
- Ninguna: un score de 0.9 ya significa, por definición, 90% de probabilidad de que el campo sea correcto.
- Basta con re-correr el generador y confirmar que el score se mantiene estable en 0.9 en cada pasada.
- Un 0.9 está bien calibrado en cuanto el campo tenga una cita documental directa que lo respalde.
- [x] Debes comparar sistemáticamente, sobre muchos campos, el score asignado contra el resultado real de la Etapa 3 — un 0.9 bien calibrado significa que ~90% de los campos con score 0.9 resultan correctos al validarse contra hardware real; si solo ~60% lo son, el sistema está sistemáticamente sobre-confiado.

### Justificación
El §5.4 distingue "alto" de "bien calibrado": la calibración es una propiedad estadística que solo se establece comparando el score asignado contra el resultado verificado en la Etapa 3, acumulando suficientes casos (es la métrica del §8 del dossier). La sobre-confianza es peligrosa precisamente porque se disfraza de certeza. El primer distractor asume exactamente lo que hay que probar (que 0.9 = 90% correcto). La estabilidad entre pasadas (segundo distractor) es la señal de "consistencia" del §3.3 — evidencia de que el valor no es un artefacto aleatorio, pero NO de correctitud, y menos de calibración. La cita directa (tercer distractor) es otra señal de entrada al score, no una prueba de que el 0.9 esté calibrado contra la realidad física.

## Contención conservadora del envelope
type: code

El cálculo de match rate del gate (§2.3.2) penaliza a `0.0` cualquier twin que declare un rango MÁS AMPLIO que el documentado (peligroso: permitiría más de lo seguro), y solo puntúa positivo si el envelope del twin está contenido dentro del documentado. Implementa ese chequeo de seguridad como un booleano puro: dado el envelope documentado y el declarado por el twin, decide si el del twin es conservador (seguro) o si excede el límite documentado (peligroso).

### Especificación
`twinEnvelopeSeguro(minDoc, maxDoc, minTwin, maxTwin)`: devuelve `true` si el envelope del twin está contenido dentro del documentado, es decir `minTwin >= minDoc` Y `maxTwin <= maxDoc`. Devuelve `false` si el twin excede por cualquier lado (`minTwin < minDoc` O `maxTwin > maxDoc`) — el caso que el dossier marca como agujero de seguridad. La igualdad exacta en un extremo cuenta como contenido (seguro). Un envelope más estrecho es seguro (solo pierde cobertura, no introduce riesgo).

### Firma
```javascript
function twinEnvelopeSeguro(minDoc, maxDoc, minTwin, maxTwin) {
  // tu código
}
```
```python
def twin_envelope_seguro(min_doc, max_doc, min_twin, max_twin):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [-118, 120, -118, 120], "expected": true },
  { "input": [-118, 120, -200, 200], "expected": false },
  { "input": [-118, 120, -100, 100], "expected": true },
  { "input": [0, 100, 0, 150], "expected": false },
  { "input": [0, 100, -10, 100], "expected": false },
  { "input": [-50, 50, -10, 10], "expected": true }
]
```

### Solución
```javascript
function twinEnvelopeSeguro(minDoc, maxDoc, minTwin, maxTwin) {
  return minTwin >= minDoc && maxTwin <= maxDoc;
}
```
```python
def twin_envelope_seguro(min_doc, max_doc, min_twin, max_twin):
    return min_twin >= min_doc and max_twin <= max_doc
```

### Pistas
- La regla del dossier es que un rango más AMPLIO que el documentado es el peligro; el complemento (más estrecho o igual) es seguro.
- Contención = ambos extremos dentro: el mínimo del twin no baja del documentado y el máximo no lo sube.
- La igualdad en un extremo (`-118 == -118`, `120 == 120`) es contención, no exceso: usa `>=` y `<=`, no `>` y `<`.
