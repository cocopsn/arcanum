---
module_id: cp5-dsu
spine: Competitiva
title: "DSU / Union-Find"
subtitle: "Conectar y preguntar, casi gratis"
source_canonical: "USACO Guide (Gold — DSU); CP-Handbook; CSES"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 20
---

# DSU / Union-Find

> **Pregunta raíz.** Necesitas mantener conjuntos disjuntos —grupos de elementos que se van uniendo dinámicamente— y responder "¿estos dos elementos están en el mismo grupo?" repetidamente, intercalado con operaciones de unión. Hacerlo con una estructura ingenua (recorrer un grupo entero para verificar membresía) cuesta O(n) por consulta. Union-Find, con dos optimizaciones específicas —**path compression** y **union by rank**— da un costo amortizado de **prácticamente O(1)** por operación (formalmente O(α(n)), donde α es la inversa de la función de Ackermann, que crece tan lentamente que para cualquier n del universo conocido es, en la práctica, una constante ≤ 4).

## Prólogo

DSU es, probablemente, la estructura de datos con la mayor relación "simplicidad de código / poder desbloqueado" de todo tu entrenamiento. Se escribe en 15 líneas, y aparece en Kruskal, en detección de ciclos, en agrupar elementos por relación de equivalencia, y en cualquier problema de "conectividad que cambia con el tiempo pero solo hacia adelante (uniones, nunca separaciones)".

---

## Señales de reconocimiento

**Gritan DSU:**
- "conectividad dinámica" con operaciones de **unión** intercaladas con preguntas de "¿están conectados?"
- "cuántos componentes conexos hay" tras una serie de uniones
- construcción de árbol de expansión mínima (Kruskal) — necesitas detectar ciclos eficientemente
- "agrupa elementos por una relación de equivalencia" (si A~B y B~C entonces A~C) sin que la relación se especifique de antemano completa, sino que se descubre incrementalmente

**Señal de alerta — DSU NO es la herramienta si:**
- necesitas **desconectar** elementos (deshacer una unión) — DSU estándar no soporta esto eficientemente; el problema pide otra estructura (o un enfoque offline con rollback, fuera de este alcance estándar).
- necesitas saber el camino/ruta entre dos elementos conectados, no solo si están conectados — DSU responde conectividad, no caminos.

**El reflejo**: "uniones + preguntas de conectividad, sin deshacer" → DSU en segundos.

---

## 1. Por qué casi O(1) — la intuición de las dos optimizaciones

**Sin ninguna optimización**, una cadena larga de uniones puede degenerar en un árbol de altura O(n) —exactamente la degeneración de un BST sin balance que ya conoces de tu estudio de teoría—, haciendo que encontrar la raíz de un elemento cueste O(n).

**Union by rank** (o por tamaño): al unir dos conjuntos, siempre cuelga el árbol más pequeño/bajo bajo la raíz del más grande/alto — evita que la altura crezca sin control, el mismo principio de "no dejes que un lado se desbalance sin límite" que ya viste con AVL, aplicado aquí de forma más simple (sin rotaciones, solo eligiendo qué raíz queda arriba).

**Path compression**: cada vez que buscas la raíz de un elemento, reengancha **directamente** ese elemento (y todos los que visitaste en el camino) a la raíz — aplanando el árbol para que la próxima búsqueda sea O(1) directa, sin tener que volver a recorrer la cadena. Es, literalmente, la misma idea de "memoiza el resultado para no recalcularlo" que reconocerás de DP.

**Juntas**, ambas garantizan que ningún árbol se mantenga alto por mucho tiempo — la prueba formal de por qué esto da específicamente O(α(n)) es matemáticamente sutil (fuera del alcance de "reconocimiento bajo reloj"), pero la intuición operativa que necesitas en contest es simple: **con ambas optimizaciones, DSU es, en la práctica, tan rápido como cualquier estructura que vas a usar en un contest — trátalo como O(1) por operación sin preocuparte más.**

---

## 2. Plantilla — DSU completo

```python
class DSU:
    def __init__(self, n):
        self.padre = list(range(n))
        self.rango = [0] * n

    def encontrar(self, x):
        if self.padre[x] != x:
            self.padre[x] = self.encontrar(self.padre[x])   # path compression
        return self.padre[x]

    def unir(self, x, y):
        rx, ry = self.encontrar(x), self.encontrar(y)
        if rx == ry:
            return False   # ya estaban conectados
        if self.rango[rx] < self.rango[ry]:
            rx, ry = ry, rx
        self.padre[ry] = rx
        if self.rango[rx] == self.rango[ry]:
            self.rango[rx] += 1
        return True

    def conectados(self, x, y):
        return self.encontrar(x) == self.encontrar(y)
```

```cpp
struct DSU {
    vector<int> padre, rango;
    DSU(int n) : padre(n), rango(n, 0) {
        iota(padre.begin(), padre.end(), 0);
    }
    int encontrar(int x) {
        if (padre[x] != x) padre[x] = encontrar(padre[x]);   // path compression
        return padre[x];
    }
    bool unir(int x, int y) {
        int rx = encontrar(x), ry = encontrar(y);
        if (rx == ry) return false;
        if (rango[rx] < rango[ry]) swap(rx, ry);
        padre[ry] = rx;
        if (rango[rx] == rango[ry]) rango[rx]++;
        return true;
    }
    bool conectados(int x, int y) { return encontrar(x) == encontrar(y); }
};
```

**Esta es una plantilla que debes poder teclear de memoria, sin pensar, en menos de dos minutos.** Es corta a propósito — memorízala tal cual.

---

## 3. Contar componentes conexos

```python
def contar_componentes(dsu, n):
    return len(set(dsu.encontrar(i) for i in range(n)))
```

Alternativa más eficiente en contest real: mantén un contador que empieza en `n` y decrementa cada vez que `unir()` devuelve `True` (una unión real ocurrió, no una que ya estaban conectados) — evita el recorrido O(n) final.

---

## Trampas de contest

**Olvidar path compression (TLE)**: DSU sin la línea `self.padre[x] = self.encontrar(self.padre[x])` (sin reenganchar durante la búsqueda) sigue siendo "correcto" en el sentido de que da la respuesta correcta, pero puede degenerar a O(n) por operación en el peor caso adversarial — exactamente el tipo de bug que pasa todos los casos de prueba pequeños y truena por Time Limit Exceeded en el caso grande. Nunca escribas `encontrar()` sin la compresión de camino.

**Union sin rank/tamaño**: unir siempre en un orden fijo (por ejemplo, siempre colgar `y` bajo `x` sin comparar tamaños) puede, en el peor caso adversarial (una secuencia de uniones diseñada específicamente para maximizar la altura), degenerar el árbol — combínalo siempre con path compression, pero no asumas que uno solo de los dos basta para todos los casos adversariales.

**Contar componentes mal**: inicializar el contador de componentes en `0` en vez de `n`, o decrementarlo incondicionalmente en cada llamada a `unir()` en vez de solo cuando la unión fue real (cuando `unir()` devuelve `True`), da un conteo incorrecto silencioso — verifica siempre contra un caso pequeño a mano.

---

## Trade-offs

**DSU vs. BFS/DFS para conectividad**: si necesitas conectividad en un grafo **estático** (construido de una vez, sin uniones incrementales intercaladas con consultas), BFS/DFS para encontrar componentes es igual de válido y quizás más directo. DSU se vuelve indispensable específicamente cuando las uniones ocurren **incrementalmente en el tiempo**, intercaladas con consultas de conectividad — el caso de Kruskal, donde procesas aristas una por una y necesitas saber, en cada paso, si agregar la arista actual crearía un ciclo.

---

## Conexiones

**Con sorting/greedy (CP4)**: Kruskal es, literalmente, "ordena las aristas por peso (CP4) + aplica DSU para detectar ciclos mientras aplicas la propiedad del corte greedy" — si ya conoces Kruskal de tu estudio de teoría de grafos (ITC C7), reconoce que es exactamente la composición de estos dos módulos.

**Con binary search (CP2)**: "¿es posible que el grafo esté completamente conectado usando solo aristas de peso ≤ X?" es un `feasible(X)` perfecto para binary search on answer, implementado internamente con DSU — la composición "binary search afuera, DSU adentro" es un patrón real de Gold/Platinum.

**Con grafos competitivos (CP6)**: DSU y BFS/DFS resuelven el mismo tipo de pregunta (conectividad) con mecanismos distintos — DSU brilla cuando las conexiones se agregan incrementalmente; BFS/DFS cuando el grafo ya está completo y solo necesitas explorarlo una vez.

---

## Síntesis

1. DSU mantiene conjuntos disjuntos con unión y consulta de conectividad casi O(1), gracias a path compression + union by rank combinadas.
2. La plantilla completa cabe en ~15 líneas — memorízala literalmente, sin pensar, porque va a aparecer embebida dentro de problemas más grandes (Kruskal, binary search on answer) donde no tienes tiempo de rederivarla.
3. Señal de reconocimiento: uniones intercaladas con preguntas de conectividad, sin necesitar deshacer uniones nunca.
4. Las trampas caras son de rendimiento silencioso (olvidar path compression pasa los tests pequeños y truena en los grandes) y de conteo (inicializar/decrementar el contador de componentes mal).

---

## Problemas para resolver

1. Un problema clásico de "cuántos componentes conexos" tras una serie de uniones, filtrado por el tag **DSU/Union-Find** de rating bajo (~1000-1200) en Codeforces — la plantilla de la sección 2 y 3, tal cual.
2. **CSES — Road Construction** (Graph Algorithms, si tu edición del problemset lo incluye en esa sección): uniones incrementales reportando el tamaño del componente más grande tras cada unión — practica extender el DSU con tamaño de componente, no solo conectividad binaria.
3. Un problema de construcción de árbol de expansión mínima (Kruskal) filtrado por tag **DSU** + **graphs** — la composición completa de CP4+CP5 en un solo problema.
4. Un problema que combine binary search on answer (CP2) con una verificación de conectividad vía DSU como `feasible(X)` — entrena reconocer la composición de técnicas, no solo cada una por separado.
5. Un problema de "agrupar elementos por relación de equivalencia descubierta incrementalmente" (ej. cuentas bancarias vinculadas transitivamente, personas conectadas por relaciones reportadas una por una) — entrena el reconocimiento de DSU fuera del contexto obvio de grafos/aristas explícitas.

---

## Fuentes

- USACO Guide, sección Gold — Disjoint Set Union: https://usaco.guide/gold/dsu
- Antti Laaksonen, *Competitive Programmer's Handbook*: https://cses.fi/book/book.pdf
- CSES Problem Set, sección Graph Algorithms: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `dsu`: https://codeforces.com/problemset?tags=dsu
