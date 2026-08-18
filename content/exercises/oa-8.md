---
module_id: ce000000-0000-4000-8000-000000000009
spine: OA Amazon
title: Ejercicios — Grafos y grid
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-8-graphs-grid.md)
version: 1
---

# Grafos y grid — banco de reflejo OA

Banco de reflejo de examen (OA Amazon): un enunciado de Amazon nunca dice «esto es un grafo» — describe un almacén-cuadrícula, dependencias de instalación de paquetes, o un robot con batería, y el drill es VER el grafo escondido debajo de la regla de negocio: qué es nodo, qué es arista, y cuál de las tres capas del libro aplica (BFS multi-fuente, Kahn con detección de ciclo gratis, o el estado expandido a 3D cuando la posición sola pierde información). Los ejercicios de código son drills validados LOCALMENTE contra casos unitarios; NO son el juez real — el veredicto lo da el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si te pasas, anota qué señal no reconociste y vuelve al libro. Todo anclado a `oa-8-graphs-grid.md`.

## Instalador de paquetes: qué es nodo, qué es arista
type: multiple_choice
tiempo: 3

El instalador de una flota recibe n paquetes de software y una lista de reglas `[a, b]` = «el paquete a requiere que b esté instalado antes». Debe decidir si TODOS los paquetes pueden instalarse y en qué orden. ¿Cuál es el grafo escondido y qué algoritmo lo resuelve?

### Opciones
- [x] Cada paquete es un nodo; cada regla `[a, b]` es una arista DIRIGIDA `b → a` (b habilita a a). La pregunta «¿puedo instalar todo?» es «¿el grafo de dependencias es un DAG?», y el orden de instalación es un orden topológico: Kahn — cola con los nodos de grado de entrada 0, decrementar el grado de los sucesores al procesar — lo produce y, si el orden final tiene menos de n elementos, hay un ciclo y la respuesta es «imposible».
- Cada regla es un nodo y cada paquete una arista que conecta las reglas donde aparece; el orden sale de un DFS cualquiera sobre ese grafo.
- Es un grafo NO dirigido (la dependencia conecta dos paquetes por igual); basta verificar que sea conexo para garantizar que todo se puede instalar.
- Es un grid: colocas los paquetes en una cuadrícula por prioridad y aplicas BFS desde el paquete sin dependencias más cercano a la esquina superior izquierda.
### Justificación
Es la señal literal del libro: «orden de instalación/ejecución dado un conjunto de dependencias» + «¿es posible completar todo?» → orden topológico, con Kahn como la variante que los candidatos prefieren bajo reloj porque la detección de ciclo viene gratis (comparar `len(orden)` contra n, sin la lógica de tres estados de DFS). Invertir los papeles (reglas como nodos) destruye la estructura: la relación de precedencia vive ENTRE paquetes, y un DFS «cualquiera» sobre eso no respeta dependencias. Tratarlo como no dirigido borra justo la información que importa — la DIRECCIÓN es la que dice quién va antes; un grafo conexo puede ser imposible (a requiere b y b requiere a: conexo, y sin orden válido). Y el grid es un disfraz de otro problema: aquí no hay geometría ni adyacencia espacial — forzar la cuadrícula es inventar aristas que las reglas de negocio no declaran.

## Derrame químico en el almacén — cómo arranca la cola
type: multiple_choice
tiempo: 3

Un almacén es un grid con celdas transitables, bloqueadas, y varias celdas contaminadas por un derrame. Cada minuto, TODA celda transitable adyacente (4 direcciones) a una contaminada se contamina también — todas las fuentes se propagan simultáneamente. Te piden en cuántos minutos queda contaminado todo lo alcanzable. ¿Cómo arranca el BFS?

### Opciones
- [x] Multi-fuente: TODAS las celdas contaminadas iniciales entran a la cola con distancia 0 ANTES de procesar nada; a partir de ahí el BFS estándar hace el resto, porque cada nivel de la cola corresponde exactamente a un minuto de propagación simultánea desde todas las fuentes activas. La respuesta es el nivel máximo alcanzado, y si al final queda una celda transitable sin contaminar, esa zona es inalcanzable.
- BFS desde la primera celda contaminada que aparezca al recorrer el grid; las demás fuentes se contaminan solas durante la propagación y no necesitan tratamiento especial.
- Un BFS separado desde cada fuente, tomando para cada celda el MÁXIMO de las distancias obtenidas, porque la propagación simultánea equivale al peor caso entre fuentes.
- DFS desde cada fuente marcando el minuto de llegada, y al final quedarse con el mayor minuto registrado en todo el grid.
### Justificación
Es la deducción de la sección 1 del libro (naranjas podridas): la propagación ocurre simultáneamente desde todas las fuentes A LA VEZ, y modelarla es meter todas las fuentes a la cola con distancia 0 desde el inicio — el BFS ya garantiza procesar por niveles de distancia creciente, así que cada nivel ES un minuto. BFS desde «la primera que encuentre» resuelve el problema equivocado (la trampa de instinto que el libro nombra): las otras fuentes quedarían modeladas como si empezaran a propagar más tarde, inflando los minutos. Un BFS por fuente con el MÁXIMO invierte la lógica — la propagación simultánea da a cada celda el MÍNIMO entre fuentes, no el máximo — y además cuesta un BFS entero por fuente. Y el DFS no da distancias mínimas en absoluto: profundiza por una rama arbitraria, así que el «minuto de llegada» que registra depende del orden de exploración, no del tiempo real de propagación.

## El orden salió con 9 de 12 paquetes
type: multiple_choice
tiempo: 3

Corres Kahn sobre 12 paquetes con sus dependencias. El algoritmo termina sin error y el orden resultante tiene 9 elementos. ¿Qué concluyes, y por qué no hace falta buscar el ciclo explícitamente?

### Opciones
- [x] Hay un ciclo que atrapa a los 3 paquetes faltantes (o dependen de alguien atrapado): un nodo solo entra a la cola cuando su grado de entrada llega a 0, es decir, cuando TODOS sus prerrequisitos ya se procesaron — en un ciclo, cada nodo espera a otro del mismo ciclo, así que ninguno llega jamás a grado 0 ni entra a la cola. `len(orden) < n` ES la detección de ciclo, como comparación de longitud, sin lógica adicional; la instalación completa es imposible.
- Es un bug de implementación: Kahn siempre produce exactamente n elementos cuando el grafo se construyó bien, así que faltan aristas por registrar.
- Los 3 paquetes faltantes son independientes (nadie los requiere y no requieren a nadie), y hay que agregarlos al final del orden manualmente.
- El resultado es inconcluyente: para confirmar un ciclo hay que correr además el DFS de tres estados (blanco/gris/negro) y verificar que encuentre una arista hacia atrás.
### Justificación
Es la deducción central de la sección 3 del libro, deducida y no memorizada: entrar a la cola exige grado de entrada 0, y en un ciclo cada nodo depende de otro del mismo grupo — ninguno puede llegar a 0 de forma independiente, ninguno entra jamás, y el orden termina estrictamente menor que n. Esa comparación de longitud es exactamente la razón práctica por la que Kahn es popular en el OA. «Kahn siempre produce n» es falso justo en el caso interesante — producir menos de n es el comportamiento CORRECTO ante un ciclo, no un bug. Los paquetes verdaderamente independientes tienen grado de entrada 0 y entran a la cola DESDE EL INICIO — jamás quedan fuera del orden; quedar fuera prueba que su grado nunca bajó a 0, lo contrario de ser independiente. Y el DFS tricolor es redundante: ambos métodos detectan lo mismo, y el punto del libro es que con Kahn la detección ya viene incluida gratis — exigir una segunda confirmación es no haber entendido por qué la primera es una prueba.

## El robot dice «inalcanzable» y la ruta existe
type: multiple_choice
tiempo: 4

Un robot repartidor cruza un almacén-grid gastando 1 de batería por movimiento, con estaciones de recarga en celdas fijas. Implementas BFS marcando visitado por `(fila, columna)` y tu solución responde «inalcanzable» en un caso donde el revisor humano encuentra ruta válida pasando por una recarga. ¿Cuál es la raíz del defecto?

### Opciones
- [x] El nodo del grafo implícito no es la celda — es el estado completo `(fila, columna, batería)`: llegar a la misma celda con baterías distintas son situaciones genuinamente diferentes (con más batería puedes seguir por donde con menos no). Marcar visitado solo por posición descarta indebidamente re-entradas con batería distinta — por ejemplo llegar con más carga tras pasar por la recarga — y el BFS reporta «inalcanzable» sobre un camino que sí existía. El visitado debe ser sobre la tupla completa.
- Es un off-by-one en los límites del grid: el robot nunca considera la última fila y la última columna, donde está la estación de recarga.
- BFS no puede modelar recargas porque la batería «sube» a mitad del camino; hay que cambiar a DFS con backtracking que deshaga movimientos.
- Basta priorizar en la cola los estados con más batería (ordenarla descendente por carga) manteniendo el visitado 2D, y el camino aparece.
### Justificación
Es la trampa conceptual central de la sección 4 del libro, con su síntoma exacto: no produce error de sintaxis — produce «inalcanzable» cuando sí había camino, porque el BFS descartó un estado que parecía «ya visitado» sin serlo genuinamente. La cura es expandir el estado hasta que capture TODO lo que cambia los movimientos futuros posibles: `(fila, columna, batería)`, visitado 3D, mismo algoritmo con una noción más rica de nodo. El off-by-one es un bug posible pero no explica ESTE síntoma (fallaría siempre cerca del borde, no específicamente en rutas que pasan por recarga). DFS con backtracking no arregla nada: el defecto está en la definición de visitado, no en el orden de exploración — un DFS con visitado 2D descarta exactamente igual. Y priorizar por batería con visitado 2D sigue perdiendo estados: la primera llegada (aunque sea la de más carga) sella la celda, y los problemas donde conviene llegar DESPUÉS pero con recarga en medio quedan igual de descartados — además de que reordenar la cola rompe la garantía de niveles del BFS.

## Contaminar al desencolar — el BFS que se arrastra
type: multiple_choice
tiempo: 4

En el BFS de propagación del derrame, un compañero marca la celda como contaminada cuando la SACA de la cola (al desencolar), no cuando la mete. En grids chicos el resultado numérico sale igual, pero en el grid grande del OA el proceso tarda muchísimo más y la cola crece enorme. ¿Qué está pasando?

### Opciones
- [x] Sin marcar al ENCOLAR, una misma celda fresca puede ser encolada por varios vecinos distintos antes de procesarse por primera vez — todas esas copias entran a la cola y se procesan, y cada copia re-encola a sus propios vecinos: la cola se infla y el rendimiento se degrada. Marcar al encolar (en este problema, contaminar la celda ES marcarla visitada) garantiza que cada celda entra a la cola a lo más una vez; y en BFS sobre estados, donde «la primera vez que llego» importa para la lógica, marcar tarde puede además producir resultados incorrectos.
- `popleft` sobre una deque es O(n), así que el costo extra viene de la estructura de datos, no de cuándo se marca; con una lista indexada el problema desaparece.
- Es un leak de memoria del lenguaje: las tuplas encoladas no se liberan hasta que el BFS termina, y eso ralentiza el recorrido.
- El orden de las cuatro direcciones está mal: explorar arriba antes que abajo duplica el trabajo en grids anchos.
### Justificación
Es la trampa número uno de toda la familia según el libro: marcar visitado al desencolar deja una ventana en la que la misma celda entra múltiples veces a la cola desde varios vecinos — degradación de rendimiento garantizada, y en casos con estado 3D, resultados potencialmente incorrectos si «la primera vez que llego aquí» importa. El libro además señala la elegancia de este problema: pudrir/contaminar la celda al encolarla ES la marca de visitado — una sola operación. `popleft` sobre una deque es O(1) amortizado (para eso existe la deque); culpar a la estructura desvía del defecto real, que es algorítmico. No hay leak: la cola crece porque el algoritmo GENUINAMENTE encola duplicados, no porque el lenguaje retenga memoria de más. Y el orden de las direcciones es irrelevante para la correctitud y el costo asintótico del BFS — las cuatro se exploran siempre; ninguna permutación de ese orden duplica trabajo.

## Trazar Kahn con desempate por índice menor
type: trace
tiempo: 5

Cuatro paquetes, dependencias `[[1,0],[2,0],[3,1],[3,2]]` (cada `[curso, prerrequisito]`: 0 habilita a 1 y a 2; 1 y 2 habilitan a 3). Corres Kahn con la política «ante empate de candidatos con grado 0, entra primero el de índice menor». ¿Cuál es la evolución de la cola y el orden final?

### Opciones
- [x] Grados de entrada iniciales: 0→0, 1→1, 2→1, 3→2. Solo 0 arranca en la cola. Al procesar 0, los grados de 1 y 2 caen a 0 y entran (1 antes que 2 por el desempate); al procesar 1, el grado de 3 cae a 1 — aún no entra; al procesar 2, cae a 0 y entra. Orden final: `[0, 1, 2, 3]`, con longitud 4 = n, así que no hay ciclo.
- La cola arranca vacía porque todos los paquetes aparecen en alguna dependencia, y el algoritmo devuelve `[]` declarando ciclo.
- El orden final es `[0, 2, 1, 3]`: al procesar 0, el paquete 2 entra antes que el 1 porque aparece primero en la lista de dependencias.
- El paquete 3 entra a la cola en cuanto SU PRIMER prerrequisito se procesa, así que el orden es `[0, 1, 3, 2]`.
### Justificación
Traza verificada a mano: las aristas son 0→1, 0→2, 1→3, 2→3; grados 0:0, 1:1, 2:1, 3:2. Procesar 0 decrementa a 1 y 2 (ambos llegan a 0, el desempate mete 1 primero); procesar 1 deja a 3 en grado 1 — el punto fino de la traza: 3 NO entra todavía porque entrar exige grado exactamente 0, no «algún prerrequisito resuelto»; procesar 2 lo baja a 0 y recién entonces entra. El distractor de la cola vacía confunde «aparece en la lista» con «tiene prerrequisitos»: 0 aparece solo como habilitador — su grado de ENTRADA es 0 y por eso arranca. `[0, 2, 1, 3]` viola la política declarada: con 1 y 2 empatados en grado 0, el desempate dicta índice menor primero — este enunciado fija esa política justamente porque sin ella el orden entre 1 y 2 sería una decisión arbitraria de implementación. Y `[0, 1, 3, 2]` es el error conceptual serio: encolar a 3 con un prerrequisito pendiente rompe el invariante completo de Kahn — 3 se instalaría antes que 2, que es exactamente lo que el grado de entrada existe para impedir.

## V y E en un grid — el costo real del BFS
type: complexity
tiempo: 4

Un BFS estándar (visitado al encolar) recorre un almacén-grid de m filas por n columnas donde toda celda es transitable. En términos de V y E del grafo implícito: ¿cuánto valen, y cuál es la complejidad total del recorrido?

### Opciones
- [x] V = m·n (una por celda) y E ≈ 4mn = O(mn) (cada celda tiene a lo más 4 vecinos, y cada adyacencia se cuenta desde ambos lados). El BFS es O(V + E) porque cada celda entra a la cola a lo más una vez (gracias al visitado-al-encolar) y cada arista se examina un número constante de veces — total O(mn), lineal en el número de celdas.
- O((mn)²): cada celda desencolada debe buscar sus vecinos recorriendo el grid completo para encontrarlos.
- O(4^(mn)): desde cada celda salen 4 direcciones, así que los caminos posibles se multiplican exponencialmente y el BFS los enumera todos.
- O(mn log(mn)): la cola del BFS mantiene sus elementos ordenados por distancia, y cada inserción paga el logaritmo.
### Justificación
El grid es la representación implícita de adyacencia (sección 2 del libro): V = m·n celdas, y las aristas son las adyacencias de 4 direcciones — a lo más 4 por celda, O(mn) en total, así que O(V+E) = O(mn + mn) = O(mn). La garantía de linealidad viene del visitado-al-encolar: cada celda entra a la cola a lo más una vez, y sus 4 vecinos se examinan en O(1) con aritmética de índices (`fila±1`, `columna±1`) — no hay ninguna búsqueda sobre el grid para «encontrar» vecinos, que es lo que el distractor cuadrático inventa. El exponencial confunde enumerar CAMINOS con visitar CELDAS: el BFS nunca enumera caminos — visita cada estado una vez y el visitado corta toda re-expansión; esa poda es la esencia del algoritmo. Y el logarítmico describe una priority queue (Dijkstra, cuando las aristas tienen pesos distintos — la composición con heap que el libro difiere a `oa-6-heap-topk`): la cola FIFO del BFS ya produce el orden por niveles gratis, sin ordenar nada — inserción y extracción O(1).

## Drill: contar islas de inventario
type: code
tiempo: 15

El mapa de un almacén llega como grid de 0/1: `1` = celda ocupada por inventario, `0` = pasillo. Un «bloque de inventario» es un grupo de 1s conectados en 4 direcciones (las diagonales NO conectan). Cuenta cuántos bloques hay — es contar componentes conexas con el grid como adyacencia implícita. Usa la versión ITERATIVA (pila explícita o cola): en grids grandes del OA, la recursión puede desbordar la pila con un bloque muy alargado.

### Especificación
`contarIslas(grid)`:
- `grid` es un array de arrays de números `0`/`1` (todas las filas del mismo largo).
- Devuelve el número de grupos de `1`s conectados en 4 direcciones. Diagonales no conectan.
- Grid vacío (`[]`) o sin columnas (`[[]]`) → `0`. Grid sin ningún `1` → `0`.
- No debes modificar el grid de entrada (usa una estructura de visitados aparte, o trabaja sobre una copia).

### Firma
```javascript
function contarIslas(grid) {
  // TODO: doble bucle externo; al hallar un 1 no visitado, +1 isla y
  // DFS/BFS iterativo que marca toda la componente
  return 0;
}
```
```python
def contar_islas(grid):
    # TODO: doble bucle externo; al hallar un 1 no visitado, +1 isla y
    # DFS/BFS iterativo que marca toda la componente
    return 0
```

### Casos
```json
[
  { "input": [[[1, 1, 0], [0, 1, 0], [0, 0, 1]]], "expected": 2 },
  { "input": [[]], "expected": 0 },
  { "input": [[[]]], "expected": 0 },
  { "input": [[[0, 0], [0, 0]]], "expected": 0 },
  { "input": [[[1]]], "expected": 1 },
  { "input": [[[1, 0, 1], [0, 1, 0], [1, 0, 1]]], "expected": 5 },
  { "input": [[[1, 1, 1], [1, 1, 1]]], "expected": 1 },
  { "input": [[[1, 0, 1, 1]]], "expected": 2 }
]
```

### Solución
```javascript
function contarIslas(grid) {
  if (!Array.isArray(grid) || grid.length === 0 || grid[0].length === 0) return 0;
  const filas = grid.length;
  const cols = grid[0].length;
  const visitado = Array.from({ length: filas }, () => new Array(cols).fill(false));
  const direcciones = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let islas = 0;
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1 && !visitado[r][c]) {
        islas++;                                   // celda de tierra nueva = isla nueva
        const pila = [[r, c]];                     // DFS iterativo: cero riesgo de desbordar
        visitado[r][c] = true;                     // marcar al APILAR, no al sacar
        while (pila.length > 0) {
          const [fr, fc] = pila.pop();
          for (const [dr, dc] of direcciones) {
            const nr = fr + dr;
            const nc = fc + dc;
            if (nr >= 0 && nr < filas && nc >= 0 && nc < cols &&
                grid[nr][nc] === 1 && !visitado[nr][nc]) {
              visitado[nr][nc] = true;
              pila.push([nr, nc]);
            }
          }
        }
      }
    }
  }
  return islas;
}
```
```python
def contar_islas(grid):
    if not grid or not grid[0]:
        return 0
    filas = len(grid)
    cols = len(grid[0])
    visitado = [[False] * cols for _ in range(filas)]
    direcciones = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    islas = 0
    for r in range(filas):
        for c in range(cols):
            if grid[r][c] == 1 and not visitado[r][c]:
                islas += 1                      # celda de tierra nueva = isla nueva
                pila = [(r, c)]                 # DFS iterativo: cero riesgo de desbordar
                visitado[r][c] = True           # marcar al APILAR, no al sacar
                while pila:
                    fr, fc = pila.pop()
                    for dr, dc in direcciones:
                        nr, nc = fr + dr, fc + dc
                        if (0 <= nr < filas and 0 <= nc < cols and
                                grid[nr][nc] == 1 and not visitado[nr][nc]):
                            visitado[nr][nc] = True
                            pila.append((nr, nc))
    return islas
```

### Pistas
- El doble bucle externo es indispensable: un solo DFS/BFS desde un punto no cubre un grid desconectado — cada `1` no visitado que el bucle encuentra es una isla nueva, y el recorrido desde ahí marca su componente completa antes de seguir.
- Marca visitado al APILAR/encolar, no al sacar — la misma disciplina de siempre; aquí evita que dos vecinos metan la misma celda dos veces.
- Verifica los límites ANTES de indexar `grid[nr][nc]`, con cortocircuito: primero `0 <= nr < filas`, después el acceso.

## Drill: minutos para contaminar el almacén
type: code
tiempo: 20

El grid del almacén trae `0` = pasillo vacío, `1` = mercancía fresca, `2` = mercancía contaminada. Cada minuto, toda mercancía fresca adyacente (4 direcciones) a una contaminada se contamina. Devuelve los minutos hasta que no quede mercancía fresca — BFS multi-fuente: TODAS las fuentes arrancan en la cola con minuto 0, y la respuesta es el nivel máximo alcanzado.

### Especificación
`minutosParaPudrirse(grid)`:
- `grid` es un array de arrays con valores `0`/`1`/`2`.
- Devuelve el número mínimo de minutos hasta que ninguna celda `1` quede sin contaminar.
- Sin ninguna celda fresca (aunque haya contaminadas o esté vacío el grid) → `0`.
- Si queda al menos una fresca inalcanzable desde toda fuente → `-1`.
- No modifiques el grid de entrada: trabaja sobre una copia (contaminar la copia ES tu marca de visitado).

### Firma
```javascript
function minutosParaPudrirse(grid) {
  // TODO: encolar TODAS las fuentes con minuto 0, contar frescas;
  // propagar por niveles; frescas restantes > 0 al final = -1
  return 0;
}
```
```python
def minutos_para_pudrirse(grid):
    # TODO: encolar TODAS las fuentes con minuto 0, contar frescas;
    # propagar por niveles; frescas restantes > 0 al final = -1
    return 0
```

### Casos
```json
[
  { "input": [[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], "expected": 4 },
  { "input": [[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], "expected": -1 },
  { "input": [[[0, 2]]], "expected": 0 },
  { "input": [[[0]]], "expected": 0 },
  { "input": [[[1]]], "expected": -1 },
  { "input": [[[2]]], "expected": 0 },
  { "input": [[[2, 1, 1, 1, 1]]], "expected": 4 },
  { "input": [[[2, 0, 1]]], "expected": -1 },
  { "input": [[[2, 1, 1], [1, 1, 1], [1, 1, 2]]], "expected": 2 }
]
```

### Solución
```javascript
function minutosParaPudrirse(grid) {
  if (!Array.isArray(grid) || grid.length === 0 || grid[0].length === 0) return 0;
  const filas = grid.length;
  const cols = grid[0].length;
  const estado = grid.map((fila) => fila.slice());   // copia: no mutar la entrada
  const cola = [];
  let frescas = 0;
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < cols; c++) {
      if (estado[r][c] === 2) cola.push([r, c, 0]);  // TODAS las fuentes, minuto 0
      else if (estado[r][c] === 1) frescas++;
    }
  }
  if (frescas === 0) return 0;                       // nada que contaminar
  const direcciones = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let minutoMax = 0;
  let frente = 0;
  while (frente < cola.length) {
    const [r, c, minuto] = cola[frente++];
    if (minuto > minutoMax) minutoMax = minuto;
    for (const [dr, dc] of direcciones) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < filas && nc >= 0 && nc < cols && estado[nr][nc] === 1) {
        estado[nr][nc] = 2;                          // contaminar = marcar visitado, al ENCOLAR
        frescas--;
        cola.push([nr, nc, minuto + 1]);
      }
    }
  }
  return frescas === 0 ? minutoMax : -1;             // fresca restante = inalcanzable
}
```
```python
from collections import deque


def minutos_para_pudrirse(grid):
    if not grid or not grid[0]:
        return 0
    filas = len(grid)
    cols = len(grid[0])
    estado = [fila[:] for fila in grid]      # copia: no mutar la entrada
    cola = deque()
    frescas = 0
    for r in range(filas):
        for c in range(cols):
            if estado[r][c] == 2:
                cola.append((r, c, 0))       # TODAS las fuentes, minuto 0
            elif estado[r][c] == 1:
                frescas += 1
    if frescas == 0:
        return 0                             # nada que contaminar
    direcciones = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    minuto_max = 0
    while cola:
        r, c, minuto = cola.popleft()
        minuto_max = max(minuto_max, minuto)
        for dr, dc in direcciones:
            nr, nc = r + dr, c + dc
            if 0 <= nr < filas and 0 <= nc < cols and estado[nr][nc] == 1:
                estado[nr][nc] = 2           # contaminar = marcar visitado, al ENCOLAR
                frescas -= 1
                cola.append((nr, nc, minuto + 1))
    return minuto_max if frescas == 0 else -1   # fresca restante = inalcanzable
```

### Pistas
- La cola arranca con TODAS las fuentes a minuto 0 — meter una sola y «dejar que las demás se contaminen solas» modela fuentes que arrancan tarde e infla la respuesta.
- Contaminar la celda en el momento de encolarla cumple dos papeles a la vez: propaga y marca visitado. Si contaminas al desencolar, la misma celda entra varias veces.
- Lleva el contador de frescas desde el inicio y decreméntalo al contaminar: al final, `frescas > 0` significa inalcanzable → `-1`. Distingue ese caso de «nunca hubo frescas» → `0`.
