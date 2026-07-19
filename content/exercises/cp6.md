---
module_id: cd000000-0000-4000-8000-000000000006
spine: Competitiva
title: Ejercicios — Grafos competitivos
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp6-grafos-competitivos.md)
version: 1
---

# Grafos competitivos — banco de reconocimiento

Banco de reflejo bajo el reloj: cada ejercicio entrena ver el grafo escondido en un enunciado que no dice "grafo", elegir BFS o DFS por la pregunta, esquivar las trampas de rendimiento (marcar visitado al encolar, límites antes del acceso, recursión que desborda), y teclear la plantilla como función pura. Anclado a lo que el libro `cp6-grafos-competitivos` realmente enseña — no a teoría (esa ya la sabes) ni a trivia. Los dos ejercicios de código son drills de plantilla: entrenan el patrón como función pura, NO son un juez de contest ni emiten veredicto.

## El reflejo — "número mínimo de movimientos" en un tablero
type: multiple_choice

Lees: "Dado un tablero de R×C con casillas libres y muros, ¿cuál es el número mínimo de movimientos (arriba/abajo/izquierda/derecha) para llegar de la casilla inicial a la meta?". Bajo el reloj, ¿qué reflejo es el correcto y por qué?

### Opciones
- [x] BFS sobre un grafo implícito: cada casilla libre es un nodo, cada movimiento válido a una vecina es una arista de peso uniforme, y BFS da el camino más corto en número de aristas — exactamente "mínimo número de movimientos".
- DFS recursivo desde la casilla inicial, porque explorar en profundidad siempre encuentra el camino más corto primero.
- DSU/Union-Find, uniendo cada casilla con sus vecinas y consultando la distancia entre inicio y meta.
- Ordenar las casillas por distancia a la meta y tomarlas greedy en ese orden.

### Justificación
Es la primera señal de "Gritan BFS": "número mínimo de movimientos/pasos para llegar de A a B" sin pesos distintos por movimiento (todos cuestan lo mismo). El grid es el grafo implícito por excelencia (sección 3 y la habilidad central del módulo): celda = nodo, movimiento válido = arista. BFS explora por niveles y por eso el primer momento en que alcanza la meta es con el mínimo de aristas. DFS NO da caminos mínimos —explora en profundidad, puede llegar a la meta por un camino largo antes que por el corto—; ese es justo el error que el módulo previene. DSU responde conectividad (¿están conectadas?), no distancia mínima (señal de alerta de CP5). Y no hay un orden greedy que resuelva el camino más corto en un grid con muros.

## Ver el grafo escondido — cuando no hay tablero
type: multiple_choice

Un enunciado describe un rompecabezas: partes de una configuración inicial y, en cada paso, puedes aplicar uno de varios movimientos legales que transforman la configuración; quieres el mínimo número de movimientos para llegar a una configuración objetivo. No hay ningún grid ni mapa físico. ¿Cómo modelas esto para aplicar BFS?

### Opciones
- [x] Cada configuración distinta es un nodo; cada movimiento legal que lleva de una configuración a otra es una arista; BFS sobre ese espacio de estados da el mínimo número de movimientos. Lo único nuevo por escribir es `generar_vecinos`, que produce las configuraciones alcanzables en un movimiento.
- No se puede aplicar BFS sin un grid físico; el problema requiere programación dinámica desde el inicio.
- Cada movimiento legal es un nodo y cada configuración es una arista entre movimientos consecutivos.
- Se numeran las configuraciones del 1 al k y se corre BFS sobre esa numeración lineal como si fuera una lista.

### Justificación
Es la generalización de la sección 3, "Estados como nodos", que el libro llama "el patrón más subestimado en contest": cuando una configuración cambia mediante movimientos legales, cada configuración distinta es un nodo y cada movimiento es una arista, y BFS da el mínimo número de movimientos — el MISMO algoritmo de la sección 1, solo que tu "posición" es una tupla/string que representa el estado completo y las distancias viven en un hashmap en vez de una matriz 2D. La habilidad central del módulo es preguntarte "¿cuáles son los nodos y cuáles las aristas, aunque el enunciado no use esas palabras?". Invertir nodos y aristas no modela nada coherente; numerar linealmente ignora la estructura de vecindad real (las transiciones legales); y afirmar que hace falta un grid físico contradice justo el punto de la sección 3.

## BFS o DFS — dejar que la pregunta decida
type: multiple_choice

Tienes cuatro problemas sobre el mismo grafo ya construido. ¿En cuál de ellos el reflejo correcto es BFS (y no DFS), según el criterio del libro para elegir entre ambos?

### Opciones
- [x] "¿Cuál es el mínimo número de aristas en un camino del nodo A al nodo B?" (aristas sin peso).
- "¿Existe un ciclo en el grafo?"
- "¿En qué orden topológico se pueden procesar las tareas con dependencias?"
- "¿Cuántas regiones/islas conexas hay en el grid?"

### Justificación
El criterio de "Trade-offs" es directo: si la pregunta es "el mínimo número de X" (aristas, pasos, movimientos) en aristas no ponderadas, BFS casi siempre; si es "existe un camino/ciclo" o "en qué orden", DFS casi siempre. El mínimo número de aristas entre A y B es precisamente el caso de BFS (explora por niveles → primer alcance = mínimo). Detectar un ciclo y producir un orden topológico son las dos aplicaciones canónicas listadas bajo "Gritan DFS" ("existe" y "en qué orden"). Contar regiones/islas es flood fill: funciona con BFS o DFS, pero el módulo la clasifica como la aplicación típica de DFS, no como un problema de mínimo — no pide una distancia mínima, así que no es el reflejo de BFS. Solo el primero pide un mínimo sobre aristas uniformes, la firma de BFS.

## Marcar visitado en el momento equivocado
type: trace

Escribes BFS pero marcas cada nodo como "visitado" cuando lo DESENCOLAS (al sacarlo de la cola para procesarlo), no cuando lo encolas. Los tests chicos pasan. En un grid grande y muy conectado obtienes TLE o te quedas sin memoria. ¿Cuál es el diagnóstico y la corrección?

### Opciones
- [x] Entre el instante en que un nodo se encola y el instante en que se procesa, otros vecinos pueden volver a encolarlo varias veces (aún no está marcado), inflando la cola y reprocesando; BFS se degrada muy por debajo de O(V+E). La corrección: marcar visitado en el instante EXACTO en que agregas a la cola.
- El resultado de distancias queda incorrecto porque desencolar en orden de inserción rompe la exploración por niveles; hay que usar una pila en vez de una cola.
- El problema es que usas una cola en vez de recursión; BFS solo es eficiente implementado recursivamente.
- Marcar al desencolar hace que algunos nodos alcanzables nunca se visiten, así que faltan casillas en el resultado.

### Justificación
Es la trampa número uno de BFS en contest ("No marcar visitado al encolar"): si marcas solo al desencolar, el mismo nodo puede encolarse múltiples veces antes de procesarse la primera vez, y en el peor caso esto degrada BFS de O(V+E) a mucho peor, con explosión de memoria en grids grandes. La plantilla de la sección 1 lo resuelve con `distancia[nr][nc] == -1` cumpliendo doble rol —marca "no visitado" Y evita reprocesar— asignando la distancia (que marca) en el momento de encolar. No es un problema de correctitud del orden (la cola sigue siendo lo correcto para BFS, no una pila); no tiene que ver con recursión; y no faltan nodos —al contrario, sobran encolamientos del mismo nodo.

## El acceso al grid que truena (o algo peor)
type: trace

En el bucle de BFS escribes la condición de vecino así: `if grid[nr][nc] != '#' and 0 <= nr < filas and 0 <= nc < cols and distancia[nr][nc] == -1`. Es decir, accedes a `grid[nr][nc]` ANTES de verificar que `nr, nc` caen dentro del tablero. ¿Qué pasa y cómo se corrige?

### Opciones
- [x] Cuando un vecino cae fuera del tablero, `grid[nr][nc]` se evalúa con índices inválidos: en Python lanza IndexError (o, con negativos, indexa por atrás dando un resultado silenciosamente incorrecto); en C++ es comportamiento indefinido. La corrección: verificar los límites PRIMERO y apoyarse en el cortocircuito de `&&`/`and` para que el acceso al grid nunca se evalúe si los límites ya fallaron.
- No pasa nada: el orden de las condiciones en un `and`/`&&` es irrelevante porque todas se evalúan de todos modos antes de decidir.
- El BFS da distancias incorrectas pero no truena, porque acceder fuera de rango siempre devuelve un muro `'#'`.
- El problema solo aparece en el nodo inicial; para el resto de los nodos los índices siempre son válidos.

### Justificación
Es la trampa "Grid con índices fuera de rango": acceder `grid[nr][nc]` antes de verificar límites causa error de índice (o, peor en C++, comportamiento indefinido que puede no truene de inmediato). La defensa es verificar los límites primero con evaluación de cortocircuito, de modo que el acceso al grid nunca se evalúe si `0 <= nr < filas && 0 <= nc < cols` ya falló — exactamente el orden de la plantilla de la sección 1 ("CRITICO: verifica limites ANTES de acceder grid[nr][nc]"). El orden SÍ importa por el cortocircuito. En Python un índice negativo no truena sino que indexa desde el final —un bug silencioso, aún peor que el crash— así que "siempre devuelve un muro" es falso. Y el problema aparece en CUALQUIER nodo en el borde del tablero, no solo en el inicial.

## DFS recursivo que se desmaya sin avisar
type: trace

Escribes DFS recursivo (la función se llama a sí misma por cada vecino no visitado) y lo usas como default. El grafo de la prueba grande es esencialmente una cadena larga: 1 → 2 → 3 → ... → 10^6. Los casos chicos pasan; el grande falla con un error de desbordamiento de pila (o un crash sin mensaje claro). ¿Cuál es la causa y el default que el libro recomienda?

### Opciones
- [x] Una cadena de 10^6 nodos obliga a la recursión a anidar ~10^6 llamadas, desbordando la pila de llamadas del lenguaje. El default en contest es DFS ITERATIVO con una pila explícita en el heap, que no tiene ese límite; la recursión se reserva solo cuando la profundidad máxima está garantizada como pequeña.
- La causa es que DFS no puede recorrer cadenas lineales; para grafos en forma de cadena hay que usar BFS obligatoriamente.
- El desbordamiento ocurre porque olvidaste marcar visitado, y sin eso la recursión entra en un ciclo infinito sobre la cadena.
- El crash es aleatorio y depende de la memoria libre del sistema; no hay forma de prevenirlo desde el código.

### Justificación
Es la trampa "Recursión de DFS desbordando la pila" (sección 2 y Trampas): un grafo con una cadena larga (n hasta 10^5–10^6, común en límites de contest) puede desbordar la pila de llamadas recursiva; en C++ el límite es más generoso que en Python pero sigue siendo un riesgo real con n grande. La versión iterativa con pila explícita en el heap no tiene ese límite —por eso el libro dice "memoriza la versión iterativa como tu default" y usa recursión solo si la profundidad máxima es garantizadamente pequeña. No es que DFS no pueda con cadenas (sí puede, iterativo); no es falta de marcar visitado (una cadena simple sin ciclos no genera bucle infinito, y aun marcando visitado la recursión anida igual); y no es aleatorio: es determinista según la profundidad de la cadena.

## El costo de un recorrido completo
type: complexity

Corres BFS (o DFS) sobre un grafo con V nodos y E aristas, marcando visitado al encolar como manda la plantilla. ¿Cuál es la complejidad temporal del recorrido completo y por qué?

### Opciones
- [x] O(V + E): cada nodo se encola y procesa exactamente una vez (gracias a marcarlo al visitarlo), y por cada nodo se examinan sus aristas incidentes una sola vez, de modo que el trabajo total sobre aristas suma E (o 2E en un grafo no dirigido).
- O(V · E), porque por cada nodo se recorren todas las aristas del grafo.
- O(V²) siempre, independientemente del número de aristas.
- O(V log V), por el costo de mantener la cola ordenada por distancia.

### Justificación
Marcar visitado al encolar garantiza que cada nodo entra a la cola/pila una sola vez, y al procesarlo se examinan solo sus aristas incidentes; sumando sobre todos los nodos, el trabajo de aristas es O(E). De ahí el clásico O(V + E) de un recorrido BFS/DFS. O(V·E) supondría recorrer TODAS las aristas por cada nodo —justo lo que marcar visitado evita. O(V²) solo coincide con O(V+E) en un grafo denso representado por matriz de adyacencia, no en general. Y O(V log V) implicaría una cola de prioridad ordenada por distancia —eso es Dijkstra con pesos, no el BFS de aristas uniformes de este módulo: la cola de BFS es FIFO simple, sin ordenar.

## BFS sobre estados — cuándo el espacio te rebasa
type: complexity

Aplicas BFS de estados (sección 3): cada configuración es un nodo y desde cada una generas hasta b vecinos (movimientos legales). Si el número total de estados alcanzables es S, ¿cuál es el costo del BFS, y qué señal te dice que este enfoque directo puede no ser viable?

### Opciones
- [x] O(S · b): visitas cada uno de los S estados una vez y en cada uno generas hasta b vecinos. La señal de alerta es que S sea astronómicamente grande —entonces ni el tiempo ni la memoria del hashmap de distancias alcanzan, y necesitas otra técnica (DP sobre un subconjunto relevante, o poda agresiva).
- O(b) constante, porque BFS solo explora los vecinos inmediatos del estado inicial.
- O(log S), porque el hashmap de distancias hace cada búsqueda logarítmica.
- O(S²), porque por cada estado hay que comparar contra todos los demás estados ya visitados.

### Justificación
En BFS de estados cada estado se visita una vez y genera hasta b vecinos, de ahí O(S·b) (S = número de estados alcanzables, b = factor de ramificación). La sección "Trade-offs" marca la señal clave: si el espacio de estados es astronómicamente grande, BFS ingenuo no alcanza (tiempo y memoria) y hace falta otra técnica —frecuentemente DP sobre un subconjunto relevante, o poda agresiva—; reconocer cuándo el espacio es demasiado grande es, en sí, parte del reflejo que el módulo entrena. O(b) ignora que BFS explora TODO el espacio alcanzable, no solo el primer nivel. El hashmap da búsquedas O(1) amortizado, no O(log S), y de todas formas ese no es el término dominante. Y no comparas cada estado contra todos los demás (eso sería O(S²)): el hashmap te dice en O(1) si un estado ya se vio.

## Plantilla — distancia mínima en un grid con muros
type: code

El drill estrella de la sección 1: BFS sobre un grafo implícito (celda = nodo, movimiento válido = arista). Implementa como función PURA el mínimo número de movimientos 4-direccionales de `start` a `target` por casillas libres, o −1 si es inalcanzable. Marca la distancia (= marcar visitado) EN EL MOMENTO DE ENCOLAR, y verifica los límites ANTES de acceder al grid.

### Especificación
`bfsDistance(grid, start, target)`:
- `grid` es una lista de strings del mismo largo; cada carácter es `.` (libre) o `#` (muro).
- `start` y `target` son pares `[fila, columna]` (0-indexados).
- Movimiento permitido: 4-direccional (arriba, abajo, izquierda, derecha) hacia casillas libres dentro del tablero.
- Devuelve el mínimo número de movimientos de `start` a `target`, o −1 si `target` es inalcanzable.
- Casos borde: `start == target` → 0; si la casilla de `start` es muro → −1; si `target` es muro o está encerrado → −1.

### Firma
```javascript
function bfsDistance(grid, start, target) {
  // TODO: BFS en grid; mínimo de movimientos start->target, o -1
}
```
```python
def bfs_distance(grid, start, target):
    # TODO: BFS en grid; mínimo de movimientos start->target, o -1
    pass
```

### Casos
```json
[
  { "input": [["...", "...", "..."], [0, 0], [0, 0]], "expected": 0 },
  { "input": [["...", "...", "..."], [0, 0], [2, 2]], "expected": 4 },
  { "input": [[".#.", ".#.", "..."], [0, 0], [0, 2]], "expected": 6 },
  { "input": [[".#", "#."], [0, 0], [1, 1]], "expected": -1 },
  { "input": [["."], [0, 0], [0, 0]], "expected": 0 },
  { "input": [["#"], [0, 0], [0, 0]], "expected": -1 },
  { "input": [["..", ".#"], [0, 0], [1, 1]], "expected": -1 },
  { "input": [["...", "...", "..."], [0, 0], [1, 2]], "expected": 3 }
]
```

### Solución
```javascript
function bfsDistance(grid, start, target) {
  const R = grid.length;
  if (R === 0) return -1;
  const C = grid[0].length;
  const [sr, sc] = start;
  const [tr, tc] = target;
  if (sr < 0 || sr >= R || sc < 0 || sc >= C) return -1;
  if (grid[sr][sc] === "#") return -1;
  const dist = Array.from({ length: R }, () => new Array(C).fill(-1));
  dist[sr][sc] = 0;
  const queue = [[sr, sc]];
  let head = 0;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (head < queue.length) {
    const [r, c] = queue[head++];
    if (r === tr && c === tc) return dist[r][c];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      // límites PRIMERO (cortocircuito), luego muro, luego no visitado
      if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] !== "#" && dist[nr][nc] === -1) {
        dist[nr][nc] = dist[r][c] + 1; // marcar al encolar
        queue.push([nr, nc]);
      }
    }
  }
  return -1;
}
```
```python
from collections import deque


def bfs_distance(grid, start, target):
    R = len(grid)
    if R == 0:
        return -1
    C = len(grid[0])
    sr, sc = start
    tr, tc = target
    if sr < 0 or sr >= R or sc < 0 or sc >= C:
        return -1
    if grid[sr][sc] == "#":
        return -1
    dist = [[-1] * C for _ in range(R)]
    dist[sr][sc] = 0
    queue = deque([(sr, sc)])
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    while queue:
        r, c = queue.popleft()
        if r == tr and c == tc:
            return dist[r][c]
        for dr, dc in dirs:
            nr, nc = r + dr, c + dc
            # límites PRIMERO (cortocircuito), luego muro, luego no visitado
            if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] != "#" and dist[nr][nc] == -1:
                dist[nr][nc] = dist[r][c] + 1  # marcar al encolar
                queue.append((nr, nc))
    return -1
```

### Pistas
- `dist[nr][nc] == -1` cumple doble rol: "no visitado" Y "aún sin distancia"; asígnalo al ENCOLAR, no al desencolar.
- Verifica `0 <= nr < R && 0 <= nc < C` ANTES de leer `grid[nr][nc]` — el cortocircuito evita el acceso fuera de rango.
- Devuelve la distancia en cuanto desencolas la meta; si la cola se vacía sin alcanzarla, es −1 (inalcanzable). No olvides el caso `start` sobre un muro.

## Plantilla — contar regiones conexas (flood fill)
type: code

La aplicación más directa de DFS/BFS: contar cuántas regiones conexas de casillas `.` hay en un grid (islas). Implementa el flood fill como función PURA: barre el grid, y cada vez que encuentras una casilla `.` no visitada, suma una región y hunde (marca) toda su componente antes de seguir.

### Especificación
`countRegions(grid)`:
- `grid` es una lista de strings del mismo largo; `.` es tierra, `#` es agua/muro.
- Dos casillas `.` pertenecen a la misma región si están conectadas por adyacencia 4-direccional (arriba/abajo/izquierda/derecha).
- Devuelve el número de regiones conexas de `.`.
- Casos borde: todo muro → 0; una sola casilla `.` → 1; casillas `.` aisladas entre muros cuentan cada una como su propia región.

### Firma
```javascript
function countRegions(grid) {
  // TODO: cuenta regiones conexas de '.' (flood fill 4-direccional)
}
```
```python
def count_regions(grid):
    # TODO: cuenta regiones conexas de '.' (flood fill 4-direccional)
    pass
```

### Casos
```json
[
  { "input": [["..", "##"]], "expected": 1 },
  { "input": [["#.#", ".#.", "#.#"]], "expected": 4 },
  { "input": [["###", "###"]], "expected": 0 },
  { "input": [["."]], "expected": 1 },
  { "input": [["#"]], "expected": 0 },
  { "input": [["...", "...", "..."]], "expected": 1 },
  { "input": [["..#", "..#", "###"]], "expected": 1 },
  { "input": [[".#.", "#.#", ".#."]], "expected": 5 }
]
```

### Solución
```javascript
function countRegions(grid) {
  const R = grid.length;
  if (R === 0) return 0;
  const C = grid[0].length;
  const visited = Array.from({ length: R }, () => new Array(C).fill(false));
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let regions = 0;
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      if (grid[i][j] === "." && !visited[i][j]) {
        regions++;
        const stack = [[i, j]]; // DFS iterativo (pila explícita en el heap)
        visited[i][j] = true;
        while (stack.length > 0) {
          const [r, c] = stack.pop();
          for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] === "." && !visited[nr][nc]) {
              visited[nr][nc] = true; // marcar al apilar
              stack.push([nr, nc]);
            }
          }
        }
      }
    }
  }
  return regions;
}
```
```python
def count_regions(grid):
    R = len(grid)
    if R == 0:
        return 0
    C = len(grid[0])
    visited = [[False] * C for _ in range(R)]
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    regions = 0
    for i in range(R):
        for j in range(C):
            if grid[i][j] == "." and not visited[i][j]:
                regions += 1
                stack = [(i, j)]  # DFS iterativo (pila explícita en el heap)
                visited[i][j] = True
                while stack:
                    r, c = stack.pop()
                    for dr, dc in dirs:
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < R and 0 <= nc < C and grid[nr][nc] == "." and not visited[nr][nc]:
                            visited[nr][nc] = True  # marcar al apilar
                            stack.append((nr, nc))
    return regions
```

### Pistas
- Cada casilla `.` no visitada que encuentras en el barrido inicia exactamente una región nueva: suma 1 y luego hunde toda su componente.
- Marca `visited` al APILAR (igual que BFS marca al encolar) para no reprocesar ni recontar la misma casilla.
- Usa pila explícita (DFS iterativo) como default: en un grid grande, la recursión podría desbordar la pila de llamadas.
