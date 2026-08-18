---
module_id: oa-1-arrays-hashmap
spine: OA Amazon
title: "Arrays y HashMap"
subtitle: "Cuando mapear algo mata el bucle anidado"
source_canonical: "Patrones Amazon-tagged (Two Sum, Product of Array Except Self, Contains Duplicate, Group Anagrams); CtCI"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 38
---

# Arrays y HashMap

> **Pregunta raíz.** La mayoría de los problemas de arrays que vas a ver en el OA se resuelven con una sola idea repetida: **mapear algo hacia algo más, mientras recorres el arreglo una sola vez, en vez de comparar cada elemento contra todos los demás**. Esa idea —usar un diccionario para convertir una búsqueda de O(n) en O(1)— es, por volumen de problemas que resuelve, la herramienta más rentable de todo tu entrenamiento para este examen. Si dominas cuándo y cómo mapear, vas a resolver una fracción sorprendentemente grande de lo que Amazon te va a poner enfrente.

## Prólogo

Ya tienes, de `oa-0-fundamentos`, la disciplina de leer restricciones antes de escribir código. Este módulo te da la primera —y más rentable— familia de patrones concretos que esa disciplina te va a hacer reconocer. La firma es reconocible: `n` hasta `10^5`-`10^6`, y el enunciado pide algo sobre pares, frecuencias, duplicados, o agrupaciones. Esa combinación, casi siempre, grita hash map.

---

## 1. El array — lo mínimo que necesitas, deducido rápido

Un array vive en memoria contigua: acceder a `arr[i]` es aritmética de dirección, O(1), sin importar `i`. Insertar o eliminar al **final**, si hay espacio, es O(1). Insertar o eliminar al **inicio o en medio** es O(n) — porque hay que desplazar físicamente todo lo que viene después para abrir o cerrar el hueco. **Esta es la trampa más silenciosa de arrays en Python**: `lista.insert(0, x)` dentro de un loop convierte, sin ningún error visible, un algoritmo que "debería" ser O(n) en uno O(n²) — cada inserción al inicio cuesta O(n), y lo repites n veces. Si necesitas insertar/eliminar frecuentemente en el extremo izquierdo, usa `collections.deque` (ya lo viste en `oa-0-fundamentos`), que da O(1) en ambos extremos.

---

## 2. El hash map — por qué O(1) esperado, deducido sin la teoría profunda

**La idea central, en una frase**: en vez de recorrer el arreglo completo cada vez que preguntas "¿existe X?", un hash map calcula, con una función hash, **dónde debería estar X** — y va directo ahí, sin recorrer nada. Eso es lo que da la búsqueda, inserción, y eliminación en **O(1) esperado** (no garantizado en el peor caso teórico — una colisión mal manejada puede degradar esto, pero para efectos de un OA, con las funciones hash de Python trabajando sobre datos normales, trátalo como O(1) confiable).

**Colisión, en una frase**: dos claves distintas pueden, ocasionalmente, mapear al mismo lugar — Python lo resuelve internamente sin que tengas que pensarlo. La teoría completa de por qué esto pasa y cómo se resuelve (encadenamiento, direccionamiento abierto, factor de carga) la tienes completa en tu módulo de teoría (`itc-c3-hashing`) — aquí solo necesitas confiar en que `dict`, `set`, y `Counter` de Python te dan O(1) esperado por operación, y usarlos sin dudar.

```python
from collections import Counter

# Verificacion de membresia: O(1)
vistos = set([1, 2, 3])
print(4 in vistos)   # False, O(1)

# Conteo de frecuencias: O(n) construir, O(1) consultar cada frecuencia
frecuencias = Counter([1, 1, 2, 3, 3, 3])
print(frecuencias[3])          # 3
print(frecuencias.most_common(1))   # [(3, 3)] -- el mas frecuente

# dict como mapeo general valor -> indice/informacion
mapa = {}
for i, x in enumerate([10, 20, 30]):
    mapa[x] = i
print(mapa[20])   # 1
```

---

## 3. Señales de reconocimiento — cómo oler "esto es un hash map"

- **"¿Existe un par de elementos tales que...?"** — casi siempre resoluble guardando lo que ya viste y preguntando por su complemento en O(1), en vez de comparar cada par.
- **"El elemento más frecuente"**, **"¿hay duplicados?"** — conteo de frecuencias, `Counter` directo.
- **"Agrupa por [algo]"** — un diccionario donde la clave es el criterio de agrupación y el valor es la lista de elementos que comparten ese criterio.
- **"¿Cuántos... tienen la propiedad X?"** sin que el orden importe — casi siempre un conteo o una verificación de membresía, no una comparación par a par.

**La pregunta de diagnóstico rápido**: si tu primer instinto es "comparar cada elemento contra todos los demás" (bucle anidado, O(n²)), pregúntate de inmediato: **¿puedo, en vez de eso, guardar información sobre lo que ya vi, en un diccionario, y preguntar por lo que necesito en O(1)?** Si la respuesta es sí —y lo es sorprendentemente seguido— acabas de bajar de O(n²) a O(n), y probablemente acabas de identificar exactamente el patrón que el problema esperaba.

---

## 4. Two Sum — el patrón de mapeo complemento

**El problema** (Amazon-tagged, uno de los más citados en OAs de la industria): dado un arreglo y un objetivo, encuentra los índices de dos números que sumen el objetivo.

**La fuerza bruta que hay que descartar de inmediato**: comparar cada par, O(n²) — con `n` hasta `10^5` (la firma típica), esto truena.

**La deducción del patrón**: para cada elemento `x` que visitas, la pregunta relevante no es "¿qué otro elemento sumado a x da el objetivo?" recorriendo todo el resto del arreglo — es **"¿ya vi, en algún punto anterior, el complemento exacto (objetivo - x)?"** Si guardas cada elemento visto en un diccionario (valor → índice) conforme recorres, esa pregunta se responde en O(1).

```python
def two_sum(nums, objetivo):
    """
    O(n) tiempo, O(n) espacio. El patron de mapeo complemento:
    para cada x, pregunta si (objetivo - x) YA fue visto.
    """
    visto = {}   # valor -> indice
    for i, x in enumerate(nums):
        complemento = objetivo - x
        if complemento in visto:
            return [visto[complemento], i]
        visto[x] = i
    return []   # o el centinela que el problema pida si no hay solucion


if __name__ == "__main__":
    print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```

**Nota el orden exacto**: preguntas por el complemento **antes** de agregar el elemento actual al diccionario — esto evita, de forma natural, usar el mismo elemento dos veces para formar el par (a menos que el problema explícitamente permita eso, en cuyo caso invertirías el orden deliberadamente). Este es exactamente el tipo de detalle de orden que decide si tu solución es correcta o tiene un bug sutil de "usé el mismo índice dos veces".

---

## 5. Group Anagrams — agrupar por clave canónica

**El problema**: dado un arreglo de strings, agrupa los que son anagramas entre sí (mismas letras, distinto orden).

**La deducción**: dos strings son anagramas si y solo si, al ordenar sus letras, producen el mismo string — esa forma ordenada es una **clave canónica** que identifica el grupo. Usa esa clave canónica como llave de un diccionario, y agrupa.

```python
from collections import defaultdict

def group_anagrams(strings):
    """
    O(n * k log k), donde k es la longitud maxima de un string --
    el costo de ordenar cada string para obtener su clave canonica.
    """
    grupos = defaultdict(list)
    for s in strings:
        clave = ''.join(sorted(s))
        grupos[clave].append(s)
    return list(grupos.values())


if __name__ == "__main__":
    print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))
    # [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]
```

**Por qué `defaultdict` y no `dict` normal**: `defaultdict(list)` crea automáticamente una lista vacía la primera vez que accedes a una clave nueva — evita el `if clave not in grupos: grupos[clave] = []` que tendrías que escribir manualmente cada vez con un `dict` normal. Bajo reloj, esta es exactamente el tipo de ceremonia que Python te ahorra (recuerda `oa-0-fundamentos`, sección 4).

---

## 6. Contains Duplicate — el caso más simple, el que no debes complicar

**El problema**: dado un arreglo, determina si contiene algún valor repetido.

```python
def contains_duplicate(nums):
    """O(n) tiempo, O(n) espacio -- el caso mas directo de todos."""
    return len(nums) != len(set(nums))
```

**Por qué esto funciona en una sola línea**: un `set` elimina duplicados automáticamente al construirse — si el tamaño del set es menor que el del arreglo original, es porque algo se repitió. Esta es, literalmente, la aplicación más simple posible de "usa un hash-based container en vez de comparar pares" — y vale la pena tenerla como reflejo de una línea, sin pensarlo, porque libera tiempo de examen para problemas más difíciles.

---

## 7. Product of Array Except Self — prefix/suffix sin división

**El problema**: dado un arreglo, devuelve un arreglo donde cada posición contiene el producto de **todos los demás** elementos, sin usar la operación de división, en O(n).

**Por qué esto no es, a primera vista, un problema de hash map**: no lo es — pero vale la pena incluirlo aquí porque comparte la misma familia de "precalcula algo mientras recorres una vez, en vez de recalcular desde cero para cada posición" que motiva todo este módulo, y es exactamente el tipo de problema que Amazon dispara con frecuencia porque descarta la solución ingenua (dividir el producto total entre cada elemento — prohibido explícitamente, y además falla si hay un cero).

**La deducción**: el producto de todo excepto la posición `i` es exactamente `(producto de todo a la izquierda de i) × (producto de todo a la derecha de i)`. Si precalculas ambos —un arreglo de productos prefijo y uno de productos sufijo— puedes combinar en O(1) por posición, dando O(n) total.

```python
def product_except_self(nums):
    """
    O(n) tiempo, O(1) espacio adicional si no cuentas el arreglo
    de salida (truco: reusa el arreglo de salida como el prefix,
    y acumula el suffix con una sola variable en vez de un arreglo separado).
    """
    n = len(nums)
    resultado = [1] * n

    prefijo = 1
    for i in range(n):
        resultado[i] = prefijo
        prefijo *= nums[i]

    sufijo = 1
    for i in range(n - 1, -1, -1):
        resultado[i] *= sufijo
        sufijo *= nums[i]

    return resultado


if __name__ == "__main__":
    print(product_except_self([1, 2, 3, 4]))   # [24, 12, 8, 6]
```

**Nota el truco de espacio**: en vez de dos arreglos separados (prefijos y sufijos) combinados al final, este código construye el arreglo de prefijos directamente en `resultado`, y luego multiplica el sufijo **sobre la marcha**, con una sola variable acumuladora, en vez de un segundo arreglo completo — la diferencia entre O(n) de espacio adicional y O(1) (sin contar el arreglo de salida, que el problema exige de todas formas). Esta optimización específica —"acumula con una variable en vez de un segundo arreglo"— es un patrón que vas a ver repetirse en otros problemas de prefix/suffix.

---

## Trampas OA — específicas de esta familia

**Usar un objeto mutable como clave de diccionario**: Python prohíbe esto directamente para listas (`TypeError: unhashable type: 'list'`) — pero si construyes tu propia clase con `__hash__` sobre atributos que luego mutas, rompes la invariante de que el hash de una clave no debe cambiar mientras vive en el diccionario (la misma trampa que ya viste en tu módulo de teoría de hashing). En el contexto de un OA, esto casi siempre aparece como intentar usar una lista directamente como clave — Python te va a dar el error de inmediato, así que conviértela a tupla (`tuple(mi_lista)`) si genuinamente necesitas una secuencia como clave.

**No manejar el empate lexicográfico**: varios problemas de Amazon, cuando piden "el par" o "la combinación" que cumple una condición y hay múltiples respuestas válidas, exigen explícitamente **el lexicográficamente menor** como desempate. Si tu solución encuentra *una* respuesta válida pero no verifica cuál es la lexicográficamente menor cuando hay varias, el juez la va a marcar incorrecta aunque tu lógica central esté bien. **Lee el enunciado buscando explícitamente la palabra "lexicográfic" o "smallest"/"first" en el contexto de desempate** — y si está, ordena tus candidatos o compara explícitamente antes de devolver, no confíes en que el primero que encuentres por casualidad de tu orden de iteración sea el correcto.

```python
# Ejemplo del patron de desempate lexicografico:
def par_valido_lexicograficamente_menor(nums, objetivo):
    candidatos = []
    visto = set()
    for x in nums:
        complemento = objetivo - x
        if complemento in visto:
            par = tuple(sorted([complemento, x]))
            candidatos.append(par)
        visto.add(x)
    if not candidatos:
        return None
    return min(candidatos)   # min() sobre tuplas compara lexicograficamente, gratis
```

**Nota el truco de la última línea**: `min()` sobre una lista de tuplas en Python compara elemento por elemento, exactamente el orden lexicográfico — no necesitas escribir un comparador custom, Python ya lo hace por ti al comparar tuplas directamente.

**O(n²) cuando un map lo hace O(n)**: la trampa más cara de todas en términos de tiempo perdido — escribir el bucle anidado porque "es lo primero que se me ocurrió", sin detenerte los 15 segundos que toma preguntarte "¿puedo mapear esto en vez de comparar pares?". Cada problema de esta sección es la prueba de que esa pregunta, aplicada consistentemente, cambia la complejidad de tu solución de raíz.

---

## Conexiones

**Con `oa-0-fundamentos`**: la firma de restricciones de esta familia (`n` hasta `10^5`-`10^6`, combinado con "par", "frecuencia", "agrupa", "duplicado") es exactamente el tipo de reconocimiento en 30 segundos que ese módulo te entrenó a hacer. Cada vez que veas esa combinación, tu primer instinto ahora debería ser "hash map", no "bucle anidado".

**Con tu módulo de teoría de hashing (`itc-c3-hashing`)**: la razón de fondo de por qué `dict`/`set` dan O(1) esperado —función hash, factor de carga, rehashing— ya la construiste completa ahí, con rigor de primer principio. Este módulo no repite esa teoría; la asume y se enfoca en el reflejo de reconocimiento y ejecución rápida bajo reloj, exactamente la misma distinción que ya viste entre tu eje ITC (comprensión profunda) y tu eje Competitiva (reflejo bajo reloj) — este eje OA vive en esa misma naturaleza de "reflejo", pero con el vocabulario específico y la presión de tiempo real de Amazon.

**Con el siguiente módulo**: two pointers y sliding window (que ya conoces completos de tu eje Competitiva, `cp1-two-pointers`) son la siguiente familia de patrones que el OA te va a pedir reconocer — frecuentemente sobre los mismos arrays de este módulo, pero cuando el problema exige orden o contigüidad en vez de solo membresía/frecuencia. La pregunta de diagnóstico que decide entre ambas familias: **¿necesito saber si algo EXISTE/CUÁNTAS VECES aparece (hash map), o necesito trabajar sobre un RANGO CONTIGUO u ORDEN del arreglo (two pointers/sliding window)?**

---

## Síntesis

1. Un array da O(1) de acceso pero O(n) de inserción/eliminación fuera del extremo derecho — la trampa silenciosa de `insert(0, x)` en un loop.
2. Un hash map (`dict`/`set`/`Counter`) da O(1) esperado para búsqueda, inserción, eliminación — la herramienta que convierte comparar-cada-par (O(n²)) en recorrer-una-vez-y-preguntar (O(n)).
3. Señales de reconocimiento: "¿existe un par...?", "el más frecuente", "agrupa por...", "¿hay duplicados?" — todas gritan hash map.
4. Two Sum es el patrón de mapeo complemento: pregunta por lo que falta antes de agregar lo que tienes.
5. Group Anagrams agrupa por clave canónica (string ordenado) usando `defaultdict`.
6. Product Except Self usa prefix/suffix acumulados en una sola variable, no un segundo arreglo — el patrón de "precalcula mientras recorres" aplicado sin hash map, pero de la misma familia de espíritu.
7. Las trampas caras son de desempate (lexicográfico, con `min()` sobre tuplas como atajo gratis) y de reflejo lento (tardar en preguntarte si un map reemplaza el bucle anidado).

---

## Lo que deberías poder hacer en 30 segundos

Dado un problema nuevo de esta familia:

1. **Identifica si la pregunta central es sobre existencia, frecuencia, o agrupación** — si sí, hash map es tu primer candidato, no tu último recurso.
2. **Pregúntate explícitamente "¿qué necesito recordar mientras recorro, para responder en O(1) más adelante?"** — esa pregunta sola resuelve la mayoría de los problemas de esta familia.
3. **Verifica si el problema exige desempate lexicográfico** — si sí, planea usar `min()`/`sorted()` sobre tuplas desde el diseño inicial, no como parche al final.
4. **Descarta explícitamente la fuerza bruta O(n²)** en tu cabeza antes de escribir código, confirmando que la restricción de `n` la descarta.

---

## Fuentes

- Patrones ampliamente documentados de la industria para preparación de entrevistas técnicas SDE (Two Sum, Group Anagrams, Contains Duplicate, Product of Array Except Self) — problemas estándar y ampliamente practicados en plataformas de preparación técnica.
- Gayle Laakmann McDowell, *Cracking the Coding Interview*.
- Documentación oficial de Python: `collections.Counter`, `collections.defaultdict`: https://docs.python.org/3/library/collections.html
- `itc-c3-hashing` de esta misma colección — la teoría completa de hashing que fundamenta este módulo.
