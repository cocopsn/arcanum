---
module_id: cp3-prefix-sums
spine: Competitiva
title: "Prefix sums y difference arrays"
subtitle: "Pagar una vez para responder mil veces"
source_canonical: "USACO Guide (Silver — Prefix Sums, More on Prefix Sums); CSES"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 22
---

# Prefix sums y difference arrays

> **Pregunta raíz.** Si necesitas responder muchas consultas de "suma del rango [l, r]" sobre un arreglo que **no cambia**, calcular cada suma desde cero cuesta O(r-l) por consulta — con Q consultas, O(n·Q) en el peor caso. Precomputa **una vez** el arreglo de sumas acumuladas (`prefix[i] = a[0]+...+a[i-1]`), y cada consulta se reduce a una resta: `prefix[r+1] - prefix[l]`, O(1). Pagas O(n) una sola vez al construir; cobras O(1) por consulta, para siempre. El difference array es exactamente la operación inversa: en vez de consultar sumas de rango sobre un arreglo estático, **actualizas** rangos enteros de forma barata sobre un arreglo que sí cambia.

## Prólogo

Esta es, probablemente, la técnica de menor "misterio" de todo tu entrenamiento — pero es también la que más rápido tienes que teclear sin pensar, porque casi siempre aparece como una pieza dentro de un problema más grande, no como el problema completo. Si tardas en reconocerla y escribirla, robas tiempo de la parte realmente difícil del problema.

---

## Señales de reconocimiento

**Gritan prefix sums:**
- "Q consultas, cada una pregunta la suma/conteo en el rango [l, r]" sobre un arreglo **que no se modifica** entre consultas
- "número de elementos ≤ K en el rango [l,r]" (con un preprocesamiento adicional, ver Conexiones con CP2)
- grids 2D con consultas de suma de subrectángulos — la extensión directa a 2D
- "cuántas veces ocurre X en el rango [l,r]" con conteos por valor precomputados

**Gritan difference array:**
- "aplica +X a todos los elementos del rango [l,r]" **muchas veces**, y solo necesitas el arreglo final después de todas las actualizaciones (no consultas intermedias)
- "cuántas veces está cubierta cada posición" por un conjunto de intervalos (barrido de cobertura)

**Señal de alerta — NO uses prefix sums estático si:**
- el arreglo se actualiza (valores individuales cambian) **entre** consultas de suma de rango → eso exige un Fenwick tree / segment tree (CP8), no prefix sums simple, porque reconstruir el prefix completo tras cada update cuesta O(n) de nuevo.

**El reflejo**: "muchas consultas de suma de rango" + "el arreglo no cambia" → prefix sums, en segundos. "Muchas actualizaciones de rango" + "solo necesito el resultado final" → difference array, en segundos.

---

## 1. Por qué O(1) por consulta — la deducción en una línea

`prefix[i]` es la suma de los primeros `i` elementos. La suma del rango `[l, r]` (inclusive) es `prefix[r+1] - prefix[l]` — porque `prefix[r+1]` incluye todo hasta `r`, y le restas exactamente lo que sobra antes de `l`. Es aritmética de una resta, no un recorrido — de ahí el O(1).

---

## 2. Plantilla — prefix sums 1D

```python
def construir_prefix(a):
    n = len(a)
    prefix = [0] * (n + 1)   # prefix[0] = 0 por convencion -- CRITICO, ver Trampas
    for i in range(n):
        prefix[i + 1] = prefix[i] + a[i]
    return prefix

def suma_rango(prefix, l, r):   # [l, r] inclusive, 0-indexado
    return prefix[r + 1] - prefix[l]
```

```cpp
vector<long long> construirPrefix(vector<long long>& a) {
    int n = (int)a.size();
    vector<long long> prefix(n + 1, 0);
    for (int i = 0; i < n; i++) prefix[i + 1] = prefix[i] + a[i];
    return prefix;
}

long long sumaRango(vector<long long>& prefix, int l, int r) {   // [l, r] inclusive, 0-indexado
    return prefix[r + 1] - prefix[l];
}
```

**El offset de `+1` no es decorativo**: `prefix` tiene tamaño `n+1`, con `prefix[0] = 0`, precisamente para que `suma_rango(0, i)` funcione sin un caso especial cuando `l = 0` — si indexaras `prefix` de tamaño `n` sin ese offset, tendrías que escribir una rama `if l == 0` separada cada vez. El offset elimina esa rama estructuralmente.

---

## 3. Plantilla — prefix sums 2D (extensión directa)

```python
def construir_prefix_2d(grid):
    filas, cols = len(grid), len(grid[0])
    prefix = [[0] * (cols + 1) for _ in range(filas + 1)]
    for i in range(filas):
        for j in range(cols):
            prefix[i+1][j+1] = grid[i][j] + prefix[i][j+1] + prefix[i+1][j] - prefix[i][j]
    return prefix

def suma_subrectangulo(prefix, r1, c1, r2, c2):   # esquina sup-izq (r1,c1), inf-der (r2,c2), inclusive
    return prefix[r2+1][c2+1] - prefix[r1][c2+1] - prefix[r2+1][c1] + prefix[r1][c1]
```

**La inclusión-exclusión del `-prefix[i][j]`** al construir, y del `+prefix[r1][c1]` al consultar, es el mismo principio combinatorio: sumaste dos veces la esquina compartida, la restas una vez para compensar.

---

## 4. Plantilla — difference array (la operación inversa)

```python
def aplicar_incremento_rango(diff, l, r, x):   # +x a todo el rango [l, r] inclusive
    diff[l] += x
    diff[r + 1] -= x   # cancela el efecto de +x a partir de r+1

def reconstruir_desde_diff(diff, n):
    resultado = [0] * n
    acumulado = 0
    for i in range(n):
        acumulado += diff[i]
        resultado[i] = acumulado
    return resultado
```

```cpp
void aplicarIncrementoRango(vector<long long>& diff, int l, int r, long long x) {
    diff[l] += x;
    diff[r + 1] -= x;
}

vector<long long> reconstruirDesdeDiff(vector<long long>& diff, int n) {
    vector<long long> resultado(n);
    long long acumulado = 0;
    for (int i = 0; i < n; i++) {
        acumulado += diff[i];
        resultado[i] = acumulado;
    }
    return resultado;
}
```

**El truco completo, en una frase**: marcar `+x` en `l` y `-x` en `r+1` en un arreglo auxiliar convierte "aplicar +x a todo un rango" (que costaría O(r-l) si lo hicieras directamente) en dos escrituras O(1) — el costo de aplicar el rango se paga **una sola vez al final**, con un solo barrido de prefix sum sobre `diff` (sección 1, exactamente la misma técnica, en dirección inversa).

---

## Trampas de contest

**Off-by-one en el índice del prefijo**: la fuente más común de bugs de esta técnica — confundir si `prefix[i]` incluye o no `a[i]`, o si el rango de consulta es inclusive o exclusive en cada extremo. Fija una convención (este libro usa `prefix[i]` = suma de los primeros `i` elementos, consultas `[l,r]` inclusive, tamaño `n+1`) y no la cambies a media sesión de contest.

**Overflow**: si sumas muchos elementos con valores grandes, el prefix acumulado puede exceder el rango de `int` en C++ mucho antes de que cualquier elemento individual lo haga — usa `long long` para el arreglo de prefix casi siempre que el problema no garantice explícitamente que la suma total cabe en `int`.

**Olvidar el caso `l=0`**: si tu implementación no usa el offset de tamaño `n+1` con `prefix[0]=0`, vas a necesitar una rama especial para `l=0` en cada consulta — fácil de olvidar bajo presión de tiempo. La plantilla de la sección 2 elimina este caso por construcción; úsala tal cual.

**Difference array sin reconstruir**: `diff` por sí solo, sin el paso de acumulación final (sección 4), **no** es el arreglo de valores reales — es solo el registro de incrementos marcados. Olvidar el paso de reconstrucción y usar `diff` directamente como si fuera el arreglo final es un error de lógica, no de sintaxis, y puede pasar desapercibido si no verificas contra un caso pequeño a mano.

---

## Trade-offs

**Prefix sums vs. segment tree/Fenwick tree**: prefix sums es O(n) de construcción + O(1) por consulta, pero **no soporta actualizaciones** de elementos individuales sin reconstruir todo el prefix desde el punto de cambio en adelante (O(n) por update). Si el problema mezcla consultas de rango **con** actualizaciones de elementos, necesitas Fenwick tree o segment tree (CP8), que dan O(log n) tanto para consulta como para update — el costo de esa flexibilidad es una estructura más compleja de implementar. La señal para decidir: ¿el arreglo cambia entre consultas? Si nunca cambia, prefix sums es más simple y suficiente; si cambia, necesitas la estructura de CP8.

**Difference array vs. actualizar directamente**: si solo tienes **una** actualización de rango que consultar inmediatamente después, actualizar directamente (O(r-l)) puede ser más simple de escribir sin ninguna pérdida real. Difference array se vuelve indispensable cuando tienes **muchas** actualizaciones de rango antes de necesitar el resultado final — ahí el costo total baja de O(n·actualizaciones) a O(n + actualizaciones).

---

## Conexiones

**Con two pointers (CP1)**: "subarreglo con suma exacta K" — si el arreglo tiene solo no-negativos, es two pointers (CP1); si tiene negativos, **prefix sums + hashmap** es la técnica correcta (guarda cuántas veces se ha visto cada valor de prefix, y para cada posición pregunta si `prefix_actual - K` ya apareció antes). Esta es, literalmente, la frontera exacta que ya viste señalada en CP1 — vale la pena tenerla memorizada en ambas direcciones.

**Con binary search (CP2)**: "número de elementos ≤ K en el rango [l,r]" sobre un arreglo ordenado combina ambas técnicas — binary search encuentra la posición límite, prefix sums (sobre un arreglo de conteos, no de valores) da el total en O(1).

**Con segment tree (CP8)**: prefix sums es, conceptualmente, el caso especial y más simple de "estructura que responde consultas de rango" — cuando ese caso especial (sin actualizaciones) no basta, CP8 es la generalización completa.

---

## Síntesis

1. Prefix sums convierte consultas repetidas de suma de rango de O(n) a O(1), pagando O(n) una sola vez al construir.
2. `suma_rango(l,r) = prefix[r+1] - prefix[l]` — con `prefix[0]=0` por convención, eliminando el caso especial `l=0`.
3. Difference array es la operación inversa: convierte muchas actualizaciones de rango en dos escrituras O(1) cada una, pagando la reconstrucción completa una sola vez al final.
4. Señal de contest: "muchas consultas de suma de rango, arreglo estático" → prefix sums. "Muchas actualizaciones de rango, solo el resultado final importa" → difference array. "Consultas Y actualizaciones intercaladas" → ninguna de las dos, necesitas CP8.
5. Las trampas caras son de índice (off-by-one, confundir inclusive/exclusive) y de overflow — ambas silenciosas, no truenan, solo dan mal.

---

## Problemas para resolver

1. **CSES — Static Range Sum Queries** (Sorting and Searching / Range Queries): el caso de libro de texto exacto de la sección 2 — construir prefix, responder Q consultas en O(1) cada una.
2. **CSES — Forest Queries** (Range Queries): la extensión 2D de la sección 3 — suma de subrectángulos sobre un grid estático.
3. Un problema de "aplica +X a un rango, muchas veces, reporta el arreglo final" filtrado por difference array o por el tag general de prefix sums en Codeforces — practica la plantilla de la sección 4 hasta que la teclees sin pensar.
4. Un problema que combine prefix sums con conteo de valores (no solo suma numérica) — por ejemplo, "cuántos elementos iguales a V hay en el rango [l,r]", usando un prefix sum por cada valor distinto o un prefix sum sobre un arreglo indicador — entrena la generalización de la técnica más allá de "solo sumas".
5. Un problema 2D con actualizaciones de rango (usando difference array 2D, la extensión directa del truco de inclusión-exclusión de la sección 3) — confirma que puedes generalizar el patrón 1D a dos dimensiones sin ayuda.

---

## Fuentes

- USACO Guide, sección Silver — Prefix Sums y More on Prefix Sums: https://usaco.guide/silver/prefix-sums
- Antti Laaksonen, *Competitive Programmer's Handbook*: https://cses.fi/book/book.pdf
- CSES Problem Set, secciones Sorting and Searching / Range Queries: https://cses.fi/problemset/
