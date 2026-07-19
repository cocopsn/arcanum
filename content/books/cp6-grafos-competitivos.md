---
module_id: cp6-grafos-competitivos
spine: Competitiva
title: "Grafos competitivos"
subtitle: "Ver el grafo escondido en el enunciado"
source_canonical: "USACO Guide (Silver — Graph Traversal, DFS); CSES graph section"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 22
---

# Grafos competitivos

> **Pregunta raíz.** Ya construiste la teoría completa de BFS, DFS, y sus propiedades en tu estudio profundo (ITC C6/C7) — la prueba de por qué BFS da camino más corto, por qué el orden de finalización invertido de DFS da orden topológico. **Este libro no repite esa teoría.** Este libro entrena algo distinto y, en contest, igual de crítico: reconocer que un problema que **no menciona la palabra "grafo" en ningún lado** es, en realidad, un grafo disfrazado — un grid es un grafo, un conjunto de estados alcanzables es un grafo, una relación de dependencias es un grafo — y teclear el recorrido correcto en minutos, no en media hora.

## Prólogo

La diferencia entre este módulo y tu estudio de teoría es exactamente la diferencia entre entender por qué algo funciona y poder ejecutarlo bajo presión de tiempo sin releer nada. Aquí no vas a re-derivar por qué BFS da caminos mínimos — vas a entrenar el reflejo de, en cuanto leas "grid" o "número mínimo de movimientos", reconocer inmediatamente "esto es BFS sobre un grafo implícito" y escribir el código sin fricción.

---

## Señales de reconocimiento

**Gritan BFS:**
- "número mínimo de movimientos/pasos para llegar de A a B" (sin pesos distintos por movimiento — todos cuestan lo mismo)
- grids con movimientos en 4 u 8 direcciones, laberintos, "el camino más corto en un tablero"
- "estados alcanzables en el menor número de transformaciones" — cualquier problema donde el "grafo" son estados abstractos, no posiciones físicas

**Gritan DFS:**
- "cuenta el número de regiones/islas conectadas" en un grid — flood fill, la aplicación más directa de DFS/BFS sobre grids
- detección de ciclos, orden topológico, componentes conexas — exactamente las aplicaciones que ya conoces de tu estudio de teoría, aquí bajo la presión de reconocerlas rápido
- "dependencias entre tareas" que sugieren un DAG y requieren orden topológico

**La habilidad central de este módulo — ver el grafo escondido**: pregúntate siempre, ante cualquier enunciado, **¿cuáles son los "nodos" y cuáles son las "aristas" aquí, aunque el enunciado no use esas palabras?** Un grid: cada celda es un nodo, cada movimiento válido a una celda vecina es una arista. Un conjunto de configuraciones de un rompecabezas: cada configuración es un nodo, cada movimiento legal es una arista. Una lista de prerequisitos entre cursos: cada curso es un nodo, cada prerequisito es una arista dirigida. **En cuanto identifiques nodos y aristas, el resto es la plantilla que ya conoces.**

---

## 1. Plantilla — BFS en grid (la aplicación más común en contest)

```python
from collections import deque

def bfs_grid(grid, inicio):
    filas, cols = len(grid), len(grid[0])
    distancia = [[-1] * cols for _ in range(filas)]
    fi, fc = inicio
    distancia[fi][fc] = 0
    cola = deque([inicio])
    direcciones = [(-1,0),(1,0),(0,-1),(0,1)]   # 4-direccional; agrega diagonales si aplica

    while cola:
        r, c = cola.popleft()
        for dr, dc in direcciones:
            nr, nc = r + dr, c + dc
            # CRITICO: verifica limites ANTES de acceder grid[nr][nc]
            if 0 <= nr < filas and 0 <= nc < cols and grid[nr][nc] != '#' and distancia[nr][nc] == -1:
                distancia[nr][nc] = distancia[r][c] + 1
                cola.append((nr, nc))

    return distancia
```

```cpp
vector<vector<int>> bfsGrid(vector<string>& grid, pair<int,int> inicio) {
    int filas = grid.size(), cols = grid[0].size();
    vector<vector<int>> dist(filas, vector<int>(cols, -1));
    queue<pair<int,int>> cola;
    dist[inicio.first][inicio.second] = 0;
    cola.push(inicio);
    int dr[] = {-1, 1, 0, 0};
    int dc[] = {0, 0, -1, 1};

    while (!cola.empty()) {
        auto [r, c] = cola.front(); cola.pop();
        for (int i = 0; i < 4; i++) {
            int nr = r + dr[i], nc = c + dc[i];
            if (nr >= 0 && nr < filas && nc >= 0 && nc < cols &&
                grid[nr][nc] != '#' && dist[nr][nc] == -1) {
                dist[nr][nc] = dist[r][c] + 1;
                cola.push({nr, nc});
            }
        }
    }
    return dist;
}
```

**Nota que `distancia[nr][nc] == -1` cumple dos roles a la vez**: marca "no visitado" Y evita reprocesar. Esto es exactamente **marcar como visitado en el momento de encolar**, no al desencolar — cubierto explícitamente en Trampas porque es la fuente número uno de TLE en BFS de contest.

---

## 2. Plantilla — DFS iterativo (para evitar desbordar la pila)

```python
def dfs_iterativo(grafo, inicio):
    visitado = set([inicio])
    pila = [inicio]
    orden = []
    while pila:
        u = pila.pop()
        orden.append(u)
        for v in grafo[u]:
            if v not in visitado:
                visitado.add(v)   # marcar AL ENCOLAR, no al desencolar
                pila.append(v)
    return orden
```

**Por qué iterativo, no recursivo, como plantilla por defecto en contest**: un grafo con una cadena larga (n hasta 10⁵-10⁶, común en límites de contest) puede desbordar la pila de llamadas recursiva del lenguaje — en C++ el límite es más generoso que en Python, pero sigue siendo un riesgo real con n grande. La versión iterativa con pila explícita en el heap no tiene ese límite. **Memoriza la versión iterativa como tu default**, y usa recursión solo si estás seguro de que la profundidad máxima es pequeña.

---

## 3. Estados como nodos — la generalización que más vale la pena entrenar

El patrón más subestimado en contest: el "grafo" no siempre son posiciones físicas. Si un problema describe una configuración que cambia mediante movimientos legales (un rompecabezas deslizante, una secuencia de transformaciones válidas de un string, un conjunto de valores alcanzables aplicando operaciones permitidas), **cada configuración distinta es un nodo**, y BFS sobre ese espacio de estados te da el mínimo número de movimientos para llegar de una configuración a otra — exactamente el mismo algoritmo de la sección 1, solo que en vez de `grid[r][c]`, tu "posición" es una tupla o string que representa el estado completo, y tu diccionario de distancias es un hashmap en vez de una matriz 2D.

```python
def bfs_estados(estado_inicial, generar_vecinos, es_objetivo):
    distancia = {estado_inicial: 0}
    cola = deque([estado_inicial])
    while cola:
        actual = cola.popleft()
        if es_objetivo(actual):
            return distancia[actual]
        for vecino in generar_vecinos(actual):
            if vecino not in distancia:
                distancia[vecino] = distancia[actual] + 1
                cola.append(vecino)
    return -1   # objetivo inalcanzable
```

**El reflejo a entrenar**: en cuanto un enunciado describa "movimientos legales entre configuraciones" sin mencionar un grid físico, reconoce que es exactamente este patrón — la única parte nueva del problema es escribir `generar_vecinos` correctamente para ese dominio específico.

---

## Trampas de contest

**No marcar visitado al encolar (BFS explota)**: si marcas "visitado" solo cuando desencolas (en vez de en el momento en que agregas a la cola), el mismo nodo puede encolarse múltiples veces antes de ser procesado la primera vez — en el peor caso, esto degrada BFS de O(V+E) a mucho peor, y en grids grandes puede directamente causar TLE o consumo excesivo de memoria. **Marca visitado en el instante exacto en que agregas a la cola**, no después.

**Recursión de DFS desbordando la pila**: ya cubierto en la sección 2 — usa la versión iterativa como default en contest si el límite de n no garantiza explícitamente que la profundidad es pequeña.

**Grid con índices fuera de rango**: acceder `grid[nr][nc]` **antes** de verificar que `nr, nc` están dentro de los límites del grid causa un error de índice fuera de rango (o, peor en C++, comportamiento indefinido que puede no truene inmediatamente) — siempre verifica los límites **primero**, con evaluación de cortocircuito (`&&`) para que el acceso al grid nunca se evalúe si los límites ya fallaron.

---

## Trade-offs

**BFS vs. DFS según qué necesitas**: BFS para camino más corto en aristas no ponderadas o exploración por niveles; DFS para explorar completamente, detectar ciclos, o cuando el orden de descubrimiento en sí mismo importa (orden topológico). Si la pregunta del problema es "el mínimo número de X", BFS casi siempre. Si es "existe un camino/ciclo" o "en qué orden", DFS casi siempre.

**Grafo explícito vs. grafo de estados**: cuando el espacio de estados es pequeño y enumerable (n ≤ algunas decenas de miles de estados posibles), BFS de estados (sección 3) es directo. Si el espacio de estados es astronómicamente grande, necesitas otra técnica (frecuentemente DP sobre un subconjunto relevante del espacio, o poda agresiva) — reconocer cuándo el espacio de estados es demasiado grande para BFS ingenuo es, en sí mismo, parte del reflejo que este módulo entrena.

---

## Conexiones

**Con tu estudio de teoría (ITC C6/C7) — relacionado, otra naturaleza**: la prueba rigurosa de por qué BFS da caminos mínimos, la derivación completa de orden topológico, la propiedad del corte de MST — todo eso ya lo dominas de tu estudio profundo. Este módulo no repite esa prueba; entrena el reflejo de **reconocer rápido** dónde aplica, sin tener que rederivar nada bajo presión de tiempo. Son dos naturalezas de conocimiento distintas sobre el mismo contenido: comprensión de primer principio vs. reflejo de reconocimiento — necesitas ambas, pero se entrenan de forma distinta.

**Con DSU (CP5)**: BFS/DFS y DSU responden preguntas de conectividad con mecanismos distintos — BFS/DFS cuando el grafo completo ya existe y lo exploras una vez; DSU cuando las conexiones se agregan incrementalmente en el tiempo.

**Con DP (CP7)**: BFS sobre un espacio de estados y DP sobre estados comparten la misma idea de fondo (un espacio de configuraciones, transiciones entre ellas) — la diferencia es que BFS busca el camino más corto en número de transiciones sin pesos, mientras DP típicamente optimiza un valor acumulado (costo, conteo) que puede no ser simplemente "número de pasos". Si tu problema de "estados" tiene pesos o valores a optimizar más allá de contar pasos, probablemente es DP, no BFS.

---

## Síntesis

1. La teoría de BFS/DFS ya la sabes — este módulo entrena reconocer el grafo escondido en un enunciado que no usa la palabra "grafo", y teclear la plantilla rápido.
2. Grids son grafos (celdas = nodos, movimientos válidos = aristas); espacios de estados son grafos (configuraciones = nodos, transiciones legales = aristas) — el mismo BFS/DFS aplica a ambos con el mismo código, solo cambia qué representa un "nodo".
3. Marca visitado **al encolar**, nunca al desencolar — la trampa de rendimiento más común de BFS en contest.
4. Usa DFS iterativo por defecto si n es grande — la recursión puede desbordar la pila sin ningún aviso hasta que truena.

---

## Problemas para resolver

1. Un problema clásico de "número mínimo de movimientos en un grid con obstáculos" filtrado por el tag **BFS** o **shortest path** de rating bajo (~1000-1200) en Codeforces — la plantilla de la sección 1, tal cual.
2. **CSES — Labyrinth** (Graph Algorithms): BFS en grid con reconstrucción del camino, no solo la distancia — practica guardar predecesores además de distancias.
3. **CSES — Counting Rooms** (Graph Algorithms): flood fill / conteo de componentes conexas en un grid — la aplicación de DFS/BFS más directa de "contar regiones".
4. Un problema de espacio de estados (rompecabezas deslizante pequeño, transformaciones de string con movimientos limitados) filtrado por **BFS** en Codeforces — entrena reconocer y aplicar la generalización de la sección 3 fuera del contexto de un grid físico.
5. **CSES — Building Roads** o un problema equivalente de "componentes conexas + conectar todo con el mínimo de aristas nuevas" — combina BFS/DFS de componentes con una decisión greedy simple de cuántas aristas agregar.

---

## Fuentes

- USACO Guide, sección Silver — Graph Traversal, DFS: https://usaco.guide/silver/graph-traversal
- CSES Problem Set, sección Graph Algorithms: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `graphs` / `shortest paths`: https://codeforces.com/problemset?tags=graphs
