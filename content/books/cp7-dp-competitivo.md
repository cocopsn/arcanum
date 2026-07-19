---
module_id: cp7-dp-competitivo
spine: Competitiva
title: "DP competitivo"
subtitle: "Encontrar el estado en dos minutos"
source_canonical: "USACO Guide (Gold — Intro to DP); CP-Handbook; CSES DP section"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 25
---

# DP competitivo

> **Pregunta raíz.** La teoría de programación dinámica ya la conoces de tu estudio profundo (ITC C8) — subproblemas superpuestos, subestructura óptima, memoización vs. tabulación. Este libro entrena algo distinto y, bajo reloj, mucho más crítico: **encontrar el estado correcto en minutos, no en media hora**. La mayoría de las DPs de contest no son difíciles de implementar una vez que tienes el estado correcto — son difíciles porque encontrar qué información necesitas cargar en cada subproblema (y qué puedes olvidar con seguridad) es exactamente donde se va el tiempo si no tienes los patrones clásicos memorizados como reflejo.

## Prólogo

Hay un puñado de "formas" de estado que se repiten constantemente en contest — knapsack, LIS, DP sobre grids, DP con bitmask, DP en árboles. Reconocer cuál de estas formas encaja con el enunciado que tienes enfrente, en los primeros dos minutos de leerlo, es la habilidad que este módulo entrena. No vamos a rederivar por qué DP funciona (subestructura óptima, ya lo sabes) — vamos a entrenar el catálogo de estados clásicos hasta que los reconozcas por instinto.

---

## Señales de reconocimiento

**Gritan DP en general:**
- "de cuántas formas puedes..." (conteo de formas de llegar a un resultado)
- "máximo/mínimo valor eligiendo un subconjunto/secuencia sujeta a una restricción"
- el problema tiene una **restricción pequeña** en algún parámetro (n ≤ 20 → sospecha bitmask; n ≤ 1000-5000 → sospecha O(n²); n ≤ 10⁵-10⁶ → sospecha O(n) o O(n log n), DP con estado lineal simple)
- "el resultado depende de decisiones anteriores, pero solo a través de un resumen compacto del progreso" — la señal conceptual de que existe un estado que resume todo lo relevante del pasado sin necesitar el historial completo

**El reflejo de encontrar el estado**: pregúntate explícitamente **"¿qué necesito saber del pasado para tomar la decisión correcta en este punto, y nada más?"** — si la respuesta es "solo la posición actual y cuánto peso llevo acumulado" (knapsack), o "solo la posición y el último valor usado" (LIS), o "solo la posición en el grid" (DP en grid), ya tienes el estado. El error más común de principiante es incluir demasiada información en el estado (historial completo) cuando un resumen mucho más pequeño basta.

---

## 1. Knapsack (0/1) — el patrón más clásico

**Reconocimiento**: "elige un subconjunto de items, cada uno con peso y valor, maximiza valor sujeto a un límite de peso" — la restricción de capacidad es la señal.

```python
def knapsack(pesos, valores, capacidad):
    n = len(pesos)
    dp = [0] * (capacidad + 1)   # dp[w] = maximo valor con peso <= w, usando items procesados hasta ahora
    for i in range(n):
        for w in range(capacidad, pesos[i] - 1, -1):   # CRITICO: hacia atras, ver Trampas
            dp[w] = max(dp[w], dp[w - pesos[i]] + valores[i])
    return dp[capacidad]
```

```cpp
int knapsack(vector<int>& pesos, vector<int>& valores, int capacidad) {
    vector<int> dp(capacidad + 1, 0);
    int n = pesos.size();
    for (int i = 0; i < n; i++) {
        for (int w = capacidad; w >= pesos[i]; w--) {   // hacia atras
            dp[w] = max(dp[w], dp[w - pesos[i]] + valores[i]);
        }
    }
    return dp[capacidad];
}
```

**Por qué el bucle interno va hacia atrás**: `dp[w]` en una sola fila (optimización de memoria, sin la fila anterior explícita) necesita leer `dp[w - pesos[i]]` **antes** de que este mismo item ya lo haya modificado en esta misma pasada — recorrer hacia atrás garantiza que `dp[w - pesos[i]]` todavía refleja el estado "sin usar el item i todavía". Recorrer hacia adelante permitiría usar el mismo item **más de una vez** (eso sería knapsack no acotado, un problema distinto), un bug de lógica silencioso si no lo tienes memorizado.

---

## 2. LIS (Longest Increasing Subsequence) — el patrón O(n log n)

**Reconocimiento**: "la subsecuencia creciente más larga", o cualquier variante de "el subconjunto más largo tal que cada elemento sea mayor/compatible con el anterior en el orden elegido".

```python
import bisect

def lis_longitud(a):
    tails = []   # tails[i] = el menor valor final posible de una subsecuencia creciente de longitud i+1
    for x in a:
        pos = bisect.bisect_left(tails, x)
        if pos == len(tails):
            tails.append(x)
        else:
            tails[pos] = x
    return len(tails)
```

**Por qué esto es O(n log n) y no la DP clásica O(n²)**: la DP directa (`dp[i]` = longitud de la LIS terminando en `i`, revisando todos los `j<i`) es O(n²). La versión con `tails` explota que **mantener el menor valor final posible para cada longitud** permite usar binary search (CP2) para encontrar dónde insertar cada nuevo elemento — la conexión directa con el módulo de binary search: reconoces la estructura y reemplazas un O(n²) por un O(n log n) con una estructura auxiliar simple.

---

## 3. DP sobre grids — caminos en una matriz

```python
def caminos_desde_esquina(grid):
    filas, cols = len(grid), len(grid[0])
    dp = [[0] * cols for _ in range(filas)]
    dp[0][0] = 1 if grid[0][0] != '#' else 0
    for i in range(filas):
        for j in range(cols):
            if grid[i][j] == '#':
                continue
            if i > 0:
                dp[i][j] += dp[i-1][j]
            if j > 0:
                dp[i][j] += dp[i][j-1]
    return dp[filas-1][cols-1]
```

**El estado aquí es, literalmente, la posición** — porque toda la información relevante para decidir el futuro (cuántos caminos llegan hasta aquí) ya está resumida en `dp[i][j]`, sin necesitar el camino completo que se siguió para llegar.

---

## 4. DP con bitmask — cuando n es pequeño (≤ ~20)

**Reconocimiento**: n ≤ 20 en el enunciado es, casi siempre, una señal deliberada del autor del problema de "el estado incluye un subconjunto de elementos, representado como los bits de un entero".

```python
def dp_bitmask_ejemplo(costo, n):
    # dp[mascara] = mejor valor usando exactamente el subconjunto de
    # elementos marcados en 'mascara'. 2^n mascaras posibles.
    dp = [float('inf')] * (1 << n)
    dp[0] = 0
    for mascara in range(1 << n):
        if dp[mascara] == float('inf'):
            continue
        for i in range(n):
            if not (mascara & (1 << i)):   # elemento i no usado todavia
                nueva_mascara = mascara | (1 << i)
                dp[nueva_mascara] = min(dp[nueva_mascara], dp[mascara] + costo(mascara, i))
    return dp[(1 << n) - 1]
```

**Por qué n ≤ 20 específicamente**: `2^20` ≈ 10⁶ máscaras — manejable. `2^30` ya serían mil millones, intratable. **El límite de n en el enunciado te dice directamente qué complejidad se espera** — esta es una de las señales más confiables y más subestimadas en contest: mira los límites antes de pensar en el algoritmo, no después.

---

## 5. DP en árboles — introducción

**Reconocimiento**: el problema opera sobre una estructura de árbol explícita (o un grafo que resulta ser un árbol) y pide optimizar algo que depende de subárboles — "máximo conjunto independiente en un árbol", "diámetro del árbol", cualquier "óptimo considerando cada nodo y sus hijos".

```python
def dp_arbol(nodo, padre, adyacencia):
    # patron general: resuelve recursivamente para cada hijo PRIMERO
    # (post-order, exactamente el mismo orden de finalizacion de DFS
    # que ya conoces de tu estudio de grafos), luego combina.
    resultado_incluir = 1
    resultado_excluir = 0
    for hijo in adyacencia[nodo]:
        if hijo == padre:
            continue
        inc_hijo, exc_hijo = dp_arbol(hijo, nodo, adyacencia)
        resultado_incluir += exc_hijo   # si incluyo este nodo, no puedo incluir sus hijos directos
        resultado_excluir += max(inc_hijo, exc_hijo)
    return resultado_incluir, resultado_excluir
```

**La conexión explícita con tu estudio de grafos**: DP en árboles es, mecánicamente, un DFS post-order (resuelve hijos antes que el padre) donde cada llamada recursiva devuelve el "estado" resumido de ese subárbol — el mismo patrón de finalización que ya dominas de BFS/DFS, con una combinación de valores en el momento de "finalizar" cada nodo.

---

## Trampas de contest

**Definir un estado que no captura toda la información necesaria**: el error de diseño más caro — si tu `dp[estado]` no incluye algo que sí afecta las decisiones futuras (por ejemplo, olvidar incluir "cuánta capacidad me queda" en un problema de empaquetado), obtienes una respuesta incorrecta que **no truena**, simplemente está mal, y puede pasar los casos de prueba pequeños por coincidencia. Antes de escribir código, verifica explícitamente: dado mi estado propuesto, ¿puedo tomar la decisión óptima del siguiente paso sin necesitar NADA más del historial?

**Orden de evaluación incorrecto**: en knapsack 0/1, iterar el peso hacia adelante en vez de hacia atrás (sección 1) reintroduce items — un bug de lógica, no de sintaxis, que da respuestas mayores a las correctas de forma sistemática.

**Memoria — usar solo la fila anterior**: muchas DPs sobre grids o secuencias solo necesitan la fila/estado inmediatamente anterior, no la tabla completa — optimizar esto reduce memoria de O(n·m) a O(m), relevante cuando los límites son grandes. Reconocer cuándo puedes hacer esta optimización (cuando `dp[i]` solo depende de `dp[i-1]`, nunca de filas más atrás) es una habilidad de reconocimiento en sí misma.

**Overflow al contar formas (módulo 1e9+7)**: problemas de "cuántas formas" frecuentemente piden la respuesta módulo un primo grande (comúnmente 10⁹+7) porque el conteo real crece exponencialmente. Olvidar aplicar el módulo en cada suma intermedia (no solo al final) causa overflow de `long long` incluso, si los números intermedios sin reducir crecen sin control — aplica el módulo en cada operación de suma/multiplicación, no solo al final.

---

## Trade-offs

**DP vs. greedy (CP4)**: si no puedes probar un exchange argument para un greedy candidato, DP es la alternativa segura — considera explícitamente todas las decisiones en vez de comprometerte irreversiblemente. El costo es mayor complejidad de tiempo/espacio, pero la garantía de correctitud sin necesitar una prueba adicional.

**Memoización (top-down) vs. tabulación (bottom-up)**: memoización es más natural de escribir cuando no todos los subestados son necesariamente alcanzables (evitas calcular estados que nunca se visitan); tabulación es típicamente más rápida en la práctica (sin overhead de llamadas recursivas) y más fácil de optimizar en memoria (sección de trampas). En contest, memoización suele ser más rápida de **escribir** bajo presión de tiempo si la recurrencia no es trivial de tabular en el orden correcto.

---

## Conexiones

**Con tu estudio de teoría (ITC C8) — relacionado, otra naturaleza**: la prueba de subestructura óptima y por qué la memoización evita recomputar subproblemas superpuestos ya la dominas. Este módulo entrena el catálogo de formas de estado clásicas como reflejo de reconocimiento rápido, no la justificación teórica de por qué DP funciona en general.

**Con binary search (CP2)**: LIS con la optimización `tails` (sección 2) es la composición directa y explícita de DP + binary search — resuélvela una vez entendiendo ambas piezas por separado, y reconocerás la composición instantáneamente en problemas futuros.

**Con grafos competitivos (CP6)**: DP en árboles es, mecánicamente, DFS post-order con combinación de valores — la misma estructura de recorrido, con una capa de "acumular resultado al finalizar cada nodo" encima.

---

## Síntesis

1. La teoría de DP ya la sabes — este módulo entrena reconocer, en minutos, cuál de los patrones clásicos (knapsack, LIS, grid, bitmask, árbol) encaja con el enunciado.
2. El límite de n en el enunciado es una señal directa de la complejidad esperada — n ≤ 20 sugiere bitmask, n ≤ 1000-5000 sugiere O(n²), n grande sugiere O(n) o O(n log n).
3. El estado correcto es el resumen mínimo del pasado que basta para decidir el futuro — ni más información de la necesaria, ni menos.
4. Las trampas caras son de diseño (estado que no captura todo lo relevante) y de implementación (orden de iteración en knapsack, overflow con módulo no aplicado en cada paso).

---

## Problemas para resolver

1. **CSES — Dice Combinations** o **Coin Combinations** (Introductory Problems / Dynamic Programming): DP de conteo de formas más simple — el punto de entrada antes de cualquier variante con restricciones.
2. **CSES — Longest Increasing Subsequence** (Dynamic Programming section, si tu edición la incluye ahí, o el análogo de "subsecuencia creciente más larga"): la plantilla exacta de la sección 2, con la optimización O(n log n).
3. **CSES — Grid Paths** o el análogo de "número de caminos en un grid con obstáculos": la plantilla de la sección 3.
4. Un problema tageado **dp** + **bitmask** en Codeforces con n ≤ 20 explícito en los límites — practica reconocer la señal de límite pequeño antes de leer el resto del enunciado.
5. Un problema clásico de knapsack (0/1) filtrado por tag **dp** en CSES o Codeforces con rating bajo-medio — memoriza la plantilla de la sección 1 hasta poder teclearla sin dudar en el orden del bucle.
6. Un problema de DP en árboles (máximo conjunto independiente, diámetro, o similar) filtrado por tag **dp** + **trees** — conecta explícitamente con el patrón de DFS post-order de la sección 5.

---

## Fuentes

- USACO Guide, sección Gold — Introduction to DP: https://usaco.guide/gold/intro-dp
- Antti Laaksonen, *Competitive Programmer's Handbook*: https://cses.fi/book/book.pdf
- CSES Problem Set, sección Dynamic Programming: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `dp`: https://codeforces.com/problemset?tags=dp
