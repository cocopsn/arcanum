---
module_id: ca000000-0000-4000-8000-000000000009
spine: ITC
title: Ejercicios — Programación dinámica
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro itc-c8-dp.md)
version: 1
---

# Programación dinámica — recursión que se niega a repetir trabajo

Banco anclado a `itc-c8-dp`: las dos condiciones (subestructura óptima + subproblemas superpuestos), memoización vs tabulación, y los DPs canónicos (Fibonacci, knapsack 0/1, LCS). Los ejercicios de código te piden implementar la recurrencia como función PURA, con casos límite reales — entrada vacía, objeto que no cabe, capacidad 0, sin subsecuencia común, empates. Los de justificación, complejidad y traza te piden DEFENDER por qué la técnica es correcta, por qué colapsa el costo de exponencial a polinomial, y dónde deja de aplicar — con el argumento real del libro.

## Las dos condiciones — cuál es de correctitud y cuál de eficiencia
type: multiple_choice

Programación dinámica exige dos condiciones estructurales independientes. ¿Cuál enunciado asigna correctamente el rol de cada una y nombra correctamente qué distingue a DP de "divide y vencerás" puro?

### Opciones
- [x] Subestructura óptima es la condición de CORRECTITUD (la solución grande se puede ensamblar a partir de soluciones óptimas de sus partes); subproblemas superpuestos es la condición de EFICIENCIA (el mismo subproblema se repite, así que recordarlo rinde). Divide y vencerás también tiene subestructura óptima, pero sus subproblemas son disjuntos, así que no necesita memoria — el solapamiento es exactamente lo que distingue a DP.
- Subestructura óptima es de eficiencia y subproblemas superpuestos es de correctitud; divide y vencerás carece por completo de subestructura óptima.
- Ambas condiciones son de eficiencia; DP se diferencia de divide y vencerás solo en usar una tabla en vez de recursión.
- Subproblemas superpuestos garantiza que la elección greedy es segura, mientras subestructura óptima garantiza que la recursión termina.

### Justificación
La sección 1.2 las separa con precisión: subestructura óptima responde "¿puedo construir la solución grande a partir de soluciones óptimas de partes?" (CORRECTITUD — sin ella, ensamblar subproblemas resueltos por separado da la respuesta equivocada), y subproblemas superpuestos responde "¿vale la pena guardarlas, o cada una es única de todas formas?" (EFICIENCIA). Mergesort y quicksort SÍ tienen subestructura óptima (por eso puedes combinar mitades ordenadas), pero sus subproblemas caen sobre porciones DISJUNTAS del input y nunca se repiten — por eso divide y vencerás no necesita memoria; DP sí, porque enfrenta solapamiento masivo. La opción que invierte los roles también niega falsamente que divide y vencerás tenga subestructura óptima. "Tabla vs recursión" es la distinción memoización/tabulación, no lo que separa a DP de divide y vencerás. Y ninguna de las dos condiciones habla de que "la recursión termine" o de que "greedy sea seguro".

## Por qué el camino simple más largo NO tiene subestructura óptima
type: multiple_choice

El camino MÁS CORTO tiene subestructura óptima (por eso Dijkstra y Bellman-Ford funcionan). El camino simple MÁS LARGO no la tiene. ¿Cuál es la razón exacta?

### Opciones
- [x] Porque el camino simple más largo óptimo de A a B podría usar un vértice `x` que el camino simple más largo óptimo de B a C también necesita; como el camino combinado no puede repetir vértices, no puedes concatenar libremente las dos mitades "óptimas" por separado — las soluciones óptimas de los subproblemas interfieren entre sí, la firma de la ausencia de subestructura óptima (y la razón de que el problema sea NP-difícil).
- Porque los caminos más largos pueden ser infinitos, así que no existe ninguna solución óptima sobre la cual construir.
- Porque el camino simple más largo nunca pasa por vértices intermedios, de modo que no hay subproblemas que combinar.
- Porque el camino más corto usa greedy y el más largo usa DP, y greedy siempre tiene subestructura óptima mientras DP nunca la tiene.

### Justificación
El contraejemplo de la sección 1.1: "el más largo de A a C pasando por B = el más largo de A a B + el más largo de B a C" es FALSO porque la mitad A→B óptima podría usar un vértice `x` que la mitad B→C óptima también necesita — y como el camino combinado debe ser simple (sin repetir vértices), no puedes pegar ambas soluciones óptimas; podrías tener que sacrificar la optimalidad de una mitad para evitar la repetición. Esa interferencia entre las soluciones óptimas de los subproblemas es exactamente la ausencia de subestructura óptima, y es la razón de que el problema sea NP-difícil. La opción del "infinito" confunde el planteamiento: la restricción "simple" existe PRECISAMENTE para que la respuesta no sea infinita (si permitieras repetir vértices con ciclos positivos, sí lo sería). "Nunca pasa por vértices intermedios" es simplemente falso. Y greedy/DP no se mapean a "siempre/nunca tiene subestructura óptima": la propiedad es del PROBLEMA, no de la técnica.

## El costo del Fibonacci recursivo ingenuo
type: complexity

`fib_ingenuo(n)` traduce literalmente `F(n) = F(n-1) + F(n-2)`, sin memoria. ¿Cuántas llamadas hace para calcular `fib(n)`, y por qué ese costo y no lineal?

### Opciones
- [x] Θ(φⁿ) — exponencial: el árbol de recursión tiene un número exponencial de nodos porque cada valor se recalcula en muchas ramas distintas (`fib(2)` solo aparece 3 veces en el árbol de `fib(5)`), aunque existan apenas n+1 valores DISTINTOS — toda la explosión es recálculo redundante puro.
- Θ(n) — lineal, porque solo hay n+1 valores distintos de Fibonacci que calcular.
- Θ(n²) — porque cada uno de los n niveles hace trabajo lineal.
- Θ(2ⁿ log n) — porque cada llamada hace una búsqueda logarítmica en una tabla.

### Justificación
La sección 2.2 lo diagnostica exacto: el árbol de recursión completo tiene un número EXPONENCIAL de nodos (Θ(φⁿ), con φ la razón áurea — la misma constante que emerge en la altura mínima de un AVL, no por coincidencia), pero un número apenas LINEAL de valores distintos. La opción "lineal" es la trampa central: es cierto que solo existen n+1 valores distintos, pero la recursión ingenua NO lo explota — los recalcula una y otra vez en ramas que no se comunican. Θ(n) es lo que LOGRA la memoización, no lo que CUESTA la versión ingenua. No hay una estructura de "n niveles × trabajo lineal" (Θ(n²)) ni búsquedas en tabla (Θ(2ⁿ log n)): el Fibonacci ingenuo no consulta ninguna tabla — esa es justamente la memoización que aún no tiene.

## Fibonacci por tabulación — cero recursión
type: code

Memoización sigue siendo recursión (con memoria), y paga el overhead de llamadas y el riesgo de desbordar la pila. Tabulación lo INVIERTE: si conoces el orden de dependencia entre subproblemas, iteras en ese orden llenando una tabla, sin recursión alguna (sección 4.2). Implementa Fibonacci por tabulación bottom-up.

### Especificación
`fib(n)` con `n >= 0`. Devuelve F(n), donde `F(0) = 0`, `F(1) = 1`, `F(k) = F(k-1) + F(k-2)`.
- Llena una tabla en orden CRECIENTE de `k`: al calcular `tabla[k]`, sus dos dependencias `tabla[k-1]` y `tabla[k-2]` ya fueron calculadas en iteraciones previas (la recurrencia solo depende de valores estrictamente menores que `k`).
- Sin recursión. Casos base `F(0) = 0`, `F(1) = 1`.

### Firma
```javascript
function fib(n) {
  // n >= 0; tabulación bottom-up, sin recursión
  // tu código
}
```
```python
def fib(n):
    # n >= 0; tabulación bottom-up, sin recursión
    # tu código
    pass
```

### Casos
```json
[
  { "input": [0], "expected": 0 },
  { "input": [1], "expected": 1 },
  { "input": [2], "expected": 1 },
  { "input": [3], "expected": 2 },
  { "input": [5], "expected": 5 },
  { "input": [10], "expected": 55 },
  { "input": [20], "expected": 6765 }
]
```

### Solución
```javascript
function fib(n) {
  if (n <= 1) return n;
  const tabla = new Array(n + 1);
  tabla[0] = 0;
  tabla[1] = 1;
  for (let k = 2; k <= n; k++) {
    tabla[k] = tabla[k - 1] + tabla[k - 2]; // dependencias YA calculadas
  }
  return tabla[n];
}
```
```python
def fib(n):
    if n <= 1:
        return n
    tabla = [0] * (n + 1)
    tabla[0], tabla[1] = 0, 1
    for k in range(2, n + 1):
        tabla[k] = tabla[k - 1] + tabla[k - 2]  # dependencias YA calculadas
    return tabla[n]
```

### Pistas
- Trata `n = 0` y `n = 1` como casos base directos ANTES de construir la tabla (una tabla de tamaño `n+1` con `n < 2` se vuelve incómoda).
- El orden de iteración es lo único que importa: `k` creciente garantiza que `tabla[k-1]` y `tabla[k-2]` existan cuando los necesitas — esa es la esencia de tabulación (sección 4.2).
- Ninguna recursión, ninguna pila: por eso tabulación no puede desbordar la pila de llamadas como sí podría la memoización profunda.

## Longest Common Subsequence — la longitud
type: code

Dadas dos cadenas, la subsecuencia común más larga (LCS) es una secuencia de caracteres que aparece en AMBAS en el mismo orden relativo, pero no necesariamente contigua (a diferencia de un substring). La recurrencia razona sobre el ÚLTIMO carácter de cada prefijo (sección 7.2). Implementa el cálculo de la LONGITUD de la LCS por tabulación.

### Especificación
`lcsLength(a, b)` para dos cadenas `a` y `b`. Devuelve la longitud (entero) de la subsecuencia común más larga.
- Subproblema `dp[i][j]` = longitud de la LCS entre el prefijo de `a` de longitud `i` y el prefijo de `b` de longitud `j`.
- Recurrencia: si `a[i-1] == b[j-1]` → `dp[i-1][j-1] + 1` (el carácter compartido extiende la LCS); si difieren → `max(dp[i-1][j], dp[i][j-1])`.
- Casos base: `dp[0][j] = 0` y `dp[i][0] = 0` (una LCS contra la cadena vacía tiene longitud 0).

### Firma
```javascript
function lcsLength(a, b) {
  // devuelve la longitud (entero) de la subsecuencia común más larga
  // tu código
}
```
```python
def lcs_length(a, b):
    # devuelve la longitud (entero) de la subsecuencia común más larga
    # tu código
    pass
```

### Casos
```json
[
  { "input": ["ABCBDAB", "BDCABA"], "expected": 4 },
  { "input": ["", "ABC"], "expected": 0 },
  { "input": ["ABC", ""], "expected": 0 },
  { "input": ["ABC", "ABC"], "expected": 3 },
  { "input": ["ABC", "DEF"], "expected": 0 },
  { "input": ["AGGTAB", "GXTXAYB"], "expected": 4 },
  { "input": ["AA", "A"], "expected": 1 }
]
```

### Solución
```javascript
function lcsLength(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}
```
```python
def lcs_length(a, b):
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]
```

### Pistas
- La tabla tiene `(m+1)×(n+1)` celdas; la fila 0 y la columna 0 son todas cero (LCS contra la cadena vacía).
- `a[i-1]`/`b[j-1]` porque `dp[i][j]` habla de PREFIJOS de longitud `i` y `j`, cuyos últimos caracteres están en el índice `i-1`/`j-1`.
- Cada celda depende de la diagonal superior izquierda, la de arriba y la de la izquierda — todas con índices menores; iterar `i` y `j` crecientes basta (sección 7.2).
- Con cadenas vacías (`m = 0` o `n = 0`) el doble bucle no corre y devuelves `dp[0][0] = 0`, correcto sin caso especial.

## La recurrencia de LCS — por qué "coinciden" tiene una opción y "difieren" un máximo
type: multiple_choice

En LCS, ¿por qué el caso "los últimos caracteres coinciden" produce una sola opción (`dp[i-1][j-1] + 1`) mientras "difieren" necesita un máximo entre dos opciones?

### Opciones
- [x] Cuando coinciden, ese carácter compartido puede extender con seguridad la mejor LCS de los dos prefijos más cortos — no hay ninguna razón para descartar un carácter común garantizado, así que la única elección `dp[i-1][j-1] + 1` es óptima. Cuando difieren, al menos uno de los dos últimos caracteres no puede estar en la LCS de ambos prefijos completos, pero no sabemos cuál — así que probamos descartar cada uno (`dp[i-1][j]` y `dp[i][j-1]`) y tomamos el mejor.
- Cuando coinciden se toma un máximo de tres opciones; cuando difieren, solo una — LCS y edit distance son idénticas.
- Cuando difieren se suma 1 por la sustitución; cuando coinciden se suma 0 — exactamente como edit distance.
- El caso "coinciden" toma un máximo para desempatar entre los dos prefijos, y el caso "difieren" es una sola consulta.

### Justificación
La derivación de la sección 7.2: si `a[i-1] == b[j-1]`, ese carácter común SIEMPRE conviene incluirlo — extiende en uno la mejor LCS de los prefijos sin esos últimos caracteres, y nunca hay motivo para tirar un carácter común, por eso una sola opción. Si difieren, el último carácter de al menos una de las dos cadenas no puede formar parte de la LCS común, pero no sabemos de cuál — así que se exploran ambas alternativas (ignorar el último de `a`, o el último de `b`) y se toma el máximo. Las otras opciones confunden LCS con EDIT DISTANCE, que la sección 7.3 contrasta explícitamente: edit distance usa el MÍNIMO de TRES operaciones (insertar/eliminar/sustituir) y suma costos, mientras LCS maximiza la longitud con un máximo de dos. Aquí es al revés de lo que dicen esos distractores: el caso "coinciden" es el de una sola opción, no el del máximo.

## Knapsack 0/1 — el valor máximo
type: code

Tienes `n` objetos, cada uno con peso y valor, y una mochila de capacidad `W`. Quieres el subconjunto de MÁXIMO valor cuyo peso total no exceda `W`, con cada objeto entero o ausente (0/1). La fuerza bruta prueba los `2ⁿ` subconjuntos; la recurrencia de la sección 6.2 razona sobre la última decisión (incluir o no el objeto `i`) y lo baja a `O(n·W)`. Impleméntala.

### Especificación
`knapsack(weights, values, capacity)`:
- `weights[i]` y `values[i]` = peso y valor del objeto `i` (enteros `>= 0`); `capacity` = capacidad máxima (entero `>= 0`).
- Devuelve el valor total máximo alcanzable sin exceder `capacity`.
- Recurrencia: `dp[i][c] = dp[i-1][c]` si `w_i > c` (no cabe); si `w_i <= c`, `dp[i][c] = max(dp[i-1][c], v_i + dp[i-1][c - w_i])` (no incluir vs incluir el objeto `i`). Caso base `dp[0][c] = 0`.
- Una estrategia greedy por relación valor/peso NO garantiza el óptimo (sección 8) — necesitas la tabla.

### Firma
```javascript
function knapsack(weights, values, capacity) {
  // devuelve el valor total máximo sin exceder capacity (0/1)
  // tu código
}
```
```python
def knapsack(weights, values, capacity):
    # devuelve el valor total máximo sin exceder capacity (0/1)
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[2, 3, 4, 5], [3, 4, 5, 6], 5], "expected": 7 },
  { "input": [[2, 3], [3, 4], 0], "expected": 0 },
  { "input": [[3], [10], 5], "expected": 10 },
  { "input": [[7], [10], 5], "expected": 0 },
  { "input": [[], [], 5], "expected": 0 },
  { "input": [[10, 20, 30], [60, 100, 120], 50], "expected": 220 },
  { "input": [[1, 2], [5, 5], 10], "expected": 10 }
]
```

### Solución
```javascript
function knapsack(weights, values, capacity) {
  const n = weights.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const w = weights[i - 1], v = values[i - 1];
    for (let c = 0; c <= capacity; c++) {
      dp[i][c] = dp[i - 1][c];                 // no incluir el objeto i
      if (w <= c) {                             // incluir el objeto i, si cabe
        dp[i][c] = Math.max(dp[i][c], v + dp[i - 1][c - w]);
      }
    }
  }
  return dp[n][capacity];
}
```
```python
def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        w, v = weights[i - 1], values[i - 1]
        for c in range(capacity + 1):
            dp[i][c] = dp[i - 1][c]                 # no incluir el objeto i
            if w <= c:                              # incluir el objeto i, si cabe
                dp[i][c] = max(dp[i][c], v + dp[i - 1][c - w])
    return dp[n][capacity]
```

### Pistas
- Cada celda `dp[i][c]` compara DOS opciones: no incluir el objeto `i` (`dp[i-1][c]`) e incluirlo si cabe (`v_i + dp[i-1][c - w_i]`, la capacidad restante tras reservar espacio).
- El objeto `i` solo es opción si `w_i <= c`; si pesa más que la capacidad disponible, ni siquiera se considera.
- Con `capacity = 0`, sin objetos (`n = 0`), u objetos que no caben, la respuesta es `0` — la tabla lo produce sola, sin casos especiales.
- No caigas en greedy "mejor relación valor/peso primero": la sección 8 muestra que puede cerrar la puerta a una combinación global mejor.

## Por qué O(nW) es pseudo-polinomial, no polinomial
type: complexity

El DP de knapsack llena una tabla de `(n+1)×(W+1)` entradas, cada una en O(1). ¿Cuál es su complejidad, y por qué se le llama pseudo-polinomial en vez de polinomial?

### Opciones
- [x] O(nW): la tabla tiene `(n+1)(W+1)` entradas y cada una se calcula en O(1). Es pseudo-polinomial porque el costo depende del VALOR numérico de W, no del número de bits necesarios para escribirlo — un W astronómicamente grande pero escrito con pocos dígitos hace la tabla astronómicamente grande, y por eso knapsack 0/1 sigue siendo NP-difícil en el sentido estricto.
- O(n log W), porque una búsqueda binaria sobre las capacidades hace cada fila logarítmica.
- O(2ⁿ), porque el DP en el fondo sigue enumerando todos los subconjuntos, solo que más rápido.
- O(nW), y es plenamente polinomial, porque W es parte de la entrada y cualquier dependencia de él cuenta como polinomial.

### Justificación
La sección 6.2 lo remarca: la tabla tiene `(n+1)(W+1)` celdas O(1) → O(nW). La sutileza está en la última opción, que es exactamente la confusión que el libro advierte: O(nW) NO es polinomial en el TAMAÑO de la entrada, porque el tamaño de `W` como dato es su número de bits (`log W`), no su valor. Una `W` enorme se escribe con poquísimos dígitos pero infla la tabla exponencialmente respecto a esa longitud — por eso "pseudo-polinomial" y por eso knapsack 0/1 es NP-difícil en sentido estricto, sin que este DP lo contradiga. No hay búsqueda binaria por fila (O(n log W) es inventado) y el DP justamente EVITA enumerar los `2ⁿ` subconjuntos (por eso no es O(2ⁿ)) — considera la interacción de las decisiones sistemáticamente en la tabla.

## "Parece greedy pero necesita DP" — el contraejemplo de knapsack
type: multiple_choice

Tres objetos con (peso, valor) `(10, 60)`, `(20, 100)`, `(30, 120)` y capacidad 50. Aplicas greedy "toma primero el de mayor relación valor/peso". ¿Qué obtiene greedy y por qué está mal?

### Opciones
- [x] Greedy toma el objeto 0 (relación 6) y luego el objeto 1 (relación 5), para peso 30 y valor 160 — el objeto 2 ya no cabe — pero el óptimo son los objetos 1 + 2 (peso 50, valor 220). Greedy se compromete temprano con el objeto 0 de alta relación, y esa elección local cierra la puerta a la combinación globalmente mejor: por eso knapsack 0/1 necesita DP, no greedy.
- Greedy da 220, lo mismo que el DP, así que greedy sí es correcto para knapsack 0/1.
- Greedy falla solo porque las relaciones están empatadas; con relaciones distintas greedy siempre iguala al DP.
- Greedy da 180 (objetos 0 + 2), que es óptimo porque usa la mayor capacidad posible.

### Justificación
Es el contraejemplo de la sección 8 ("parece greedy pero necesita DP"). Relaciones: objeto 0 = 60/10 = 6, objeto 1 = 100/20 = 5, objeto 2 = 120/30 = 4. Greedy ordena 0, 1, 2: toma el 0 (peso 10, valor 60), toma el 1 (peso acumulado 30, valor 160), y el 2 ya no cabe (30 > 20 restantes) → 160. Pero los objetos 1 + 2 pesan exactamente 50 y valen 220. La decisión local aparentemente óptima (el objeto de mejor relación) impide la mejor combinación global — exactamente la tensión "todo o nada" que la variante 0/1 tiene y la fraccionaria no. Las relaciones aquí son DISTINTAS (6, 5, 4), no empatadas, así que el fallo no viene de empates. Y 180 (objetos 0 + 2, peso 40) ni es lo que greedy calcula ni es óptimo: "usar la mayor capacidad" no es el objetivo, maximizar el VALOR sí.

## Knapsack en 1D — por qué la capacidad se recorre de mayor a menor
type: trace

La versión optimizada en espacio de knapsack guarda una sola fila (`O(W)` en vez de `O(nW)`) y, DENTRO de cada objeto, recorre la capacidad de MAYOR a MENOR. ¿Qué se rompe si la recorres de menor a mayor?

### Opciones
- [x] De menor a mayor, `dp[c - w_i]` ya reflejaría al objeto `i` incluido en ESTA misma pasada, así que el objeto podría contarse VARIAS veces — estarías resolviendo la mochila NO ACOTADA (unbounded), no la 0/1. Recorrer de mayor a menor garantiza que `dp[c - w_i]` conserve aún el valor de la fila ANTERIOR (objeto `i` todavía sin usar), preservando la semántica "cada objeto a lo más una vez" de la recurrencia.
- Nada se rompe: el orden es arbitrario y solo afecta el rendimiento, no el resultado.
- De menor a mayor se leerían celdas sin inicializar y el programa fallaría con un error de índice.
- El orden de mayor a menor solo hace falta para evitar índices negativos cuando `w_i > c`.

### Justificación
La sección 9 marca este orden como CRÍTICO. En 1D, `dp[c]` se sobrescribe en el sitio; la recurrencia 0/1 exige que `dp[c - w_i]` provenga de la fila `i-1` (objeto `i` aún NO considerado). De mayor a menor, cuando actualizas `dp[c]` todavía no tocaste `dp[c - w_i]` (índice menor) en esta pasada de `i`, así que sigue siendo el valor previo — correcto. De menor a mayor, `dp[c - w_i]` YA fue actualizado con el objeto `i` en esta misma pasada, y al usarlo lo cuentas otra vez: eso es mochila no acotada, no 0/1. Traza mínima con un objeto `(w=1, v=1)` y `capacity = 2`: correcto (mayor→menor) `dp` pasa de `[0,0,0]` a `dp[2]=max(0,1+dp[1]=1)=1`, `dp[1]=max(0,1+dp[0]=1)=1` → `dp[2]=1` (el objeto se usó una vez); incorrecto (menor→mayor) `dp[1]=1`, luego `dp[2]=max(0,1+dp[1]=1+1)=2` → devuelve 2, contando el único objeto DOS veces. No hay celdas sin inicializar (toda la fila arranca en 0) ni índices negativos: el bucle solo baja hasta `c = w_i`.
