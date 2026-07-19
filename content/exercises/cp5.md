---
module_id: cd000000-0000-4000-8000-000000000005
spine: Competitiva
title: Ejercicios — DSU / Union-Find
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp5-dsu.md)
version: 1
---

# DSU / Union-Find — banco competitivo

Banco de reconocimiento bajo el reloj: cada ejercicio entrena ver la firma de DSU en un enunciado, esquivar sus trampas de rendimiento silencioso, y teclear la plantilla como función pura. Anclado a lo que el libro `cp5-dsu` realmente enseña (path compression + union by rank, contar componentes, la señal de alerta del "deshacer") — no a trivia. Los dos ejercicios de código son drills de plantilla: entrenan el patrón como función pura, NO son un juez de contest ni emiten veredicto.

## El reflejo — qué enunciado grita DSU
type: multiple_choice

Estás bajo el reloj y lees cuatro enunciados distintos. Sin resolver ninguno, ¿cuál dispara el reflejo "esto es DSU/Union-Find en segundos"? Recuerda la firma exacta del patrón: uniones intercaladas con preguntas de conectividad, sin necesidad de deshacer ninguna unión.

### Opciones
- [x] Procesas una lista de operaciones que alternan "vincula la cuenta A con la B" y "¿pertenecen A y B al mismo grupo de cuentas vinculadas?", y una vez que dos cuentas quedan vinculadas nunca se separan.
- Dado un tablero con obstáculos, encuentra el número mínimo de pasos para ir de una casilla a otra moviéndote en cuatro direcciones.
- Dado un grafo ya construido por completo, imprime el camino concreto (la secuencia de nodos) entre dos vértices dados.
- Procesas operaciones que a veces vinculan dos elementos y a veces DESHACEN una vinculación previa, y entre medio preguntas si dos elementos siguen conectados.

### Justificación
El primer enunciado es la firma canónica de "Señales de reconocimiento": una relación de equivalencia descubierta incrementalmente (vínculos que llegan uno por uno) intercalada con consultas de "¿mismo grupo?", y crucialmente sin deshacer — el reflejo que el libro pide entrenar ("uniones + preguntas de conectividad, sin deshacer → DSU en segundos"). El tablero con "número mínimo de pasos" es BFS sobre un grafo implícito (CP6), no DSU. Imprimir el camino concreto entre dos nodos cae en la señal de alerta explícita: DSU responde SI están conectados, no POR CUÁL ruta — para el camino necesitas otra herramienta. Y el cuarto enunciado dispara la otra señal de alerta: requiere DESHACER uniones, algo que el DSU estándar no soporta eficientemente.

## La señal de alerta — cuándo el reflejo DSU te traiciona
type: multiple_choice

Un problema te pide mantener grupos que se van formando, PERO además, cada cierto tiempo, "revierte la última vinculación" (separa dos elementos que habías unido) y luego vuelve a preguntar por conectividad. Tu instinto grita "DSU", pero el libro marca esto como una señal de alerta. ¿Por qué el DSU estándar es la herramienta equivocada aquí?

### Opciones
- [x] Porque el DSU estándar no soporta deshacer una unión de forma eficiente: path compression aplana el árbol de forma irreversible, así que no hay manera barata de reconstruir la estructura previa a una unión ya aplicada.
- Porque el DSU estándar no puede responder consultas de conectividad una vez que se ha hecho al menos una unión.
- Porque deshacer una unión obliga a reinicializar el arreglo `padre` desde cero en cada consulta, lo que siempre es más rápido con BFS.
- Porque el DSU estándar solo funciona sobre grafos con pesos, y las separaciones eliminan el peso de la arista.

### Justificación
La sección "Señal de alerta" es explícita: DSU estándar NO soporta desconectar/deshacer una unión eficientemente — el problema pide otra estructura (o un enfoque offline con rollback, fuera del alcance estándar). La razón mecánica está en la sección 1: path compression reengancha nodos directamente a la raíz para aplanar el árbol, y ese aplanamiento es destructivo — pierde la forma original, así que no puedes "retroceder" una unión sin haber guardado explícitamente el estado anterior. Los distractores son falsos sobre el patrón: DSU responde conectividad perfectamente tras cualquier número de uniones (es su propósito); no reinicializa nada por consulta (cada `conectados` es casi O(1)); y no requiere pesos (el peso aparece en Kruskal, pero DSU en sí solo maneja pertenencia a conjuntos).

## El costo de una operación — con las dos optimizaciones puestas
type: complexity

Implementas DSU con path compression Y union by rank, tal cual la plantilla de la sección 2. Bajo el reloj necesitas justificar que una secuencia de m operaciones (uniones y consultas mezcladas) es lo bastante rápida. ¿Cuál es el costo amortizado por operación, y cómo lo nombras con precisión?

### Opciones
- [x] O(α(n)) amortizado, donde α es la inversa de la función de Ackermann — crece tan lento que para cualquier n del universo conocido es una constante ≤ 4; en la práctica lo tratas como O(1).
- O(1) exacto en el peor caso de cada operación individual, garantizado sin necesidad de amortizar.
- O(log n) por operación, igual que una búsqueda en un árbol balanceado.
- O(n) por operación, porque encontrar la raíz puede recorrer toda la cadena de padres.

### Justificación
La pregunta raíz y la sección 1 lo fijan: path compression + union by rank JUNTAS dan un costo amortizado de prácticamente O(1), que formalmente es O(α(n)). La precisión importa bajo review: no es O(1) exacto en el peor caso de una operación aislada (una sola llamada a `encontrar` sobre un árbol aún no aplanado puede costar más; el O(α(n)) es amortizado sobre la secuencia, no una garantía por operación) — por eso "O(1) exacto peor caso" es la trampa. O(log n) sería el orden de una sola optimización o de un árbol balanceado, no el de ambas combinadas. Y O(n) es precisamente el costo que estas dos optimizaciones existen para evitar (el árbol degenerado de la sección 1); nombrarlo así ignora que las optimizaciones están puestas.

## Contar componentes al final — el recorrido que delata
type: complexity

Terminaste todas las uniones y ahora cuentas componentes con la forma directa de la sección 3: `len(set(dsu.encontrar(i) for i in range(n)))`. Identifica el costo de ESE conteo final (asumiendo DSU con ambas optimizaciones) y por qué el libro prefiere la alternativa incremental.

### Opciones
- [x] O(n · α(n)), que en la práctica es O(n): haces n llamadas a `encontrar` (cada una casi O(1)) más construir el conjunto — un recorrido lineal sobre los n elementos.
- O(α(n)), porque `encontrar` es casi O(1) y solo lo llamas una vez.
- O(1), porque el DSU ya sabe cuántos componentes hay sin recorrer nada.
- O(n²), porque por cada uno de los n elementos vuelves a recorrer los n padres.

### Justificación
La sección 3 lo dice directo: la forma con `set` hace un recorrido O(n) final (una llamada a `encontrar` por cada uno de los n elementos, cada una casi O(1) con las optimizaciones, de ahí O(n·α(n)) ≈ O(n)). Por eso el libro ofrece la alternativa "más eficiente en contest real": un contador que arranca en n y decrementa cada vez que `unir()` devuelve True — así el conteo es O(1) en cualquier momento, sin recorrido final. El distractor O(α(n)) confunde "una operación" con "n operaciones"; O(1) describe la alternativa incremental, no la forma con `set`; y O(n²) sobrecuenta: `encontrar` con path compression no recorre los n padres, es casi constante.

## Pasa todos los tests chicos y truena en el grande
type: trace

Tu DSU funciona: `unir` y `conectados` dan siempre la respuesta correcta, y pasas cada caso de prueba de ejemplo. Pero escribiste `encontrar` SIN la línea de path compression (`self.padre[x] = self.encontrar(self.padre[x])`) — solo subes por los padres hasta la raíz y la devuelves, sin reenganchar nada. Envías y obtienes Time Limit Exceeded solo en los casos grandes. ¿Cuál es el diagnóstico correcto?

### Opciones
- [x] La respuesta sigue siendo correcta, pero sin path compression una cadena adversarial de uniones puede degenerar el árbol a altura O(n), y entonces cada `encontrar` cuesta O(n) — invisible en entradas pequeñas, letal en las grandes. Es un bug de rendimiento silencioso, no de correctitud.
- El TLE indica que `unir` está devolviendo True cuando debería devolver False, así que procesas el doble de uniones de las necesarias.
- La respuesta es incorrecta en los casos grandes; el TLE es un síntoma de que entraste en un ciclo infinito al subir por los padres.
- Sin path compression, `conectados` deja de ser transitivo, así que el juez rechaza las respuestas por inconsistentes.

### Justificación
Es exactamente la trampa "Olvidar path compression (TLE)": el DSU sin compresión sigue dando la respuesta CORRECTA, pero puede degenerar a O(n) por operación en el peor caso adversarial (la degeneración de altura O(n) de la sección 1). Ese perfil —pasa los casos chicos, truena por Time Limit en el grande— es la firma del bug de rendimiento silencioso que el libro advierte. No es un problema de correctitud (la respuesta es la misma), no hay ciclo infinito (subir por padres siempre termina en la raíz), y la transitividad de `conectados` se preserva sin importar la compresión — lo único que la compresión cambia es la VELOCIDAD, no el resultado.

## El contador de componentes que miente
type: trace

Cuentas componentes con un contador incremental, pero lo decrementas en CADA llamada a `unir`, sin fijarte en si la unión fue real. Arrancas el contador en n = 4 y procesas estas operaciones en orden: unir(0,1), unir(2,3), unir(0,1). El conteo real de componentes al final es 2 (los grupos {0,1} y {2,3}). ¿Qué reporta tu contador y por qué?

### Opciones
- [x] Reporta 1: decrementa tres veces (una por cada llamada a `unir`), incluida la tercera unir(0,1) que era redundante y no fusionó nada — 4 − 3 = 1, uno menos que el conteo real de 2.
- Reporta 2 correctamente, porque `unir` ignora internamente la unión redundante y por tanto el contador no baja en la tercera llamada.
- Reporta 0, porque el contador se decrementa hasta agotar los cuatro elementos iniciales.
- Reporta 4, porque decrementar en cada llamada se cancela con las uniones y el contador nunca cambia neto.

### Justificación
Es la trampa "Contar componentes mal" de la sección de Trampas: decrementar el contador incondicionalmente en cada `unir()` —en vez de solo cuando `unir()` devuelve True (unión real)— produce un conteo incorrecto silencioso. Aquí las dos primeras uniones son reales (bajan el contador de 4 a 2 legítimamente), pero la tercera, unir(0,1), es redundante: 0 y 1 ya están en el mismo grupo, así que `unir` devuelve False y NO debería contar. Al decrementar de todas formas, el contador cae a 1 cuando la respuesta correcta es 2. El distractor "reporta 2" describe el código CORRECTO (que solo decrementa cuando la unión es real), justo lo que el bug NO hace. El libro insiste: verifica siempre contra un caso pequeño a mano — este es ese caso.

## Plantilla — contar componentes tras una lista de uniones
type: code

El drill estrella de la sección 3: implementa DSU con path compression + union by rank como función PURA y devuelve cuántos componentes conexos quedan tras aplicar todas las uniones. Usa el contador que arranca en n y decrementa solo cuando la unión fue real (`encontrar(a) != encontrar(b)`) — la forma eficiente que evita el recorrido O(n) final.

### Especificación
`countComponents(n, edges)`:
- `n` es el número de nodos, etiquetados 0..n−1.
- `edges` es una lista de pares `[a, b]`; cada par es una unión entre los nodos a y b.
- Devuelve el número de componentes conexos tras aplicar todas las uniones.
- Casos borde: sin aristas → n componentes; una arista repetida o un lazo `[a, a]` no fusiona nada nuevo (el contador no debe bajar); `n = 0` → 0.

### Firma
```javascript
function countComponents(n, edges) {
  // TODO: cuenta los componentes conexos tras aplicar las uniones de `edges`
}
```
```python
def count_components(n, edges):
    # TODO: cuenta los componentes conexos tras aplicar las uniones de `edges`
    pass
```

### Casos
```json
[
  { "input": [1, []], "expected": 1 },
  { "input": [0, []], "expected": 0 },
  { "input": [5, []], "expected": 5 },
  { "input": [3, [[0, 1], [1, 2]]], "expected": 1 },
  { "input": [4, [[0, 1], [2, 3]]], "expected": 2 },
  { "input": [3, [[1, 1]]], "expected": 3 },
  { "input": [3, [[0, 1], [0, 1]]], "expected": 2 },
  { "input": [6, [[0, 1], [2, 3], [4, 5], [1, 3]]], "expected": 2 }
]
```

### Solución
```javascript
function countComponents(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression (halving)
      x = parent[x];
    }
    return x;
  }
  let count = n;
  for (const [a, b] of edges) {
    const ra = find(a), rb = find(b);
    if (ra === rb) continue; // unión redundante: no fusiona nada
    if (rank[ra] < rank[rb]) {
      parent[ra] = rb;
    } else if (rank[ra] > rank[rb]) {
      parent[rb] = ra;
    } else {
      parent[rb] = ra;
      rank[ra]++;
    }
    count--; // solo baja cuando la unión fue real
  }
  return count;
}
```
```python
def count_components(n, edges):
    parent = list(range(n))
    rank = [0] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # path compression (halving)
            x = parent[x]
        return x

    count = n
    for a, b in edges:
        ra, rb = find(a), find(b)
        if ra == rb:
            continue  # unión redundante: no fusiona nada
        if rank[ra] < rank[rb]:
            parent[ra] = rb
        elif rank[ra] > rank[rb]:
            parent[rb] = ra
        else:
            parent[rb] = ra
            rank[ra] += 1
        count -= 1  # solo baja cuando la unión fue real
    return count
```

### Pistas
- Arranca `count = n` y decrementa SOLO cuando `find(a) != find(b)` (unión real) — nunca incondicionalmente.
- Un lazo `[a, a]` o una arista repetida cae en `ra === rb` y se salta con `continue`; el contador no se mueve.
- `find` con path compression aplana el árbol; con union by rank cuelgas siempre el árbol más bajo bajo el más alto.

## Plantilla — consultas de conectividad intercaladas con uniones
type: code

La firma de "conectividad dinámica": procesa una lista de operaciones que MEZCLAN uniones y consultas, y responde cada consulta con el estado del momento. Implementa `unir` + `encontrar` + `conectados` como función pura y devuelve el arreglo de respuestas booleanas, en orden.

### Especificación
`runConnectivity(n, ops)`:
- `n` nodos, etiquetados 0..n−1.
- `ops` es una lista; cada operación es `["union", a, b]` (une a y b) o `["query", a, b]` (pregunta si a y b están conectados EN ESE MOMENTO).
- Devuelve un arreglo de booleanos, uno por cada `"query"`, en el orden en que aparecen.
- Un nodo siempre está conectado consigo mismo; una consulta antes de cualquier unión que los relacione es `false`.

### Firma
```javascript
function runConnectivity(n, ops) {
  // TODO: responde cada "query" con la conectividad del momento
}
```
```python
def run_connectivity(n, ops):
    # TODO: responde cada "query" con la conectividad del momento
    pass
```

### Casos
```json
[
  { "input": [3, [["query", 0, 1]]], "expected": [false] },
  { "input": [3, [["query", 0, 0]]], "expected": [true] },
  { "input": [3, [["union", 0, 1], ["query", 0, 1]]], "expected": [true] },
  { "input": [4, [["union", 0, 1], ["union", 1, 2], ["query", 0, 2], ["query", 0, 3]]], "expected": [true, false] },
  { "input": [5, [["union", 0, 1], ["union", 2, 3], ["query", 1, 3], ["union", 1, 2], ["query", 0, 3]]], "expected": [false, true] },
  { "input": [3, []], "expected": [] },
  { "input": [2, [["query", 0, 1], ["union", 0, 1], ["query", 0, 1]]], "expected": [false, true] },
  { "input": [1, [["query", 0, 0]]], "expected": [true] }
]
```

### Solución
```javascript
function runConnectivity(n, ops) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = new Array(n).fill(0);
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }
  const result = [];
  for (const op of ops) {
    if (op[0] === "union") union(op[1], op[2]);
    else result.push(find(op[1]) === find(op[2]));
  }
  return result;
}
```
```python
def run_connectivity(n, ops):
    parent = list(range(n))
    rank = [0] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if rank[ra] < rank[rb]:
            parent[ra] = rb
        elif rank[ra] > rank[rb]:
            parent[rb] = ra
        else:
            parent[rb] = ra
            rank[ra] += 1

    result = []
    for op in ops:
        if op[0] == "union":
            union(op[1], op[2])
        else:
            result.append(find(op[1]) == find(op[2]))
    return result
```

### Pistas
- `conectados(a, b)` es simplemente `find(a) === find(b)` — misma raíz, mismo componente.
- Una consulta `["query", x, x]` siempre es `true`: `find(x) === find(x)`.
- No reinicializes nada entre operaciones: el `parent` persiste y va acumulando el efecto de las uniones anteriores.

## Kruskal — el papel exacto de DSU en el algoritmo
type: multiple_choice

Reconoces que un problema de árbol de expansión mínima se resuelve con Kruskal: ordenas las aristas por peso y las procesas de menor a mayor. Dentro de ese algoritmo, ¿qué papel exacto juega el DSU?

### Opciones
- [x] Detectar en casi O(1) si los dos extremos de la arista actual ya están en el mismo componente: si lo están, agregarla formaría un ciclo y la descartas; si no, la aceptas y unes ambos componentes. Es lo que permite aplicar la propiedad del corte greedy eficientemente.
- Ordenar las aristas por peso, que es la parte que domina el costo de Kruskal.
- Calcular el peso total del árbol resultante sumando las aristas conforme las procesa.
- Encontrar el camino concreto entre los dos extremos de cada arista para decidir si conviene agregarla.

### Justificación
La sección "Conexiones" lo formula literalmente: Kruskal es "ordena las aristas por peso (CP4) + aplica DSU para detectar ciclos mientras aplicas la propiedad del corte greedy". El DSU aporta la detección de ciclos casi O(1): antes de agregar una arista, `conectados(u, v)` (o el valor de retorno de `unir`) te dice si u y v ya comparten componente — si sí, la arista cerraría un ciclo y se descarta. Ordenar las aristas es trabajo del sorting (CP4), no del DSU. Sumar el peso total es contabilidad aparte, trivial. Y encontrar el camino concreto entre extremos es justo lo que DSU NO hace (señal de alerta): para Kruskal no necesitas el camino, solo saber si ya están en el mismo conjunto.
