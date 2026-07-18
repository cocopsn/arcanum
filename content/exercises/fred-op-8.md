---
module_id: cb000000-0000-4000-8000-000000000011
spine: FrED
title: Ejercicios — OP-8 · Computer Vision para control industrial
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-8-cv-industrial.md)
version: 1
---

# OP-8 · Computer Vision para control industrial

Banco a_mano: defiende la disciplina de la decisión que la visión alimenta — del píxel a la acción física, con confianza. Todo anclado al libro del nodo.

## Dónde vive la confiabilidad del pipeline
type: multiple_choice

Un pipeline de CV industrial —suavizado, contornos, o incluso una CNN entrenada— produce siempre, en el mejor de los casos, una **medida continua**: un área de contorno, un score de confianza, una dimensión medida. El módulo insiste en que la confiabilidad real de todo el sistema NO vive en la sofisticación del procesamiento previo. ¿Dónde vive?

### Opciones
- En la resolución de la cámara y el número de megapíxeles del sensor.
- [x] En la elección del **umbral de decisión** que convierte esa medida continua en la acción binaria rechazar/aceptar.
- En el número de capas convolucionales de la red, que determina cuánto patrón puede aprender.
- En la velocidad del enlace de red entre la cámara y el servidor de inferencia.

### Justificación
La sección 5.2 lo afirma sin rodeos: por sofisticado que sea el pipeline, "se colapsa en la calidad de una sola decisión de umbral" — el mismo patrón estructural que `contamination` en detección de anomalías y que los envelopes de las capability cards. Elegir dónde cortar entre "medida continua" y "booleano que dispara una acción física" es donde el sistema gana o pierde su confiabilidad, y esa elección tiene un costo asimétrico que ninguna matemática pura resuelve. La resolución del sensor, el número de capas y el enlace de red afectan la calidad de la MEDIDA, pero una medida perfecta con un umbral mal elegido sigue produciendo decisiones malas — por eso la decisión binaria, no el procesamiento, es la parte que se codifica a mano con más cuidado.

## Falso positivo vs. falso negativo en una pieza de seguridad
type: multiple_choice

Inspeccionas visualmente un componente de freno: barato, alto volumen, crítico para seguridad. Un **falso negativo** deja pasar una pieza defectuosa; un **falso positivo** rechaza una pieza buena. Según el marco de costo asimétrico del módulo, ¿hacia qué lado calibras el umbral de decisión, y por qué?

### Opciones
- Hacia aceptar más agresivamente (menos falsos positivos), para no desperdiciar material bueno ni frenar la línea.
- [x] Hacia rechazar más agresivamente (menos falsos negativos), aunque genere más falsos positivos, porque el costo de que un freno defectuoso llegue al cliente domina.
- Al punto exacto que iguala numéricamente ambas tasas de error, porque un sistema justo trata los dos errores por igual.
- A ninguno en particular: existe un valor matemático universal que minimiza el error total, independiente del contexto.

### Justificación
La sección 6.2 fija el criterio: un falso negativo en un componente de seguridad tiene consecuencias de seguridad, garantía o marca cuando el producto defectuoso llega al cliente; un falso positivo solo desperdicia material y, a lo sumo, ralentiza la línea o genera fatiga de alertas. Para "una pieza de bajo costo con alto volumen" el módulo dice explícitamente que "quizás toleras más falsos positivos para minimizar el riesgo de que un defecto real llegue al cliente" — exactamente rechazar más agresivamente. Igualar las tasas ignora que los costos SON asimétricos; y las secciones 5.2 y 6.2 son enfáticas en que NO existe fórmula universal: el umbral correcto depende enteramente de cuál costo es mayor en tu contexto específico.

## La cámara se movió: traza lo que reporta el sistema
type: trace

Un sistema de medición dimensional fue calibrado (factor mm/píxel derivado de un patrón conocido) y reporta correctamente una pieza de 50.0mm. Sin recalibrar, alguien golpea el montaje y la cámara se desplaza físicamente. Pasa la siguiente pieza, idéntica, de 50.0mm real. Traza qué hace el sistema.

### Opciones
- Lanza una excepción de "calibración inválida" y detiene la línea hasta que un operador recalibre.
- El detector de contornos deja de encontrar la pieza y devuelve una lista vacía, señal clara de que algo cambió.
- [x] Reporta un valor erróneo (p. ej. 48.5mm) con la misma confianza aparente de siempre y **sin ningún error visible**, porque nada en el pipeline verifica continuamente la validez de la calibración.
- Autocorrige el factor mm/píxel al detectar el desplazamiento y sigue reportando 50.0mm.

### Justificación
La sección 6.3 la marca como "posiblemente el edge case más peligroso", precisamente porque "falla sin ningún error visible". El factor mm/píxel solo es válido para el setup físico exacto de la calibración; al moverse la cámara ese factor deja de ser válido, pero "el sistema sigue produciendo números, con la misma confianza aparente que antes, solo que ahora incorrectos". No hay excepción, no hay autocorrección y no hay lista vacía — el detector sigue encontrando contornos y midiéndolos, solo que la conversión a milímetros ya está sesgada. La mitigación real no es un try/catch: es recalibración periódica programada y verificación continua contra un objeto de referencia de dimensión conocida, fijo en el campo de visión, que alerta si su medida reportada se desvía de su valor real.

## La frontera de confianza: por qué la decisión de visión no mueve el actuador directamente
type: multiple_choice

La decisión binaria del pipeline (`aceptar: false`) no dispara el actuador de rechazo por sí sola: se convierte en un intent que atraviesa la validación de la capability card del actuador antes de tocar hardware, igual que un comando originado por el LLM. Si tu pipeline de visión fuera extremadamente confiable, ¿por qué seguiría pasando por esa validación?

### Opciones
- Porque la capability card mejora la exactitud del clasificador de visión al reentrenarlo con cada decisión.
- Porque las decisiones de visión son más lentas que las del LLM y la card las acelera.
- [x] Porque la capability card es la garantía final e **independiente** de que el comando concreto está dentro de límites físicos seguros — defensa en profundidad: ninguna fuente de decisión toca hardware sin pasar por la misma validación determinista, sin importar qué tan confiable sea.
- Porque sin la capability card la cámara no puede comunicarse con el Bridge.

### Justificación
La sección 5.1 y las Conexiones (cierre con OP-4) son explícitas: la visión es "una fuente más de intents junto al LLM, no un camino alternativo que se salta la validación". El sentido de la defensa en profundidad es justamente que la garantía de seguridad NO depende de la confiabilidad de la fuente: un detector probabilístico (visión, LLM, modelo de anomalías) nunca es la garantía final; la capa determinista de la capability card lo es, y valida el comando específico contra límites físicos seguros de forma independiente. La card no reentrena nada, no acelera nada y no es el canal de comunicación — es el candado determinista entre cualquier detector probabilístico y el actuador real. Esa es la frontera de confianza que sostiene toda la ruta operativa, incluso frente a un sistema de visión engañable (superficies reflectantes, adversarial examples, la trampa de iluminación explotada a propósito).

## Ventana de latencia: por qué la CNN pesada en la nube es la opción equivocada
type: complexity

Una línea en movimiento te da una **ventana de tiempo acotada** entre que la cámara captura la imagen y que la pieza llega a la estación del actuador de rechazo. Toda la cadena de decisión (preprocesamiento + detección + decisión + viaje por el Bridge hasta el handler) debe caber en esa ventana. Bajo esa restricción, ¿qué elección de arquitectura defiende el módulo, y por qué?

### Opciones
- Una CNN profunda ejecutada en un servidor remoto en la nube, porque el ancho de banda moderno hace despreciable el viaje de red.
- [x] Visión clásica (o, si hace falta CNN, inferencia en hardware de edge junto a la línea), porque una convolución fija es órdenes de magnitud más barata que la inferencia de una red profunda y se evita el viaje de red que puede exceder la ventana.
- Siempre una CNN, porque una red profunda es intrínsecamente más rápida que una convolución clásica.
- La latencia es irrelevante mientras la decisión sea correcta: basta con maximizar la exactitud.

### Justificación
La sección 6.4 aplica la disciplina de latencia crítica ya vista en Reactive Observer y Transport: "si el procesamiento tarda más que esa ventana, la decisión llega tarde para ser útil, sin importar qué tan correcta sea" — por eso la exactitud sola no basta, y la última opción cae. El trade-off de la sección 3.3 establece que "convoluciones fijas simples son órdenes de magnitud más rápidas que la inferencia de una red profunda", así que una CNN NO es intrínsecamente más rápida; es lo contrario. Y el argumento de edge computing es literal: nunca depender "de un viaje de red hacia un servidor remoto para la decisión crítica en tiempo real"; la nube queda para reentrenamiento periódico y análisis histórico de tendencias, no para la decisión dentro de la ventana. La respuesta es visión clásica o, cuando el patrón lo exige, CNN ejecutada en el edge.

## La decisión binaria a mano: rechazar por área de defecto
type: code

Codifica el núcleo del `DecisorCalidad` de la sección 5.2: la conversión de una medida continua en la acción binaria rechazar/aceptar. Dada la lista de áreas (en píxeles) de los defectos detectados en una pieza y un umbral de área, decide si la pieza se RECHAZA. La regla del libro (secciones 2.3 y 5.2) es **estricta**: se rechaza si algún defecto **supera** el umbral (`área > umbral`), no si lo iguala. Sin defectos = nada que supere el umbral = se acepta.

### Especificación
`debeRechazar(areas, umbral)`: devuelve `true` si ALGÚN valor de `areas` es estrictamente mayor que `umbral`; en cualquier otro caso —incluida la lista vacía, o un área exactamente igual al umbral— devuelve `false`. Sin efectos secundarios, sin I/O.

### Firma
```javascript
function debeRechazar(areas, umbral) {
  // tu código
}
```
```python
def debe_rechazar(areas, umbral):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[], 50], "expected": false },
  { "input": [[30, 45], 50], "expected": false },
  { "input": [[50], 50], "expected": false },
  { "input": [[51], 50], "expected": true },
  { "input": [[10, 90, 40], 50], "expected": true },
  { "input": [[340], 50], "expected": true }
]
```

### Solución
```javascript
function debeRechazar(areas, umbral) {
  return areas.some((a) => a > umbral);
}
```
```python
def debe_rechazar(areas, umbral):
    return any(a > umbral for a in areas)
```

### Pistas
- El umbral es estricto: exactamente en el umbral NO se supera (la frontera `50 > 50` es falsa → se acepta).
- La lista vacía no tiene ningún elemento que supere el umbral, así que se acepta sin recorrer nada.
- `área > umbral` es la MISMA comparación que usa `detectar_defecto_por_contorno` (2.3) y el `DecisorCalidad` (5.2) del libro.
