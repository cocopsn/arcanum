---
module_id: ca000000-0000-4000-8000-000000000008
spine: ITC
title: Ejercicios — Grafos II · caminos mínimos y expansión
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro itc-c7-grafos-ii.md)
version: 1
---

# Grafos II — caminos mínimos y expansión

Banco anclado a `itc-c7-grafos-ii`: caminos mínimos con peso (Dijkstra, Bellman-Ford) y árboles de expansión mínima (Kruskal, Prim, propiedad del corte). Los ejercicios de código te piden implementar el algoritmo DESDE CERO con casos límite reales — grafo desconectado, ciclo, nodo aislado, peso negativo, ciclo negativo, empates — como función pura. Los de justificación, complejidad y traza te piden DEFENDER por qué el diseño es correcto y por qué su costo es exactamente el que es, con el argumento real del libro, no trivia.

## Por qué BFS da la respuesta incorrecta en cuanto las aristas pesan distinto
type: multiple_choice

En el grafo dirigido `A → B` (peso 10), `A → C` (peso 1), `C → B` (peso 1), aplicas BFS ingenuo — tratando cada arista como "un salto", ignorando el peso — para hallar el mejor camino de A a B. ¿A qué conclusión llega BFS y por qué es incorrecta?

### Opciones
- [x] BFS concluye que el camino directo `A → B` es el mejor porque alcanza B en un solo salto, sin darse cuenta de que el camino `A → C → B` cuesta 1 + 1 = 2, estrictamente menos que el 10 del salto directo — porque BFS mide "distancia" en número de aristas, no en costo acumulado.
- BFS encuentra correctamente `A → C → B` porque siempre expande primero la arista más barata disponible.
- BFS falla porque entra en un bucle infinito, visitando B una y otra vez a causa de la arista de peso 10.
- BFS da la respuesta incorrecta solo porque el grafo es dirigido; sobre una versión no dirigida del mismo grafo acertaría.

### Justificación
La garantía de BFS (camino con MENOS aristas) depende, de forma esencial y no accidental, de que cada arista cuente como "+1" — así "procesado antes en la cola FIFO" equivale exactamente a "menor distancia acumulada" (sección 1.1). En cuanto los pesos varían, "menos aristas" y "menor costo total" dejan de ser lo mismo: BFS descubre B en la primera capa (un salto, "distancia" 1) y nunca reconsidera esa estimación, concluyendo que el salto directo de costo 10 es mejor que las dos aristas que suman 2 — el contraejemplo exacto de la sección 1.2. La opción de "expande primero la arista más barata" describe una cola de PRIORIDAD (Dijkstra), no la cola FIFO de BFS. BFS no cae en bucles infinitos: marca vértices visitados. Y el defecto no es la direccionalidad sino la métrica (contar aristas vs sumar costos); una versión no dirigida con los mismos pesos sufriría idéntico error.

## Dijkstra desde cero — caminos mínimos con pesos no negativos
type: code

El contraejemplo de BFS te obliga a un algoritmo que compare COSTOS ACUMULADOS reales y esté dispuesto a RECONSIDERAR su estimación de un vértice si aparece un camino más barato (aunque tenga más aristas). Esa es la estrategia greedy de Dijkstra: procesa los vértices en orden de distancia estimada creciente, relajando cada arista, y cierra cada vértice una sola vez. Implementa Dijkstra como función PURA sobre un grafo dirigido con pesos no negativos.

### Especificación
`dijkstra(n, adj, source)` sobre un grafo DIRIGIDO con `n` vértices etiquetados `0..n-1`:
- `adj[u]` es la lista de aristas salientes de `u`, cada una `[v, w]` (vecino, peso `w >= 0`).
- Devuelve un arreglo `dist` de longitud `n` donde `dist[i]` = costo del camino mínimo de `source` a `i`, o `-1` si `i` es inalcanzable (con pesos no negativos ninguna distancia real es negativa, así que `-1` nunca es ambiguo).
- Mecanismo (secciones 2.1-2.2): mantén la mejor estimación por vértice; en cada paso extrae el vértice NO visitado con menor `dist`, ciérralo, y relaja cada arista saliente (`si dist[u] + w < dist[v]`, mejora `dist[v]`).

### Firma
```javascript
function dijkstra(n, adj, source) {
  // adj[u] = lista de [v, w] con w >= 0; devuelve arreglo de distancias, -1 si inalcanzable
  // tu código
}
```
```python
def dijkstra(n, adj, source):
    # adj[u] = lista de [v, w] con w >= 0; devuelve lista de distancias, -1 si inalcanzable
    # tu código
    pass
```

### Casos
```json
[
  { "input": [1, [[]], 0], "expected": [0] },
  { "input": [3, [[[1, 10], [2, 1]], [], [[1, 1]]], 0], "expected": [0, 2, 1] },
  { "input": [4, [[[1, 5]], [], [], []], 0], "expected": [0, 5, -1, -1] },
  { "input": [4, [[[1, 1], [2, 4]], [[2, 1], [3, 5]], [[3, 1]], []], 0], "expected": [0, 1, 2, 3] },
  { "input": [3, [[[1, 2]], [[2, 3]], []], 1], "expected": [-1, 0, 3] },
  { "input": [4, [[[1, 1]], [[2, 1]], [[0, 1]], []], 0], "expected": [0, 1, 2, -1] },
  { "input": [3, [[[1, 2], [2, 2]], [], []], 0], "expected": [0, 2, 2] }
]
```

### Solución
```javascript
function dijkstra(n, adj, source) {
  const dist = new Array(n).fill(Infinity);
  dist[source] = 0;
  const visited = new Array(n).fill(false);
  for (let iter = 0; iter < n; iter++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; }
    }
    if (u === -1) break; // los restantes son inalcanzables
    visited[u] = true;
    for (const [v, w] of adj[u]) {
      if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    }
  }
  return dist.map(d => (d === Infinity ? -1 : d));
}
```
```python
def dijkstra(n, adj, source):
    INF = float('inf')
    dist = [INF] * n
    dist[source] = 0
    visited = [False] * n
    for _ in range(n):
        u, best = -1, INF
        for i in range(n):
            if not visited[i] and dist[i] < best:
                best, u = dist[i], i
        if u == -1:
            break
        visited[u] = True
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    return [-1 if d == INF else d for d in dist]
```

### Pistas
- En cada paso extrae el vértice no visitado con menor `dist`. Un escaneo O(V) basta; un heap binario lo baja a O(log V) (sección 2.3), pero la LÓGICA es la misma.
- Relajar `(u, v, w)`: mejora `dist[v]` solo si `dist[u] + w < dist[v]`. Cierra cada `u` una sola vez (nunca lo reproceses).
- Traduce `Infinity` a `-1` al final. Con pesos no negativos ninguna distancia real es negativa, así que `-1` no colisiona.
- La correctitud depende ENTERAMENTE de que los pesos sean `>= 0` (sección 2.2) — por eso este ejercicio los exige.

## Dijkstra cierra un vértice antes de tiempo cuando hay una arista negativa
type: trace

Considera el grafo dirigido `A → B` (peso 1), `A → C` (peso 2), `C → B` (peso -4). Corres el algoritmo de Dijkstra — sin ningún guard que rechace pesos negativos — partiendo de A, procesando siempre el vértice no visitado con menor distancia estimada. ¿Qué hace con B y por qué el resultado final queda mal?

### Opciones
- [x] Tras procesar A quedan `d[B]=1` y `d[C]=2`; como 1 < 2, Dijkstra extrae y CIERRA B con distancia 1 antes de tocar C, y nunca lo reconsidera — pero el camino real más barato es `A → C → B` = 2 + (-4) = -2, estrictamente menor que 1. Falla porque cierra vértices asumiendo que ningún descubrimiento futuro puede mejorar una distancia ya cerrada, supuesto que la arista negativa `C → B` viola.
- Dijkstra extrae C antes que B, relaja `C → B` a -2 y devuelve -2 correctamente.
- Dijkstra entra en un bucle infinito porque la arista negativa crea un ciclo negativo.
- Dijkstra detecta la arista negativa y lanza un error antes de procesar cualquier vértice.

### Justificación
Es el contraejemplo exacto de la sección 2.4. Al extraer A se relajan `d[B]=1`, `d[C]=2`; la menor estimación entre los no procesados es B (1 < 2), así que Dijkstra lo extrae PRIMERO y lo cierra en 1 — y una vez cerrado, jamás vuelve a relajar sus aristas de entrada, perdiéndose el `A → C → B = -2`. El diagnóstico conecta con dónde se rompe la prueba de la sección 2.2: la correctitud dependía de que "continuar el camino desde el cruce solo puede aumentar la distancia total", garantía válida SOLO con pesos no negativos; la arista `C → B = -4` la REDUCE, justo lo que la prueba prohibía. La opción "extrae C antes que B" describe la OTRA variante del libro (cuando `A → B` vale 5, no 1): ahí C se procesa primero y el resultado sale bien; con `A → B = 1` el orden se invierte y B se cierra mal. No hay bucle infinito: las tres aristas van "hacia adelante" (sin ciclo). Y el algoritmo puro no tiene ningún guard que lance error — el listado del libro añade un `ValueError` defensivo, pero eso es una decisión de implementación, no la conducta inherente del algoritmo (que la sección 2.4 corre "mentalmente" sin guard, precisamente para exhibir la falla).

## El costo de Dijkstra con cola de prioridad
type: complexity

Implementas Dijkstra con un heap binario como cola de prioridad, ignorando entradas obsoletas al extraerlas (el ajuste práctico de la sección 2.3). ¿Cuál es la complejidad total y de dónde sale cada término?

### Opciones
- [x] O((V+E) log V): cada uno de los V vértices se extrae del heap a lo más una vez de forma efectiva (V·log V), y cada una de las E aristas dispara a lo más una inserción cuando relaja con éxito (E·log V); la suma es O((V+E) log V), dominada por el término de las aristas en grafos densos.
- O(V²), porque en cada paso hay que escanear todos los vértices para hallar el mínimo.
- O(E), porque cada arista se relaja exactamente una vez y las operaciones del heap son O(1).
- O(VE), porque cada vértice reconsidera todas las aristas en cada pasada, como Bellman-Ford.

### Justificación
Con un heap, las dos operaciones costosas son las V extracciones del mínimo (cada una O(log V)) y las inserciones al relajar: cada arista relaja con éxito a lo más una vez, empujando una entrada al heap, así que hay hasta E inserciones de O(log V) — total O((V+E) log V), tal como cierra la sección 2.3. El O(V²) es real, pero es el costo de la variante con ESCANEO de arreglo (buscar el mínimo recorriendo todos los vértices) — con un heap la extracción del mínimo es O(log V), no un barrido O(V), así que O(V²) no aplica a la implementación que la pregunta especifica. O(E) ignora el factor log V de cada operación de heap. Y O(VE) confunde a Dijkstra con Bellman-Ford, que NO usa cola de prioridad y relaja todas las aristas V-1 veces.

## Bellman-Ford — lo que Dijkstra no puede: pesos negativos y ciclos negativos
type: code

Si el problema de Dijkstra es que CIERRA vértices prematuramente, la cura (más costosa) es no cerrar nada: relaja TODAS las aristas, repetidamente, V-1 veces. Cualquier camino mínimo simple usa a lo más V-1 aristas, así que V-1 pasadas bastan para propagarlo entero (sección 3.1). Una pasada EXTRA que todavía mejora algo delata un ciclo negativo alcanzable (sección 3.2). Implementa Bellman-Ford con detección de ciclo negativo.

### Especificación
`bellmanFord(n, edges, source)` sobre un grafo DIRIGIDO con `n` vértices `0..n-1`:
- `edges` es la lista de aristas, cada una `[u, v, w]` (de `u` a `v`, peso `w`, que PUEDE ser negativo).
- Relaja las E aristas, V-1 veces. Luego haz una pasada EXTRA: si alguna arista todavía puede relajarse (con `dist[u]` finita), existe un ciclo negativo alcanzable desde `source` → devuelve la cadena `"NEG_CYCLE"`.
- Si NO hay ciclo negativo alcanzable, devuelve un arreglo `dist` de longitud `n` con la distancia mínima a cada vértice, usando `null` para los inalcanzables (las distancias reales pueden ser negativas, así que el centinela de inalcanzable NO puede ser un número).

### Firma
```javascript
function bellmanFord(n, edges, source) {
  // edges = lista de [u, v, w] (w puede ser negativo)
  // devuelve "NEG_CYCLE", o arreglo de distancias con null si inalcanzable
  // tu código
}
```
```python
def bellman_ford(n, edges, source):
    # edges = lista de [u, v, w] (w puede ser negativo)
    # devuelve "NEG_CYCLE", o lista de distancias con None si inalcanzable
    # tu código
    pass
```

### Casos
```json
[
  { "input": [3, [[0, 1, 1], [0, 2, 2], [2, 1, -4]], 0], "expected": [0, -2, 2] },
  { "input": [3, [[0, 1, 1], [1, 2, -1], [2, 1, -1]], 0], "expected": "NEG_CYCLE" },
  { "input": [3, [[0, 1, 4]], 0], "expected": [0, 4, null] },
  { "input": [4, [[0, 1, 5], [0, 2, 2], [2, 1, -3], [1, 3, 1]], 0], "expected": [0, -1, 2, 0] },
  { "input": [1, [], 0], "expected": [0] },
  { "input": [3, [[1, 2, 3], [0, 1, 1]], 1], "expected": [null, 0, 3] },
  { "input": [2, [[0, 0, -1]], 0], "expected": "NEG_CYCLE" }
]
```

### Solución
```javascript
function bellmanFord(n, edges, source) {
  const dist = new Array(n).fill(Infinity);
  dist[source] = 0;
  for (let i = 0; i < n - 1; i++) {
    for (const [u, v, w] of edges) {
      if (dist[u] !== Infinity && dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    }
  }
  for (const [u, v, w] of edges) {
    if (dist[u] !== Infinity && dist[u] + w < dist[v]) return "NEG_CYCLE";
  }
  return dist.map(d => (d === Infinity ? null : d));
}
```
```python
def bellman_ford(n, edges, source):
    INF = float('inf')
    dist = [INF] * n
    dist[source] = 0
    for _ in range(n - 1):
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    for u, v, w in edges:
        if dist[u] != INF and dist[u] + w < dist[v]:
            return "NEG_CYCLE"
    return [None if d == INF else d for d in dist]
```

### Pistas
- Guarda `dist[u] != Infinity` como condición antes de relajar: nunca propagues desde un vértice todavía inalcanzable (sumar a "infinito" es basura).
- Exactamente V-1 pasadas completas — ni más ni menos — porque un camino simple tiene a lo más V-1 aristas (sección 3.1).
- La detección de ciclo negativo es una pasada EXTRA (la V-ésima): si algo AÚN mejora, ninguna distancia finita real podía seguir bajando tras V-1 pasadas, así que hay un ciclo negativo alcanzable.
- El inalcanzable se marca con `null`, no con un número: como las distancias pueden ser negativas, cualquier centinela numérico colisionaría con una distancia real.

## Por qué una mejora tras V-1 pasadas delata un ciclo negativo
type: multiple_choice

Tras V-1 pasadas completas de relajación de Bellman-Ford, todavía existe una arista que puede relajarse (mejorar alguna distancia). ¿Por qué esto es evidencia inequívoca de un ciclo negativo alcanzable, y no simplemente de que hacían falta más pasadas?

### Opciones
- [x] Porque cualquier camino simple usa a lo más V-1 aristas, así que V-1 pasadas bastan para propagar por completo cualquier camino mínimo simple; una mejora adicional significa que el camino "óptimo" necesitaría más de V-1 aristas — es decir, repite un vértice (un ciclo) — y solo un ciclo de peso negativo permite seguir reduciendo el costo dando vueltas.
- Porque la pasada V-ésima siempre encuentra una mejora en cualquier grafo, así que no es realmente una prueba significativa.
- Porque Bellman-Ford necesita exactamente V pasadas, y la V-ésima es solo la última pasada normal de convergencia.
- Porque un ciclo de peso positivo también seguiría mejorando distancias en cada pasada.

### Justificación
El argumento es el de la sección 3.2, deducido de la longitud máxima de un camino simple. Ningún camino simple (sin repetir vértices) en un grafo de V vértices tiene más de V-1 aristas, y V-1 pasadas de relajación completa garantizan propagar arista por arista incluso el camino óptimo más largo posible. Si tras eso ALGO todavía mejora, el "camino" responsable necesita más de V-1 aristas → repite un vértice → contiene un ciclo; y solo si ese ciclo tiene peso negativo puede seguir bajando el costo (dar otra vuelta lo reduce indefinidamente). Un ciclo positivo o cero NO permite mejora: quitarlo nunca empeora el camino, así que el camino simple equivalente ya fue capturado en las V-1 pasadas — por eso la opción del "ciclo positivo" es falsa. En un grafo SIN ciclos negativos la pasada V-ésima no encuentra nada (contra la opción de "siempre encuentra mejora"). Y Bellman-Ford converge en V-1 pasadas; la V-ésima no es una pasada de convergencia sino el DETECTOR.

## La propiedad del corte — por qué T' sigue siendo un árbol de expansión
type: multiple_choice

En la prueba de la propiedad del corte, partes de un MST `T` que NO contiene la arista mínima `e` del corte, le quitas una arista cruzada `e'` de `T` y agregas `e` en su lugar, formando `T'`. ¿Por qué `T'` sigue siendo un árbol de expansión válido (y qué prueba eso sobre `e`)?

### Opciones
- [x] Porque quitar `e'` parte `T` en exactamente dos componentes (un árbol es mínimamente conexo — quitar cualquier arista lo desconecta en dos piezas); como `e` cruza el MISMO corte que cruzaba `e'`, reconecta precisamente esas dos componentes, dejando `T'` conexo y con V-1 aristas — de nuevo un árbol de expansión. Y como `peso(e) <= peso(e')`, se tiene `costo(T') <= costo(T)`, así que `T'` también es un MST y sí contiene `e`.
- Porque `e` tiene peso estrictamente menor que `e'`, y las aristas de menor peso nunca forman ciclos.
- Porque dos aristas cualesquiera de un árbol siempre se pueden intercambiar sin afectar la conectividad.
- Porque `T'` tiene una arista más que `T`, lo que garantiza que siga conexo.

### Justificación
Es el argumento de intercambio de la sección 4.2. Un árbol de expansión tiene exactamente V-1 aristas y es acíclico, así que es mínimamente conexo: quitar `e'` lo divide en EXACTAMENTE dos componentes. Como `e` cruza el mismo corte, sus extremos caen en esas dos componentes distintas, y agregarla las reconecta: `T'` vuelve a ser conexo con V-1 aristas, es decir, un árbol de expansión. El costo cierra la prueba: `costo(T') = costo(T) - peso(e') + peso(e) <= costo(T)` porque `peso(e) <= peso(e')` por ser `e` la mínima que cruza el corte — luego existe un MST que contiene `e`. La opción del "peso menor evita ciclos" confunde dos cosas: la VALIDEZ de `T'` no depende del peso (podrías meter una arista cruzada más cara y seguiría siendo árbol de expansión); el peso solo entra en la comparación de COSTO. "Dos aristas cualesquiera se intercambian" es falso: solo aristas que cruzan el MISMO corte preservan la conectividad. Y `T'` tiene el MISMO número de aristas que `T` (quitaste una, agregaste una), no una más.

## Kruskal con Union-Find — costo total del árbol de expansión mínima
type: code

Kruskal aplica la propiedad del corte GLOBALMENTE: ordena todas las aristas de menor a mayor peso y agrega cada una si y solo si no forma ciclo (sus extremos están en componentes distintas). Para decidir "¿misma componente?" eficientemente se usa Union-Find. Implementa Kruskal que devuelva el COSTO TOTAL del MST — o un centinela si el grafo es desconectado (no existe árbol que abarque todo, solo un bosque; sección 5).

### Especificación
`kruskalCost(n, edges)` sobre un grafo NO DIRIGIDO con `n` vértices `0..n-1`:
- `edges` es la lista de aristas, cada una `[u, v, w]` (peso `w`).
- Devuelve la suma de pesos del MST si el grafo es CONEXO (el MST usa exactamente `n-1` aristas). Si es desconectado, devuelve `-1`.
- Un solo vértice (`n = 1`) ya está "conectado" sin aristas → devuelve `0`.
- Implementa Union-Find internamente: ordena por peso, y para cada arista une sus extremos si están en componentes distintas (si no, la descartas: formaría ciclo). El costo total del MST es único aunque el MST no lo sea (empates, sección 5).

### Firma
```javascript
function kruskalCost(n, edges) {
  // edges = lista de [u, v, w] no dirigidas; devuelve costo total del MST, o -1 si desconectado
  // tu código
}
```
```python
def kruskal_cost(n, edges):
    # edges = lista de [u, v, w] no dirigidas; devuelve costo total del MST, o -1 si desconectado
    # tu código
    pass
```

### Casos
```json
[
  { "input": [4, [[0, 1, 1], [1, 2, 3], [0, 2, 2], [2, 3, 4]]], "expected": 7 },
  { "input": [4, [[0, 1, 1], [1, 2, 1]]], "expected": -1 },
  { "input": [1, []], "expected": 0 },
  { "input": [2, [[0, 1, 5]]], "expected": 5 },
  { "input": [3, [[0, 1, 1], [1, 2, 2], [0, 2, 3]]], "expected": 3 },
  { "input": [4, [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 0, 1], [0, 2, 1]]], "expected": 3 },
  { "input": [2, [[0, 1, 5], [0, 1, 2]]], "expected": 2 },
  { "input": [5, [[0, 1, 1], [1, 2, 1], [3, 4, 1]]], "expected": -1 }
]
```

### Solución
```javascript
function kruskalCost(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  const sorted = edges.slice().sort((a, b) => a[2] - b[2]);
  let total = 0, used = 0;
  for (const [u, v, w] of sorted) {
    const ru = find(u), rv = find(v);
    if (ru !== rv) { parent[ru] = rv; total += w; used++; }
  }
  return used === n - 1 ? total : -1;
}
```
```python
def kruskal_cost(n, edges):
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    total, used = 0, 0
    for u, v, w in sorted(edges, key=lambda e: e[2]):
        ru, rv = find(u), find(v)
        if ru != rv:
            parent[ru] = rv
            total += w
            used += 1
    return total if used == n - 1 else -1
```

### Pistas
- Ordena las aristas por peso ASCENDENTE. Recórrelas y une con Union-Find solo cuando los extremos estén en componentes distintas (evita el ciclo).
- Cuenta cuántas aristas AGREGASTE: un grafo conexo de `n` vértices produce exactamente `n-1`. Si terminas con menos, era desconectado → `-1`.
- El costo total del MST es el mismo aunque haya empates y el MST no sea único (sección 5), así que no necesitas criterio de desempate para el COSTO.
- No mutes `edges`: ordena una copia (`slice()` / `sorted(...)`), o los casos posteriores verían el arreglo reordenado.

## El costo de Bellman-Ford y su trade-off con Dijkstra
type: complexity

Bellman-Ford relaja las E aristas, V-1 veces. ¿Cuál es su complejidad, y qué trade-off concreto la separa de Dijkstra?

### Opciones
- [x] O(VE): V-1 pasadas, cada una relajando las E aristas → (V-1)·E = O(VE). Es asintóticamente más lento que el O((V+E) log V) de Dijkstra, pero es el precio de no cerrar ningún vértice prematuramente — a cambio tolera pesos negativos y detecta ciclos negativos, dos cosas que Dijkstra no puede hacer de forma coherente.
- O((V+E) log V), igual que Dijkstra, porque ambos recorren vértices y aristas.
- O(V+E), porque cada arista se relaja una sola vez en total.
- O(E log V), porque usa una cola de prioridad como Dijkstra.

### Justificación
El costo sale directo de la estructura de la sección 3.1: dos bucles anidados — V-1 pasadas por fuera, E relajaciones por dentro — dan O(VE). La regla de decisión de la sección 6: usa Dijkstra por defecto cuando puedas garantizar pesos no negativos (más rápido); usa Bellman-Ford cuando el dominio admita pesos negativos, aceptando el costo mayor a cambio de correctitud con negativos y detección de ciclos negativos. O(V+E) es el costo de BFS/DFS, donde cada arista se toca UNA vez — Bellman-Ford la relaja V-1 veces, ese es justamente el punto. Bellman-Ford no usa cola de prioridad, así que ni O((V+E) log V) ni O(E log V) aplican: esos son perfiles de Dijkstra/Prim.

## Por qué el MST no te da el camino más corto entre dos vértices
type: multiple_choice

¿Por qué un MST NO garantiza que el camino entre dos vértices específicos, usando solo aristas del MST, sea el camino más corto entre ellos en el grafo original?

### Opciones
- [x] Porque el MST minimiza el costo TOTAL de conectar todos los vértices, no el costo de cada par por separado — por ejemplo, con aristas `A–B = 1`, `B–C = 1`, `A–C = 1.5`, el MST se queda con `{A–B, B–C}` (costo total 2) y descarta `A–C`, así que el camino MST `A → B → C` cuesta 2, mientras que el camino más corto real `A → C` es la arista directa de costo 1.5.
- Porque los MST solo existen para grafos no dirigidos, y los caminos mínimos son un concepto exclusivo de grafos dirigidos.
- Porque el MST siempre excluye la arista individual más barata del grafo.
- Porque Prim y Kruskal producen MSTs distintos, y solo el de Prim respeta los caminos mínimos.

### Justificación
Son dos preguntas genuinamente distintas (sección 4.1): "conectar TODO al menor costo total" no es "el mejor camino entre dos puntos". El ejemplo lo hace concreto: entre las aristas `A–B=1`, `B–C=1`, `A–C=1.5`, Kruskal toma las dos de peso 1 (conectan los tres vértices con costo total 2) y descarta la de 1.5 porque cerraría un ciclo — pero eso deja el camino MST `A→B→C` en 2, peor que la arista directa `A→C` de 1.5. La opción de "solo grafos dirigidos" es falsa: los caminos mínimos se definen igual en grafos no dirigidos. El MST NO excluye la arista más barata — al contrario, Kruskal la procesa primero y casi siempre la incluye; excluye las que forman ciclo. Y no es cuestión de Prim vs Kruskal: TODOS los MSTs tienen el mismo costo total y NINGUNO garantiza caminos mínimos por pares.
