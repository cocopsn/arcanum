---
module_id: oa-6-heap-topk
spine: OA Amazon
title: "Heaps y Top-K"
subtitle: "El mejor a la mano en log n"
source_canonical: "itc-c5-heaps; patrones Amazon-tagged de Top K Frequent Elements, Task Scheduler, asignación de máximo disponible"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 36
---

# Heaps y Top-K

> **Pregunta raíz.** Cuando un problema pide "los K más grandes/frecuentes", o describe un proceso donde repetidamente "asignas el máximo disponible" y ese máximo cambia después de cada asignación, un heap te da acceso al extremo (mínimo o máximo) en O(1) y actualización en O(log n) — contra el O(n) de buscar el máximo desde cero cada vez que lo necesitas. Con muchas asignaciones repetidas, esa diferencia es exactamente la que separa una solución que corre de una que hace TLE.

## Prólogo

La teoría completa de heaps —por qué heapify es O(n), sift-up/sift-down, la representación como array— ya la tienes de primer principio en `itc-c5-heaps`. Este módulo no la repite: vive en la otra naturaleza de tu entrenamiento, la de reflejo bajo reloj, exactamente como ya distinguiste entre tu eje ITC y tu eje Competitiva. Aquí el objetivo es reconocer, en segundos, cuándo un heap es la herramienta y teclear `heapq` de Python sin dudar.

---

## 1. heapq de Python — el detalle que hay que tener automático

`heapq` de Python implementa **únicamente un min-heap** — la raíz siempre es el elemento menor. Si necesitas un max-heap (el caso más común en problemas de "el máximo disponible"), la técnica estándar es **negar los valores** al insertarlos y volver a negar al extraerlos.

```python
import heapq

# Min-heap directo
min_heap = []
heapq.heappush(min_heap, 5)
heapq.heappush(min_heap, 1)
heapq.heappush(min_heap, 3)
print(heapq.heappop(min_heap))   # 1 -- el menor

# Max-heap: niega al insertar, niega al extraer
max_heap = []
for x in [5, 1, 3]:
    heapq.heappush(max_heap, -x)
print(-heapq.heappop(max_heap))   # 5 -- el mayor
```

**Memoriza esto como reflejo de una línea**: `heapq.heappush(heap, -x)` para insertar en un max-heap simulado, `-heapq.heappop(heap)` para extraer el máximo real. Olvidar la negación en cualquiera de los dos lados es la trampa número uno de esta familia — y produce un bug silencioso (obtienes el mínimo cuando necesitabas el máximo) sin ningún error de sintaxis que te avise.

---

## 2. Top K Frequent Elements — heap de tamaño acotado

**El problema**: dado un arreglo, encuentra los K elementos más frecuentes.

**La deducción, conectando con `oa-1-arrays-hashmap`**: primero cuenta frecuencias con `Counter` (O(n), ya lo dominas). Luego, en vez de ordenar **todas** las frecuencias (O(n log n)) cuando solo necesitas las K más grandes, mantén un heap de tamaño **exactamente K**: si un elemento nuevo es mayor que el mínimo del heap, reemplázalo. Esto da O(n log K) — mejor que O(n log n) cuando K es mucho menor que n, y es exactamente el patrón que ya reconociste en `itc-c5-heaps` sección de Conexiones (top-k con heap de tamaño fijo).

```python
from collections import Counter
import heapq

def top_k_frecuentes(nums, k):
    """
    O(n log k): cuenta frecuencias O(n), mantiene un min-heap de
    tamano k sobre esas frecuencias.
    """
    frecuencias = Counter(nums)
    heap = []   # min-heap de (frecuencia, valor)

    for valor, freq in frecuencias.items():
        heapq.heappush(heap, (freq, valor))
        if len(heap) > k:
            heapq.heappop(heap)   # descarta el de menor frecuencia

    return [valor for freq, valor in heap]


if __name__ == "__main__":
    print(top_k_frecuentes([1, 1, 1, 2, 2, 3], 2))   # [2, 1] (orden puede variar)
```

**Alternativa más simple si K no es mucho menor que n**: `heapq.nlargest(k, frecuencias.items(), key=lambda x: x[1])` — Python ya trae esta utilidad, y bajo reloj, usarla directamente en vez de reimplementar el patrón manual ahorra tiempo real cuando no necesitas la ganancia de O(log k) sobre O(log n) (que es marginal salvo que n sea mucho mayor que k).

---

## 3. El máximo disponible que cambia — asignación repetida con heap

### 3.1 El tipo de problema

Una familia frecuente en Amazon: simulas un proceso donde, repetidamente, tomas el elemento de mayor valor disponible, lo procesas (posiblemente modificándolo), y potencialmente lo regresas al conjunto disponible — como asignar tareas al trabajador con más capacidad restante, o procesar el lote con más unidades pendientes.

### 3.2 Por qué esto es heap y no búsqueda lineal repetida

Si el "máximo disponible" cambia después de cada operación (porque procesar un elemento lo modifica y podría necesitar volver a insertarse), buscar el máximo desde cero cada vez es O(n) por operación — con muchas operaciones repetidas (`n` operaciones sobre `n` elementos), eso es O(n²) total, exactamente el tipo de complejidad que la tabla de `oa-0-fundamentos` te dice que va a hacer TLE con `n` grande. Un heap da O(log n) por extracción **y** por reinserción, bajando el total a O(n log n).

```python
import heapq

def procesar_maximo_repetidamente(capacidades, num_operaciones):
    """
    Patron: en cada operacion, toma el MAYOR disponible, procesalo
    (aqui: reducelo a la mitad como ejemplo), y si sigue siendo
    positivo, reinsertalo -- todo en O(log n) por operacion.
    """
    heap = [-c for c in capacidades]
    heapq.heapify(heap)   # O(n), no O(n log n) -- construccion directa

    for _ in range(num_operaciones):
        if not heap:
            break
        mayor = -heapq.heappop(heap)
        mayor_procesado = mayor // 2   # la "operacion" especifica del problema
        if mayor_procesado > 0:
            heapq.heappush(heap, -mayor_procesado)

    return [-x for x in heap]


if __name__ == "__main__":
    print(procesar_maximo_repetidamente([10, 4, 7], 3))
```

**Nota `heapq.heapify(heap)` en vez de insertar uno por uno**: construir el heap inicial con `heapify` sobre la lista completa es O(n) — exactamente la prueba rigurosa que ya construiste en `itc-c5-heaps`, sección de heapify — mientras que insertar los mismos n elementos uno por uno con `heappush` repetido sería O(n log n). Bajo reloj, usa siempre `heapify` sobre una lista ya construida en vez de un loop de `heappush`, cuando tengas todos los elementos iniciales disponibles de antemano.

---

## Señales de reconocimiento

- **"Los K más grandes/pequeños/frecuentes"** — heap de tamaño acotado K, casi siempre.
- **"El mayor/menor disponible cada vez"**, en un proceso que se repite — heap completo, con reinserción si aplica.
- **Costo acumulado de asignaciones repetidas** donde el "mejor candidato" cambia dinámicamente después de cada asignación — la firma más clara de que necesitas O(log n) por operación, no O(n).
- **Amazon-tagged "Task Scheduler"** o variantes de programación de tareas con enfriamiento/prioridad — frecuentemente heap de frecuencias combinado con lógica de espaciado.

---

## Trampas OA

**Olvidar negar para max-heap**: la trampa número uno, ya cubierta en la sección 1 — produce un bug silencioso, no un error de sintaxis.

**Búsqueda lineal del máximo que hace TLE**: si tu instinto es `max(lista)` dentro de un loop que se repite `n` veces, acabas de escribir O(n²) sin darte cuenta — exactamente el tipo de complejidad que la restricción de `n` (típicamente `10^5` o más en esta familia) va a rechazar. En cuanto reconozcas "máximo que cambia, repetido muchas veces", tu reflejo debería saltar directo a heap, no a `max()` en un loop.

**Reconstruir el heap completo en cada operación**: un error relacionado — llamar `heapify()` de nuevo después de cada modificación, en vez de usar `heappush`/`heappop` para mantener la propiedad de heap incrementalmente. Esto reintroduce el costo O(n) por operación que el heap existe para evitar.

---

## Conexiones

**Con `itc-c5-heaps`**: relacionado, otra naturaleza — la prueba de por qué heapify es O(n), el mecanismo de sift-up/sift-down, la representación como array, todo eso ya lo dominas de primer principio. Este módulo es el reflejo de examen: reconocer la firma en segundos y teclear `heapq` sin dudar, sin necesitar rederivar nada.

**Con `oa-1-arrays-hashmap`**: Top K Frequent combina directamente ambos módulos — `Counter` para las frecuencias, heap para extraer las K mayores sin ordenar todo. Esta composición de dos patrones simples es exactamente el tipo de problema de dificultad media que el OA favorece.

**Con `oa-4-binary-search-answer`**: en problemas donde necesitas simular un proceso de asignación repetida como parte de `feasible(X)` dentro de una búsqueda binaria on-answer, frecuentemente esa simulación interna es, ella misma, un patrón de heap — reconocer que estás componiendo dos técnicas, no inventando una tercera, acelera la resolución.

---

## Síntesis

1. `heapq` de Python es min-heap puro — niega para simular max-heap, y memoriza esto como reflejo de una línea.
2. Top K se resuelve con un heap de tamaño acotado K, dando O(n log k), mejor que ordenar todo cuando K << n.
3. Un "máximo disponible" que cambia dinámicamente en un proceso repetido es la firma más clara de heap — O(log n) por operación contra el O(n) de búsqueda lineal repetida, que se vuelve O(n²) total y hace TLE.
4. `heapify()` sobre una lista completa es O(n); usarlo en vez de insertar uno por uno cuando ya tienes todos los elementos iniciales.
5. La trampa más común es de reflejo, no de lógica: no reconocer a tiempo que "máximo que cambia, repetido muchas veces" exige heap, no `max()` en un loop.

---

## Lo que deberías poder hacer en 30 segundos

1. **Reconocer "K más grandes/frecuentes" o "el mejor disponible cada vez, repetidamente"** como firma directa de heap.
2. **Decidir min-heap vs. max-heap simulado** (con negación) en los primeros segundos.
3. **Elegir `heapify` sobre una lista completa vs. `heappush` incremental** según si ya tienes todos los elementos de entrada de antemano.
4. **Descartar `max()`/`min()` dentro de un loop repetido** en cuanto reconozcas que el "mejor" cambia dinámicamente muchas veces.

---

## Fuentes

- `itc-c5-heaps` de esta misma colección — la teoría completa de heaps, heapify O(n), y el patrón top-k con heap de tamaño fijo.
- Documentación oficial de Python, `heapq`: https://docs.python.org/3/library/heapq.html
- "Top K Frequent Elements" y "Task Scheduler" — problemas estándar y ampliamente citados en preparación de entrevistas técnicas de la industria, frecuentemente reportados bajo el tag Amazon.
