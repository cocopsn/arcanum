---
module_id: itc-c6-grafos-i
spine: ITC
title: "Grafos I — recorrido y estructura"
subtitle: "La estructura de la que todo lo demás es un caso especial"
source_canonical: "MIT 6.006 L9-L11; CLRS cap. 20-22; CS61B"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Grafos I — recorrido y estructura

> **Pregunta raíz.** Un array es una secuencia lineal. Un árbol es una jerarquía donde cada nodo tiene un único padre. Ambas son estructuras poderosas, pero ambas son **restricciones específicas** sobre algo más general: un conjunto de cosas (vértices) con relaciones arbitrarias entre ellas (aristas) — sin exigir que esas relaciones formen una secuencia, ni una jerarquía de padre único, ni ninguna forma particular. **¿Por qué modelar un problema como grafo, en vez de forzarlo en la estructura más restrictiva de array o árbol, desbloquea algoritmos enteros que de otra forma ni siquiera podrías formular?** Ese es el terreno de este módulo — y la primera cosa que hay que interiorizar es que un array *es* un grafo (una cadena de vértices, cada uno conectado solo al siguiente) y un árbol *es* un grafo (sin ciclos, con un único camino entre cualquier par de nodos) — no analogías, sino **casos especiales literales** de la estructura más general que vas a estudiar aquí.

## Prólogo — de dónde nace esto

Piensa en una red social: personas (vértices) conectadas por relaciones de amistad (aristas). No hay ningún "orden" natural entre las personas como en un array, ni ninguna persona es el "padre" único de todas las demás como en un árbol — cualquiera puede estar conectado con cualquiera, en cualquier patrón. Preguntas naturales sobre esta red — "¿estas dos personas están conectadas por alguna cadena de amistades?", "¿cuál es la cadena de amistades más corta entre ellas?", "¿existen grupos de personas mutuamente desconectados del resto?" — no tienen ni siquiera *sentido* de formular sobre un array o un árbol, porque esas estructuras no tienen la libertad relacional para representar el problema en primer lugar.

Esta es la razón de ser de los grafos: son la estructura que **no impone ninguna restricción de forma** sobre las relaciones entre elementos, más allá de "existe una conexión o no existe". Esa generalidad tiene un precio (los algoritmos que operan sobre grafos generales son, en promedio, más complejos que los que operan sobre arrays o árboles, precisamente porque no pueden asumir ninguna estructura regular que explotar) — pero es exactamente lo que te permite modelar problemas que de otra forma no podrías ni plantear: redes de computadoras, dependencias entre tareas, mapas de carreteras, el propio grafo de conocimiento de un sistema de aprendizaje. Todo lo que sigue en este módulo son las dos formas fundamentales de **explorar** esa estructura general — y por qué cada una revela información distinta sobre ella.

---

## 1. Qué es un grafo — y por qué array y árbol son casos especiales, no analogías

### 1.1 Definición mínima, y las variantes deducidas desde qué relación quieres modelar

Un grafo `G = (V, E)` es un conjunto de **vértices** `V` (los elementos) y un conjunto de **aristas** `E` (pares de vértices, representando una relación entre ellos). Eso es todo — la definición no impone ninguna estructura adicional. Todo lo demás son variantes que existen porque distintos problemas necesitan modelar distintos tipos de relación:

**Dirigido vs. no dirigido**: si la relación es simétrica por naturaleza (amistad mutua, una carretera de doble sentido), una arista `{u, v}` conecta ambos sentidos por igual — grafo **no dirigido**. Si la relación tiene una dirección intrínseca que importa (A sigue a B en una red social sin que B necesariamente siga a A; una tarea que depende de otra), necesitas que la arista `(u, v)` sea distinta de `(v, u)` — grafo **dirigido** (digraph). La elección no es estética: modelar una relación inherentemente direccional como no dirigida **pierde información real** del problema (perderías la distinción entre "A depende de B" y "B depende de A", que en un sistema de dependencias es exactamente la información que te importa).

**Ponderado vs. no ponderado**: si cada arista tiene además un **costo** asociado (la distancia de una carretera, el tiempo de una conexión de red), es un grafo ponderado — necesario cuando la pregunta que quieres responder no es solo "¿existe un camino?" sino "¿cuál es el camino más *barato*?" (el terreno de Dijkstra, que construye sobre este módulo). Si toda arista cuenta como "el mismo costo unitario", no ponderado — suficiente cuando la pregunta es sobre número de saltos/conexiones, no sobre costo acumulado.

### 1.2 Por qué array y árbol son grafos, literalmente, no por analogía

Un **array** es un grafo dirigido donde el vértice `i` tiene exactamente una arista hacia `i+1` — una cadena lineal, el caso más restringido posible de conectividad. Un **árbol** es un grafo no dirigido, **conexo** (todo vértice alcanzable desde cualquier otro) y **acíclico** (no existe ningún camino que regrese a un vértice ya visitado sin repetir una arista) — la definición formal de árbol en teoría de grafos es exactamente "grafo conexo sin ciclos", y de ahí se deriva la propiedad familiar de que un árbol con n vértices tiene exactamente n-1 aristas (puedes probarlo por inducción: cada vértice nuevo agregado a un árbol existente necesita exactamente una arista nueva para conectarse sin crear un ciclo).

**La consecuencia práctica de reconocer esto**: cualquier algoritmo que ya conoces para árboles (recorrido, búsqueda) es, estructuralmente, un caso especial de un algoritmo de grafos más general, aplicado a una estructura con restricciones adicionales (acíclica, conexa) que simplifican el análisis. Esto significa que **no estás aprendiendo algoritmos completamente nuevos en este módulo** — estás aprendiendo la versión general de patrones que ya reconoces (recorrido, invariantes de exploración), ahora sin la muleta de las restricciones de árbol que hacían esos patrones más simples de razonar.

---

## 2. Representación — matriz de adyacencia vs. lista de adyacencia, el trade-off deducido

### 2.1 Matriz de adyacencia — la representación directa

La forma más directa de representar "¿existe una arista entre u y v?" es una matriz `A` de tamaño `|V| × |V|`, donde `A[u][v] = 1` (o el peso de la arista, si es ponderado) si existe una arista de `u` a `v`, y `0` en caso contrario.

**Costo de espacio**: **Θ(V²)**, sin importar cuántas aristas realmente existan — reservas espacio para **todos** los pares posibles de vértices, exista o no una arista entre ellos.

**Costo de operaciones**: verificar si existe una arista específica `(u,v)` es **O(1)** — aritmética de direcciones sobre la matriz, exactamente el mismo mecanismo de acceso indexado que ya conoces de arrays. Pero **recorrer todos los vecinos de un vértice u** (una operación central en BFS/DFS, como vas a ver) exige revisar la fila completa de u — **O(V)**, sin importar cuántos vecinos reales tenga u.

### 2.2 Lista de adyacencia — la representación que explota la escasez

Para cada vértice `u`, guarda **solo** la lista de sus vecinos reales — no una fila completa de tamaño V, solo tantas entradas como aristas realmente salen de `u`.

**Costo de espacio**: **Θ(V + E)** — proporcional al número de vértices más el número de aristas *reales*, no al número de pares posibles.

**Costo de operaciones**: recorrer todos los vecinos de `u` es **O(grado(u))** — exactamente proporcional a cuántos vecinos reales tiene, no a V. Verificar si una arista específica `(u,v)` existe exige recorrer la lista de adyacencia de u — **O(grado(u))** en el peor caso, peor que el O(1) de la matriz para esta operación específica.

### 2.3 El trade-off, deducido desde la densidad del grafo — no una preferencia arbitraria

**Grafo denso** (E cercano a V², es decir, casi todos los pares posibles de vértices tienen una arista): la matriz de adyacencia usa Θ(V²) de espacio, que es aproximadamente lo mismo que Θ(V+E) cuando E≈V² — **no hay desperdicio real de espacio**, y ganas el acceso O(1) a cualquier arista específica. Aquí la matriz es la elección razonable.

**Grafo ralo/disperso** (E mucho menor que V², el caso típico de la inmensa mayoría de grafos del mundo real — una red social donde cada persona tiene cientos de amigos, no millones; una red de carreteras donde cada ciudad conecta con un puñado de ciudades vecinas, no con todas): la matriz de adyacencia desperdicia una cantidad **enorme** de espacio en entradas que son 0 (no hay arista) — Θ(V²) cuando el contenido real de información es solo Θ(E), con E << V². La lista de adyacencia usa exactamente Θ(V+E), proporcional al contenido de información real, sin desperdicio. Además, como BFS y DFS (las dos operaciones centrales de este módulo) necesitan constantemente "recorrer todos los vecinos de un vértice" — no "verificar una arista específica al azar" — la lista de adyacencia da exactamente el costo O(grado(u)) que esas operaciones necesitan, mientras la matriz pagaría O(V) innecesariamente por cada vértice visitado.

**La regla práctica, y por qué la inmensa mayoría de implementaciones de propósito general usan lista de adyacencia**: la mayoría de los grafos que modelas en problemas reales son ralos (una red social de mil millones de usuarios no tiene, ni remotamente, mil millones² de conexiones posibles todas activas) — así que la lista de adyacencia es, en la práctica, la representación por defecto razonable, reservando la matriz de adyacencia para los casos específicos donde el grafo es genuinamente denso o donde necesitas verificación O(1) de aristas específicas con más frecuencia que recorrido de vecinos.

```python
class Grafo:
    """
    Grafo dirigido con lista de adyacencia. Fiel al esquema de
    CLRS cap. 22 / MIT 6.006 L9. Se puede usar como no dirigido
    agregando la arista en ambos sentidos al insertar.
    """
    def __init__(self):
        self._adyacencia = {}   # dict: vertice -> lista de vecinos

    def agregar_vertice(self, v):
        if v not in self._adyacencia:
            self._adyacencia[v] = []

    def agregar_arista(self, u, v, dirigido=True):
        self.agregar_vertice(u)
        self.agregar_vertice(v)
        self._adyacencia[u].append(v)
        if not dirigido:
            self._adyacencia[v].append(u)

    def vecinos(self, v):
        return self._adyacencia.get(v, [])

    def vertices(self):
        return list(self._adyacencia.keys())
```

---

## 3. BFS — deducido desde "explorar por capas"

### 3.1 La pregunta que BFS responde, y por qué su mecanismo se deriva de esa pregunta

Si quieres el **camino más corto en número de aristas** desde un vértice origen `s` hacia todos los demás vértices alcanzables (sin pesos — cada arista cuenta como "1 salto"), necesitas garantizar que visitas los vértices **en orden creciente de distancia** desde `s`: primero todos los vértices a distancia 1 (los vecinos directos de s), luego todos los que están a distancia 2 (vecinos de los vecinos, que no habías visto antes), y así sucesivamente. Si visitaras vértices en cualquier otro orden, no podrías garantizar que la primera vez que llegas a un vértice sea a través del camino más corto posible.

**El mecanismo que garantiza ese orden**: una **cola (FIFO)** — exactamente la estructura que ya construiste en el módulo de estructuras lineales, y cuya propiedad "lo primero que entra es lo primero que sale" es precisamente lo que necesitas para procesar los vértices en el orden en que fueron **descubiertos**, que es exactamente el orden creciente de distancia si agregas los vecinos de cada vértice a la cola en el momento en que lo procesas.

```python
from collections import deque

def bfs(grafo, origen):
    """
    BFS desde `origen`. Devuelve un diccionario de distancias
    (en numero de aristas) y un diccionario de predecesores
    (para reconstruir el camino mas corto hacia cualquier vertice).
    Fiel al esquema BFS de CLRS 22.2.
    """
    distancia = {origen: 0}
    predecesor = {origen: None}
    cola = deque([origen])

    while cola:
        u = cola.popleft()          # FIFO: procesa en orden de descubrimiento
        for v in grafo.vecinos(u):
            if v not in distancia:   # no visitado todavia
                distancia[v] = distancia[u] + 1
                predecesor[v] = u
                cola.append(v)

    return distancia, predecesor


def reconstruir_camino(predecesor, origen, destino):
    if destino not in predecesor:
        return None   # destino no alcanzable desde origen
    camino = []
    actual = destino
    while actual is not None:
        camino.append(actual)
        actual = predecesor[actual]
    camino.reverse()
    return camino if camino[0] == origen else None
```

**Por qué BFS garantiza el camino más corto, argumentado, no solo afirmado**: la prueba es por inducción sobre la distancia. Todos los vértices a distancia 0 (solo el origen) se procesan primero — trivialmente correcto. Supón que todos los vértices a distancia k ya fueron correctamente identificados y agregados a la cola en ese orden (hipótesis inductiva). Cuando se procesan (en orden FIFO, así que **antes** que cualquier vértice de distancia k+1), sus vecinos no visitados son exactamente los vértices a distancia k+1 — porque si un vecino ya estuviera a una distancia menor, ya habría sido visitado en una iteración anterior (por la hipótesis inductiva de que todos los vértices de distancia ≤k ya se procesaron). La propiedad FIFO de la cola es exactamente lo que garantiza que nunca "saltas" a procesar un vértice de distancia k+2 antes de haber agotado todos los de distancia k+1 — si usaras una pila (LIFO) en su lugar, romperías esta garantía, porque profundizarías por una rama específica antes de haber terminado de explorar la capa actual completa, exactamente el comportamiento de DFS que viene a continuación.

### 3.2 Analogía: BFS como una onda que se expande

Piensa en dejar caer una piedra en un estanque: la onda se expande en círculos concéntricos, alcanzando primero todos los puntos a distancia r, luego todos a distancia r+dr, nunca "saltándose" un anillo para llegar antes a uno más lejano. BFS es exactamente esa expansión, discretizada sobre un grafo: cada "anillo" es el conjunto de vértices a una distancia específica, y la cola FIFO garantiza que ningún vértice de un anillo posterior se procese antes de que el anillo actual esté completamente agotado.

---

## 4. DFS — deducido desde "explorar a fondo"

### 4.1 La pregunta distinta que DFS responde

BFS explora "de forma amplia" (todos los vecinos inmediatos antes de profundizar). DFS hace exactamente lo opuesto: desde un vértice, se compromete a explorar **completamente** una rama antes de retroceder a explorar las demás — análogo a resolver un laberinto siguiendo un pasillo hasta el final (o hasta un callejón sin salida), y solo entonces retrocediendo al último punto de decisión para probar otra dirección, en vez de explorar todos los pasillos disponibles desde el punto de partida antes de comprometerte con ninguno.

**El mecanismo que produce este comportamiento**: una **pila (LIFO)** — ya sea explícita, o implícita a través de la **recursión** (recuerda del módulo de estructuras lineales que la pila de llamadas de funciones es, ella misma, una pila LIFO — por eso DFS recursivo y DFS con pila explícita son, estructuralmente, la misma idea expresada de dos formas distintas).

```python
def dfs_recursivo(grafo, origen, visitados=None, orden_descubrimiento=None):
    """
    DFS recursivo. La pila de llamadas ES la pila LIFO que produce
    el comportamiento "explora a fondo antes de retroceder".
    """
    if visitados is None:
        visitados = set()
        orden_descubrimiento = []

    visitados.add(origen)
    orden_descubrimiento.append(origen)

    for vecino in grafo.vecinos(origen):
        if vecino not in visitados:
            dfs_recursivo(grafo, vecino, visitados, orden_descubrimiento)

    return orden_descubrimiento


def dfs_iterativo(grafo, origen):
    """
    DFS con pila EXPLICITA, en vez de la pila de llamadas implicita
    de la recursion. Necesario cuando el grafo es tan grande que la
    recursion desbordaria la pila de llamadas del interprete/runtime
    (ver seccion 6, trampa de recursion).
    """
    visitados = set()
    pila = [origen]
    orden_descubrimiento = []

    while pila:
        u = pila.pop()             # LIFO: la ultima rama agregada se explora primero
        if u in visitados:
            continue
        visitados.add(u)
        orden_descubrimiento.append(u)
        for vecino in grafo.vecinos(u):
            if vecino not in visitados:
                pila.append(vecino)

    return orden_descubrimiento
```

**Nota una sutileza real entre ambas versiones**: la versión recursiva marca un vértice como visitado **antes** de explorar recursivamente sus vecinos, garantizando que cada vértice se procese exactamente una vez y en un orden determinístico específico (el primer vecino en la lista de adyacencia se explora completamente antes de pasar al segundo). La versión iterativa con pila explícita, tal como está escrita arriba, puede agregar el mismo vértice a la pila más de una vez antes de marcarlo como visitado (si dos vértices distintos ya en la pila comparten un vecino no visitado) — de ahí el chequeo `if u in visitados: continue` al desempilar, que descarta esas entradas duplicadas obsoletas. El orden exacto de visita puede diferir sutilmente entre ambas versiones (por el orden en que se agregan los vecinos a la pila vs. las llamadas recursivas), pero **el conjunto final de vértices alcanzados y la propiedad de "explorar a fondo antes de retroceder" son equivalentes** — una distinción de implementación, no de correctitud.

---

## 5. Conectividad y componentes — la aplicación directa de BFS/DFS

### 5.1 Por qué un solo recorrido no basta para grafos desconectados

Tanto BFS como DFS, ejecutados desde un único vértice origen, alcanzan **solo** los vértices conectados a ese origen por algún camino — si el grafo tiene partes completamente desconectadas entre sí (piensa en una red social con dos comunidades que nunca se han conectado entre sí, ni siquiera transitivamente), un recorrido desde un vértice de una comunidad **nunca** visita ningún vértice de la otra, sin importar cuánto tiempo lo dejes correr.

**La consecuencia de diseño**: para cubrir un grafo completo (potencialmente desconectado), necesitas envolver BFS/DFS en un bucle externo que recorra **todos** los vértices, y ejecute un nuevo recorrido (una nueva "componente") cada vez que encuentre un vértice todavía no visitado por ningún recorrido anterior.

```python
def componentes_conexas(grafo):
    """
    Encuentra todas las componentes conexas de un grafo (dirigido o
    no -- para grafos dirigidos, esto encuentra componentes
    debilmente conexas, ignorando la direccion de las aristas para
    efectos de este calculo especifico).
    """
    visitados_global = set()
    componentes = []

    for v in grafo.vertices():
        if v not in visitados_global:
            # nueva componente descubierta
            componente = dfs_recursivo(grafo, v)
            componentes.append(componente)
            visitados_global.update(componente)

    return componentes
```

**Trampa explícita**: asumir que "correr BFS/DFS una vez cubre todo el grafo" es un error extremadamente común y silencioso — el código no falla con una excepción, simplemente **omite silenciosamente** los vértices de otras componentes, y el bug solo se manifiesta cuando alguien nota que el resultado está incompleto, potencialmente mucho después de que el código se escribió y "pareció funcionar" en pruebas sobre grafos conexos por casualidad.

---

## 6. Orden topológico — deducido desde DFS, con el porqué del orden inverso

### 6.1 El problema que resuelve: secuenciar tareas con dependencias

Si tienes un grafo dirigido **acíclico** (DAG — Directed Acyclic Graph) donde una arista `(u, v)` significa "la tarea u debe completarse antes que la tarea v", un **orden topológico** es un ordenamiento lineal de todos los vértices tal que, para cada arista `(u,v)`, `u` aparece antes que `v` en el ordenamiento — exactamente lo que necesitas para, por ejemplo, secuenciar la compilación de módulos de software con dependencias entre sí, o planificar tareas de un proyecto donde algunas requieren que otras terminen primero.

### 6.2 Por qué solo existe para grafos acíclicos — la prueba de imposibilidad con ciclos

Si el grafo tuviera un ciclo `u → v → w → u`, un orden topológico exigiría simultáneamente que u esté antes que v (por la arista u→v), v antes que w, y w antes que u — una contradicción lógica directa (`u < v < w < u` es imposible en cualquier orden lineal). **Esta es la razón exacta, no una regla arbitraria, de por qué el orden topológico solo tiene sentido de existir para DAGs** — un ciclo hace la pregunta misma incoherente, no solo difícil.

### 6.3 La deducción: por qué el orden de finalización de DFS, invertido, produce un orden topológico válido

Aquí está la pieza central de esta sección, y hay que construirla con cuidado. DFS, al visitar un grafo, no solo descubre vértices — para cada vértice, hay un momento de **finalización**: el instante en que DFS termina de explorar **todos** los descendientes alcanzables desde ese vértice y está a punto de retroceder (el "return" de la llamada recursiva, o el momento en que se saca definitivamente de una pila en la versión iterativa cuidadosamente instrumentada).

**Afirmación**: si ordenas los vértices por su tiempo de finalización, de **mayor a menor** (el que termina más tarde primero), obtienes un orden topológico válido para cualquier DAG.

**Por qué, deducido y no memorizado**: considera cualquier arista `(u, v)` en el DAG. Hay dos casos posibles según cómo DFS descubre estos dos vértices:

- **Caso 1**: DFS visita `u` primero, y desde `u` (directamente o a través de otros vértices) eventualmente visita `v`. Como `v` es descubierto *durante* la exploración de `u` (antes de que u termine), `v` necesariamente **termina antes que u** — porque DFS no puede terminar de procesar u hasta haber agotado completamente la exploración de todo lo alcanzable desde u, lo cual incluye a v. Entonces `finalización(v) < finalización(u)`, y al ordenar de mayor a menor finalización, `u` aparece antes que `v` — exactamente lo que el orden topológico exige para esta arista.
- **Caso 2**: DFS visita `v` primero (antes que u), completamente, y solo después visita `u`. Aquí es donde la propiedad de **acíclico** es exactamente lo que se necesita: si el grafo tuviera un ciclo, sería posible que, estando en medio de explorar v, DFS llegara de vuelta a u a través de algún camino — pero como el grafo es un DAG, **no puede existir ningún camino desde v de regreso a u** (eso crearía un ciclo u→v→...→u). Por lo tanto, si v se visita completamente antes que u, es porque v y u están en ramas de exploración genuinamente separadas respecto a esta arista específica, y de hecho, dado que existe la arista (u,v), este caso en realidad **no puede ocurrir** en un DAG explorado correctamente desde una raíz que alcanza u antes que v en algún momento — la estructura acíclica garantiza que la única forma consistente de que exista la arista (u,v) es que la exploración de v quede "anidada dentro" de la exploración de u (Caso 1), nunca al revés de forma que rompa el orden.

**La consecuencia práctica**: corre DFS sobre el DAG completo (con el envolvente de componentes de la sección 5, por si el grafo es desconectado), registra el orden de finalización de cada vértice, e invierte ese orden — el resultado es un orden topológico válido. Esto se implementa naturalmente con una pila: cada vez que un vértice termina de explorarse (en DFS recursivo, justo antes de que la llamada recursiva retorne), lo empujas a una pila; al final, desapilar todo da el orden topológico correcto (porque la pila invierte automáticamente el orden de finalización — el último en terminar es el primero en salir de la pila, que es exactamente el primero en el orden topológico).

```python
def orden_topologico(grafo):
    """
    Orden topologico de un DAG via DFS con registro de tiempos
    de finalizacion, invertidos mediante una pila.
    Fiel al esquema de CLRS 22.4.
    """
    visitados = set()
    pila_resultado = []

    def dfs_visitar(u):
        visitados.add(u)
        for v in grafo.vecinos(u):
            if v not in visitados:
                dfs_visitar(v)
        # ESTE es el momento de finalizacion de u: ya se exploraron
        # TODOS sus descendientes alcanzables. Se apila AQUI, no antes.
        pila_resultado.append(u)

    for v in grafo.vertices():
        if v not in visitados:
            dfs_visitar(v)

    pila_resultado.reverse()   # invertir: el orden de finalizacion invertido
    return pila_resultado


def tiene_ciclo_dirigido(grafo):
    """
    Deteccion de ciclo en grafo DIRIGIDO usando DFS con tres estados
    por vertice: no visitado, en la pila de recursion actual (EN
    PROCESO), y completamente terminado. Un ciclo existe si y solo
    si DFS encuentra una arista hacia un vertice que esta EN PROCESO
    ahora mismo (una "back edge" -- distinto de simplemente "ya
    visitado", que en un DAG es perfectamente normal si dos caminos
    distintos convergen en el mismo vertice sin formar ciclo).
    """
    NO_VISITADO, EN_PROCESO, TERMINADO = 0, 1, 2
    estado = {v: NO_VISITADO for v in grafo.vertices()}

    def dfs_visitar(u):
        estado[u] = EN_PROCESO
        for v in grafo.vecinos(u):
            if estado[v] == EN_PROCESO:
                return True             # back edge: ciclo encontrado
            if estado[v] == NO_VISITADO and dfs_visitar(v):
                return True
        estado[u] = TERMINADO
        return False

    for v in grafo.vertices():
        if estado[v] == NO_VISITADO:
            if dfs_visitar(v):
                return True
    return False
```

**Por qué la detección de ciclo necesita TRES estados, no dos ("visitado"/"no visitado")**: en un grafo dirigido, encontrar una arista hacia un vértice ya "visitado" **no** implica necesariamente un ciclo — puede ser simplemente que dos caminos distintos convergen en el mismo vértice (perfectamente normal en un DAG: piensa en dos tareas independientes que ambas son prerequisito de una tercera tarea común). Lo que sí implica un ciclo es encontrar una arista hacia un vértice que está **actualmente en la pila de recursión** (EN_PROCESO) — es decir, un ancestro de la llamada actual en el árbol de recursión de DFS, no solo cualquier vértice ya visitado en el pasado. Esta distinción de tres estados (no visitado / en proceso / terminado) es exactamente lo que CLRS llama la clasificación de aristas en **back edge** (hacia un ancestro en proceso — indica ciclo) vs. **forward/cross edge** (hacia un descendiente ya terminado o un vértice de otra rama ya terminada — no indica ciclo en un grafo dirigido).

### 6.4 Ciclos en grafo dirigido vs. no dirigido — por qué la detección es distinta

En un grafo **no dirigido**, cualquier arista hacia un vecino ya visitado (que no sea el padre inmediato desde el que llegaste, porque esa arista "de regreso" es trivial y no representa un ciclo real, solo la naturaleza bidireccional de la arista misma) indica un ciclo genuino — la distinción de tres estados de la sección 6.3 no es necesaria aquí, porque en un grafo no dirigido no existe la noción de "cruzar hacia otra rama sin ciclo" de la misma forma que en uno dirigido (toda arista es bidireccional, así que "visitado" es una condición más simple de interpretar). Confundir el algoritmo de detección de ciclos dirigido con el no dirigido (aplicar el criterio más simple del caso no dirigido a un grafo dirigido) es una trampa común: te haría marcar falsamente muchos DAGs perfectamente válidos como si tuvieran ciclos, simplemente porque dos caminos convergen en un vértice común.

---

## 7. Edge cases y trampas explícitas — resumen operativo

- **Grafo desconectado**: BFS/DFS desde un solo vértice no cubre el grafo completo — necesitas el envolvente de la sección 5 sobre todos los vértices no visitados. Silencioso, no truena, solo omite información.
- **Grafo vacío o de un solo nodo**: BFS/DFS deben manejar correctamente V=0 (sin iteraciones) y V=1 (un solo vértice, sin aristas, termina inmediatamente) — casos base que las implementaciones de arriba manejan naturalmente porque los bucles simplemente no ejecutan iteraciones si no hay vecinos, pero vale la pena verificarlo explícitamente al testear una implementación nueva.
- **DFS recursivo desbordando la pila de llamadas en grafos grandes**: cada llamada recursiva de DFS consume un marco (frame) en la pila de llamadas del intérprete/runtime — para un grafo con una rama muy profunda (por ejemplo, una cadena lineal de 100,000 vértices, que es, recuerda, literalmente un caso especial de grafo según la sección 1.2), la recursión puede exceder el límite de profundidad de pila del lenguaje (en Python, el límite por defecto es del orden de unos miles de llamadas, configurable pero acotado) y disparar un error de desbordamiento de pila (`RecursionError` en Python, stack overflow en general). **Esta es la razón práctica y no cosmética de por qué existe la versión iterativa con pila explícita** (sección 4.1) — una pila explícita vive en el heap (memoria dinámica, con límites mucho más generosos que la pila de llamadas del runtime), no en la pila de llamadas del lenguaje, así que no está sujeta al mismo límite de profundidad.
- **Ciclos en dirigido vs. no dirigido requieren algoritmos de detección distintos** (sección 6.4) — aplicar el criterio equivocado produce falsos positivos o falsos negativos según la dirección del error.

---

## 8. Trade-offs explícitos

**BFS vs. DFS, según qué pregunta necesitas responder**: si necesitas el camino más corto en número de aristas (sin pesos), BFS es la única opción correcta — DFS no da ninguna garantía sobre encontrar el camino más corto, solo *algún* camino. Si necesitas explorar toda la estructura sin importar el orden relativo (detectar ciclos, encontrar componentes conexas, calcular orden topológico), DFS es frecuentemente más natural de implementar (la recursión expresa directamente "explora esto completamente, luego continúa") y usa, en general, menos memoria auxiliar en la práctica típica (la profundidad de la pila de recursión, en un grafo razonablemente ramificado, suele ser menor que el ancho máximo de la frontera BFS, que en el peor caso puede acercarse a V).

**Matriz vs. lista de adyacencia**: ya derivado en la sección 2.3 — lista para grafos ralos (la inmensa mayoría de casos reales), matriz para grafos densos o cuando necesitas verificación O(1) de aristas específicas con más frecuencia que recorrido completo de vecinos.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**El fog-of-war de Arcanum ES, literalmente, un DAG con orden topológico — no una metáfora.** El sistema de grados AUCTORUM de Arcanum (Scintilla hasta Origo, con ceremonias de ascensión) y el mastery graph construido sobre React Flow tienen exactamente la estructura de este módulo: cada nodo de conocimiento tiene prerequisitos — otros nodos que deben "completarse" (o alcanzar cierto nivel de mastery, en el modelo de decaimiento por repetición espaciada) antes de que ese nodo se desbloquee. Esto es, con precisión matemática y no como analogía suelta, un grafo dirigido acíclico: dirigido porque "A es prerequisito de B" tiene una dirección intrínseca (no simétrica — B depender de A no implica que A dependa de B), y acíclico por necesidad estructural: si A dependiera de B y B dependiera transitivamente de A, ningún orden de aprendizaje sería posible en absoluto (la misma prueba de imposibilidad de la sección 6.2, aplicada aquí a "orden de aprendizaje" en vez de "orden de ejecución de tareas"). El "fog-of-war" — qué nodos están visibles/desbloqueados dado el progreso actual — es, estructuralmente, la frontera de un BFS o DFS parcial sobre ese DAG: los nodos "revelados" son exactamente los alcanzables desde los nodos ya dominados, siguiendo las aristas de prerequisito hacia adelante. Y calcular un orden topológico completo del grafo de conocimiento te daría, directamente, **una secuencia de estudio válida** que respeta todos los prerequisitos simultáneamente — exactamente el mismo problema que secuenciar la compilación de módulos de software con dependencias, aplicado a currículo en vez de código.

**Grafos en redes y routing.** El problema de encontrar la ruta que sigue un paquete de datos a través de internet, desde tu dispositivo hasta un servidor remoto, es un problema de grafos donde los vértices son routers/dispositivos de red y las aristas son enlaces físicos o lógicos entre ellos — BFS, en su forma más simple (sin pesos), modela exactamente "encuentra la ruta con menos saltos (hops) entre origen y destino", que es literalmente cómo protocolos de enrutamiento tempranos y simplificados conceptualizan el problema, antes de agregar pesos (latencia, ancho de banda, costo) que llevan al terreno de Dijkstra en el módulo siguiente.

**BFS en el web crawler.** Un rastreador web (web crawler) que descubre páginas siguiendo hipervínculos desde una página semilla es, estructuralmente, BFS sobre el grafo dirigido implícito de la web (vértices = páginas, aristas = hipervínculos): explorar "por capas" (todas las páginas enlazadas directamente desde la semilla, luego todas las enlazadas desde esas, y así sucesivamente) es exactamente la estrategia que la mayoría de crawlers de propósito general usan para asegurar cobertura amplia y priorizar páginas "más cercanas" (en número de clics) a la semilla original, antes de profundizar en rincones remotos y potencialmente menos relevantes de la web — la misma garantía de "explora lo cercano completamente antes de lo lejano" que probaste formalmente en la sección 3.1, aplicada aquí a escala de la web completa.

---

## Síntesis — el mapa mental

1. Un grafo `(V, E)` es la estructura sin restricciones de forma sobre relaciones entre elementos — array y árbol son, literalmente, casos especiales restringidos (cadena lineal; conexo y acíclico), no analogías separadas.
2. **Lista de adyacencia** (Θ(V+E), recorrido de vecinos en O(grado)) es la representación por defecto correcta para grafos ralos (la mayoría de casos reales); **matriz de adyacencia** (Θ(V²), acceso O(1) a una arista específica) se justifica solo cuando el grafo es genuinamente denso o la operación dominante es verificación puntual, no recorrido.
3. **BFS**, con una cola FIFO, explora por capas de distancia creciente y garantiza el camino más corto en número de aristas — probado por inducción sobre las capas de distancia, apoyado exactamente en la propiedad FIFO de la cola.
4. **DFS**, con una pila (explícita o vía recursión), explora a fondo cada rama antes de retroceder — no da garantía de camino más corto, pero es la base natural para detección de ciclos, componentes conexas, y orden topológico.
5. **Componentes conexas** requieren envolver BFS/DFS en un bucle sobre todos los vértices — un solo recorrido desde un origen nunca cubre un grafo desconectado, y ese fallo es silencioso, no un error visible.
6. **Orden topológico** existe solo para DAGs (un ciclo hace la pregunta lógicamente incoherente) y se obtiene invirtiendo el orden de finalización de DFS — probado formalmente distinguiendo los dos casos de cómo una arista `(u,v)` puede descubrirse durante el recorrido, y usando la aciclicidad para descartar el caso que rompería el orden.
7. **Detección de ciclo dirigido** necesita tres estados (no visitado / en proceso / terminado), no dos, porque en un grafo dirigido converger en un vértice ya terminado es normal y no indica ciclo — solo una arista hacia un vértice **actualmente en la pila de recursión** (back edge) indica un ciclo genuino.
8. **DFS recursivo puede desbordar la pila de llamadas** en grafos con ramas muy profundas — la versión iterativa con pila explícita en el heap existe exactamente para evitar ese límite práctico del runtime.

---

## Preguntas que deberías poder responder

1. Explica por qué un array y un árbol son, formalmente, casos especiales de grafo — no analogías — y qué restricción estructural específica define a cada uno dentro de la definición general de grafo.
2. Deriva, sin ver el texto, por qué la lista de adyacencia es preferible a la matriz de adyacencia para un grafo ralo, comparando explícitamente el costo de espacio y el costo de recorrer todos los vecinos de un vértice en ambas representaciones.
3. Prueba, por inducción sobre las capas de distancia, por qué BFS con una cola FIFO garantiza que la primera vez que se alcanza un vértice es a través de un camino más corto posible — ¿qué pasaría si usaras una pila (LIFO) en vez de una cola?
4. Reproduce la prueba de por qué invertir el orden de finalización de DFS produce un orden topológico válido para cualquier DAG — explica específicamente por qué la propiedad de aciclicidad es necesaria para que la prueba funcione (¿qué fallaría en un grafo con ciclos?).
5. Explica por qué la detección de ciclo en un grafo dirigido necesita tres estados (no visitado/en proceso/terminado) y no basta con dos (visitado/no visitado) — construye un ejemplo concreto de un DAG válido donde el criterio de dos estados produciría un falso positivo de ciclo.
6. ¿Por qué DFS recursivo puede fallar en un grafo que es, estructuralmente, una simple cadena lineal de 500,000 vértices? ¿Por qué la versión iterativa con pila explícita no tiene el mismo problema?
7. Da un ejemplo concreto (no de este texto) de un problema donde BFS es la elección correcta y DFS no serviría para lo que necesitas, y otro donde DFS es más natural y BFS sería un desperdicio de garantías que no necesitas.
8. Aplicando el marco de este módulo al grafo de conocimiento de un sistema de aprendizaje con prerequisitos entre temas: ¿qué representaría un "ciclo" en ese grafo, y por qué su existencia haría imposible cualquier secuencia de estudio válida?

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lectures 9-11 (Graphs, BFS, DFS): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 20 (Elementary Graph Algorithms... representación y BFS/DFS en ediciones donde este es el capítulo correspondiente), Capítulo 22 en la 3ª edición (BFS 22.2, DFS 22.3, orden topológico 22.4, componentes fuertemente conexas 22.5).
- UC Berkeley CS61B, notas sobre grafos, BFS, DFS: https://sp21.datastructur.es/
