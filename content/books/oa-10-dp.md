---
module_id: oa-10-dp
spine: OA Amazon
title: "Programación Dinámica"
subtitle: "Recursión que recuerda"
source_canonical: "cp7-dp-competitivo; itc-c8 (relacionado); patrones Amazon-tagged de Coin Change, House Robber, Word Break, LIS con restricción de salto"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Programación Dinámica

> **Pregunta raíz.** DP es, en su forma más comprimida, una sola idea: **recursión que no repite trabajo**. Existe porque una recursión ingenua sobre un problema con **subproblemas superpuestos** (la misma pregunta exacta se hace muchas veces por caminos distintos) recalcula la misma respuesta una y otra vez, desperdiciando tiempo exponencialmente — y porque el problema tiene **subestructura óptima** (la solución óptima se construye a partir de soluciones óptimas de subproblemas más pequeños), guardar cada respuesta la primera vez que la calculas y reutilizarla después convierte ese desperdicio exponencial en un recorrido polinomial. La dificultad real de DP en el OA nunca es "programar la recurrencia" — es **encontrar el estado correcto en los primeros minutos**, y este módulo entrena exactamente eso sobre los cuatro patrones que cubren la mayoría de lo que vas a ver.

## Prólogo

La teoría de por qué DP funciona —subestructura óptima, subproblemas superpuestos, la prueba de por qué memoizar es correcto— la tienes de primer principio en tu módulo de teoría (`itc-c8`, relacionado, otra naturaleza). El reflejo de reconocimiento de patrones clásicos (knapsack, LIS, DP en grid, bitmask) ya lo entrenaste en `cp7-dp-competitivo`. Este módulo no repite ninguno de los dos — te da la versión específica de cuatro patrones tal como Amazon los presenta, con las variantes que realmente aparecen en el examen: Word Break con costo (no solo sí/no), y LIS con una restricción de salto que exige una estructura de datos adicional.

---

## 1. Las dos condiciones, en su forma de examen

**Subestructura óptima**: la respuesta al problema completo se construye combinando respuestas óptimas de subproblemas más pequeños — nunca necesitas reconsiderar una solución subóptima de un subproblema para llegar a la solución óptima del problema completo.

**Subproblemas superpuestos**: la misma pregunta exacta (el mismo estado) aparece múltiples veces si resuelves con recursión pura, sin memoizar — es esta repetición la que memoización elimina.

**La pregunta de diagnóstico rápido, bajo reloj**: si tu primer instinto de fuerza bruta es una recursión que se ramifica (prueba esta opción, o esta otra, recursivamente), pregúntate de inmediato: **¿estoy resolviendo el mismo subproblema exacto más de una vez por caminos distintos?** Si sí, DP. Si cada llamada recursiva visita un estado genuinamente nuevo sin repetición, no necesitas DP — la recursión simple (o backtracking) ya es suficiente.

---

## 2. Coin Change — el knapsack disfrazado de cambio de monedas

**El problema**: dado un conjunto de denominaciones de monedas y un monto objetivo, encuentra el número mínimo de monedas para formar ese monto exacto (o -1 si es imposible).

**El estado**: `dp[monto]` = mínimo número de monedas para formar exactamente `monto`.

**La recurrencia**: `dp[monto] = min(dp[monto - moneda] + 1)` sobre todas las monedas que caben (`moneda ≤ monto`).

```python
def monedas_minimas(monedas, objetivo):
    """
    dp[m] = minimo numero de monedas para formar exactamente m.
    O(objetivo * len(monedas)) tiempo.
    """
    dp = [float('inf')] * (objetivo + 1)
    dp[0] = 0   # caso base: 0 monedas para formar 0

    for m in range(1, objetivo + 1):
        for moneda in monedas:
            if moneda <= m and dp[m - moneda] + 1 < dp[m]:
                dp[m] = dp[m - moneda] + 1

    return dp[objetivo] if dp[objetivo] != float('inf') else -1


if __name__ == "__main__":
    print(monedas_minimas([1, 2, 5], 11))   # 3 (5+5+1)
```

**Por qué no es exactamente el knapsack 0/1 de `cp7-dp-competitivo`**: en knapsack 0/1, cada item se usa a lo más una vez, y el bucle interno recorre el peso **hacia atrás** para evitar reusar el mismo item. Aquí, cada denominación de moneda se puede usar **múltiples veces** (es "knapsack no acotado") — así que el bucle recorre hacia **adelante**, permitiendo que `dp[m - moneda]` ya haya incorporado esa misma moneda anteriormente en esta misma pasada. **Esta diferencia de dirección del bucle es exactamente el tipo de detalle que decide si tu solución cuenta correctamente o repite/excluye monedas incorrectamente** — verifica siempre si el problema permite reutilizar el mismo elemento antes de decidir la dirección del bucle.

---

## 3. House Robber — el DP lineal más simple, la base de todo lo demás

**El problema**: maximiza la suma eligiendo elementos de un arreglo sin elegir dos adyacentes.

**El estado**: `dp[i]` = máximo botín considerando las primeras `i` casas.

**La recurrencia**: `dp[i] = max(dp[i-1], dp[i-2] + valor[i])` — o robas la casa actual (sumando el botín de hace dos posiciones, porque la inmediatamente anterior queda excluida) o no la robas (heredando el máximo hasta la posición anterior).

```python
def house_robber(valores):
    """O(n) tiempo, O(1) espacio -- solo necesitas las dos posiciones anteriores."""
    anterior2, anterior1 = 0, 0
    for v in valores:
        actual = max(anterior1, anterior2 + v)
        anterior2, anterior1 = anterior1, actual
    return anterior1
```

**Por qué esto vale la pena tener como reflejo absoluto**: House Robber es, estructuralmente, el DP lineal más simple posible con una restricción de adyacencia — y es exactamente la base conceptual de House Robber III (DP en árbol, ya visto completo en `oa-7-trees` con el par incluir/no-incluir). Reconocer que ambos comparten la misma lógica de fondo (incluir el actual excluye al vecino inmediato) te da, gratis, la mitad del trabajo de reconocer la variante de árbol.

---

## 4. Word Break — y la variante con costo que realmente aparece en el OA

### 4.1 La versión clásica: ¿se puede segmentar?

**El problema**: dado un string y un diccionario de palabras, determina si el string se puede segmentar en una secuencia de palabras del diccionario.

**El estado**: `dp[i]` = ¿es posible segmentar los primeros `i` caracteres del string?

```python
def word_break_posible(s, diccionario):
    palabras = set(diccionario)
    n = len(s)
    dp = [False] * (n + 1)
    dp[0] = True

    for i in range(1, n + 1):
        for j in range(i):
            if dp[j] and s[j:i] in palabras:
                dp[i] = True
                break

    return dp[n]
```

### 4.2 La variante con costo — la que realmente reporta Amazon

**El problema, extendido**: cada palabra del diccionario tiene un costo asociado. Encuentra el **costo mínimo** de segmentar el string completo (o -1 si no es posible), no solo si es posible.

**La deducción — el mismo estado, con un valor numérico en vez de un booleano**: `dp[i]` = costo mínimo de segmentar los primeros `i` caracteres. `dp[i] = min(dp[j] + costo(s[j:i]))` sobre todas las `j` tales que `s[j:i]` sea una palabra válida del diccionario.

```python
def word_break_costo_minimo(s, diccionario_con_costo):
    """
    diccionario_con_costo: dict palabra -> costo.
    dp[i] = costo minimo para segmentar los primeros i caracteres.
    """
    n = len(s)
    INFINITO = float('inf')
    dp = [INFINITO] * (n + 1)
    dp[0] = 0

    for i in range(1, n + 1):
        for j in range(i):
            palabra = s[j:i]
            if palabra in diccionario_con_costo and dp[j] != INFINITO:
                dp[i] = min(dp[i], dp[j] + diccionario_con_costo[palabra])

    return dp[n] if dp[n] != INFINITO else -1


if __name__ == "__main__":
    diccionario = {"cat": 2, "cats": 3, "and": 2, "sand": 4, "dog": 3}
    print(word_break_costo_minimo("catsanddog", diccionario))
```

**Por qué esta variante es exactamente la misma estructura de DP, no un problema nuevo**: nota que la única diferencia real entre la versión booleana (4.1) y la de costo (4.2) es que `dp[i]` pasa de ser un `bool` a ser un número que **minimizas** — la lógica de "revisa todos los cortes posibles `j` antes de `i`, y combina con lo que ya sabes de `dp[j]`" es idéntica. **Esta es exactamente la señal que este módulo quiere que interiorices**: cuando Amazon convierte un problema clásico de sí/no en una variante de costo mínimo/máximo, casi siempre el estado y la estructura de la recurrencia no cambian — solo cambia qué combinas en cada paso (booleano OR vs. numérico MIN).

---

## 5. LIS con restricción de salto — cuando O(n²) no basta y necesitas una estructura de datos

### 5.1 El problema, extendido sobre la LIS clásica

Ya conoces la LIS clásica O(n log n) de `cp7-dp-competitivo`, sección 2 (la técnica de `tails` con binary search). La variante que reporta Amazon agrega una restricción: encuentra la subsecuencia creciente más larga donde, además, **cada elemento consecutivo de la subsecuencia debe diferir en valor por a lo más K** (una restricción de "salto máximo" entre valores consecutivos elegidos, no solo que sean crecientes).

### 5.2 Por qué la técnica de `tails` de LIS clásica ya no aplica directamente

La técnica de `tails` de `cp7-dp-competitivo` explota que solo te importa "el menor valor final posible para cada longitud de subsecuencia" — pero con la restricción de salto máximo K, ya no basta con saber el valor final mínimo de una longitud dada; necesitas poder consultar, **para un rango de valores específico** (el valor actual menos K hasta el valor actual), cuál es la longitud máxima de subsecuencia válida que termina en ese rango de valores.

### 5.3 La deducción — DP sobre VALORES, con una estructura de rango

**El estado, redefinido**: en vez de `dp[i]` indexado por posición en el arreglo, define `mejor[v]` = longitud de la subsecuencia válida más larga que **termina exactamente en el valor `v`**. Para cada elemento nuevo `x` del arreglo, la pregunta es: **¿cuál es el máximo de `mejor[v]` para `v` en el rango `[x-K, x-1]`?** — esa es exactamente una **consulta de máximo de rango**, y actualizar `mejor[x]` después es una **actualización de punto**. Eso es, precisamente, lo que un Fenwick tree (BIT) o un segment tree te dan en O(log n) por operación — la estructura que ya construiste completa en `cp8-segment-tree`.

```python
class ArbolSegmentosMaximo:
    """
    Segment tree minimo para consulta de MAXIMO de rango + actualizacion
    de punto -- exactamente el patron de cp8-segment-tree, adaptado
    de suma a maximo (cambia el operador de combinacion, nada mas).
    """
    def __init__(self, tamano):
        self.n = tamano
        self.arbol = [0] * (4 * tamano)

    def actualizar(self, pos, valor):
        self._actualizar(1, 0, self.n - 1, pos, valor)

    def _actualizar(self, nodo, izq, der, pos, valor):
        if izq == der:
            self.arbol[nodo] = max(self.arbol[nodo], valor)
            return
        medio = (izq + der) // 2
        if pos <= medio:
            self._actualizar(2*nodo, izq, medio, pos, valor)
        else:
            self._actualizar(2*nodo+1, medio+1, der, pos, valor)
        self.arbol[nodo] = max(self.arbol[2*nodo], self.arbol[2*nodo+1])

    def consultar_maximo(self, l, r):
        return self._consultar(1, 0, self.n - 1, l, r)

    def _consultar(self, nodo, izq, der, l, r):
        if r < izq or der < l or l > r:
            return 0
        if l <= izq and der <= r:
            return self.arbol[nodo]
        medio = (izq + der) // 2
        return max(self._consultar(2*nodo, izq, medio, l, r),
                    self._consultar(2*nodo+1, medio+1, der, l, r))


def lis_con_salto_maximo(arr, k):
    """
    LIS donde elementos consecutivos de la subsecuencia difieren
    en valor por a lo mas k. DP sobre VALORES + segment tree de
    maximo, no DP sobre posiciones + tails.
    O(n log(valor_maximo)) tiempo.
    """
    valor_maximo = max(arr)
    arbol = ArbolSegmentosMaximo(valor_maximo + 1)
    mejor_global = 0

    for x in arr:
        lo = max(0, x - k)
        hi = x - 1
        mejor_terminando_en_rango = arbol.consultar_maximo(lo, hi) if hi >= lo else 0
        longitud_actual = mejor_terminando_en_rango + 1
        arbol.actualizar(x, longitud_actual)
        mejor_global = max(mejor_global, longitud_actual)

    return mejor_global


if __name__ == "__main__":
    print(lis_con_salto_maximo([1, 3, 5, 4, 7], 2))
```

**Por qué esto sigue siendo, en esencia, DP**: `mejor[v]` sigue siendo exactamente un estado de DP —la respuesta óptima que termina en un valor específico, construida a partir de respuestas óptimas de estados anteriores—, solo que la **estructura de datos** que usas para consultar y actualizar ese estado cambió de un arreglo simple a un segment tree, porque la consulta que necesitas (máximo sobre un **rango** de valores, no un solo valor) lo exige. **Esta es exactamente la composición de patrones que separa un problema de dificultad alta de uno medio**: DP (la estructura del estado y la recurrencia) combinado con segment tree (la estructura de datos que hace cada consulta/actualización eficiente) — ninguno de los dos por separado resuelve el problema completo.

---

## Memoización vs. tabulación — la decisión rápida bajo reloj

**Memoización (top-down)**: escribe la recursión natural, agrega un diccionario/arreglo de caché, y memoiza el resultado de cada estado la primera vez que se calcula. Más rápida de escribir cuando la recurrencia no es trivial de reordenar en un bucle bottom-up, y evita calcular estados que nunca se visitan.

**Tabulación (bottom-up)**: construye la tabla `dp[]` explícitamente en el orden correcto de dependencias, como en todos los ejemplos de este módulo. Generalmente más rápida en ejecución (sin overhead de llamadas recursivas) y más fácil de optimizar en memoria (usar solo la fila/valores anteriores, como en House Robber sección 3).

**La decisión rápida bajo reloj**: si la recurrencia es lineal y el orden de evaluación es obvio (como Coin Change, House Robber, Word Break — todos de "izquierda a derecha"), usa tabulación directa, es más rápida de escribir sin errores. Si la recurrencia tiene una estructura más compleja o ramificada donde no es inmediato qué orden bottom-up seguir, memoización top-down es frecuentemente más segura de escribir correctamente bajo presión de tiempo, aunque tenga un poco más de overhead.

---

## Señales de reconocimiento

- **"De cuántas formas..."** → DP de conteo, cuidado con overflow (ver Trampas).
- **"Máximo/mínimo eligiendo un subconjunto/secuencia"** con una restricción (adyacencia, capacidad, salto máximo) → DP lineal o knapsack, según la restricción.
- **"¿Se puede segmentar/formar/construir...?"** → Word Break o variante, booleano o de costo según lo que pida el problema.
- **Restricción de "salto máximo" o "diferencia máxima" entre elementos consecutivos de una subsecuencia** → sospecha de DP sobre valores + estructura de rango (segment tree/BIT), no DP clásico sobre posiciones.

---

## Trampas OA

**Estado que no captura toda la información necesaria**: el error de diseño más caro, ya establecido en `cp7-dp-competitivo` — verifica siempre, antes de codear, que tu estado propuesto contenga todo lo que necesitas para tomar la decisión óptima del siguiente paso, ni más ni menos.

**Orden de evaluación incorrecto**: en Coin Change (knapsack no acotado), el bucle va hacia adelante; en un knapsack 0/1 clásico, hacia atrás — confundir la dirección reintroduce o excluye incorrectamente la reutilización de elementos. Verifica siempre si el problema permite reutilizar elementos antes de fijar la dirección de tu bucle.

**Overflow al contar formas**: problemas de "cuántas formas" casi siempre piden la respuesta módulo `10^9+7` — aplica el módulo en **cada** suma intermedia, no solo al final, porque los números intermedios sin reducir pueden crecer sin control incluso en Python (donde no hay overflow real, pero sí un costo de rendimiento innecesario por trabajar con enteros gigantes).

**Hacer DP donde greedy basta, o viceversa**: si te encuentras escribiendo una DP compleja para un problema que, en realidad, tiene una observación greedy simple detrás (recuerda `oa-5-greedy-observation`), estás gastando tiempo de examen innecesariamente — antes de comprometerte con DP, dedica los mismos 30-60 segundos de "buscar la observación" que ya entrenaste ahí. Simétricamente, si intentas un greedy sin poder probarlo con exchange argument y sigues encontrando contraejemplos, es la señal de que el problema genuinamente necesita DP, no que tu greedy solo necesita un ajuste más.

---

## Conexiones

**Con `itc-c8` y `cp7-dp-competitivo`**: la teoría completa de por qué DP funciona, y el catálogo de patrones clásicos (knapsack, LIS, DP en grid, bitmask) ya están ahí. Este módulo entrena el reconocimiento específico de cómo Amazon presenta y extiende esos patrones — con costo en vez de solo factibilidad, con restricciones de rango en vez de solo orden simple.

**Con `oa-7-trees`**: House Robber III es, literalmente, House Robber (sección 3 de este módulo) aplicado sobre la recursión de un árbol en vez de una secuencia lineal — reconocer esa conexión te da la mitad del trabajo gratis.

**Con `cp8-segment-tree`**: LIS con restricción de salto combina DP con la estructura de segment tree de máximo de rango — la prueba más clara de este módulo de que los problemas de dificultad alta en el OA son composiciones de patrones que ya dominas por separado, no técnicas completamente nuevas.

**Con `oa-5-greedy-observation`**: la pregunta de diagnóstico "¿esto es DP o hay una observación greedy más simple detrás?" es exactamente la frontera entre estos dos módulos — vale la pena tenerla presente antes de comprometerte con la implementación más compleja.

---

## Síntesis

1. DP existe porque hay subproblemas superpuestos (recalculo evitable) y subestructura óptima (la solución se construye de sub-soluciones óptimas) — la pregunta de diagnóstico es "¿estoy resolviendo el mismo estado exacto más de una vez?"
2. Coin Change es knapsack no acotado — el bucle va hacia adelante, a diferencia del knapsack 0/1 clásico.
3. House Robber es el DP lineal más simple con restricción de adyacencia — la base conceptual directa de House Robber III en árboles.
4. Word Break con costo es exactamente la misma estructura que la versión booleana — solo cambia qué combinas (OR booleano vs. MIN numérico) en cada estado.
5. LIS con restricción de salto exige redefinir el estado sobre valores (no posiciones) y usar un segment tree de máximo de rango — DP compuesto con estructura de datos, no DP puro.
6. Memoización top-down para recurrencias complejas de escribir bottom-up; tabulación para recurrencias lineales obvias.
7. La trampa más cara conceptualmente es aplicar DP pesado donde un greedy simple (con exchange argument) ya resuelve el problema — o viceversa.

---

## Lo que deberías poder hacer en 30 segundos

1. **Articular el estado propuesto en una frase** antes de escribir cualquier código de DP.
2. **Decidir la dirección del bucle** según si los elementos se pueden reutilizar (adelante) o no (atrás).
3. **Reconocer cuándo una variante de costo/mínimo/máximo es la misma estructura que la versión booleana/clásica** ya conocida, solo con el operador de combinación cambiado.
4. **Detectar restricciones de rango de valores** (salto máximo, diferencia máxima) como señal de que necesitas componer DP con una estructura de datos de rango, no DP puro sobre posiciones.

---

## Fuentes

- `itc-c8` (relacionado, otra naturaleza) y `cp7-dp-competitivo` de esta misma colección — la teoría completa de DP y el catálogo de patrones clásicos.
- `oa-7-trees` y `cp8-segment-tree` de esta misma colección — las conexiones directas de House Robber III y LIS con restricción de salto.
- "Coin Change", "House Robber", "Word Break", "Longest Increasing Subsequence" — problemas estándar y ampliamente citados en preparación de entrevistas técnicas de la industria, frecuentemente reportados bajo el tag Amazon, incluyendo sus variantes de costo y restricción de rango.
