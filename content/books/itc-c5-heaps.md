---
module_id: itc-c5-heaps
spine: ITC
title: "Heaps y colas de prioridad"
subtitle: "Cómo tener siempre el mínimo a la mano sin ordenar todo"
source_canonical: "MIT 6.006 L8; CLRS cap. 6; CS61B"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Heaps y colas de prioridad

> **Pregunta raíz.** Necesitas, repetidamente, el elemento mínimo (o máximo) de un conjunto que cambia constantemente — insertas nuevos elementos, extraes el mínimo, repites. Ordenar todo el conjunto completo cada vez que cambia cuesta O(n log n) por cada cambio — inaceptablemente caro si el conjunto cambia con frecuencia. Buscar el mínimo en un array sin ordenar cuesta O(n) — mejor, pero sigue siendo lineal por cada consulta, y si además necesitas insertar y volver a encontrar el mínimo repetidamente, ese costo se acumula. **¿Existe una estructura que dé acceso O(1) al mínimo, y permita insertar/extraer en algo mejor que lineal, sin pagar el costo completo de mantener todo perfectamente ordenado?** La respuesta es sí, y la clave para diseñarla es notar que **no necesitas orden total — solo necesitas que el mínimo esté siempre arriba**. Esa relajación deliberada del requisito es el origen de todo lo que sigue.

## Prólogo — de dónde nace esto

Piensa en un torneo de eliminación simple, tipo bracket de fútbol — 16 equipos, y quieres saber quién es el campeón. No necesitas un ranking completo y ordenado de los 16 equipos del primero al último lugar — eso te costaría organizar muchos más partidos de los que el torneo realmente juega. Solo necesitas que, en cada enfrentamiento, el ganador avance hacia arriba — de forma que, al final, el campeón (el "mínimo" en el sentido de "el mejor") esté garantizado en la cima, sin que hayas tenido que comparar y ordenar exhaustivamente a todos los equipos entre sí.

Esa es exactamente la intuición de un heap: una jerarquía donde cada "padre" es mejor (menor, en un min-heap) que sus "hijos" directos — pero **sin exigir ningún orden entre hermanos, ni entre ramas distintas del árbol**. Esta relajación deliberada —invariante *local* (padre vs. sus hijos inmediatos) en vez de *global* (todo ordenado)— es precisamente lo que hace que mantener la estructura sea mucho más barato que mantener un orden total, mientras sigue garantizando que la raíz sea siempre el mínimo del conjunto completo. Todo el resto del módulo — la representación como array, los movimientos de reparación, la construcción en tiempo lineal — es la consecuencia de tomar en serio esa única idea.

---

## 1. La propiedad de heap — por qué una invariante local basta para un resultado global

### 1.1 El invariante, y la prueba de que es suficiente

**Propiedad de min-heap**: para todo nodo `x` con padre `p`, se cumple `valor(p) ≤ valor(x)`. Es decir, cada nodo es mayor o igual que su padre directo — no se exige ninguna relación entre nodos que no estén en una relación padre-hijo directa (dos hermanos pueden estar en cualquier orden entre sí, y las hojas de ramas distintas no tienen ninguna relación de orden garantizada entre ellas).

**Por qué esto garantiza que la raíz sea el mínimo global**: es una consecuencia directa de aplicar la invariante transitivamente a lo largo de cualquier camino desde la raíz hasta cualquier nodo. Si la raíz es `r`, y `x` es cualquier nodo del árbol, existe un único camino `r = p₀, p₁, p₂, ..., pₖ = x` donde cada `pᵢ₊₁` es hijo de `pᵢ`. Por la invariante, `valor(p₀) ≤ valor(p₁) ≤ valor(p₂) ≤ ... ≤ valor(pₖ)`, y por transitividad de `≤`, `valor(r) ≤ valor(x)`. Como esto vale para **cualquier** nodo `x` del árbol, la raíz es menor o igual que todos los demás nodos — es, por definición, el mínimo global. **Esta prueba es la razón exacta por la que una invariante puramente local (solo entre padre e hijo directo) es suficiente para garantizar una propiedad global (el mínimo en la raíz)** — no necesitas comparar cada par de nodos del árbol entre sí, solo necesitas que la cadena de comparaciones locales, a lo largo de cualquier camino desde la raíz, nunca se rompa.

### 1.2 Lo que la invariante NO garantiza — y por qué esa ausencia es la fuente del ahorro

Nota explícitamente lo que la propiedad de heap **no** exige: no dice nada sobre el orden entre dos hermanos, ni entre nodos de subárboles distintos. Esto significa que un heap **no** está ordenado de forma recuperable directamente por un recorrido simple (a diferencia del recorrido in-order de un BST, que sí te daba orden total gratis, como viste en el módulo de árboles) — un recorrido de un heap no produce la secuencia ordenada de sus elementos. Este es exactamente el precio que pagas por la relajación: ganas un mantenimiento de estructura mucho más barato (como vamos a probar rigurosamente en la sección 4), a cambio de perder la capacidad de recorrer todo en orden sin trabajo adicional. Un heap responde eficientemente **una** pregunta muy específica ("¿cuál es el mínimo ahora mismo?"), no la pregunta general de "dame todo ordenado" — para eso, como ya sabes, un BST balanceado (o simplemente ordenar) es la herramienta correcta. Elegir heap vs. BST es, en el fondo, elegir exactamente qué pregunta necesitas responder repetidamente, y no pagar por capacidad que no vas a usar.

---

## 2. La representación como array — la aritmética que elimina los punteros

### 2.1 El problema que resuelve: un árbol binario completo no necesita punteros

Un heap se implementa convencionalmente como un **árbol binario completo** — todos los niveles llenos excepto posiblemente el último, que se llena de izquierda a derecha sin huecos. Esta restricción estructural (a diferencia de un BST general, que puede tener cualquier forma) es exactamente lo que permite una optimización que ya deberías reconocer del módulo de estructuras lineales: **si la forma del árbol es predecible y regular, puedes calcular la posición de cualquier nodo con aritmética, en vez de seguir punteros**.

Concretamente: guarda los nodos del heap en un array, en el orden que resulta de recorrer el árbol nivel por nivel, de izquierda a derecha (recorrido *level-order* o BFS). Con esa convención, para un nodo en el índice `i` (usando indexación base 0):

```
hijo_izquierdo(i)  = 2i + 1
hijo_derecho(i)    = 2i + 2
padre(i)           = (i - 1) // 2      (division entera)
```

**Por qué esta fórmula funciona, deducido y no memorizado**: en un árbol binario completo llenado nivel por nivel, el nivel 0 (la raíz) ocupa el índice 0; el nivel 1 (hasta 2 nodos) ocupa los índices 1 y 2; el nivel 2 (hasta 4 nodos) ocupa los índices 3, 4, 5, 6; y en general, el nivel `k` empieza en el índice `2^k - 1`. Dentro de cada nivel, el hijo izquierdo de un nodo siempre está "dos posiciones adelante, contando desde el doble de la posición del padre dentro de su propio nivel" — la derivación completa es un ejercicio de conteo de posiciones por nivel, pero el resultado, `2i+1` y `2i+2`, es simplemente la consecuencia aritmética de que **cada nodo tiene exactamente el doble de "ancho" de espacio ocupado por sus descendientes en el siguiente nivel**, exactamente como cada dígito en notación binaria representa el doble del valor posicional del dígito anterior — es la misma estructura de "duplicación por nivel" que ya viste en la relación entre altura y número de nodos en árboles balanceados, aplicada aquí no como cota de altura sino como fórmula exacta de indexación.

### 2.2 Por qué esto es estrictamente mejor que punteros, para ESTA estructura específica

Recuerda del módulo de estructuras lineales: un array da acceso O(1) por índice calculado (aritmética de direcciones), mientras que una estructura con punteros paga overhead de memoria y localidad de caché pobre. Como la forma de un heap está **completamente determinada** por cuántos elementos tiene (no hay libertad de "forma" como en un BST general, donde la forma depende del orden de inserción) — la representación de array explota exactly esa regularidad: no necesitas **ningún** puntero explícito, porque la posición de cualquier padre/hijo se calcula, nunca se almacena ni se sigue. Esto es exclusivamente posible porque un heap **no** necesita el invariante de orden BST (que sí exige libertad estructural para acomodar inserciones en cualquier posición relativa) — el heap solo necesita la forma "completa", que es la más rígida y predecible posible, y esa rigidez es lo que habilita la representación puramente aritmética.

```python
class HeapBinario:
    """
    Min-heap binario representado como array, indexado base 0.
    Fiel al esquema de CLRS cap. 6 / MIT 6.006 L8.
    """
    def __init__(self):
        self._datos = []

    def __len__(self):
        return len(self._datos)

    def _padre(self, i):
        return (i - 1) // 2

    def _hijo_izquierdo(self, i):
        return 2 * i + 1

    def _hijo_derecho(self, i):
        return 2 * i + 2

    def _intercambiar(self, i, j):
        self._datos[i], self._datos[j] = self._datos[j], self._datos[i]
```

---

## 3. sift-up y sift-down — los dos movimientos que restauran la invariante

### 3.1 Por qué se necesitan exactamente dos movimientos, no uno

Cuando el heap se modifica (inserción o extracción), la invariante local (sección 1.1) puede romperse en un punto específico. Hay exactamente dos direcciones en las que la reparación puede necesitar propagarse, según de dónde vino la violación:

**sift-up (o "bubble-up")**: se usa después de **insertar** un elemento nuevo. La estrategia natural de inserción es agregar el nuevo elemento al final del array (la próxima posición libre que mantiene la forma de árbol completo, sección 2.1) — pero ese elemento nuevo puede ser **menor** que su padre actual, violando la invariante localmente en ese punto. La reparación: compara el nuevo elemento contra su padre; si es menor, intercambia; repite el proceso con la nueva posición (ahora un nivel más arriba); continúa hasta que el elemento encuentre un padre menor o igual, o llegue a la raíz.

```python
def insertar(self, valor):
    self._datos.append(valor)          # agregar al final: mantiene forma completa
    self._sift_up(len(self._datos) - 1)

def _sift_up(self, i):
    while i > 0:
        p = self._padre(i)
        if self._datos[i] < self._datos[p]:
            self._intercambiar(i, p)
            i = p                       # continuar reparando un nivel mas arriba
        else:
            break                       # invariante restaurada, no hay mas que hacer
```

**Costo de sift-up**: en el peor caso, el elemento recién insertado sube desde una hoja hasta la raíz — un número de intercambios proporcional a la **altura** del árbol. Como un árbol binario completo con n nodos tiene altura Θ(log n) (la misma relación de crecimiento logarítmico por duplicación de nodos por nivel que ya viste con AVL, aquí garantizada automáticamente por la forma completa, sin necesitar ninguna maquinaria de balance activo como rotaciones), `insertar` cuesta **O(log n)**.

**sift-down (o "bubble-down"/"heapify" a nivel de un solo nodo)**: se usa después de **extraer el mínimo**. El mínimo siempre vive en la raíz (sección 1.1) — extraerlo deja un hueco ahí. La estrategia natural: mueve el **último** elemento del array a la posición de la raíz (mantiene la forma completa, porque quitas exactamente el último elemento del array), y luego repara la invariante hacia abajo: compara el nuevo elemento en la raíz contra sus dos hijos; si alguno es menor, intercambia con el **menor de los dos** (no con cualquiera de los dos — hay que ser explícito sobre por qué: si intercambiaras con el mayor de los dos hijos, podrías dejar el hijo menor todavía violando la invariante respecto al elemento que acabas de bajar); repite el proceso desde la nueva posición, hasta que el elemento encuentre que ambos hijos son mayores o iguales, o hasta que llegue a una hoja.

```python
def extraer_minimo(self):
    if not self._datos:
        raise IndexError("extraer de heap vacio")
    minimo = self._datos[0]
    ultimo = self._datos.pop()
    if self._datos:                     # si no quedo vacio tras el pop
        self._datos[0] = ultimo
        self._sift_down(0)
    return minimo

def _sift_down(self, i):
    n = len(self._datos)
    while True:
        izq = self._hijo_izquierdo(i)
        der = self._hijo_derecho(i)
        menor = i
        if izq < n and self._datos[izq] < self._datos[menor]:
            menor = izq
        if der < n and self._datos[der] < self._datos[menor]:
            menor = der
        if menor == i:
            break                       # ningun hijo es menor: invariante restaurada
        self._intercambiar(i, menor)
        i = menor                       # continuar reparando hacia abajo
```

**Costo de sift-down**: idéntico argumento que sift-up, en dirección opuesta — el elemento baja, en el peor caso, desde la raíz hasta una hoja, un número de intercambios proporcional a la altura, **O(log n)**.

### 3.2 Analogía: la jerarquía corporativa que se reacomoda

Piensa en una organización donde "menor valor = más senior" (un CEO tiene "valor 1", sus reportes directos tienen valores más altos, y así sucesivamente). Si contratas a alguien nuevo (inserción) y por error de asignación inicial lo pones en la base de la jerarquía, pero en realidad es más senior que su jefe directo — sift-up es exactamente el proceso de "promoverlo" repetidamente, comparándolo contra cada jefe sucesivo, hasta que encuentre su nivel correcto de seniority relativo. Si el CEO renuncia (extracción del mínimo/raíz), sift-down es el proceso de tomar temporalmente al empleado de menor jerarquía de toda la organización (el último del array) y "probarlo" en la cima, dejando que descienda comparándose contra sus subordinados directos en cada nivel, hasta encontrar su nivel real de competencia relativa — el clásico "principio de Peter" convertido en algoritmo determinístico y correcto (aquí, a diferencia de la observación satírica original, el algoritmo sí encuentra el nivel correcto, porque compara explícitamente en cada paso).

---

## 4. Heapify — el núcleo intelectual del módulo: por qué construir es O(n), no O(n log n)

### 4.1 La pregunta que hay que tomarse en serio

Si insertar un elemento cuesta O(log n) (sección 3.1), y quieres construir un heap desde cero a partir de un array de n elementos desordenados, la estrategia ingenua sería: insertar los n elementos uno por uno, cada inserción costando O(log n) — dando un total de **O(n log n)**.

Existe una estrategia alternativa, llamada **heapify** (o *build-heap*), que logra el mismo resultado (un array que satisface la propiedad de heap) en **O(n)** — estrictamente mejor, no solo por una constante, sino por un factor logarítmico completo. Vamos a deducir por qué esto es posible, con todo el rigor que este es exactamente el tipo de resultado que un evaluador exigente esperaría que puedas reconstruir desde cero, no solo citar.

### 4.2 La estrategia: sift-down bottom-up, no sift-up top-down

**El mecanismo de heapify**: toma el array desordenado tal cual está. Empezando desde el **último nodo que tiene al menos un hijo** (es decir, desde el índice `n//2 - 1` hacia atrás, en indexación base 0 — todos los índices posteriores a ese son hojas, que trivialmente ya satisfacen la propiedad de heap por no tener hijos con quien compararse) y recorriendo hacia atrás hasta la raíz (índice 0), aplica `_sift_down` en cada uno de esos nodos.

```python
def heapify(arreglo):
    """
    Construye la propiedad de heap IN-PLACE sobre `arreglo`, en O(n).
    Fiel al esquema BUILD-MIN-HEAP de CLRS 6.3.
    """
    n = len(arreglo)
    heap = HeapBinario()
    heap._datos = arreglo   # reusa el mismo array, sin copiar

    # Empezar en el ultimo nodo con al menos un hijo, ir hacia atras.
    # Los indices posteriores a este son TODOS hojas -- ya satisfacen
    # la propiedad de heap trivialmente (no tienen hijos que violar).
    for i in range(n // 2 - 1, -1, -1):
        heap._sift_down(i)

    return heap


if __name__ == "__main__":
    datos = [9, 5, 12, 1, 7, 3, 8, 2, 6, 4]
    h = heapify(datos)
    print("heap construido:", h._datos)
    print("minimo (raiz):", h._datos[0])
    assert h._datos[0] == min(datos)
```

**Por qué construir de abajo hacia arriba (bottom-up con sift-down), en vez de arriba hacia abajo (top-down con sift-up), es la clave del ahorro**: esto no es un detalle de implementación arbitrario — es exactamente la elección que hace posible la prueba de costo O(n) que viene a continuación. La intuición previa a la prueba formal: con sift-down bottom-up, **la mayoría de los nodos están cerca de las hojas** (la mitad del árbol completo son hojas, un cuarto están a un nivel de las hojas, un octavo a dos niveles, etc.) y esos nodos requieren **poco** trabajo de reparación (poca distancia para bajar), mientras que **muy pocos** nodos están cerca de la raíz (donde el trabajo de bajar sería más costoso, en el peor caso). Con sift-up top-down (inserción una por una), es exactamente al revés en términos de qué nodos hacen el trabajo caro: cada elemento nuevo insertado potencialmente tiene que subir hasta la raíz, y **eso pasa para cada uno de los n elementos**, no solo para unos pocos.

### 4.3 La prueba rigurosa: el argumento de la suma de alturas

Aquí está la derivación completa, sección por sección, sin saltarte pasos.

**Setup**: en un árbol binario completo con n nodos, el número de nodos a **altura** `h` (donde altura de una hoja es 0, y la altura aumenta subiendo hacia la raíz — nota que esto es "altura", no "profundidad/nivel", una distinción que hay que mantener clara para el resto de la prueba) está acotado por:

```
número de nodos a altura h  ≤  ⌈n / 2^(h+1)⌉
```

**Por qué esta fórmula, intuitivamente antes de usarla**: la mitad de todos los nodos de un árbol binario completo son hojas (altura 0). De los que quedan, la mitad son nodos a altura 1 (es decir, un cuarto del total). De los que quedan, la mitad son altura 2 (un octavo del total). Este patrón de "cada nivel de altura tiene, aproximadamente, la mitad de nodos que el nivel de altura inmediatamente inferior" es exactamente la misma estructura geométrica de duplicación por nivel que ya usaste para derivar la altura logarítmica de árboles balanceados — aquí aplicada no para acotar la altura máxima, sino para contar cuántos nodos viven a cada altura específica.

**El costo de sift-down en un nodo a altura h es O(h)**: un nodo a altura `h` puede, en el peor caza, necesitar bajar hasta `h` niveles antes de encontrar su posición correcta — exactamente el mismo argumento de costo proporcional a la distancia recorrida que ya estableciste en la sección 3.1 para sift-down, aquí parametrizado por la altura específica del nodo donde se aplica, no por la altura total del árbol.

**El costo TOTAL de heapify es la suma, sobre todas las alturas posibles, del número de nodos a esa altura multiplicado por el costo de reparar cada uno**:

```
Costo total  =  Σ (para h desde 0 hasta log₂n)  [número de nodos a altura h] × O(h)
             ≤  Σ (para h desde 0 hasta log₂n)  (n / 2^(h+1)) × h
             =  (n/2) × Σ (para h desde 0 hasta log₂n)  h / 2^h
```

**El paso final — reconocer la serie**: la serie `Σ h/2^h` (sumada desde h=0 hasta infinito) es una serie aritmético-geométrica **conocida y convergente**: se puede probar (por manipulación algebraica estándar de series, derivando la serie geométrica `Σx^h = 1/(1-x)` respecto a `x` y evaluando en `x=1/2`) que:

```
Σ (h=0 hasta ∞)  h / 2^h  =  2
```

**Esta es la pieza que hace toda la prueba funcionar**: la serie converge a una **constante** (2), independiente de n — no crece con el tamaño del árbol. Sustituyendo:

```
Costo total  ≤  (n/2) × 2  =  n  =  O(n)
```

**La conclusión, y por qué es genuinamente sorprendente si no la has visto antes**: aunque cada nodo individual puede costar hasta O(log n) en el peor caso (si estuviera cerca de la raíz), la **inmensa mayoría** de los nodos están cerca de las hojas, donde el costo es pequeño — y esa distribución desigual (muchos nodos baratos, pocos nodos caros) es exactamente lo que hace que la serie `Σh/2^h` converja a una constante en vez de crecer con n. **Heapify es O(n), no porque cada operación individual sea barata, sino porque el trabajo caro está concentrado en muy pocos nodos, y esa concentración se puede sumar exactamente y probar que converge.** Este es el mismo tipo de argumento de "la mayoría del trabajo se concentra donde es barato" que ya viste, en otra forma, en el análisis amortizado del array dinámico — aquí aplicado no a una secuencia temporal de operaciones, sino a una distribución espacial de nodos en un árbol.

### 4.4 La trampa clásica, ahora completamente explicada: misma estructura final, costo de construcción distinto

Aquí está la trampa que casi todos cometen si no interiorizan la prueba de la sección 4.3: **insertar n elementos uno por uno (n × sift-up, cada uno O(log n) en el peor caso) da O(n log n) total. Heapify bottom-up (n/2 llamadas a sift-down, distribuidas de forma muy desigual en costo real) da O(n) total.** Ambos procesos terminan produciendo **una estructura que satisface exactamente la misma propiedad de heap** — no hay ninguna diferencia en el resultado final, solo en el camino para llegar ahí. Confundir "construir insertando uno por uno" con "construir con heapify" —asumiendo que ambos cuestan lo mismo porque "hacen básicamente lo mismo"— es exactamente el tipo de error de razonamiento que este módulo existe para prevenir: **la estructura final idéntica no implica que el costo de construcción sea idéntico**; el costo depende enteramente de qué operación (sift-up desde arriba vs. sift-down desde abajo) se aplica y en qué distribución de nodos.

---

## 5. Heapsort — la aplicación directa de heapify y extract-min

### 5.1 El algoritmo, deducido del mecanismo ya construido

Ya tienes todas las piezas: heapify construye un heap en O(n); extraer el mínimo cuesta O(log n) y deja el siguiente mínimo listo en la raíz. Heapsort es, literalmente, la aplicación repetida de esas dos piezas: heapify el array completo, luego extrae el mínimo n veces sucesivas, colocando cada extracción en su posición final ordenada.

```python
def heapsort(arreglo):
    """
    Ordena `arreglo` ascendentemente usando un heap.
    Costo: O(n) para heapify + n * O(log n) para las n extracciones = O(n log n).
    """
    h = heapify(list(arreglo))   # O(n)
    resultado = []
    while len(h) > 0:
        resultado.append(h.extraer_minimo())   # O(log n) cada una, n veces
    return resultado


if __name__ == "__main__":
    datos = [9, 5, 12, 1, 7, 3, 8, 2, 6, 4]
    ordenado = heapsort(datos)
    print(ordenado)
    assert ordenado == sorted(datos)
```

**Costo total**: O(n) de heapify + n extracciones a O(log n) cada una = O(n) + O(n log n) = **O(n log n)** (el término O(n log n) domina, exactamente como en el módulo de análisis asintótico donde el término de mayor orden absorbe a los de menor orden). Nota que **heapify por sí solo no ordena nada** — solo garantiza la propiedad de heap (mínimo en la raíz), no orden total. Es la extracción repetida la que produce la secuencia ordenada completa, un elemento a la vez.

**La versión in-place clásica de CLRS** logra esto sin memoria auxiliar: en vez de extraer a una lista nueva, intercambia la raíz (el mínimo, o el máximo si usas max-heap, que es la convención de CLRS para heapsort ascendente) con el último elemento del heap activo, reduce el tamaño lógico del heap en uno, y aplica sift-down sobre la nueva raíz — el espacio "liberado" al final del array se va llenando, en cada paso, con el siguiente elemento en su posición final ordenada. El resultado es un ordenamiento **O(n log n) en el peor caso, garantizado, in-place** (a diferencia de quicksort, cuyo peor caso es O(n²) como viste en el módulo de estructuras lineales al hablar de por qué el peor caso importa para garantías de ingeniería).

---

## 6. Cola de prioridad — la aplicación conceptual, no solo el heap como estructura

Un heap binario es la **implementación** más común de una **cola de prioridad (priority queue, PQ)** — una abstracción de más alto nivel que declara solo dos operaciones esenciales: `insertar(elemento, prioridad)` y `extraer_prioridad_maxima()` (o mínima, según convención). La distinción entre "cola de prioridad" (la interfaz/contrato) y "heap binario" (una implementación concreta de esa interfaz) importa porque, como verás en la sección de trade-offs, existen otras implementaciones de cola de prioridad con garantías de costo distintas — el heap binario es la opción más simple y de uso más extendido, pero no la única.

---

## 7. Edge cases y trampas explícitas

**Heap de un solo elemento**: `_sift_up` y `_sift_down` deben manejar correctamente el caso donde el heap tiene 0 o 1 elementos, sin errores de índice. Nota en el código de la sección 3 que `_sift_up` verifica `i > 0` (nunca intenta acceder al padre de la raíz) y `_sift_down` verifica `izq < n` y `der < n` antes de comparar (nunca asume que un hijo existe). Omitir estas verificaciones es la fuente más común de `IndexError` al implementar un heap desde cero.

**Índice base 0 vs. base 1**: CLRS, en su presentación original, usa indexación **base 1** (donde las fórmulas son `hijo_izquierdo(i) = 2i`, `hijo_derecho(i) = 2i+1`, `padre(i) = i/2` con división entera) — más limpio matemáticamente porque evita el `+1`/`-1` de ajuste. La mayoría de las implementaciones modernas en lenguajes con arrays base 0 (Python, Java, C) usan las fórmulas `2i+1`, `2i+2`, `(i-1)//2` que ya viste — **la trampa concreta**: mezclar fórmulas de ambas convenciones en la misma implementación (por ejemplo, copiar la fórmula del padre de una fuente base 1 y la del hijo de una fuente base 0) produce un heap que "casi funciona" pero falla silenciosamente en casos específicos de índices — exactamente el tipo de bug sutil que pasa desapercibido en pruebas casuales y se manifiesta solo con ciertos tamaños de entrada.

**Confundir heapify con "estar ordenado"**: ya se estableció en la sección 5, pero vale la pena remarcarlo como trampa explícita — después de `heapify`, el array satisface la propiedad de heap (padre ≤ hijos), **no** está ordenado de forma recuperable con un recorrido simple. Si necesitas el array completamente ordenado, necesitas las extracciones sucesivas de heapsort, no solo heapify.

---

## 8. Trade-offs explícitos: heap binario vs. otras colas de prioridad

El heap binario da inserción y extracción en O(log n) — excelente para la mayoría de los casos de uso. Pero existen estructuras alternativas con garantías distintas, relevantes específicamente cuando el patrón de uso lo justifica:

**Fibonacci heap**: ofrece inserción en **O(1) amortizado** (no O(log n)) y una operación adicional, **decrease-key** (reducir la prioridad de un elemento ya insertado), también en O(1) amortizado — a costa de una implementación considerablemente más compleja, con constantes prácticas más altas, y `extract-min` que sigue siendo O(log n) amortizado. **Por qué esto importa específicamente para el algoritmo de Dijkstra** (que vas a ver en el próximo módulo de grafos): Dijkstra necesita, repetidamente, reducir la distancia estimada de un nodo cuando encuentra un camino más corto — exactamente la operación `decrease-key`. Con un heap binario convencional, `decrease-key` no es una operación nativa eficiente (requiere encontrar el elemento primero, lo cual no es O(1) sin un índice auxiliar, y luego hacer sift-up) — con un Fibonacci heap, es O(1) amortizado, lo cual mejora la complejidad teórica global de Dijkstra de O((V+E) log V) con heap binario a O(E + V log V) con Fibonacci heap. **En la práctica**, sin embargo, las constantes ocultas de un Fibonacci heap son considerablemente mayores que las de un heap binario simple, así que para grafos de tamaño moderado, un heap binario (con el ajuste práctico de simplemente permitir entradas duplicadas en la PQ e ignorar las obsoletas al extraerlas, en vez de implementar decrease-key de verdad) frecuentemente es más rápido en la práctica real, a pesar de tener peor complejidad teórica en el peor caso — otro ejemplo del mismo principio que ya viste en el módulo de estructuras lineales: la complejidad asintótica no captura todo el rendimiento real, las constantes y la simplicidad de implementación importan en la práctica de ingeniería.

**Heapsort vs. quicksort**: ambos son O(n log n) en promedio, pero heapsort tiene **garantía de peor caso O(n log n)**, mientras que quicksort (con selección de pivote ingenua) tiene peor caso O(n²) — la misma distinción de garantía de peor caso vs. comportamiento típico que ya estableciste como principio de ingeniería en el módulo de análisis asintótico. En la práctica, sin embargo, quicksort suele ser más rápido en el caso típico debido a mejor localidad de caché (heapsort salta por el array siguiendo la estructura del árbol, con patrones de acceso menos secuenciales que quicksort en su fase de partición) — de nuevo, el mismo trade-off entre garantía teórica y rendimiento constante real.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Dijkstra usa una cola de prioridad — el puente directo al siguiente módulo.** El algoritmo de Dijkstra para caminos más cortos en un grafo con pesos no negativos mantiene, en cada paso, el conjunto de nodos "por visitar" ordenados por su distancia estimada actual desde el origen — y necesita, repetidamente, extraer el nodo con menor distancia estimada (exactamente `extraer_minimo`) y, al encontrar un camino más corto hacia un nodo ya en la cola, actualizar su prioridad (`decrease-key`, mencionado en la sección 8). Esta es la razón concreta y no arbitraria de por qué este módulo de heaps precede directamente al módulo de grafos y caminos más cortos en cualquier secuencia curricular bien diseñada — no es una coincidencia de organización temática, es una dependencia estructural real: no puedes entender ni implementar correctamente Dijkstra sin entender primero por qué una cola de prioridad da exactamente las garantías de costo que el algoritmo necesita.

**Top-k problems — la aplicación práctica más común de heaps en ingeniería de software real.** Una clase enorme de problemas prácticos ("dame los k elementos más grandes/pequeños de un stream de datos", "los k productos más vendidos", "los k procesos que más CPU consumen ahora mismo") se resuelve de forma óptima manteniendo un heap de tamaño **fijo** k (no de tamaño n): para encontrar los k mayores elementos de un stream, mantén un min-heap de tamaño k — si un elemento nuevo es mayor que el mínimo del heap (la raíz), reemplázalo y haz sift-down; si es menor o igual, ignóralo. El costo total es O(n log k) en vez de O(n log n) que costaría ordenar todo el stream completo — una mejora sustancial cuando k es mucho menor que n (el caso típico: encontrar los top 10 de un stream de millones de eventos). Esto es exactamente el mismo principio de "no necesitas resolver el problema completo (ordenar todo) cuando solo necesitas responder una pregunta parcial (los k mejores)" que motivó la pregunta raíz de todo este módulo, aplicado ahora no a "el mínimo" sino a "los k mínimos".

**Heapsort como el "seguro de peor caso" detrás de algoritmos híbridos de producción.** Muchas implementaciones de ordenamiento de propósito general en bibliotecas estándar modernas (por ejemplo, introsort, usado en las implementaciones de `std::sort` de C++) usan quicksort como estrategia principal por su excelente rendimiento típico, pero **cambian dinámicamente a heapsort** si detectan que la recursión de quicksort se está profundizando más de lo esperado (una señal de que el peor caso O(n²) está ocurriendo) — garantizando así que el peor caso absoluto del algoritmo híbrido completo nunca sea peor que O(n log n), combinando lo mejor de ambos mundos: el rendimiento constante típico de quicksort con la garantía de peor caso de heapsort. Esto es una instancia concreta y real de un principio de ingeniería que vale la pena generalizar: cuando tienes dos algoritmos con trade-offs opuestos (uno rápido en promedio pero con mal peor caso, otro con garantía de peor caso pero menor rendimiento típico), frecuentemente la mejor solución de producción no es elegir uno u otro, sino **combinarlos con una heurística de cambio de estrategia** que detecte cuándo el caso patológico del primero está ocurriendo.

---

## Síntesis — el mapa mental

1. La propiedad de heap (padre ≤ hijos) es una invariante deliberadamente **local**, no global — y se prueba, por transitividad a lo largo de cualquier camino raíz-nodo, que esa invariante local basta para garantizar el mínimo global en la raíz, sin necesitar orden total entre todos los elementos.
2. La forma de árbol binario **completo** (regular, predecible) es lo que permite representar el heap como **array puro, sin punteros** — las fórmulas `2i+1`, `2i+2`, `(i-1)//2` son aritmética de posición, consecuencia directa de la regularidad de la forma, no una convención arbitraria.
3. **sift-up** repara la invariante hacia arriba (tras inserción); **sift-down** la repara hacia abajo (tras extracción del mínimo) — ambas con costo O(altura recorrida), que en un árbol completo con n nodos es O(log n) en el peor caso.
4. **Heapify** construye la propiedad de heap en **O(n)**, no O(n log n), aplicando sift-down bottom-up en vez de sift-up top-down — la prueba rigurosa (sección 4.3) descansa en que la distribución de nodos por altura es geométricamente decreciente (la mitad son hojas, un cuarto a altura 1, etc.), y la serie resultante `Σh/2^h` converge a una constante, no crece con n.
5. La trampa clásica: insertar n elementos uno por uno da O(n log n); heapify bottom-up da O(n) — **misma estructura final, costo de construcción radicalmente distinto**, porque el camino para llegar ahí distribuye el trabajo de forma completamente diferente entre los nodos.
6. **Heapsort** = heapify (O(n)) + n extracciones sucesivas (O(log n) cada una) = O(n log n) total, con la ventaja sobre quicksort de **garantía de peor caso**, al costo de peor localidad de caché en la práctica.
7. El heap binario es la implementación más simple y extendida de la abstracción de **cola de prioridad** — pero no la única: Fibonacci heap ofrece decrease-key en O(1) amortizado, relevante específicamente para la complejidad teórica óptima de Dijkstra, aunque con constantes prácticas más altas que frecuentemente lo hacen más lento en grafos de tamaño moderado.

---

## Preguntas que deberías poder responder

1. Prueba, sin ver el texto, por qué la propiedad de heap (invariante solo entre padre e hijo directo) garantiza que la raíz sea el mínimo global — usa el argumento de transitividad a lo largo de un camino raíz-nodo.
2. Deriva las fórmulas `2i+1`, `2i+2`, `(i-1)//2` para hijo izquierdo, hijo derecho y padre en indexación base 0, explicando por qué la forma de árbol binario completo es lo que hace esta aritmética posible (a diferencia de un BST general).
3. Reproduce, sin ver el texto, la prueba completa de por qué heapify es O(n) — incluye la fórmula de número de nodos por altura, el costo de sift-down por altura, y por qué la serie `Σh/2^h` converge a una constante en vez de crecer con n.
4. Explica la trampa clásica: ¿por qué insertar n elementos uno por uno (cada uno con sift-up) da un costo total distinto a construir con heapify (sift-down bottom-up), si ambos procesos terminan en una estructura que satisface exactamente la misma propiedad de heap?
5. ¿Por qué `_sift_down` compara contra el **menor** de los dos hijos, no contra cualquiera de los dos? Construye un ejemplo concreto (4-5 elementos) donde intercambiar con el hijo mayor en vez del menor rompería la invariante de heap en el hijo que no elegiste.
6. ¿Por qué heapsort tiene garantía de peor caso O(n log n) mientras quicksort (con pivote ingenuo) puede degradar a O(n²)? ¿Por qué, a pesar de esto, quicksort suele ser más rápido en la práctica para el caso típico?
7. Explica por qué la operación `decrease-key` es central para la complejidad teórica óptima del algoritmo de Dijkstra, y por qué un Fibonacci heap la ofrece en O(1) amortizado mientras un heap binario convencional no la ofrece de forma nativamente eficiente.
8. Diseña, en palabras, cómo resolverías el problema de "encontrar los k elementos más grandes de un stream de un millón de números" usando un heap de tamaño fijo k, y explica por qué el costo resultante O(n log k) es mejor que ordenar todo el stream cuando k << n.

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lecture 8 (Binary Heaps): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 6 (Heapsort): propiedad de heap (6.1), procedimiento MAX-HEAPIFY (6.2), BUILD-MAX-HEAP y la prueba de costo O(n) (6.3), el algoritmo HEAPSORT (6.4), y colas de prioridad (6.5).
- UC Berkeley CS61B, notas sobre heaps y colas de prioridad: https://sp21.datastructur.es/
- Fredman, M. L. y Tarjan, R. E., "Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms", *Journal of the ACM*, 1987 — el paper original de Fibonacci heaps, referenciado en el contexto de la complejidad óptima de Dijkstra.
