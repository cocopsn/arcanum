---
module_id: oa-2-prefix-sum
spine: OA Amazon
title: "Prefix Sum y State Reset"
subtitle: "El patrón que abre el examen"
source_canonical: "CSES/CP-Handbook (prefix sums, difference arrays); técnica general de reset greedy en particionamiento de subarreglos; patrón de flujo acumulado en fronteras (tipo LeetCode 1526)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Prefix Sum y State Reset

> **Pregunta raíz.** Precomputar sumas acumuladas convierte "dame la suma del rango [l,r]" de O(n) a O(1) — eso ya lo construiste completo en `cp3-prefix-sums`. Este módulo da el salto que ese patrón habilita en el contexto específico del OA: cuando el problema pide **el mínimo número de operaciones para que una condición acumulada se cumpla en todo el arreglo**, casi siempre la solución es mantener una suma corriente y **reiniciarla** cada vez que viola la condición — un patrón greedy disfrazado de prefix sum, y uno de los más rentables que puedes memorizar para el examen porque aparece, con distintos disfraces, en una fracción sorprendente de los problemas de "mínimas operaciones" que vas a encontrar.

> **Nota de honestidad antes de empezar**: la técnica de este módulo —prefix sums, difference arrays, y el patrón de reset greedy— es real, está ampliamente documentada, y es exactamente el tipo de herramienta que resuelve la clase de problemas de "mínimas operaciones sobre condiciones acumuladas" que se reportan con frecuencia en OAs de SDE intern de la industria, incluyendo Amazon. No tengo forma de verificar el enunciado exacto, palabra por palabra, de un problema específico reportado de la ronda 2026 — así que este módulo construye la técnica general, rigurosa y correcta, y te la ancla a la forma más común en que ese tipo de problema se plantea. Si el problema real que te toca tiene una variación en los detalles, la técnica de fondo va a seguir aplicando; verifica los detalles específicos del enunciado el día del examen.

## Prólogo

Ya tienes `cp3-prefix-sums` completo de tu eje Competitiva — este módulo no repite esa base, la reutiliza directamente y le agrega el patrón específico que la hace brillar en el contexto de "mínimas operaciones", que es exactamente cómo Amazon suele empaquetar estos problemas.

---

## 1. Prefix sum — repaso rápido, ya lo dominas

Precomputa `prefix[i]` = suma de los primeros `i` elementos, con `prefix[0] = 0`. La suma del rango `[l, r]` inclusive es `prefix[r+1] - prefix[l]`, O(1) por consulta tras O(n) de construcción. Si necesitas **muchas actualizaciones de rango** en vez de consultas, usa el difference array: marca `+x` en `diff[l]`, `-x` en `diff[r+1]`, y reconstruye con un solo barrido de prefix sum al final. Toda esta base la tienes completa, con la prueba y las trampas de índice, en `cp3-prefix-sums` — si algo de esto se siente inseguro, repásalo ahí antes de seguir.

---

## 2. State reset — el patrón deducido desde el problema real

### 2.1 El tipo de problema, en su forma general

Un problema típico de esta familia se plantea así: "dado un arreglo, encuentra el mínimo número de operaciones para que **toda posición de un acumulado corrido** cumpla una condición (por ejemplo, nunca sea negativo)". La versión concreta más citada: modificar (o particionar) un arreglo de forma que **todo subarreglo de longitud mayor a 1 tenga suma no negativa**, con el mínimo número de operaciones — donde cada "operación" típicamente corresponde a "cortar aquí y empezar un nuevo segmento" o "ajustar un elemento".

### 2.2 La deducción del greedy — por qué reiniciar es siempre óptimo

Mantén una suma corriente `s`, inicializada en 0. Recorre el arreglo, sumando cada elemento a `s`. **En el momento exacto en que `s` se vuelve negativa**, cuenta una operación (un "corte" o "reinicio" aquí) y reinicia `s` a 0 (o al valor del elemento actual, según la formulación exacta del problema) antes de continuar.

**Por qué esto es óptimo, con el mismo tipo de argumento de intercambio que ya dominas de `cp4-sorting-greedy`**: si la suma corriente se vuelve negativa en la posición `i`, **cualquier segmento que incluya esa posición y se extienda más allá de `i` sin cortar ahí va a cargar esa negatividad hacia adelante**, potencialmente arruinando sumas de subarreglos futuros que de otra forma habrían sido válidas. Cortar exactamente en el momento en que la suma se vuelve negativa es la decisión que **nunca empeora** el resto del problema: after el corte, empiezas de cero, sin arrastrar ningún déficit acumulado hacia el segmento siguiente. Retrasar el corte no puede ayudar —solo puede dejar que la negatividad se acumule más— y cortar antes de que sea necesario desperdicia una operación sin necesidad. El momento óptimo de cortar es, exactamente, el primer instante en que la condición se viola — ni antes ni después.

```python
def minimas_operaciones_suma_no_negativa(arr):
    """
    Patron state-reset: mantiene una suma corriente, cuenta una
    operacion y reinicia cada vez que la suma se vuelve negativa.
    O(n) tiempo, O(1) espacio.
    """
    operaciones = 0
    suma_corriente = 0
    for x in arr:
        suma_corriente += x
        if suma_corriente < 0:
            operaciones += 1
            suma_corriente = 0   # reinicio -- el elemento que causo
                                  # la violacion se "consume" en el
                                  # reinicio, no arrastra su deficit
    return operaciones


if __name__ == "__main__":
    print(minimas_operaciones_suma_no_negativa([3, -4, 2, -1, 5, -6, 1]))
```

**Verifica esto a mano antes de confiar en el código**: recorre `[3, -4, 2, -1, 5, -6, 1]` con lápiz. `s=3` (ok) → `s=-1` (¡negativa! operación 1, reinicia a `s=0`) → `s=2` (ok) → `s=1` (ok) → `s=6` (ok) → `s=0` (ok, exactamente en el límite, no negativa) → `s=1` (ok). Resultado: 1 operación. Practica verificando cada ejemplo a mano antes de confiar ciegamente en tu código bajo presión de examen — es la mejor defensa contra un bug de lógica que "se ve bien" pero está mal en un caso específico.

### 2.3 Por qué esto es, estructuralmente, un prefix sum disfrazado

`suma_corriente` en cada punto **es**, literalmente, `prefix[i] - prefix[último_punto_de_reinicio]` — la misma resta de prefix sums que ya conoces, solo que el "punto de inicio" del rango que estás sumando se mueve dinámicamente cada vez que reinicias. No estás aprendiendo una técnica nueva y separada de prefix sums — estás viendo la misma idea de "suma acumulada" aplicada con una decisión greedy encima de cuándo "cortar" el rango que estás acumulando.

---

## 3. El problema de flujo acumulado en fronteras — la variante de "reabastecimiento"

### 3.1 El planteamiento típico

Una familia relacionada, común en problemas de logística/inventario (el tipo de historia de negocio que Amazon usa para disfrazar el patrón matemático): tienes un arreglo objetivo de niveles de inventario por ubicación, empezando de un estado base (frecuentemente todo en cero), y cada operación te permite incrementar (o decrementar) un **rango contiguo completo** de ubicaciones a la vez. La pregunta es el mínimo número de operaciones de rango para alcanzar el arreglo objetivo.

### 3.2 La deducción — el costo es la suma de incrementos positivos en el difference array

Aquí está la conexión directa con el difference array que ya conoces: si construyes el difference array del arreglo objetivo (`diff[i] = objetivo[i] - objetivo[i-1]`, con `objetivo[-1] = 0`), cada operación de rango `[l, r]` con incremento `+k` afecta exactamente `diff[l] += k` y `diff[r+1] -= k` — la misma mecánica que ya dominas de `cp3-prefix-sums`. El **mínimo número de operaciones** para construir el arreglo objetivo desde cero es, precisamente, la **suma de todos los valores positivos** del difference array — porque cada incremento positivo en el difference array representa un "inicio de rango" que necesita al menos una operación dedicada, mientras que los valores negativos (los "finales de rango") se resuelven automáticamente como consecuencia de las operaciones que ya iniciaste, sin costo adicional.

```python
def minimas_operaciones_rango(objetivo):
    """
    Costo minimo de operaciones de incremento de RANGO para construir
    'objetivo' desde un arreglo de ceros. O(n) tiempo.
    Equivalente a: suma de los incrementos positivos del difference array.
    """
    anterior = 0
    operaciones = 0
    for x in objetivo:
        diferencia = x - anterior
        if diferencia > 0:
            operaciones += diferencia
        anterior = x
    return operaciones


if __name__ == "__main__":
    print(minimas_operaciones_rango([1, 3, 3, 2, 4]))
```

**La intuición de "costo = suma de |flujo que cruza cada frontera|"**: piensa en cada frontera entre la posición `i-1` y `i` del arreglo — la cantidad de "flujo" (operaciones de rango) que tiene que **cruzar** esa frontera específica es exactamente `|objetivo[i] - objetivo[i-1]|`, el valor absoluto de la diferencia. Sumando ese flujo sobre todas las fronteras donde el arreglo **sube** (diferencia positiva) te da el número mínimo de operaciones que tienen que **iniciar** en ese punto — las fronteras donde el arreglo baja no requieren operaciones nuevas, porque una operación que ya inició antes simplemente termina ahí, sin costo adicional. Esto es, otra vez, el mismo principio de "cuenta solo lo que genuinamente necesita una decisión nueva, no cada cambio" que ya viste en la sección 2.

---

## Señales de reconocimiento

- **"Suma de subarreglo/rango"** repetida muchas veces sobre un arreglo estático → prefix sum clásico, O(1) por consulta.
- **"Mínimas operaciones para que [una condición acumulada] se cumpla en todo el arreglo"** → sospecha inmediata de state-reset greedy: mantén el acumulado, cuenta y reinicia cuando se viola la condición.
- **"Muchas actualizaciones de rango"**, sin consultas intermedias, solo el resultado final → difference array.
- **"Flujo acumulado"**, "reabastecimiento", "nivel objetivo alcanzado con operaciones de rango" → el patrón de costo-como-suma-de-incrementos-positivos del difference array.

**La pregunta de diagnóstico**: si el problema pide "el mínimo número de X para que una propiedad acumulada se cumpla siempre", tu primer instinto debería ser preguntarte **"¿puedo mantener un acumulado corriendo y contar cada vez que se rompe la propiedad, reiniciando ahí?"** — antes de considerar cualquier cosa más compleja como DP.

---

## Trampas OA

**Off-by-one en el índice del prefijo**: la misma trampa exacta que ya viste en `cp3-prefix-sums` — confundir si `prefix[i]` incluye o no el elemento `i`, o el rango de consulta inclusive/exclusive. Fija una convención y no la cambies a mitad de examen.

**Overflow**: si trabajas en Python, es gratis (enteros de precisión arbitraria, ya lo viste en `oa-0-fundamentos`) — pero si el problema tiene valores hasta `10^9` y sumas muchos, verifica mentalmente que la magnitud de tu resultado tenga sentido, como señal de que no cometiste un error de lógica que produce un número absurdamente grande o pequeño.

**El caso `l=0`**: si construyes tu prefix array con el offset de tamaño `n+1` y `prefix[0]=0` (la convención de `cp3-prefix-sums`), este caso se resuelve automáticamente sin rama especial — pero si improvisas una versión sin ese offset bajo presión de examen, es fácil olvidar el caso especial. Usa siempre la convención con offset.

**No ver que reiniciar es óptimo — la trampa conceptual más cara**: el error más costoso en esta familia no es de sintaxis, es de diseño: intentar resolver el problema con una búsqueda más complicada (backtracking, probar todas las posiciones de corte posibles) sin darte cuenta de que el greedy de "reinicia exactamente cuando se viola la condición" ya es la solución óptima, probada por el argumento de intercambio de la sección 2.2. Si sientes que un problema de "mínimas operaciones sobre una condición acumulada" te está llevando hacia una solución exponencial o una DP compleja, **detente y pregúntate explícitamente si un greedy de reset simple ya resuelve el problema** — la mayoría de las veces, sí.

---

## Conexiones

**Con `cp3-prefix-sums` y `cp4-sorting-greedy`**: este módulo es, literalmente, la combinación de ambos — el mecanismo de acumulación es prefix sum puro; la decisión de cuándo "cortar" es un greedy probado por exchange argument, exactamente el mismo tipo de prueba que ya dominas. No estás aprendiendo dos técnicas nuevas — estás viendo cómo se combinan dos técnicas que ya tienes.

**Con `oa-0-fundamentos`**: la firma de restricciones de esta familia es casi siempre `n` grande (`10^5`-`10^6`) con la exigencia implícita de O(n) — precisamente porque tanto prefix sum como el greedy de reset son, cada uno, O(n) puro, y su combinación sigue siendo O(n). Si ves esta firma combinada con vocabulario de "mínimas operaciones" o "flujo acumulado", el reconocimiento debería tomarte segundos.

**Con el siguiente módulo**: cuando la condición que necesitas mantener no es una simple comparación de signo sino algo más complejo (un rango de valores válidos, una ventana de tamaño variable), el patrón evoluciona hacia sliding window (`cp1-two-pointers`) — la pregunta de diagnóstico que decide entre ambos: **¿la condición se evalúa sobre un acumulado simple que se resetea completamente, o sobre una ventana que se contrae gradualmente elemento por elemento?**

---

## Síntesis

1. Prefix sum da O(1) por consulta de rango sobre un arreglo estático — la base que ya dominas de `cp3-prefix-sums`.
2. **State reset** es un greedy sobre una suma corriente: cuenta una operación y reinicia exactamente en el instante en que la condición se viola — probado óptimo por exchange argument, no por intuición.
3. El problema de flujo acumulado en fronteras reduce el costo mínimo de operaciones de rango a la **suma de incrementos positivos del difference array** — la misma mecánica de differences que ya conoces, con una fórmula de costo derivada del argumento de "flujo que cruza cada frontera".
4. Señal de reconocimiento: "mínimas operaciones para que una condición acumulada se cumpla siempre" → sospecha state-reset antes que cualquier técnica más compleja.
5. La trampa más cara es conceptual, no de sintaxis: no reconocer que el greedy simple ya es óptimo, y perder tiempo de examen buscando una solución más complicada de la que el problema necesita.

---

## Lo que deberías poder hacer en 30 segundos

1. **Reconocer la firma**: "mínimas operaciones" + "condición acumulada que debe cumplirse siempre" → state-reset greedy como primera hipótesis.
2. **Verificar mentalmente el exchange argument**: ¿retrasar el "corte" solo puede empeorar las cosas? Si sí, el greedy de reset inmediato es correcto.
3. **Distinguir consulta de rango (prefix sum puro) de actualización de rango (difference array)** antes de escribir código — son mecánicas relacionadas pero distintas.
4. **Correr el algoritmo a mano sobre un ejemplo pequeño** antes de confiar en el código, verificando el momento exacto de cada reinicio.

---

## Fuentes

- `cp3-prefix-sums` y `cp4-sorting-greedy` de esta misma colección — la base técnica completa que este módulo combina.
- Técnica general de reset greedy en particionamiento de subarreglos con condición de suma — patrón estándar de programación competitiva, ampliamente documentado en el contexto de problemas de partición óptima.
- Patrón de costo mínimo de operaciones de rango vía difference array (equivalente al problema ampliamente conocido de "incrementos mínimos de subarreglo para alcanzar un arreglo objetivo", tipo LeetCode 1526).
- Nota de honestidad: la formulación exacta del problema reportado de Amazon referenciado en este módulo no pudo verificarse palabra por palabra contra una fuente primaria — la técnica presentada es la solución estándar y correcta para esta clase de problema, tal como se plantea con mayor frecuencia en la industria.
