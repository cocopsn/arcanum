---
module_id: cd000000-0000-4000-8000-000000000008
spine: Competitiva
title: Ejercicios — Segment tree y sweep line
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp8-segment-tree.md)
version: 1
---

# Segment tree y sweep line — banco de reflejo

Banco competitivo (reflejo bajo el reloj): cada ejercicio entrena RECONOCER cuándo un problema exige un segment tree (actualizaciones intercaladas con consultas de rango) o un barrido (eventos ordenados en una dimensión), y las trampas que separan un O(log n) por operación de un O(n) disfrazado. Los ejercicios de código destilan las estructuras núcleo — segment tree de suma de rango con actualización de punto, y Fenwick de sumas de prefijo — como funciones puras manejadas por una lista de operaciones. No son un juez de contest: no hay veredicto "accepted"; son drills de plantilla contra casos borde.

## Actualizaciones intercaladas — cuándo prefix sums ya no basta
type: multiple_choice

Problema: un arreglo de `10⁵` elementos; debes procesar `10⁵` operaciones, cada una de un tipo u otro — "suma del rango `[l,r]`" o "cambia el elemento en la posición `i`". ¿Cuál estructura, y cuál palabra exacta del enunciado descarta la opción más simple?

### Opciones
- [x] Segment tree: las actualizaciones de elementos INTERCALADAS con las consultas de rango son la señal — prefix sums daría O(1) por consulta pero exige O(n) para reconstruirse tras cada cambio, inaceptable con tantas actualizaciones.
- Prefix sums: con `10⁵` elementos, precomputar una vez el arreglo de sumas acumuladas responde ambos tipos de operación en O(1).
- Sweep line: ordenas las operaciones por posición y las procesas en un solo barrido, manteniendo la suma activa.
- Un simple arreglo con recomputación: `10⁵` operaciones × O(n) por consulta es `10¹⁰`, perfectamente tratable dentro del límite de tiempo.

### Justificación
La "Señal de alerta" del libro es literal: "si las consultas de rango son sobre un arreglo que **nunca** se actualiza, no necesitas segment tree — prefix sums es suficiente. Segment tree se justifica específicamente por la coexistencia de actualizaciones y consultas". El distractor 2 ignora que cada "cambia el elemento" invalida el arreglo precomputado y exige reconstruirlo en O(n). Sweep line resuelve otra forma de problema (eventos ordenados que colapsan 2D→1D), no consulta/actualización intercaladas (distractor 3). Y `10¹⁰` operaciones **no** son tratables — es TLE seguro (distractor 4).

## El máximo de intervalos solapados — reconocer el barrido
type: multiple_choice

Problema: dados N intervalos `(inicio, fin)`, encuentra el número máximo de intervalos activos simultáneamente en cualquier punto. ¿Cuál técnica, y cuál es la idea central que colapsa el problema a una dimensión?

### Opciones
- [x] Sweep line: convierte cada intervalo en dos eventos (+1 al entrar, −1 al salir), ordena todos los eventos por posición, y barre acumulando un contador — el máximo del contador durante el barrido es la respuesta.
- Segment tree con lazy propagation: cada intervalo es una actualización de rango +1, y consultas el máximo global del árbol tras cada inserción.
- DP con bitmask sobre los N intervalos: `dp[máscara]` = si el subconjunto de intervalos de la máscara puede estar activo a la vez.
- Prefix sums sobre las posiciones de inicio: la suma acumulada de inicios menos la de fines da directamente el solapamiento máximo.

### Justificación
Es la plantilla exacta de la sección 3 (`maximo_solapamiento`): dos eventos por intervalo, `sort`, un barrido que acumula `delta` y rastrea el máximo. El distractor 2 (segment tree + lazy) *funcionaría* pero es una sobre-ingeniería enorme frente al O(n log n) del barrido — reconocer la herramienta más simple suficiente es la habilidad. El bitmask exige n ≤ 20 y no modela "en un punto" (distractor 3). Y una resta cruda de prefijos de inicios y fines no da el máximo en un punto salvo que proceses los eventos en orden de coordenada — que *es* el barrido (distractor 4).

## Por qué el segment tree es O(log n) por operación
type: complexity

Tanto la actualización de un punto como la consulta de un rango en un segment tree son O(log n). ¿De dónde sale el logaritmo, anclado a la estructura del árbol?

### Opciones
- [x] O(log n): el árbol es binario y balanceado, así que su altura es O(log n); una actualización toca exactamente un camino raíz→hoja, y una consulta de rango toca a lo más una cantidad acotada de nodos por nivel — en ambos casos, proporcional a la altura.
- O(1): como el árbol se guarda en un arreglo con indexación `2·nodo`, acceder a cualquier nodo es directo, y cada operación es un acceso constante.
- O(n): cada operación debe visitar las n hojas para mantener consistentes las sumas agregadas de los nodos internos.
- O(log² n): cada uno de los O(log n) niveles requiere a su vez un binary search interno de O(log n) para localizar la posición correcta.

### Justificación
Sección 1: "la altura del árbol es O(log n), y cada operación toca a lo más un camino desde la raíz hasta una hoja (más una cantidad acotada de nodos adicionales por consulta de rango)". El distractor 2 confunde el acceso O(1) a **un** nodo del arreglo con el costo de la **operación**, que recorre un camino completo. El distractor 3 es justo el escaneo ingenuo que el árbol evita. El distractor 4 inventa un binary search anidado: el propio descenso por el árbol *es* el logaritmo, no hay búsqueda interna adicional.

## Segment tree — suma de rango con actualización de punto
type: code

Implementa la estructura estrella de la sección 1 como función pura manejada por una lista de operaciones. Construyes un segment tree sobre `inicial` (representado con arreglos planos, indexación `2·nodo` / `2·nodo+1`, tamaño seguro `4n`) y procesas cada operación en orden: `["update", pos, val]` **asigna** `a[pos] = val`; `["query", l, r]` devuelve la suma del rango inclusivo `a[l..r]`. Devuelve el arreglo de respuestas de las consultas, en orden.

### Especificación
`sumasDeRango(inicial, operaciones)`:
- Construye el árbol sobre `inicial` (longitud `n ≥ 1`).
- `["update", pos, val]`: fija `a[pos] = val` (ASIGNA, no suma) y recombina hacia la raíz. No produce salida.
- `["query", l, r]`: devuelve `a[l] + a[l+1] + ... + a[r]` (ambos extremos incluidos), acumulando en la salida.
- La consulta usa las tres ramas: sin overlap → 0; overlap total → la suma agregada del nodo; parcial → desciende a ambos hijos.

### Firma
```javascript
function sumasDeRango(inicial, operaciones) {
  // TODO: construir/actualizar/consultar recursivos sobre un arreglo 'arbol' de tamaño 4n
}
```
```python
def sumas_de_rango(inicial, operaciones):
    # TODO: construir/actualizar/consultar recursivos sobre una lista 'arbol' de tamaño 4n
    pass
```

### Casos
```json
[
  { "input": [[5], [["query", 0, 0]]], "expected": [5] },
  { "input": [[1, 2, 3, 4, 5], [["query", 0, 4], ["query", 1, 3], ["query", 2, 2]]], "expected": [15, 9, 3] },
  { "input": [[1, 2, 3, 4, 5], [["update", 2, 10], ["query", 0, 4], ["query", 2, 2]]], "expected": [22, 10] },
  { "input": [[3, 1, 4, 1, 5], [["query", 0, 4]]], "expected": [14] },
  { "input": [[0, 0, 0, 0], [["update", 0, 5], ["query", 0, 3], ["update", 3, 7], ["query", 0, 3], ["query", 3, 3]]], "expected": [5, 12, 7] },
  { "input": [[2, 4, 6, 8, 10, 12], [["query", 0, 0], ["query", 5, 5], ["query", 2, 4]]], "expected": [2, 12, 24] },
  { "input": [[10, 20, 30], [["update", 1, 0], ["query", 0, 2]]], "expected": [40] },
  { "input": [[1, 1, 1], [["update", 1, 5], ["update", 1, 2], ["query", 0, 2]]], "expected": [4] }
]
```

### Solución
```javascript
function sumasDeRango(inicial, operaciones) {
  const n = inicial.length;
  const arbol = new Array(4 * Math.max(n, 1)).fill(0);
  function construir(nodo, izq, der) {
    if (izq === der) { arbol[nodo] = inicial[izq]; return; }
    const medio = (izq + der) >> 1;
    construir(2 * nodo, izq, medio);
    construir(2 * nodo + 1, medio + 1, der);
    arbol[nodo] = arbol[2 * nodo] + arbol[2 * nodo + 1];
  }
  function actualizar(nodo, izq, der, pos, val) {
    if (izq === der) { arbol[nodo] = val; return; }
    const medio = (izq + der) >> 1;
    if (pos <= medio) actualizar(2 * nodo, izq, medio, pos, val);
    else actualizar(2 * nodo + 1, medio + 1, der, pos, val);
    arbol[nodo] = arbol[2 * nodo] + arbol[2 * nodo + 1];
  }
  function consultar(nodo, izq, der, l, r) {
    if (r < izq || der < l) return 0;
    if (l <= izq && der <= r) return arbol[nodo];
    const medio = (izq + der) >> 1;
    return consultar(2 * nodo, izq, medio, l, r) + consultar(2 * nodo + 1, medio + 1, der, l, r);
  }
  if (n > 0) construir(1, 0, n - 1);
  const salida = [];
  for (const op of operaciones) {
    if (op[0] === "update") actualizar(1, 0, n - 1, op[1], op[2]);
    else salida.push(consultar(1, 0, n - 1, op[1], op[2]));
  }
  return salida;
}
```
```python
def sumas_de_rango(inicial, operaciones):
    n = len(inicial)
    arbol = [0] * (4 * max(n, 1))

    def construir(nodo, izq, der):
        if izq == der:
            arbol[nodo] = inicial[izq]
            return
        medio = (izq + der) // 2
        construir(2 * nodo, izq, medio)
        construir(2 * nodo + 1, medio + 1, der)
        arbol[nodo] = arbol[2 * nodo] + arbol[2 * nodo + 1]

    def actualizar(nodo, izq, der, pos, val):
        if izq == der:
            arbol[nodo] = val
            return
        medio = (izq + der) // 2
        if pos <= medio:
            actualizar(2 * nodo, izq, medio, pos, val)
        else:
            actualizar(2 * nodo + 1, medio + 1, der, pos, val)
        arbol[nodo] = arbol[2 * nodo] + arbol[2 * nodo + 1]

    def consultar(nodo, izq, der, l, r):
        if r < izq or der < l:
            return 0
        if l <= izq and der <= r:
            return arbol[nodo]
        medio = (izq + der) // 2
        return (consultar(2 * nodo, izq, medio, l, r) +
                consultar(2 * nodo + 1, medio + 1, der, l, r))

    if n > 0:
        construir(1, 0, n - 1)
    salida = []
    for op in operaciones:
        if op[0] == "update":
            actualizar(1, 0, n - 1, op[1], op[2])
        else:
            salida.append(consultar(1, 0, n - 1, op[1], op[2]))
    return salida
```

### Pistas
- `4n` es la cota segura de tamaño para el arreglo `arbol` — no la sub-dimensiones aunque parezca que sobra.
- La consulta tiene exactamente tres ramas: `r < izq || der < l` (sin overlap → 0), `l <= izq && der <= r` (overlap total → devuelve el nodo), y el caso parcial (desciende a ambos hijos y suma).
- `update` **asigna** el valor en la hoja y luego recombina en el camino de regreso (`arbol[nodo] = izq + der`) — por eso `[["update",1,0]]` pone la posición en 0, no le suma 0.

## Las tres ramas de una consulta de rango
type: trace

La función `consultar(nodo, izq, der, l, r)` de la sección 1 distingue exactamente tres casos. En un árbol sobre los índices `[0..5]`, consultando el rango `[2,4]`, clasifica qué ocurre en el nodo que cubre `[0,2]` (es decir, `izq=0`, `der=2`).

### Opciones
- [x] Overlap PARCIAL: el rango del nodo `[0,2]` ni queda totalmente fuera de `[2,4]` (comparten el índice 2) ni totalmente dentro (los índices 0 y 1 quedan fuera), así que la función NO devuelve un valor directo — desciende recursivamente a sus dos hijos y suma sus resultados.
- Overlap TOTAL: como `[0,2]` y `[2,4]` comparten el índice 2, el nodo está contenido en la consulta y devuelve su suma agregada directamente, sin descender.
- SIN overlap: como `[0,2]` no está contenido en `[2,4]`, la función devuelve 0 de inmediato y poda esa rama.
- Es una hoja: `[0,2]` cubre tres elementos, pero la consulta siempre convierte cualquier nodo intermedio en hoja antes de evaluarlo.

### Justificación
Evalúa los predicados de `_consultar`: overlap total es `l <= izq && der <= r` → `2 <= 0 && 2 <= 4` → **falso** (el `2 <= 0` falla), así que NO es total — el distractor 2 confunde "comparte un índice" con "está contenido", pero la contención exige `l <= izq`, y aquí `l=2 > izq=0`. Sin overlap es `r < izq || der < l` → `4 < 0 || 2 < 2` → **falso**, así que tampoco es disjunto — el distractor 3 confunde "no contenido" con "disjunto". Como ninguna de las dos condiciones se cumple, es el caso **parcial**: desciende a `[0,1]` (que resultará disjunto → 0) y `[2,2]` (contenido → aporta `a[2]`). Es exactamente cómo la consulta acumula solo la parte relevante del rango.

## Actualización de rango sin lazy — el TLE que no ves venir
type: multiple_choice

Necesitas "suma +X a todo el rango `[l,r]`" intercalado con consultas de rango. Implementas la actualización de rango recorriendo cada posición `l..r` y llamando a la actualización de punto en cada una. Es correcta en los ejemplos, pero da TLE en los tests grandes. ¿Cuál es la falla exacta y el arreglo?

### Opciones
- [x] Cada actualización de rango cuesta O((r−l)·log n) — hasta O(n log n) por operación al tocar cada posición — así que con muchas actualizaciones de rango grandes se dispara el TLE; lazy propagation lo arregla posponiendo la propagación a los hijos hasta que una operación futura realmente descienda a ellos, recuperando O(log n) por actualización.
- El código es incorrecto, no lento: actualizar posición por posición deja los nodos internos con sumas agregadas inconsistentes, dando respuestas erróneas en los casos grandes.
- El problema es la recursión: cada actualización de punto desborda la pila cuando el rango es grande, y la solución es convertir el segment tree a una versión iterativa.
- El TLE viene de reconstruir el árbol completo (O(n)) tras cada actualización de rango; la solución es usar prefix sums en su lugar.

### Justificación
Trampas, "Lazy propagation olvidada": "si implementas actualizaciones de rango sin lazy propagation, actualizando cada posición individualmente, tu código es **correcto pero puede ser O(n) por actualización** en vez de O(log n) — pasa los tests pequeños, truena por TLE en los grandes". Es un problema de **rendimiento, no de correctitud** (distractor 2 se equivoca al llamarlo incorrecto: cada actualización de punto sí recombina bien los nodos). No es un desbordamiento de pila (distractor 3), ni una reconstrucción completa (distractor 4: haces actualizaciones de punto, no rebuild; y prefix sums ni siquiera soporta las actualizaciones intercaladas). Lazy propagation (sección 2) paga el costo "solo cuando y donde realmente se necesita".

## Fenwick tree — sumas de prefijo con actualización de punto
type: code

Implementa un Fenwick tree (BIT), la alternativa más ligera de los Trade-offs para el caso exacto de suma-de-prefijo con actualización de punto. Manejado por operaciones sobre un arreglo lógico de `n` posiciones inicializado en ceros (índices 0-based en la API): `["add", i, delta]` suma `delta` a la posición `i`; `["prefix", i]` devuelve la suma del prefijo `a[0] + ... + a[i]` (inclusive). Devuelve el arreglo de respuestas de los prefijos, en orden.

### Especificación
`prefijosFenwick(n, operaciones)`:
- Arreglo lógico de tamaño `n`, todo en 0 al inicio; el BIT interno es 1-indexed (tamaño `n+1`).
- `["add", i, delta]`: suma `delta` en la posición 0-based `i` (recorre `j += j & -j`). No produce salida.
- `["prefix", i]`: devuelve `Σ a[0..i]` inclusive (recorre `j -= j & -j`), acumulando en la salida.
- `delta` puede ser negativo. `prefix` en una posición sin `add` previo aporta 0.

### Firma
```javascript
function prefijosFenwick(n, operaciones) {
  // TODO: BIT 1-indexed; add sube con j += j&-j, prefix baja con j -= j&-j
}
```
```python
def prefijos_fenwick(n, operaciones):
    # TODO: BIT 1-indexed; add sube con j += j&-j, prefix baja con j -= j&-j
    pass
```

### Casos
```json
[
  { "input": [1, [["add", 0, 5], ["prefix", 0]]], "expected": [5] },
  { "input": [5, [["prefix", 4]]], "expected": [0] },
  { "input": [5, [["add", 0, 1], ["add", 1, 2], ["add", 2, 3], ["add", 3, 4], ["add", 4, 5], ["prefix", 4], ["prefix", 2], ["prefix", 0]]], "expected": [15, 6, 1] },
  { "input": [3, [["add", 0, 10], ["prefix", 2], ["add", 2, 5], ["prefix", 2], ["prefix", 0]]], "expected": [10, 15, 10] },
  { "input": [4, [["add", 1, 7], ["add", 1, -3], ["prefix", 1], ["prefix", 3]]], "expected": [4, 4] },
  { "input": [3, [["add", 2, 9], ["prefix", 0], ["prefix", 1], ["prefix", 2]]], "expected": [0, 0, 9] },
  { "input": [2, [["add", 0, 1], ["add", 0, 1], ["add", 0, 1], ["prefix", 0], ["prefix", 1]]], "expected": [3, 3] },
  { "input": [8, [["add", 7, 100], ["prefix", 7], ["prefix", 6]]], "expected": [100, 0] }
]
```

### Solución
```javascript
function prefijosFenwick(n, operaciones) {
  const bit = new Array(n + 1).fill(0);
  function add(i, delta) {
    for (let j = i + 1; j <= n; j += j & -j) bit[j] += delta;
  }
  function prefix(i) {
    let s = 0;
    for (let j = i + 1; j > 0; j -= j & -j) s += bit[j];
    return s;
  }
  const salida = [];
  for (const op of operaciones) {
    if (op[0] === "add") add(op[1], op[2]);
    else salida.push(prefix(op[1]));
  }
  return salida;
}
```
```python
def prefijos_fenwick(n, operaciones):
    bit = [0] * (n + 1)

    def add(i, delta):
        j = i + 1
        while j <= n:
            bit[j] += delta
            j += j & -j

    def prefix(i):
        s = 0
        j = i + 1
        while j > 0:
            s += bit[j]
            j -= j & -j
        return s

    salida = []
    for op in operaciones:
        if op[0] == "add":
            add(op[1], op[2])
        else:
            salida.append(prefix(op[1]))
    return salida
```

### Pistas
- El BIT es 1-indexed internamente: la posición 0-based `i` de la API se mapea a `j = i + 1`.
- `j & -j` aísla el bit menos significativo: `add` **sube** sumándolo (`j += j & -j`), `prefix` **baja** restándolo (`j -= j & -j`). Esa es toda la magia del Fenwick.
- Es la estructura de "constante más baja" de los Trade-offs para suma-de-prefijo + actualización de punto; reserva el segment tree completo para mínimo/máximo de rango o lazy propagation, que Fenwick no maneja tan naturalmente.

## Complejidad del barrido — qué domina
type: complexity

La plantilla `maximo_solapamiento` (sección 3) construye `2N` eventos, los ordena, y luego hace un solo barrido lineal acumulando un contador. ¿Cuál es la complejidad total y cuál paso domina?

### Opciones
- [x] O(n log n): construir los `2N` eventos es O(n) y el barrido lineal es O(n), pero el `sort` de los eventos es O(n log n) y domina el total.
- O(n): tanto la construcción de eventos como el barrido son lineales, y ordenar `2N` enteros pequeños es O(1) amortizado.
- O(n²): por cada evento se recorre la lista completa de intervalos activos para recalcular el contador desde cero.
- O(log n): el barrido es un binary search sobre los eventos ordenados que localiza directamente el punto de máximo solapamiento.

### Justificación
Descompón la plantilla: construir eventos O(n), barrido O(n), `sort` O(n log n). El `sort` domina → total **O(n log n)**. El distractor 2 afirma un `sort` en O(1), falso. El distractor 3 describe un re-escaneo ingenuo que el barrido **evita**: el contador se mantiene incrementalmente con `+1`/`−1`, sin recalcular. El distractor 4 confunde el barrido lineal (un puntero que avanza monótonamente, como two pointers en CP1) con un binary search.

## Empate en el barrido — ¿entra o sale primero?
type: trace

Dos intervalos: `[1,3]` y `[3,5]`. El problema define los intervalos como cerrados pero que NO cuentan como solapados en el punto exacto de contacto (tocarse en 3 no es solapamiento). ¿Cómo debes romper el empate en la coordenada 3, y qué máximo produce el orden correcto?

### Opciones
- [x] Procesar la SALIDA (−1) antes que la ENTRADA (+1) en el empate en la coordenada 3: el contador baja a 0 al cerrar `[1,3]` antes de subir a 1 al abrir `[3,5]`, y el máximo correcto es 1 (nunca 2). Si entraras antes de salir, el contador llegaría a 2 y reportarías un solapamiento que el problema no considera real.
- Procesar la ENTRADA (+1) antes que la SALIDA (−1): el contador sube a 2 en la coordenada 3, que es el solapamiento máximo correcto porque ambos intervalos contienen el punto 3.
- El orden del empate es irrelevante: el máximo es 2 en cualquier orden, porque `sort` estabiliza los eventos por posición y el resultado no depende del desempate.
- Hay que eliminar uno de los dos eventos en la coordenada 3 para evitar el empate, quedándote solo con la entrada de `[3,5]`.

### Justificación
Es la trampa de "Eventos ordenados incorrectamente en el sweep" (sección 3 + Trampas). Los eventos son `(1,+1), (3,−1)` para `[1,3]` y `(3,+1), (5,−1)` para `[3,5]`. Con salida-antes-de-entrada: `1→+1=1`, `3→−1=0`, `3→+1=1`, `5→−1=0` → máximo **1**. Con entrada-antes-de-salida: `1→1`, `3→2`, `3→1`, `5→0` → máximo **2**. Como el problema dice que tocarse en 3 NO cuenta, el correcto es salida-primero → 1. El distractor 2 solo sería correcto si tocarse SÍ contara (definición opuesta). El distractor 3 niega la trampa entera (el resultado **sí** depende del desempate). El distractor 4 inventa borrar eventos. "Verifica explícitamente contra la definición del problema... no asumas un orden por defecto".

## Segment tree o Fenwick — cuándo el más ligero no alcanza
type: multiple_choice

Para actualización de punto + suma de rango, un Fenwick tree (BIT) es más simple y tiene una constante más baja. Pero tu problema en cambio pide actualización de punto + **mínimo** de rango. ¿Cuál estructura, y por qué?

### Opciones
- [x] Segment tree: Fenwick es más ligero y suficiente para suma (que se descompone en resta de prefijos), pero el mínimo de rango no es una resta de prefijos, así que Fenwick no lo maneja naturalmente — el segment tree, que agrega cada rango explícitamente en sus nodos, sí soporta mínimo/máximo directamente.
- Fenwick tree: basta cambiar la operación de `+` a `min` en el update y en la query de prefijo, y obtienes mínimo de rango arbitrario con la misma estructura ligera.
- Prefix sums de mínimos: precomputa el mínimo acumulado y responde el mínimo de `[l,r]` como `min_prefijo[r] − min_prefijo[l−1]`.
- Ninguna estructura de rango sirve para mínimo con actualizaciones; hay que reordenar las consultas offline y resolverlas con un heap.

### Justificación
Trade-offs, "Segment tree vs Fenwick tree": el Fenwick "es más simple de codificar y tiene una constante más baja" para suma+actualización de punto, "reservando segment tree completo para cuando necesitas operaciones más generales (mínimo/máximo de rango, lazy propagation) que Fenwick tree no maneja tan naturalmente". La suma tiene inverso (resta de prefijos); el **mínimo no tiene inverso**, por eso la resta del distractor 3 es un sinsentido. El distractor 2 es la trampa: un Fenwick de mínimos solo soporta ciertas formas restringidas (p.ej. prefijo con actualizaciones que solo disminuyen el valor), no el mínimo de rango arbitrario con actualizaciones generales. El distractor 4 sobre-complica algo que el segment tree resuelve online directamente cambiando la operación de agregación de suma a `min`.
