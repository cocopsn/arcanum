---
module_id: itc-c7-grafos-ii
spine: ITC
title: "Grafos II — caminos mínimos y expansión"
subtitle: "Encontrar el mejor camino cuando cada paso cuesta distinto"
source_canonical: "MIT 6.006 L11-L13; CLRS cap. 22-24; CS61B"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Grafos II — caminos mínimos y expansión

> **Pregunta raíz.** BFS te da el camino con **menos aristas** entre dos puntos — perfecto cuando cada conexión "cuesta lo mismo". Pero en el mundo real, cada arista casi nunca cuesta lo mismo: una carretera de 200 km no es equivalente a una de 2 km, una conexión de red saturada no es equivalente a una libre. **En cuanto las aristas tienen peso, BFS deja de servir — y hay que deducir, desde cero, qué algoritmo sí resuelve "el camino más barato", no solo "el camino con menos saltos".** Ese es el terreno completo de este módulo: cómo se comporta la búsqueda de caminos óptimos cuando el costo de cada paso no es uniforme, y qué pasa cuando además necesitas conectar **toda** una red al menor costo total posible, no solo encontrar un camino entre dos puntos.

## Prólogo — de dónde nace esto

Piensa en planear un viaje por carretera. Si todas las carreteras tomaran exactamente el mismo tiempo por segmento, "la ruta más rápida" sería simplemente "la ruta con menos cruces de ciudad" — exactamente lo que BFS te daría. Pero las carreteras reales tienen longitudes y velocidades distintas: un camino con más segmentos pero todos cortos y rápidos puede ser mucho más rápido que un camino con menos segmentos pero uno de ellos larguísimo y congestionado. La pregunta "¿cuál es el camino más rápido?" deja de ser una pregunta sobre **contar pasos** y se convierte en una pregunta sobre **sumar costos** — y esa diferencia, aparentemente pequeña, es exactamente lo que hace que necesites un algoritmo completamente distinto a BFS.

Este módulo tiene dos mitades que comparten la misma raíz conceptual pero responden preguntas distintas. La primera mitad — Dijkstra y Bellman-Ford — responde "¿cuál es el camino más barato **entre dos puntos específicos**?". La segunda mitad — Kruskal y Prim — responde una pregunta relacionada pero distinta: "si necesito conectar **todos** los puntos de una red entre sí (no solo dos específicos), ¿cuál es la forma más barata de hacerlo?" — piensa en tender cableado eléctrico para conectar todas las casas de un vecindario al menor costo total de cable, no en encontrar la ruta más barata entre dos casas específicas. Ambas preguntas se resuelven con la misma herramienta conceptual — una estrategia **greedy** (voraz) que toma la decisión localmente óptima en cada paso — y vas a deducir, con rigor completo, por qué esa estrategia greedy es matemáticamente correcta en ambos casos, y exactamente dónde deja de serlo.

---

## 1. Por qué BFS falla con pesos — el contraejemplo concreto

### 1.1 El mecanismo de BFS, y por qué depende de que cada arista cueste lo mismo

Recuerda del módulo anterior: BFS garantiza el camino más corto **en número de aristas** porque procesa los vértices en orden estrictamente creciente de distancia, usando una cola FIFO — todos los vértices a distancia k se procesan completamente antes que cualquier vértice a distancia k+1. Esta garantía depende, de forma esencial y no accidental, de que **cada arista cuenta como "+1" de distancia** — así que "procesado antes en la cola" es exactamente equivalente a "descubierto con una distancia acumulada menor".

### 1.2 El contraejemplo: por qué esa equivalencia se rompe con pesos

Considera un grafo dirigido con tres vértices: `A → B` con peso 10, `A → C` con peso 1, y `C → B` con peso 1. Si aplicaras BFS ingenuamente (ignorando pesos, tratando cada arista como "un salto"), descubrirías `B` en la primera capa (un salto desde A) con "distancia" 1 salto, y nunca reconsiderarías esa distancia — pero el camino real más barato hacia B es `A → C → B`, con costo total `1 + 1 = 2`, estrictamente menor que el costo `10` del camino directo `A → B` de un solo salto. **BFS, al medir "distancia" en número de aristas, llega a la conclusión incorrecta de que el camino directo de un salto es "mejor" simplemente porque tiene menos aristas** — sin ninguna noción de que esa única arista podría costar mucho más que dos aristas combinadas.

**La consecuencia de diseño, deducida directamente de este contraejemplo**: necesitas un algoritmo que compare **costos acumulados reales**, no número de aristas — y que esté dispuesto a **reconsiderar** su estimación de la mejor forma de llegar a un vértice si descubre, después, un camino más barato (aunque tenga más aristas) que el que había encontrado primero. Esa es exactamente la propiedad que BFS, con su procesamiento FIFO estrictamente por capas, no tiene — y es exactamente la propiedad que Dijkstra va a construir desde cero.

---

## 2. Dijkstra — deducido desde la estrategia greedy y por qué funciona

### 2.1 La estrategia greedy: procesar vértices en orden de distancia YA CONOCIDA creciente

La idea central de Dijkstra, deducida directamente del contraejemplo anterior: en vez de procesar vértices en el orden en que los **descubres** (como BFS, con FIFO puro), procesa vértices en el orden de su **distancia acumulada actual conocida**, de menor a mayor — y mantén, para cada vértice, la mejor estimación de distancia encontrada **hasta ahora**, actualizándola (relajándola) cada vez que encuentres un camino mejor.

**Relajación de arista**, el mecanismo atómico central: para una arista `(u, v)` con peso `w`, si `distancia[u] + w < distancia[v]`, entonces encontraste un camino mejor hacia v pasando por u — actualiza `distancia[v] = distancia[u] + w` y registra `u` como el predecesor de v en ese camino mejorado. Esta operación, por sí sola, no garantiza nada sobre optimalidad global — es solo "mejora tu estimación local si encuentras evidencia de que puedes mejorarla". La pregunta que hay que responder con rigor es: **¿en qué orden aplicar estas relajaciones garantiza que, cuando finalmente "cierras" (das por definitiva) la distancia de un vértice, esa distancia sea efectivamente la óptima?**

### 2.2 La prueba de correctitud: por qué procesar en orden de distancia creciente es seguro

**Afirmación**: si en cada paso extraes, de entre los vértices no procesados todavía, el que tiene la **menor** distancia estimada actual, y "cierras" esa distancia como definitiva (nunca la vuelves a cambiar), el resultado es correcto — **siempre que todos los pesos sean no negativos** (la condición que vamos a ver exactamente por qué es necesaria en la sección 2.4).

**La prueba, por contradicción, deducida paso a paso**: supón que extraes el vértice `u` con la menor distancia estimada `d[u]` entre los no procesados, y supón, para llegar a una contradicción, que `d[u]` **no** es en realidad la distancia mínima real hacia u — es decir, existe un camino real más corto hacia u que el que `d[u]` representa actualmente. Ese camino más corto (hipotético) tiene que salir del conjunto de vértices ya procesados (donde las distancias ya están confirmadas como correctas, por hipótesis inductiva) hacia el conjunto de no procesados, cruzando en algún punto una arista `(x, y)` donde `x` ya fue procesado y `y` todavía no. Como los pesos son **no negativos** (aquí es exactamente donde esa condición entra en juego), la distancia hasta ese punto de cruce `y`, siguiendo el camino hipotéticamente más corto, ya sería **al menos** `d[x] + peso(x,y)` — y por cómo funciona la relajación, esa cantidad ya habría sido considerada como candidata para `d[y]` en el momento en que `x` fue procesado. Como los pesos son no negativos, continuar el camino desde `y` hasta `u` **solo puede aumentar** la distancia total (nunca reducirla, porque no hay aristas de peso negativo que "recuperen" costo) — así que la distancia real hacia `u` por este camino hipotético es **al menos** `d[y]`, que a su vez es **al menos** tan grande como `d[u]` (porque elegiste extraer `u` precisamente por tener la menor distancia estimada entre los no procesados, y `y` también está en ese conjunto de no procesados). Esto contradice la suposición de que existía un camino estrictamente más corto que `d[u]` — por lo tanto, `d[u]` ya era la distancia mínima real. ∎

**La pieza que hace toda la prueba funcionar, remarcada explícitamente**: la garantía de que "continuar el camino desde y hasta u solo puede aumentar la distancia total" depende **enteramente** de que ningún peso sea negativo. Esta es exactamente la grieta que vamos a explotar en la sección 2.4 para mostrar por qué Dijkstra falla con pesos negativos — no es un detalle técnico menor de la prueba, es el paso exacto donde la prueba se rompe.

### 2.3 Por qué necesitas una cola de prioridad — la conexión directa con el módulo de heaps

La estrategia greedy exige, en cada paso, **extraer el vértice no procesado con menor distancia estimada actual** — exactamente la operación `extraer_minimo` de una cola de prioridad, que ya construiste completa (con la prueba rigurosa de por qué heapify es O(n)) en el módulo `itc-c5-heaps`. Además, cada vez que relajas una arista y mejoras la estimación de distancia de un vértice, necesitas que esa mejora se refleje en la cola de prioridad — la operación `decrease-key` que ya identificaste en ese módulo como la razón teórica de por qué un Fibonacci heap ofrece la complejidad asintótica óptima para Dijkstra, aunque en la práctica un heap binario con el ajuste de permitir entradas obsoletas (e ignorarlas al extraerlas) sea frecuentemente más rápido por constantes prácticas menores.

```python
import heapq

def dijkstra(grafo, origen):
    """
    Dijkstra con heap binario. Grafo representado como dict:
    vertice -> lista de (vecino, peso).
    Fiel al esquema de CLRS 24.3 / MIT 6.006 L11-12.
    Requiere TODOS los pesos no negativos (ver seccion 2.4).
    """
    distancia = {v: float('inf') for v in grafo}
    distancia[origen] = 0
    predecesor = {origen: None}
    visitado = set()

    # heap de (distancia_estimada, vertice) -- Python compara tuplas
    # lexicograficamente, asi que el heap ordena por distancia primero.
    heap = [(0, origen)]

    while heap:
        d_actual, u = heapq.heappop(heap)

        if u in visitado:
            # entrada OBSOLETA: ya procesamos u con una distancia mejor
            # antes. En vez de implementar decrease-key de verdad,
            # simplemente ignoramos duplicados obsoletos (el ajuste
            # practico mencionado en la seccion 2.3).
            continue
        visitado.add(u)

        for vecino, peso in grafo[u]:
            if peso < 0:
                raise ValueError("Dijkstra no soporta pesos negativos (seccion 2.4)")
            nueva_distancia = distancia[u] + peso
            if nueva_distancia < distancia[vecino]:
                distancia[vecino] = nueva_distancia
                predecesor[vecino] = u
                heapq.heappush(heap, (nueva_distancia, vecino))

    return distancia, predecesor


if __name__ == "__main__":
    # el contraejemplo de la seccion 1.2, mas un vertice extra
    grafo = {
        "A": [("B", 10), ("C", 1)],
        "B": [],
        "C": [("B", 1)],
    }
    distancias, _ = dijkstra(grafo, "A")
    print(distancias)   # {'A': 0, 'B': 2, 'C': 1} -- correcto: A-C-B cuesta 2, no 10
    assert distancias["B"] == 2
```

**Costo total**: cada vértice se extrae del heap a lo más una vez de forma "efectiva" (las extracciones de entradas obsoletas son O(1) adicional cada una, descartadas inmediatamente) — V extracciones a O(log V) cada una. Cada arista puede disparar, a lo más, una inserción al heap (cuando relaja exitosamente) — E inserciones a O(log V) cada una. Total: **O((V+E) log V)**, dominado por el término de las aristas cuando el grafo es razonablemente denso.

### 2.4 Por qué Dijkstra FALLA con pesos negativos — el argumento completo, no solo el hecho

Aquí está la pieza que hay que dominar con el mismo rigor que la prueba de correctitud — no basta con saber "Dijkstra no funciona con pesos negativos", hay que poder **construir** el contraejemplo que lo demuestra.

**Contraejemplo concreto**: considera un grafo dirigido con vértices `A, B, C`, y aristas `A → B` con peso 5, `A → C` con peso 2, `C → B` con peso **-4** (peso negativo). El camino real más corto de A a B es `A → C → B`, con costo `2 + (-4) = -2` — estrictamente mejor que el camino directo `A → B` con costo 5.

**Corre Dijkstra mentalmente sobre este grafo**: inicialmente, `d[A]=0`, todo lo demás infinito. Extraes A (menor distancia, 0), relajas sus aristas: `d[B] = 5`, `d[C] = 2`. Ahora, el vértice no procesado con **menor** distancia estimada es `C` (distancia 2, menor que la distancia 5 de B) — así que Dijkstra extrae `C` **antes** que B, y lo "cierra" como definitivo con `d[C]=2` (correcto, en este caso particular). Al procesar C, relaja la arista `C → B` con peso -4: `d[C] + (-4) = 2 - 4 = -2`, que es menor que el `d[B]=5` actual, así que Dijkstra actualiza `d[B] = -2` — **y esto todavía es correcto**, porque C se procesó antes que B.

Pero ahora considera una variante ligeramente distinta donde `A → B` tiene peso **1** en vez de 5 (todo lo demás igual: `A → C` peso 2, `C → B` peso -4): Dijkstra extrae A, relaja: `d[B]=1`, `d[C]=2`. Ahora el vértice con **menor** distancia estimada es `B` (distancia 1, menor que la distancia 2 de C) — así que Dijkstra extrae `B` **primero** y lo **cierra como definitivo con d[B]=1**. Pero el camino real más corto hacia B es, de nuevo, `A → C → B` con costo `2 + (-4) = -2`, estrictamente menor que 1 — **y Dijkstra ya cerró B con el valor incorrecto, y nunca lo va a reconsiderar**, porque una vez que un vértice se marca como visitado/procesado, el algoritmo (tal como está diseñado) nunca vuelve a relajar sus aristas de entrada.

**El diagnóstico exacto, conectado directamente con dónde se rompió la prueba de la sección 2.2**: la prueba de correctitud dependía de que "continuar el camino desde el punto de cruce hasta u solo puede aumentar la distancia total" — una garantía que **solo** se sostiene si no hay pesos negativos. Con la arista `C → B` de peso -4, continuar el camino **reduce** drásticamente la distancia total, exactamente lo que la prueba prohibía como imposible. Dijkstra extrae y cierra vértices asumiendo que ningún descubrimiento futuro puede mejorar una distancia ya cerrada — un supuesto que los pesos negativos violan directamente, porque una arista negativa "lejana" en el grafo puede retroactivamente hacer que un camino con más aristas termine siendo más barato que uno ya dado por óptimo con menos aristas.

---

## 3. Bellman-Ford — por qué relajar |V|-1 veces resuelve lo que Dijkstra no puede

### 3.1 La estrategia, deducida desde el fallo de Dijkstra

Si el problema de Dijkstra es que **cierra vértices prematuramente**, asumiendo que ya no pueden mejorar, la solución obvia (aunque más costosa) es: **no cierres nada prematuramente — simplemente relaja todas las aristas del grafo, repetidamente, hasta que ya no haya ninguna mejora posible.**

**¿Cuántas veces hay que repetir esto, y por qué exactamente ese número?** La deducción: en un grafo sin ciclos negativos, cualquier camino más corto real entre dos vértices, si existe, usa **a lo más V-1 aristas** — porque un camino más corto nunca repite un vértice (si repitiera un vértice, formaría un ciclo, y como ningún ciclo tiene peso negativo por supuesto de esta sección, quitar ese ciclo del camino no aumenta su costo, así que existe un camino igual de corto o más corto sin repetir vértices) — y un camino simple (sin repetir vértices) en un grafo de V vértices tiene, como máximo, V-1 aristas (visita, a lo más, los V vértices una vez cada uno). Si relajas **todas** las aristas del grafo, en cualquier orden, una vez completa, garantizas que **al menos un vértice adicional** en cualquier camino óptimo no descubierto todavía queda correctamente relajado en esa pasada (el primer vértice del camino óptimo que todavía no tenía su distancia correcta). Repitiendo esto V-1 veces, garantizas que **incluso el camino óptimo más largo posible** (con V-1 aristas) queda completamente relajado, arista por arista, en el peor caso una arista nueva correctamente relajada por cada pasada completa.

```python
def bellman_ford(grafo, origen, vertices):
    """
    Bellman-Ford: relaja TODAS las aristas, |V|-1 veces.
    Fiel al esquema de CLRS 24.1. Soporta pesos negativos
    (a diferencia de Dijkstra), y DETECTA ciclos negativos.
    """
    distancia = {v: float('inf') for v in vertices}
    distancia[origen] = 0
    predecesor = {v: None for v in vertices}

    aristas = [(u, v, peso) for u in grafo for v, peso in grafo[u]]

    # Relajar TODAS las aristas, |V|-1 veces.
    for _ in range(len(vertices) - 1):
        for u, v, peso in aristas:
            if distancia[u] != float('inf') and distancia[u] + peso < distancia[v]:
                distancia[v] = distancia[u] + peso
                predecesor[v] = u

    # Pasada EXTRA (la V-esima): si TODAVIA hay una relajacion posible,
    # existe un ciclo negativo alcanzable -- ninguna distancia finita
    # real puede seguir mejorando despues de V-1 pasadas completas,
    # asi que si mejora, la "distancia optima" no esta bien definida
    # (puedes seguir dando vueltas al ciclo negativo reduciendo el
    # costo indefinidamente).
    for u, v, peso in aristas:
        if distancia[u] != float('inf') and distancia[u] + peso < distancia[v]:
            raise ValueError("Ciclo negativo detectado: no existe camino minimo bien definido")

    return distancia, predecesor


if __name__ == "__main__":
    # el mismo grafo con peso negativo que rompio Dijkstra:
    grafo = {
        "A": [("B", 1), ("C", 2)],
        "B": [],
        "C": [("B", -4)],
    }
    distancias, _ = bellman_ford(grafo, "A", ["A", "B", "C"])
    print(distancias)   # {'A': 0, 'B': -2, 'C': 2} -- CORRECTO, a diferencia de Dijkstra
    assert distancias["B"] == -2
```

### 3.2 Por qué detecta ciclos negativos — deducido del mismo argumento

Si después de V-1 pasadas completas de relajación todavía existe alguna arista que puede relajarse (mejorar alguna distancia), eso significa que algún camino usa **más de V-1 aristas** para ser "óptimo" — pero ya establecimos que ningún camino simple puede tener más de V-1 aristas. La única forma de que un camino "óptimo" necesite más aristas que eso es que **no sea simple** — que repita vértices, es decir, que contenga un ciclo, y que ese ciclo tenga peso negativo (de otra forma, quitarlo no empeoraría el camino, y el camino simple resultante ya habría sido capturado en las V-1 pasadas). Esta es exactamente la razón por la que la pasada extra (la V-ésima) en el código de arriba sirve como detector: **cualquier mejora posible después de V-1 pasadas completas es evidencia directa de un ciclo negativo alcanzable desde el origen**, no de un camino simple que simplemente no había tenido tiempo de propagarse todavía.

---

## 4. MST — la segunda pregunta: conectar TODO al menor costo total

### 4.1 Por qué esta es una pregunta distinta a caminos mínimos

Un **árbol de expansión mínima (Minimum Spanning Tree, MST)** de un grafo no dirigido y conexo es un subconjunto de aristas que **conecta todos los vértices** (forma un árbol que abarca —spans— todos los vértices, sin ciclos, exactamente la definición de árbol que ya estableciste en el módulo de grafos anterior: conexo y acíclico) con el **costo total mínimo posible** (la suma de los pesos de las aristas elegidas).

**Por qué esto no es "lo mismo que caminos mínimos, aplicado repetidamente"**: un MST no garantiza que el camino **entre dos vértices específicos cualesquiera**, siguiendo únicamente las aristas del MST, sea el camino más corto posible entre ellos en el grafo original — el MST optimiza el **costo total de conectar todo**, no el costo de cada par específico de vértices por separado. Estas son, genuinamente, dos preguntas distintas con respuestas potencialmente distintas, aunque comparten el mismo tipo de estrategia de solución (greedy) y el mismo tipo de argumento de correctitud (la propiedad del corte, que vamos a deducir a continuación).

### 4.2 La propiedad del corte — el argumento de correctitud que hace posible tanto Kruskal como Prim

Esta es la pieza intelectual central de esta mitad del módulo — hay que deducirla con el mismo rigor que la prueba de Dijkstra.

**Definición de "corte"**: un corte de un grafo es cualquier forma de dividir el conjunto de vértices en dos subconjuntos no vacíos, `S` y `V-S`. Una arista **cruza** el corte si tiene un extremo en `S` y el otro en `V-S`.

**Propiedad del corte (Cut Property)**: para cualquier corte `(S, V-S)`, si `e` es la arista de **menor peso** entre todas las que cruzan ese corte (y ese mínimo es único, o eliges cualquiera entre los empatados), entonces `e` pertenece a **algún** MST del grafo.

**La prueba, por intercambio, deducida paso a paso**: supón, para llegar a una contradicción, que existe un MST `T` que **no** contiene la arista mínima `e` del corte. Como `T` es un árbol que conecta todos los vértices, y `S` y `V-S` son ambos no vacíos, `T` **tiene que** contener alguna arista que cruce el corte (de otra forma, `T` no conectaría los vértices de `S` con los de `V-S`, y no sería un árbol de expansión válido) — llamemos a esa arista `e'`, con `peso(e') ≥ peso(e)` por definición de que `e` es la mínima entre las que cruzan el corte.

Ahora, **construye un árbol nuevo** `T'` quitando `e'` de `T` y agregando `e` en su lugar. ¿Sigue siendo `T'` un árbol de expansión válido? Sí: quitar `e'` de `T` divide al árbol en exactamente dos componentes (porque un árbol es mínimamente conexo — quitar cualquier arista lo desconecta en exactamente dos piezas, una consecuencia directa de que un árbol tiene exactamente V-1 aristas y es acíclico); como `e` también cruza el mismo corte que `e'` cruzaba, `e` reconecta exactamente esas mismas dos componentes, así que `T'` sigue siendo conexo y sigue teniendo V-1 aristas — es decir, sigue siendo un árbol de expansión válido.

**El costo de `T'` comparado con `T`**: `costo(T') = costo(T) - peso(e') + peso(e) ≤ costo(T)`, porque `peso(e) ≤ peso(e')` por construcción. Si `T` era un MST (costo mínimo posible), y `T'` tiene costo menor o igual, entonces `T'` **también** es un MST — y `T'` **sí** contiene `e`. Esto prueba que existe (al menos) un MST que contiene `e`, exactamente lo que la propiedad del corte afirma. ∎

**Por qué esta prueba es la que habilita ambos algoritmos greedy simultáneamente**: la propiedad del corte te dice que **siempre es seguro** elegir la arista más barata que cruza cualquier corte que definas — nunca vas a arrepentirte de esa elección, porque siempre existe un MST que la incluye. Kruskal y Prim son, cada uno, una estrategia distinta de **qué cortes considerar y en qué orden**, pero ambos se apoyan, sin excepción, en esta misma garantía matemática para justificar por qué su elección greedy local nunca compromete la optimalidad global.

### 4.3 Kruskal — ordena todas las aristas, aplica la propiedad del corte globalmente

**La estrategia**: ordena **todas** las aristas del grafo de menor a mayor peso. Recorre esa lista en orden, y para cada arista, agrégala al MST en construcción **si y solo si** no crea un ciclo con las aristas ya elegidas (es decir, si sus dos extremos todavía no están conectados por el subconjunto de aristas ya elegido).

**Por qué esto es exactamente una aplicación repetida de la propiedad del corte**: cuando consideras la arista de menor peso todavía no procesada, y sus dos extremos están en componentes distintas del MST parcial construido hasta ahora, esa arista es, precisamente, la arista de menor peso que cruza el corte definido por "una componente vs. todo el resto" — la propiedad del corte garantiza que agregarla es seguro. Si sus dos extremos ya están en la **misma** componente, agregarla crearía un ciclo (violaría la definición de árbol), así que se descarta, sin que eso comprometa la optimalidad (la propiedad del corte no dice nada sobre esa arista específica en ese caso, porque no cruza ningún corte relevante entre componentes distintas).

**El problema de implementación que esto genera, y su solución**: para decidir eficientemente "¿estos dos vértices ya están en la misma componente del MST parcial?", necesitas una estructura de datos que soporte, eficientemente, **unir** dos componentes (cuando agregas una arista) y **consultar** si dos elementos están en la misma componente — exactamente el problema que resuelve la estructura **Union-Find (Disjoint Set Union)**.

```python
class UnionFind:
    """
    Union-Find con compresion de camino y union por rango --
    ambas optimizaciones dan un costo amortizado casi-constante
    por operacion (formalmente O(alpha(n)), donde alpha es la
    funcion inversa de Ackermann, que crece tan lentamente que
    es efectivamente constante para cualquier n del mundo real).
    """
    def __init__(self, elementos):
        self._padre = {e: e for e in elementos}
        self._rango = {e: 0 for e in elementos}

    def encontrar(self, x):
        # Compresion de camino: al buscar la raiz, reengancha
        # cada nodo visitado DIRECTAMENTE a la raiz, aplanando
        # el arbol para que futuras busquedas sean mas rapidas.
        if self._padre[x] != x:
            self._padre[x] = self.encontrar(self._padre[x])
        return self._padre[x]

    def unir(self, x, y):
        raiz_x, raiz_y = self.encontrar(x), self.encontrar(y)
        if raiz_x == raiz_y:
            return False   # ya estaban en la misma componente
        # Union por rango: cuelga el arbol mas pequeno bajo el
        # mas grande, para mantener los arboles bajos.
        if self._rango[raiz_x] < self._rango[raiz_y]:
            raiz_x, raiz_y = raiz_y, raiz_x
        self._padre[raiz_y] = raiz_x
        if self._rango[raiz_x] == self._rango[raiz_y]:
            self._rango[raiz_x] += 1
        return True


def kruskal(vertices, aristas):
    """
    aristas: lista de (peso, u, v).
    Fiel al esquema de CLRS 23.2.
    """
    uf = UnionFind(vertices)
    mst = []
    for peso, u, v in sorted(aristas):   # orden ascendente de peso
        if uf.unir(u, v):                # True si NO formaba ciclo
            mst.append((peso, u, v))
    return mst


if __name__ == "__main__":
    vertices = ["A", "B", "C", "D"]
    aristas = [(1, "A", "B"), (3, "B", "C"), (2, "A", "C"), (4, "C", "D")]
    resultado = kruskal(vertices, aristas)
    print(resultado)   # [(1,'A','B'), (2,'A','C'), (4,'C','D')] -- costo total 7
    assert sum(p for p, _, _ in resultado) == 7
```

**Costo**: dominado por ordenar las aristas, O(E log E), más E operaciones de Union-Find a costo prácticamente constante amortizado cada una — total **O(E log E)**, equivalente a O(E log V) porque E ≤ V² implica log E = O(log V).

### 4.4 Prim — crece un único árbol, aplica la propiedad del corte localmente

**La estrategia alternativa**: en vez de ordenar todas las aristas globalmente, mantén un **único** árbol en crecimiento, empezando desde un vértice arbitrario. En cada paso, agrega la arista de **menor peso** que conecta el árbol actual (la componente `S` de la propiedad del corte, que crece en cada paso) con cualquier vértice todavía **fuera** del árbol (`V-S`).

**Por qué esto también es una aplicación directa de la propiedad del corte**: en cada paso, el corte relevante es exactamente "el árbol construido hasta ahora" vs. "todo lo demás" — y la arista que Prim elige es, por construcción, la de menor peso que cruza precisamente ese corte, así que la propiedad del corte garantiza directamente que agregarla es seguro.

**La implementación se apoya en una cola de prioridad**, exactamente como Dijkstra — de hecho, la estructura del código es casi idéntica a Dijkstra, con una diferencia conceptual clave que vale la pena remarcar explícitamente: Dijkstra prioriza por **distancia acumulada desde el origen**; Prim prioriza por **el peso de la arista individual** que conectaría el vértice al árbol — no una suma acumulada de camino, solo el costo de ese último paso de conexión.

```python
import heapq

def prim(grafo, origen):
    """
    grafo: dict vertice -> lista de (vecino, peso).
    Fiel al esquema de CLRS 23.2 (variante con heap).
    """
    en_arbol = {origen}
    mst = []
    heap = [(peso, origen, vecino) for vecino, peso in grafo[origen]]
    heapq.heapify(heap)

    while heap and len(en_arbol) < len(grafo):
        peso, u, v = heapq.heappop(heap)
        if v in en_arbol:
            continue   # entrada obsoleta, mismo patron que en Dijkstra
        en_arbol.add(v)
        mst.append((peso, u, v))
        for vecino, p in grafo[v]:
            if vecino not in en_arbol:
                heapq.heappush(heap, (p, v, vecino))

    return mst
```

---

## 5. Edge cases y trampas explícitas

**Grafo desconectado y MST**: un MST, por definición, requiere que el grafo original sea **conexo** — si no lo es, no existe ningún árbol que conecte todos los vértices (porque, por definición de "desconectado", algunos vértices no son alcanzables desde otros por ningún camino de aristas). En este caso, lo que existe es un **bosque de expansión mínima** (minimum spanning forest) — un MST independiente para cada componente conexa. Tanto Kruskal como Prim, aplicados ingenuamente sobre un grafo desconectado, requieren ajuste: Kruskal simplemente termina con menos de V-1 aristas en el resultado (las que corresponden a cada componente por separado, sin intentar unir componentes que no tienen ninguna arista entre sí); Prim, tal como está escrito arriba, se queda atascado si el heap se vacía antes de que `en_arbol` cubra todos los vértices — necesita el mismo envolvente de "reiniciar desde un vértice no visitado" que ya viste para componentes conexas en el módulo de grafos anterior.

**MST no es necesariamente único**: si existen aristas con pesos empatados, puede haber múltiples MSTs distintos, todos con el mismo costo total mínimo — la propiedad del corte garantiza que *alguna* elección entre las empatadas produce un MST válido, pero no dice que la elección sea la única forma de lograrlo. Esto es relevante si tu aplicación necesita un MST "canónico" específico (por ejemplo, para reproducibilidad de tests) — necesitarías un criterio de desempate explícito y consistente (como un orden secundario por identificador de vértice), no confiar en que el algoritmo produzca siempre exactamente el mismo resultado con pesos empatados.

**Ciclos negativos y por qué "camino mínimo" deja de estar bien definido**: si existe un ciclo alcanzable desde el origen con peso total negativo, puedes recorrer ese ciclo repetidamente, reduciendo el costo acumulado indefinidamente cada vuelta — no existe un "camino mínimo" finito bien definido hacia los vértices alcanzables después de ese ciclo, porque siempre puedes construir un camino "todavía mejor" dando una vuelta más al ciclo. Esta es la razón exacta de por qué Bellman-Ford necesita, explícitamente, **detectar y reportar** esta condición (sección 3.2) en vez de simplemente devolver un número — ese número, en presencia de un ciclo negativo alcanzable, no representaría nada matemáticamente coherente.

**Camino mínimo de fuente única vs. todos-los-pares**: Dijkstra y Bellman-Ford, tal como se presentaron aquí, resuelven el problema de **fuente única** (single-source shortest paths): las distancias más cortas desde **un** vértice origen específico hacia todos los demás. Si necesitas las distancias más cortas **entre todos los pares** de vértices simultáneamente, existe la opción de correr Dijkstra (o Bellman-Ford) una vez por cada vértice como origen — O(V) ejecuciones — pero también existen algoritmos diseñados específicamente para el problema de todos-los-pares (como Floyd-Warshall, basado en programación dinámica, fuera del alcance de este módulo específico pero que vale la pena reconocer como el nombre correcto a buscar cuando la pregunta es genuinamente "todos contra todos", no solo "desde un origen").

---

## 6. Trade-offs explícitos

**Dijkstra O((V+E) log V) vs. Bellman-Ford O(VE)**: Dijkstra es estrictamente más rápido, pero **solo** es aplicable con pesos no negativos garantizados. Bellman-Ford es más lento (V veces el costo de relajar todas las aristas, contra el costo logarítmico de mantener una cola de prioridad de Dijkstra), pero funciona con pesos negativos y, como beneficio adicional, detecta ciclos negativos — una capacidad que Dijkstra ni siquiera puede intentar de forma coherente. **La regla de decisión**: usa Dijkstra por defecto cuando puedes garantizar pesos no negativos (el caso típico en distancias físicas, tiempos, costos monetarios positivos); usa Bellman-Ford cuando el dominio del problema genuinamente admite pesos negativos (por ejemplo, en ciertos problemas de arbitraje financiero, donde un "peso negativo" representa una ganancia neta en una cadena de transacciones, y detectar un ciclo negativo es literalmente detectar una oportunidad de arbitraje).

**Kruskal vs. Prim, según densidad del grafo**: Kruskal, dominado por el costo de ordenar todas las E aristas, tiene un costo que crece con E de forma más directa — para grafos **ralos** (E cercano a V, el caso típico de la mayoría de grafos reales, como ya estableciste en el módulo anterior), Kruskal con Union-Find es frecuentemente la opción más simple y eficiente en la práctica. Prim, con la implementación de heap mostrada arriba, tiene un costo similar en notación asintótica, pero para grafos **densos** (E cercano a V²), una variante de Prim con una implementación de array simple en vez de heap (evitando el overhead logarítmico cuando casi todas las aristas existen de todas formas) puede ser más eficiente en la práctica — un trade-off de implementación análogo al de matriz vs. lista de adyacencia del módulo anterior: la estructura de datos correcta depende de la densidad real del grafo que estás procesando, no de una preferencia abstracta entre los dos algoritmos.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Dijkstra en el routing real de redes — OSPF.** El protocolo de enrutamiento OSPF (Open Shortest Path First), ampliamente usado en redes internas de organizaciones grandes para decidir cómo enrutar tráfico entre routers, usa, como su nombre lo indica explícitamente, una variante de Dijkstra sobre un grafo donde los vértices son routers y los pesos de las aristas representan el costo de cada enlace (típicamente derivado del ancho de banda del enlace — enlaces más rápidos tienen menor "costo", haciendo que Dijkstra los prefiera naturalmente). Esta es la aplicación práctica directa de exactamente lo que probaste en la sección 2.2: cada router, ejecutando Dijkstra localmente sobre su vista del mapa de la red, calcula la ruta de menor costo total hacia cualquier destino — con la garantía formal de optimalidad que la prueba de correctitud te da, no solo una heurística que "funciona generalmente".

**Por qué el GPS usa variantes de esto, no Dijkstra puro.** Un sistema de navegación GPS moderno enfrenta un grafo con millones de nodos (intersecciones) y aristas (segmentos de calle) — correr Dijkstra puro, explorando en todas direcciones desde el origen hasta encontrar el destino, sería computacionalmente costoso a esa escala si el destino está lejos del origen en el mapa. La optimización práctica más común es **A\*** (A-star), una variante de Dijkstra que usa una **heurística** — una estimación (nunca sobreestimada, formalmente "admisible") de la distancia restante hacia el destino, típicamente la distancia en línea recta — para **priorizar** la exploración hacia vértices que parecen estar en la dirección correcta del destino, en vez de explorar uniformemente en todas direcciones como Dijkstra puro haría. A\* conserva la misma garantía de optimalidad de Dijkstra (bajo la condición de que la heurística nunca sobreestime la distancia real restante) mientras explora, en la práctica, muchísimos menos nodos — la diferencia entre "explorar el mapa completo alrededor de tu ubicación" y "explorar principalmente en la dirección general del destino".

**Bellman-Ford ES programación dinámica — el preludio directo al siguiente módulo.** Vale la pena reconocer explícitamente algo que quizás no fue obvio durante la derivación de la sección 3: Bellman-Ford, en su estructura, **es** un algoritmo de programación dinámica — cada pasada de relajación completa corresponde a calcular "la distancia mínima usando **a lo más k aristas**", para k creciente desde 1 hasta V-1, donde cada nueva pasada construye sobre los resultados de la pasada anterior (la distancia con a lo más k+1 aristas se deriva directamente de la distancia con a lo más k aristas, más una relajación adicional). Esta es exactamente la estructura de "subproblemas superpuestos, construidos incrementalmente uno sobre el anterior" que define programación dinámica como técnica general — y es precisamente por esto que Bellman-Ford, a diferencia de la estrategia puramente greedy de Dijkstra, puede tolerar pesos negativos: la programación dinámica no asume que una decisión local temprana sea definitiva (no "cierra" nada prematuramente como Dijkstra), reconsiderando sistemáticamente hasta que el proceso converge — exactamente la propiedad que la sección 2.4 identificó como la que Dijkstra sacrifica a cambio de velocidad.

---

## Síntesis — el mapa mental

1. BFS resuelve caminos mínimos **solo** cuando cada arista cuesta lo mismo — en cuanto los pesos varían, "menos aristas" y "menor costo total" dejan de ser equivalentes, y BFS puede llegar a la conclusión incorrecta (el contraejemplo del camino directo caro vs. el camino indirecto barato).
2. **Dijkstra** procesa vértices en orden de distancia estimada creciente, usando una cola de prioridad — su prueba de correctitud (por contradicción, vía el argumento del corte entre procesados/no procesados) depende **esencialmente** de que ningún peso sea negativo, porque solo así "continuar un camino nunca reduce su costo total" es una garantía válida.
3. **Dijkstra falla con pesos negativos** porque puede cerrar prematuramente un vértice con una distancia que, en realidad, todavía puede mejorarse por un camino que pasa por una arista negativa "lejana" en el grafo — el contraejemplo construido en la sección 2.4 muestra exactamente el mecanismo de esa falla, no solo el hecho de que ocurre.
4. **Bellman-Ford** relaja todas las aristas V-1 veces, garantizando que cualquier camino simple (a lo más V-1 aristas) quede completamente propagado — tolera pesos negativos porque nunca cierra nada prematuramente, y una pasada V-ésima que todavía encuentra mejoras es, matemáticamente, la firma inequívoca de un ciclo negativo alcanzable.
5. **MST** responde una pregunta distinta a caminos mínimos: conectar **todo** al menor costo total, no optimizar el camino entre dos puntos específicos — ambos problemas comparten la estrategia greedy y el mismo tipo de argumento de correctitud, pero son preguntas genuinamente distintas.
6. La **propiedad del corte**, probada por intercambio (construir un MST alternativo que nunca empeora al intercambiar la arista cruzada más cara por la más barata), es la garantía matemática que hace segura la elección greedy tanto de Kruskal (aplicándola globalmente sobre todas las aristas ordenadas) como de Prim (aplicándola localmente sobre el corte entre el árbol en crecimiento y el resto).
7. **Kruskal** usa Union-Find para detectar ciclos eficientemente; **Prim** usa una cola de prioridad, con estructura casi idéntica a Dijkstra pero priorizando el peso de la última arista, no la distancia acumulada.
8. **Bellman-Ford es, estructuralmente, programación dinámica** — subproblemas superpuestos parametrizados por "número máximo de aristas permitidas", construidos incrementalmente — el preludio conceptual directo al siguiente módulo del curso.

---

## Preguntas que deberías poder responder

1. Construye, sin ver el texto, un contraejemplo concreto de tres vértices donde BFS (ignorando pesos) da una respuesta incorrecta sobre el camino más barato, y explica exactamente por qué BFS llega a esa conclusión errónea.
2. Reproduce la prueba de correctitud de Dijkstra por contradicción — ¿en qué paso exacto de la prueba se usa la condición de que los pesos no sean negativos, y qué se rompe específicamente si esa condición no se cumple?
3. Construye, sin ver el texto, un grafo de tres vértices con un peso negativo donde Dijkstra cierra un vértice prematuramente con una distancia incorrecta — muestra paso a paso qué hace el algoritmo y por qué el resultado está mal.
4. Explica por qué Bellman-Ford necesita exactamente V-1 pasadas de relajación completa, no más ni menos (en ausencia de ciclos negativos) — conecta tu respuesta con la longitud máxima de un camino simple en un grafo de V vértices.
5. ¿Por qué una pasada V-ésima de Bellman-Ford que todavía encuentra una mejora es evidencia inequívoca de un ciclo negativo, y no simplemente de que hacían falta más pasadas?
6. Deriva, sin ver el texto, la propiedad del corte del MST usando el argumento de intercambio (construir un árbol alternativo T' a partir de un supuesto MST T que no contiene la arista mínima del corte) — ¿por qué T' sigue siendo un árbol de expansión válido después del intercambio?
7. Explica la diferencia conceptual entre qué prioriza Dijkstra (en su cola de prioridad) y qué prioriza Prim, a pesar de que ambas implementaciones usan una estructura de código casi idéntica.
8. ¿Por qué un MST no garantiza que el camino entre dos vértices específicos, restringido a las aristas del MST, sea el camino más corto entre ellos en el grafo original? Construye un ejemplo concreto donde esto se rompe.

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lectures 11-13 (Weighted Shortest Paths, Bellman-Ford, MST): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 22/23 (Minimum Spanning Trees: propiedad genérica y del corte, Kruskal, Prim) y Capítulo 24 (Single-Source Shortest Paths: Bellman-Ford 24.1, Dijkstra 24.3).
- UC Berkeley CS61B, notas sobre caminos mínimos y árboles de expansión mínima: https://sp21.datastructur.es/
- Dijkstra, E. W., "A note on two problems in connexion with graphs", *Numerische Mathematik*, 1959 — el paper original del algoritmo.
