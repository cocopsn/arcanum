---
module_id: oa-8-graphs-grid
spine: OA Amazon
title: "Grafos y Grids"
subtitle: "El grafo escondido en la cuadrícula"
source_canonical: "itc-c6-grafos-i; cp6-grafos-competitivos; patrones Amazon-tagged de Rotting Oranges, Number of Islands, Course Schedule (Kahn), robot con estado de batería"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 42
---

# Grafos y Grids

> **Pregunta raíz.** Un enunciado de Amazon casi nunca dice "esto es un grafo". Te va a describir un almacén como una cuadrícula con pasillos bloqueados, una red de dependencias de instalación de paquetes, o un robot repartidor con batería limitada — y tu trabajo es reconocer que, debajo de esa historia, hay nodos y aristas esperando a que apliques exactamente el BFS o DFS que ya dominas de primer principio. La pieza nueva que este módulo agrega no es el algoritmo — es reconocer que **el "nodo" a veces no es una casilla del grid, es un estado completo** (posición más algo más, como batería restante), y que BFS sobre ese espacio de estados es el mismo algoritmo, solo con una noción más rica de "dónde estoy".

## Prólogo

La teoría completa de BFS/DFS —la prueba de por qué BFS da camino más corto, el orden topológico deducido desde DFS— ya la tienes de primer principio en `itc-c6-grafos-i`, y el reflejo de "ver el grafo escondido" en grids y espacios de estados ya lo entrenaste en `cp6-grafos-competitivos`. Este módulo no repite ninguna de las dos — te da la capa específica de reconocimiento que Amazon favorece: grids con reglas de negocio, propagación tipo "naranjas podridas", dependencias con Kahn, y el salto a estados 3D cuando una sola dimensión (fila, columna) no basta para capturar todo lo relevante del problema.

---

## 1. BFS multi-fuente — "naranjas podridas" y propagación simultánea

### 1.1 El problema, y por qué NO es un BFS de una sola fuente

Un grid representa un almacén con naranjas frescas, podridas, y celdas vacías. Cada minuto, cualquier naranja fresca **adyacente** a una podrida se pudre también. Encuentra el número mínimo de minutos hasta que no quede ninguna fresca (o -1 si es imposible).

**La trampa de instinto**: si tu primer impulso es "hago BFS desde la primera naranja podrida que encuentre", estás resolviendo el problema equivocado — la propagación ocurre **simultáneamente desde todas las naranjas podridas iniciales a la vez**, no secuencialmente desde una sola.

### 1.2 La deducción — todas las fuentes entran a la cola desde el inicio

**La solución**: en vez de una sola fuente, mete **todas** las naranjas podridas iniciales a la cola de BFS **antes** de empezar a procesar, todas con distancia 0. A partir de ahí, el BFS estándar hace exactamente lo que necesitas — porque BFS ya garantiza procesar por niveles de distancia creciente (la prueba completa está en `itc-c6-grafos-i`), y con múltiples fuentes simultáneas, cada nivel del BFS corresponde exactamente a un minuto de propagación simultánea desde todas las fuentes activas.

```python
from collections import deque

def minutos_hasta_podridas(grid):
    filas, cols = len(grid), len(grid[0])
    cola = deque()
    frescas = 0

    for r in range(filas):
        for c in range(cols):
            if grid[r][c] == 2:      # podrida
                cola.append((r, c, 0))
            elif grid[r][c] == 1:    # fresca
                frescas += 1

    if frescas == 0:
        return 0

    direcciones = [(-1,0),(1,0),(0,-1),(0,1)]
    minutos_max = 0

    while cola:
        r, c, minuto = cola.popleft()
        minutos_max = max(minutos_max, minuto)
        for dr, dc in direcciones:
            nr, nc = r + dr, c + dc
            if 0 <= nr < filas and 0 <= nc < cols and grid[nr][nc] == 1:
                grid[nr][nc] = 2     # se pudre -- esto ES marcar visitado
                frescas -= 1
                cola.append((nr, nc, minuto + 1))

    return minutos_max if frescas == 0 else -1


if __name__ == "__main__":
    grid = [[2,1,1],[1,1,0],[0,1,1]]
    print(minutos_hasta_podridas(grid))
```

**Nota que "pudrir la naranja" y "marcar visitado" son la misma operación**: al cambiar `grid[nr][nc]` de 1 a 2 en el momento de encolar, evitas procesar la misma celda dos veces — exactamente la disciplina de "marca visitado al encolar, no al desencolar" que vas a ver remarcada como la trampa número uno de este módulo.

---

## 2. Number of Islands — conteo de componentes en un grid

**El problema**: cuenta el número de "islas" (grupos de 1s conectados en 4 direcciones) en un grid de 0s y 1s.

**La deducción, conectando directo con tu teoría**: esto es, literalmente, contar componentes conexas — el mismo algoritmo de `itc-c6-grafos-i` sección de componentes, con el grid como representación implícita de adyacencia.

```python
def contar_islas(grid):
    filas, cols = len(grid), len(grid[0])
    visitado = set()

    def dfs(r, c):
        if (r < 0 or r >= filas or c < 0 or c >= cols or
            grid[r][c] == '0' or (r, c) in visitado):
            return
        visitado.add((r, c))
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            dfs(r + dr, c + dc)

    islas = 0
    for r in range(filas):
        for c in range(cols):
            if grid[r][c] == '1' and (r, c) not in visitado:
                dfs(r, c)
                islas += 1
    return islas
```

**Por qué el bucle externo que recorre todas las celdas es indispensable**: exactamente la misma razón que ya dedujiste en `itc-c6-grafos-i` — un solo DFS/BFS desde un punto no cubre un grafo (aquí, grid) desconectado. Cada vez que encuentras una celda de tierra no visitada, es una isla nueva; el DFS desde ahí marca toda esa componente antes de que el bucle externo siga buscando la siguiente.

---

## 3. Course Schedule — orden topológico de Kahn, y la detección de ciclo gratis

### 3.1 El problema

Dado un conjunto de cursos y prerrequisitos, determina si es posible completar todos los cursos (equivalente a preguntar si el grafo de dependencias es un DAG), y opcionalmente, encuentra un orden válido.

### 3.2 Kahn's algorithm — BFS sobre grados de entrada

Ya conoces el orden topológico vía DFS (orden de finalización invertido) de `itc-c6-grafos-i`. **Kahn's algorithm** es la versión BFS del mismo problema, y es la que más candidatos usan en el OA porque es más directa de codear bajo reloj: mantén el **grado de entrada** (in-degree) de cada nodo — cuántos prerrequisitos le faltan. Empieza la cola con todos los nodos de grado de entrada 0 (sin prerrequisitos). Al procesar un nodo, "quítale" una dependencia a cada uno de sus sucesores (decrementa su grado de entrada); si algún sucesor llega a grado 0, se vuelve procesable, y entra a la cola.

```python
from collections import deque, defaultdict

def orden_topologico_kahn(num_cursos, prerrequisitos):
    """
    prerrequisitos: lista de [curso, prerrequisito] -- debes tomar
    prerrequisito ANTES de curso.
    Devuelve el orden valido, o [] si hay un ciclo (imposible).
    """
    grafo = defaultdict(list)
    grado_entrada = [0] * num_cursos

    for curso, prereq in prerrequisitos:
        grafo[prereq].append(curso)
        grado_entrada[curso] += 1

    cola = deque([c for c in range(num_cursos) if grado_entrada[c] == 0])
    orden = []

    while cola:
        actual = cola.popleft()
        orden.append(actual)
        for siguiente in grafo[actual]:
            grado_entrada[siguiente] -= 1
            if grado_entrada[siguiente] == 0:
                cola.append(siguiente)

    # LA VERIFICACION CLAVE: si el orden tiene menos elementos que
    # num_cursos, algunos nodos NUNCA llegaron a grado 0 -- estan
    # atrapados en un ciclo.
    return orden if len(orden) == num_cursos else []


if __name__ == "__main__":
    print(orden_topologico_kahn(4, [[1,0],[2,0],[3,1],[3,2]]))
```

**Por qué "si el orden tiene menos de n elementos, hay un ciclo" — deducido, no memorizado**: cada nodo solo entra a la cola cuando su grado de entrada llega a 0, es decir, cuando todos sus prerrequisitos ya fueron procesados. Si un grupo de nodos está en un ciclo, cada uno depende de otro del mismo grupo — ninguno de ellos **puede** llegar nunca a grado de entrada 0 de forma independiente, así que ninguno entra jamás a la cola. El algoritmo termina con esos nodos nunca procesados, y el tamaño final de `orden` queda estrictamente menor que `num_cursos` — una prueba directa y verificable de ciclo, sin necesitar el mecanismo de tres estados de DFS que ya viste en `itc-c6-grafos-i`. Esta es la razón práctica de por qué Kahn es popular en el OA: la detección de ciclo viene gratis, como una simple comparación de longitud, no como una lógica adicional de estados.

---

## 4. El salto a estados 3D — cuando (fila, columna) no basta

### 4.1 El problema: robot repartidor con batería limitada

Un robot se mueve por un grid, gastando batería en cada movimiento, y puede recargar en celdas específicas. Encuentra el mínimo número de movimientos para llegar al destino, sin quedarse sin batería nunca.

### 4.2 Por qué (fila, columna) ya no identifica el estado completo

Si haces BFS estándar marcando visitado solo por `(fila, columna)`, vas a fallar: el robot puede llegar a la misma celda **dos veces**, con niveles de batería distintos, y esas son situaciones genuinamente diferentes — con batería alta puede seguir explorando lejos; con batería baja, no. Si marcas `(fila, columna)` como visitado la primera vez que llegas ahí (con batería alta, digamos), y el BFS nunca vuelve a considerar llegar ahí con menos batería, puedes estar **descartando indebidamente** un camino que en realidad sí sería válido si tu noción de "visitado" fuera más rica.

### 4.3 La deducción — el estado es (fila, columna, batería)

**La solución**: el "nodo" del grafo implícito no es la celda — es la **tupla completa** `(fila, columna, batería_restante)`. Dos visitas a la misma celda con batería distinta son, para efectos de BFS, nodos **distintos** del espacio de estados. Marca visitado sobre esa tupla completa, no solo sobre la posición.

```python
from collections import deque

def bfs_robot_con_bateria(grid, inicio, destino, bateria_inicial, celdas_recarga):
    """
    Estado = (fila, columna, bateria). BFS estandar sobre ese
    espacio de estados 3D -- MISMO algoritmo que BFS en grid 2D,
    solo con una nocion mas rica de que constituye un 'nodo'.
    """
    filas, cols = len(grid), len(grid[0])
    fi, fc = inicio
    estado_inicial = (fi, fc, bateria_inicial)
    visitado = {estado_inicial}
    cola = deque([(fi, fc, bateria_inicial, 0)])   # +pasos

    while cola:
        r, c, bateria, pasos = cola.popleft()

        if (r, c) == destino:
            return pasos

        if bateria == 0:
            continue   # sin bateria, no se puede mover mas desde aqui

        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < filas and 0 <= nc < cols and grid[nr][nc] != '#':
                nueva_bateria = (bateria_inicial if (nr, nc) in celdas_recarga
                                  else bateria - 1)
                nuevo_estado = (nr, nc, nueva_bateria)
                if nuevo_estado not in visitado:
                    visitado.add(nuevo_estado)
                    cola.append((nr, nc, nueva_bateria, pasos + 1))

    return -1   # inalcanzable dentro de las restricciones de bateria
```

**Esto es exactamente la generalización de BFS de estados que ya construiste en `cp6-grafos-competitivos`, sección 3**: "cada configuración distinta es un nodo" — aquí la configuración es posición más batería, no solo posición. El algoritmo no cambió; lo que cambió es tu definición de qué constituye un estado distinto, y esa es precisamente la habilidad que este módulo entrena: **reconocer cuándo una sola dimensión (fila, columna) pierde información relevante para el problema, y expandir el estado hasta que la capture completa**.

---

## Señales de reconocimiento

- **Grid con movimientos permitidos, obstáculos, "mínimo de pasos/movimientos"** → BFS 2D estándar.
- **"En cuántos minutos/rondas se propaga X hasta que ya no queda Y"**, con múltiples fuentes de propagación simultánea → BFS multi-fuente (todas las fuentes iniciales entran a la cola con distancia 0, no una por una).
- **"Número de islas/regiones/grupos conectados"** → conteo de componentes, DFS/BFS con el bucle externo que cubre todo el grid.
- **"Orden de instalación/ejecución dado un conjunto de dependencias"**, **"¿es posible completar todo?"** → orden topológico, Kahn si necesitas detección de ciclo directa y simple.
- **Un recurso limitado que se consume/recarga durante el movimiento** (batería, combustible, tiempo) → sospecha inmediata de que el estado necesita una tercera dimensión más allá de la posición.

---

## Trampas OA

**No marcar visitado al encolar**: la trampa más citada de toda esta familia, ya remarcada en `cp6-grafos-competitivos` — si marcas visitado al desencolar en vez de al encolar, el mismo nodo puede entrar a la cola múltiples veces antes de procesarse la primera vez, degradando el rendimiento y, en casos con estado 3D, potencialmente produciendo resultados incorrectos si el criterio de "primera vez que llego aquí" importa para la lógica del problema.

**Recursión de DFS desbordando la pila**: en grids grandes (dimensiones de cientos por cientos, con cientos de miles de celdas), un DFS recursivo para contar islas puede desbordar la pila de llamadas de Python en el peor caso de una isla muy alargada. Si sospechas que el grid puede ser grande, usa la versión iterativa con pila explícita — exactamente la misma disciplina de `cp6-grafos-competitivos` sección de DFS iterativo.

**Índices fuera de rango**: verifica siempre los límites del grid **antes** de acceder a `grid[nr][nc]`, con evaluación de cortocircuito, nunca después — la misma trampa exacta que ya viste en `cp6-grafos-competitivos`.

**No expandir el estado cuando el problema lo exige**: la trampa conceptual central de la sección 4 — aplicar BFS marcando visitado solo por posición cuando el problema tiene un recurso limitado que cambia el conjunto de movimientos futuros posibles. Esto no produce un error de sintaxis — produce una respuesta incorrecta (frecuentemente "inalcanzable" cuando en realidad sí había un camino válido) porque el BFS descartó indebidamente un estado que parecía "ya visitado" sin serlo genuinamente.

---

## La regla de oro del candidato — la forma fácil antes que la optimizada

Bajo reloj, si reconoces que un problema es un grafo/grid pero no estás seguro de inmediato de si necesitas BFS multi-fuente, Kahn, o un estado expandido, **empieza con la versión más directa y simple que sabes que es correcta** — BFS/DFS estándar, aunque sospeches que podría no ser la más eficiente — consigue que pase los casos básicos, y **solo después**, si la restricción de tamaño lo exige (recuerda la tabla de `oa-0-fundamentos`), optimiza hacia la variante correcta. Exactamente el mismo principio de "correcto y simple vale más que optimizado e incompleto" que ya estableciste en `oa-0-fundamentos` sección 7, aplicado aquí específicamente a la familia de grafos, donde la tentación de "sobre-diseñar" el estado antes de necesitarlo es particularmente fuerte.

---

## Conexiones

**Con `itc-c6-grafos-i` y `cp6-grafos-competitivos`**: toda la teoría (por qué BFS da camino más corto, la prueba de orden topológico vía DFS) y el reflejo de "ver el grafo escondido" en grids y espacios de estados ya están completos ahí. Este módulo agrega específicamente: BFS multi-fuente, Kahn como alternativa BFS al orden topológico con detección de ciclo gratis, y el patrón de expandir el estado a 3D cuando una sola dimensión pierde información.

**Con `oa-6-heap-topk`**: en variantes donde el grafo tiene pesos distintos por arista (no todos los movimientos cuestan lo mismo), BFS deja de dar el camino más barato — necesitas Dijkstra, que combina exactamente el heap de `oa-6-heap-topk` con el recorrido de grafos de este módulo. Si ves "costo" o "peso" variable en un problema de camino más corto, sospecha de esa composición.

**Con `oa-0-fundamentos`**: la regla de oro de esta sección final es, literalmente, la aplicación directa de la disciplina de trade-offs que ya construiste ahí — específicamente reforzada aquí porque los problemas de grafos/grids son donde más candidatos se tientan a over-engineerar el estado antes de confirmar que lo necesitan.

---

## Síntesis

1. BFS multi-fuente mete **todas** las fuentes iniciales a la cola con distancia 0 desde el principio — no procesa una fuente a la vez.
2. Contar islas/componentes en un grid es, literalmente, el mismo algoritmo de componentes conexas que ya conoces, con el grid como adyacencia implícita.
3. Kahn's algorithm da orden topológico vía BFS sobre grados de entrada, con detección de ciclo gratis: si el orden final tiene menos elementos que nodos totales, hay un ciclo.
4. Cuando un recurso limitado (batería, tiempo) cambia qué movimientos son posibles después, el estado del BFS necesita expandirse más allá de la posición — el "nodo" es la tupla completa, no solo (fila, columna).
5. La regla de oro: resuelve la versión simple y correcta primero, optimiza después si la restricción de tamaño lo exige — no diseñes el estado 3D antes de confirmar que lo necesitas.

---

## Lo que deberías poder hacer en 30 segundos

1. **Distinguir BFS de una sola fuente de BFS multi-fuente** por si el problema describe propagación simultánea desde múltiples orígenes.
2. **Reconocer "orden de dependencias" + "¿es posible?"** como Kahn, con la detección de ciclo como comparación de longitud, no lógica adicional.
3. **Detectar si el problema tiene un recurso limitado que cambia los movimientos futuros posibles** — la señal directa de que necesitas expandir el estado más allá de la posición.
4. **Aplicar la regla de oro**: BFS/DFS simple primero, optimización solo si la restricción de `n` lo exige.

---

## Fuentes

- `itc-c6-grafos-i` y `cp6-grafos-competitivos` de esta misma colección — la teoría completa de BFS/DFS y el reflejo de reconocimiento de grafos disfrazados.
- "Rotting Oranges", "Number of Islands", "Course Schedule" — problemas estándar y ampliamente citados en preparación de entrevistas técnicas de la industria, frecuentemente reportados bajo el tag Amazon.
- Kahn, A. B., "Topological sorting of large networks", *Communications of the ACM*, 1962 — el algoritmo original.
