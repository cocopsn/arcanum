---
module_id: cp8-segment-tree
spine: Competitiva
title: "Segment tree y sweep line"
subtitle: "Cuando el rango cambia bajo tus pies"
source_canonical: "USACO Guide (Gold — Point Update Range Sum; Platinum — Sweep Line); CP-Handbook"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 25
---

# Segment tree y sweep line

> **Pregunta raíz.** Prefix sums (CP3) da O(1) por consulta de rango, pero exige O(n) reconstruir si el arreglo cambia — inaceptable con muchas actualizaciones intercaladas con consultas. Un **segment tree** da O(log n) para **ambas** operaciones —consulta de rango y actualización de un elemento— pagando esa flexibilidad con una estructura más compleja de construir. Y **sweep line** es un principio distinto pero relacionado: procesar eventos ordenados en una dimensión (tiempo, posición) para colapsar un problema que parece 2D en una serie de problemas 1D manejables uno a la vez.

## Prólogo

Esta es la cima de tu entrenamiento estándar — no porque sea "más difícil de entender" que lo anterior, sino porque combina más piezas: un árbol binario (como los que ya conoces de tu estudio de estructuras), aritmética de indexación (como heaps), y la misma disciplina de invariantes que ya dominas. El objetivo aquí no es dominar cada variante posible de segment tree (lazy propagation completo, segment trees persistentes) — es reconocer cuándo la necesitas y teclear la versión básica de consulta/actualización de punto sin fricción.

---

## Señales de reconocimiento

**Gritan segment tree:**
- consultas de rango (suma, mínimo, máximo) **con actualizaciones intercaladas** de elementos individuales — la palabra clave exacta que descarta prefix sums simple
- "actualiza el elemento en la posición i" + "consulta el rango [l,r]" repetido muchas veces, en cualquier orden

**Gritan sweep line:**
- "en cuántos puntos se cruzan N segmentos/intervalos"
- problemas donde una dimensión (frecuentemente tiempo o una coordenada) tiene un orden natural de procesamiento, y el problema se simplifica si procesas eventos en ese orden
- "número máximo de intervalos que se solapan simultáneamente en algún punto"

**Señal de alerta**: si las consultas de rango son sobre un arreglo que **nunca** se actualiza, no necesitas segment tree — prefix sums (CP3) es más simple y suficiente. Segment tree se justifica específicamente por la coexistencia de actualizaciones y consultas.

---

## 1. Segment tree — la estructura, deducida desde la necesidad

Un segment tree es un árbol binario donde cada nodo representa el resultado agregado (suma, mínimo, etc.) de un **rango** del arreglo original — la raíz representa el arreglo completo, cada hijo representa la mitad de ese rango, recursivamente hasta que las hojas representan elementos individuales. Consultar un rango arbitrario o actualizar un elemento cuesta O(log n) porque, exactamente como con cualquier árbol balanceado, la altura del árbol es O(log n), y cada operación toca a lo más un camino desde la raíz hasta una hoja (más una cantidad acotada de nodos adicionales por consulta de rango).

```python
class SegmentTree:
    def __init__(self, a):
        self.n = len(a)
        self.arbol = [0] * (4 * self.n)   # 4n es una cota segura de tamaño
        self._construir(a, 1, 0, self.n - 1)

    def _construir(self, a, nodo, izq, der):
        if izq == der:
            self.arbol[nodo] = a[izq]
            return
        medio = (izq + der) // 2
        self._construir(a, 2*nodo, izq, medio)
        self._construir(a, 2*nodo+1, medio+1, der)
        self.arbol[nodo] = self.arbol[2*nodo] + self.arbol[2*nodo+1]

    def actualizar(self, pos, valor):
        self._actualizar(1, 0, self.n - 1, pos, valor)

    def _actualizar(self, nodo, izq, der, pos, valor):
        if izq == der:
            self.arbol[nodo] = valor
            return
        medio = (izq + der) // 2
        if pos <= medio:
            self._actualizar(2*nodo, izq, medio, pos, valor)
        else:
            self._actualizar(2*nodo+1, medio+1, der, pos, valor)
        self.arbol[nodo] = self.arbol[2*nodo] + self.arbol[2*nodo+1]

    def consultar(self, l, r):
        return self._consultar(1, 0, self.n - 1, l, r)

    def _consultar(self, nodo, izq, der, l, r):
        if r < izq or der < l:
            return 0   # sin overlap
        if l <= izq and der <= r:
            return self.arbol[nodo]   # overlap total
        medio = (izq + der) // 2
        return (self._consultar(2*nodo, izq, medio, l, r) +
                self._consultar(2*nodo+1, medio+1, der, l, r))
```

```cpp
struct SegmentTree {
    int n;
    vector<long long> arbol;
    SegmentTree(vector<long long>& a) : n(a.size()), arbol(4 * a.size()) {
        construir(a, 1, 0, n - 1);
    }
    void construir(vector<long long>& a, int nodo, int izq, int der) {
        if (izq == der) { arbol[nodo] = a[izq]; return; }
        int medio = (izq + der) / 2;
        construir(a, 2*nodo, izq, medio);
        construir(a, 2*nodo+1, medio+1, der);
        arbol[nodo] = arbol[2*nodo] + arbol[2*nodo+1];
    }
    void actualizar(int pos, long long valor) { actualizar(1, 0, n-1, pos, valor); }
    void actualizar(int nodo, int izq, int der, int pos, long long valor) {
        if (izq == der) { arbol[nodo] = valor; return; }
        int medio = (izq + der) / 2;
        if (pos <= medio) actualizar(2*nodo, izq, medio, pos, valor);
        else actualizar(2*nodo+1, medio+1, der, pos, valor);
        arbol[nodo] = arbol[2*nodo] + arbol[2*nodo+1];
    }
    long long consultar(int l, int r) { return consultar(1, 0, n-1, l, r); }
    long long consultar(int nodo, int izq, int der, int l, int r) {
        if (r < izq || der < l) return 0;
        if (l <= izq && der <= r) return arbol[nodo];
        int medio = (izq + der) / 2;
        return consultar(2*nodo, izq, medio, l, r) + consultar(2*nodo+1, medio+1, der, l, r);
    }
};
```

**La indexación `2*nodo`, `2*nodo+1`**: exactamente la misma aritmética de heaps binarios que ya dominas de tu estudio de estructuras — un árbol binario completo representado como array, sin punteros. Reconocer esto significa que no estás aprendiendo una indexación nueva, estás reaplicando algo que ya sabes.

---

## 2. Lazy propagation — la extensión para actualizaciones de RANGO

Si necesitas actualizar un **rango completo** (no solo un elemento), actualizar ingenuamente cada posición dentro de ese rango cuesta O(r-l) por actualización — perdiendo la ventaja de O(log n). **Lazy propagation** pospone la propagación de una actualización de rango hacia los hijos hasta que efectivamente necesites descender a ellos (en una consulta o actualización posterior que los toque específicamente), marcando el nodo actual con un valor "pendiente" en vez de aplicar la actualización a todo el subárbol inmediatamente.

**La intuición, sin el código completo (fuera del alcance de este libro estándar, pero necesitas reconocer cuándo la necesitas)**: cada nodo del árbol tiene un campo adicional "lazy" que dice "todo este subárbol tiene una actualización pendiente de aplicar, pero no la he empujado hacia mis hijos todavía porque nadie la ha necesitado con esa granularidad". Cuando una consulta o actualización futura necesita descender más allá de ese nodo, primero empuja el valor pendiente hacia los hijos (y lo limpia del nodo actual) antes de continuar — así el costo de aplicar la actualización se paga solo cuando y donde realmente se necesita, no de golpe sobre todo el rango.

**Reconocimiento de cuándo la necesitas**: "actualiza +X a todo el rango [l,r]" **combinado con** consultas de rango intercaladas → necesitas lazy propagation. Si las actualizaciones son siempre de un solo elemento (sección 1), no la necesitas.

---

## 3. Sweep line — el principio, no solo el código

**La idea central**: ordena todos los "eventos" relevantes por su posición en una dimensión (tiempo, coordenada X), y procésalos en ese orden, manteniendo una estructura de datos que resume el estado "activo en este momento" — cada evento nuevo actualiza esa estructura, y la pregunta del problema se responde consultando esa estructura en los momentos relevantes.

```python
def maximo_solapamiento(intervalos):
    """
    intervalos: lista de (inicio, fin). Retorna el maximo numero de
    intervalos activos simultaneamente en cualquier punto.
    """
    eventos = []
    for inicio, fin in intervalos:
        eventos.append((inicio, 1))    # +1 al entrar
        eventos.append((fin, -1))      # -1 al salir
    eventos.sort()   # ordena por posicion; en empate, procesa salidas
                       # antes que entradas si el problema exige
                       # intervalos "cerrados" que no cuentan como
                       # solapados en el punto exacto de contacto --
                       # ESTA es la trampa de orden de eventos

    activos = 0
    maximo = 0
    for posicion, delta in eventos:
        activos += delta
        maximo = max(maximo, activos)
    return maximo
```

**El "barrido" es, literalmente, un puntero que avanza por la línea de eventos ordenados** — el mismo principio de recorrido monótono que ya conoces de two pointers (CP1), aplicado aquí a una secuencia de eventos en vez de a un arreglo de datos.

---

## Trampas de contest

**Construcción del árbol mal indexada**: confundir `2*nodo`/`2*nodo+1` con una convención de indexación distinta (por ejemplo, mezclar con la convención base-1 de heaps de CLRS sin ajustar consistentemente) produce un árbol que "casi funciona" pero falla en posiciones específicas — la misma trampa exacta que ya viste en el módulo de heaps de tu estudio de teoría, aquí reaplicada.

**Lazy propagation olvidada**: si implementas actualizaciones de rango sin lazy propagation, actualizando cada posición individualmente, tu código es correcto pero puede ser O(n) por actualización en vez de O(log n) — pasa los tests pequeños, truena por TLE en los grandes con muchas actualizaciones de rango.

**Eventos ordenados incorrectamente en el sweep**: cuando dos eventos ocurren en la misma posición exacta (un intervalo termina exactamente donde otro empieza), el orden relativo entre "entrada" y "salida" en ese empate puede cambiar la respuesta correcta según si el problema considera esos intervalos como solapados en ese punto exacto o no — verifica explícitamente contra la definición del problema si debes procesar salidas antes o después de entradas en caso de empate, no asumas un orden por defecto.

---

## Trade-offs

**Segment tree vs. prefix sums (CP3)**: prefix sums es más simple y suficiente si el arreglo es estático. Segment tree se justifica exclusivamente cuando coexisten actualizaciones y consultas de rango — el costo de esa flexibilidad es una estructura notablemente más compleja de implementar correctamente bajo presión de tiempo.

**Segment tree vs. Fenwick tree (Binary Indexed Tree)**: para el caso específico de suma de rango + actualización de punto, un Fenwick tree (fuera del alcance detallado de este libro, pero vale la pena saber que existe) es más simple de codificar y tiene una constante más baja — considera aprenderlo como alternativa más ligera cuando solo necesitas exactamente ese caso de uso, reservando segment tree completo para cuando necesitas operaciones más generales (mínimo/máximo de rango, lazy propagation) que Fenwick tree no maneja tan naturalmente.

---

## Conexiones

**Con prefix sums (CP3)**: segment tree es la generalización directa — mismo problema de fondo (consultas de rango), pero soportando actualizaciones que prefix sums no puede manejar sin reconstrucción completa.

**Con heaps (tu estudio de teoría)**: la indexación `2*nodo`/`2*nodo+1` de un segment tree es idéntica a la de un heap binario — si ya dominas esa aritmética, no estás aprendiendo nada nuevo en ese aspecto, solo aplicándola a un árbol que agrega rangos en vez de mantener un mínimo/máximo.

**Con two pointers (CP1)**: sweep line es, conceptualmente, un puntero recorriendo una secuencia ordenada de eventos monótonamente — el mismo principio de recorrido sin retroceso, aplicado a eventos en vez de a un arreglo de datos crudos.

---

## Síntesis

1. Segment tree da O(log n) para consulta y actualización de rango simultáneamente — la generalización de prefix sums (O(1) consulta, O(n) actualización) cuando ambas operaciones coexisten.
2. La indexación `2*nodo`/`2*nodo+1` es la misma aritmética de heaps que ya conoces — no una técnica nueva de indexación.
3. Lazy propagation extiende segment tree para actualizaciones de **rango** completo, posponiendo la propagación hasta que realmente se necesita descender a los hijos afectados.
4. Sweep line procesa eventos ordenados en una dimensión, colapsando un problema aparentemente 2D en una secuencia de decisiones 1D manejables una a la vez — el mismo principio de recorrido monótono de two pointers, aplicado a eventos.

---

## Problemas para resolver

1. **CSES — Dynamic Range Sum Queries** (Range Queries): el caso de libro de texto exacto de la sección 1 — consulta y actualización de punto intercaladas.
2. **CSES — Range Update Queries** (Range Queries, si tu edición lo incluye): actualización de rango + consulta de punto (o viceversa) — practica la variante que exige lazy propagation o el truco de difference array combinado con segment tree.
3. Un problema clásico de "número máximo de intervalos solapados simultáneamente" filtrado por tag **sweep line** o **sortings** en Codeforces con rating bajo-medio — la plantilla de la sección 3.
4. Un problema tageado **segment tree** en Codeforces de rating 1400-1600 que combine consulta de mínimo/máximo de rango con actualización de punto — practica adaptar la plantilla de suma a otra operación de agregación.
5. Un problema de "número de pares de segmentos que se cruzan" o similar, tageado **sweep line** — entrena reconocer cuándo un problema geométrico 2D se colapsa a un barrido 1D.

---

## Fuentes

- USACO Guide, sección Gold — Point Update Range Sum, y Platinum — Sweep Line: https://usaco.guide/gold/PURS y https://usaco.guide/plat/sweep-line
- Antti Laaksonen, *Competitive Programmer's Handbook*: https://cses.fi/book/book.pdf
- CSES Problem Set, sección Range Queries: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `data structures` / `sweep line`: https://codeforces.com/problemset?tags=data+structures
