---
module_id: ce000000-0000-4000-8000-000000000002
spine: OA Amazon
title: Ejercicios — Arrays + HashMap
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-1-arrays-hashmap.md)
version: 1
---

# Arrays + HashMap — banco de reconocimiento

Banco de reflejo OA (Amazon SDE Intern): cada ejercicio entrena el salto central del libro — de «comparar cada elemento contra todos los demás» (bucle anidado, O(n²)) a «guardar lo que ya vi en un diccionario y preguntar en O(1)» — sobre reglas de negocio disfrazadas como las que Amazon usa (órdenes, paquetes, almacenes, SKUs). Entrena oler la firma (`n` hasta 10⁵-10⁶ + pares/frecuencias/duplicados/agrupaciones), el mapeo complemento de Two Sum, la clave canónica de Group Anagrams, prefijo×sufijo sin división, el desempate lexicográfico, y también lo contrario: cuándo NO sobre-optimizar porque la restricción es chica. Estos drills se validan LOCALMENTE contra casos unitarios; NO son el examen — el juez real es el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si te pasas, anota dónde se te fue y vuelve al libro. Todo anclado a `oa-1-arrays-hashmap.md`.

## El SKU más vendido del día — contar sin comparar pares
type: multiple_choice
tiempo: 2

«Al cierre del día, el sistema de un centro de distribución entrega la lista de los SKUs vendidos, uno por venta, hasta 10⁶ entradas. Reporta el SKU que aparece más veces.» ¿Qué enfoque dispara tu reflejo, y por qué?

### Opciones
- [x] Una sola pasada construyendo un diccionario de frecuencias (SKU → cuántas veces), y al final tomar la entrada de cuenta máxima — O(n) construir, O(1) esperado por consulta. «El más frecuente» es una de las señales que el libro lista como grito directo de hash map (`Counter` en Python lo hace en dos líneas), y con 10⁶ entradas el presupuesto exige exactamente eso: recorrer una vez y preguntar barato.
- Comparar cada venta contra todas las demás para contar cuántas veces aparece cada SKU, y quedarte con el mayor conteo.
- Meter la lista a un `set` para quedarte con los SKUs únicos, y de ahí leer cuál fue el más vendido.
- Ordenar la lista es la única forma confiable de contar frecuencias: agrupas las rachas de iguales y mides la racha más larga.
### Justificación
«El elemento más frecuente» está literal en la sección de señales del libro: conteo de frecuencias, diccionario directo, O(n) total con 10⁶ entradas. Comparar cada venta contra todas las demás es el bucle anidado O(n²) que esa señal existe para descartar — con n = 10⁶ son ~10¹² comparaciones, imposible en cualquier presupuesto de OA. El `set` responde EXISTENCIA, no frecuencia: al deduplicar destruye precisamente la información que el problema pide (cuántas veces), así que después del `set` ya no hay nada que leer. Y ordenar SÍ permite contar rachas en O(n log n), pero «es la única forma confiable» es falso — el diccionario cuenta en O(n) sin ordenar nada, con menos código y menos oportunidades de bug bajo reloj; la opción vende como obligatorio lo que es la alternativa más cara.

## Dos paquetes que llenan el camión exacto — el complemento antes que el par
type: multiple_choice
tiempo: 3

«Un camión sale con capacidad restante exacta C. Tienes los pesos de hasta 10⁵ paquetes en el andén, en el orden en que llegaron. Devuelve los ÍNDICES originales de dos paquetes distintos cuyos pesos sumen exactamente C.» ¿Cuál es el plan correcto?

### Opciones
- [x] Una pasada con un diccionario peso → índice: para cada paquete `x` preguntas primero si el complemento `C - x` YA está en el diccionario (si sí, devuelves ese índice guardado y el actual), y solo DESPUÉS registras `x`. Es el patrón de mapeo complemento: la pregunta no es «¿qué otro paquete suma C con este?» recorriendo el resto, sino «¿ya vi exactamente lo que me falta?» — O(n) total, y el orden pregunta-luego-registra evita usar el mismo paquete dos veces.
- Probar cada par de paquetes con dos bucles anidados: con 10⁵ paquetes es un número manejable de combinaciones.
- Ordenar los pesos y cerrar con dos punteros desde los extremos: encuentra el par y devuelve directamente los índices que el problema pide.
- El mismo diccionario, pero registrando cada peso ANTES de preguntar por su complemento — el orden entre registrar y preguntar no cambia el resultado.
### Justificación
Es Two Sum, el problema que el libro usa para deducir el patrón: guardar lo visto (peso → índice) y preguntar por el complemento exacto convierte la búsqueda de O(n) en O(1), y el total de O(n²) en O(n). Los bucles anidados con n = 10⁵ son ~5×10⁹ pares — la fuerza bruta que el libro manda descartar de inmediato, no un «número manejable». Ordenar + dos punteros sí encuentra el PAR de valores, pero el sort revuelve las posiciones: los índices que devuelven los punteros son del arreglo ordenado, no los originales que pide el problema — habría que cargar los índices aparte, más código y más riesgo bajo reloj, sin ganar complejidad (O(n log n) contra O(n)). Y el orden SÍ importa: registrar antes de preguntar hace que, cuando C = 2x, el diccionario te devuelva el índice del propio paquete que estás procesando — el bug de «usé el mismo índice dos veces» que el libro señala como el detalle exacto que decide si tu solución es correcta.

## Códigos que son permutaciones — la clave canónica decide el grupo
type: multiple_choice
tiempo: 3

«Marketing generó códigos de promoción y sospecha que muchos son la misma palabra con las letras revueltas. Agrupa los códigos que usan exactamente las mismas letras, con las mismas repeticiones, en distinto orden.» ¿Cómo agrupas sin comparar cada par?

### Opciones
- [x] Un diccionario cuya llave es la forma CANÓNICA de cada código — sus letras ordenadas (`''.join(sorted(s))`) — y cuyo valor es la lista de códigos que comparten esa forma: dos códigos son permutaciones si y solo si su forma ordenada coincide, así que la llave identifica el grupo por sí sola. Una pasada, O(n · k log k) por el sort de cada código, con `defaultdict(list)` para no inicializar listas a mano.
- Comparar cada código contra cada otro (ordenando ambos en cada comparación) y unir los que coincidan.
- Usar como llave el CONJUNTO de letras de cada código, convertido a algo hasheable: si dos códigos usan las mismas letras, van al mismo grupo.
- Usar como llave la suma de los valores numéricos de los caracteres: es más barato que ordenar y agrupa igual.
### Justificación
Es Group Anagrams calcado: la deducción del libro es que la forma ordenada es una clave canónica — identifica al grupo entero sin comparar a nadie contra nadie, y el diccionario hace el resto. Comparar cada par es O(n²) comparaciones (cada una con su propio sort encima): funciona en chico y truena en grande, además de ser mucho más código. El conjunto de letras pierde las MULTIPLICIDADES: «aab» y «ab» comparten el conjunto {a, b} sin ser permutaciones — agruparía lo que no va junto, y el enunciado pide explícitamente mismas repeticiones. Y la suma de valores de carácter colisiona trivialmente: «ad» y «bc» suman lo mismo sin compartir una sola letra — una llave que junta extraños no es una llave canónica, es un bug silencioso que ningún error de ejecución te va a delatar.

## Respaldo si un almacén se cae — producto de los demás sin dividir
type: multiple_choice
tiempo: 3

«Cada almacén i tiene un rendimiento diario `r[i]`. Para el plan de contingencia, calcula para cada i la capacidad combinada de TODOS LOS DEMÁS almacenes (el producto de sus rendimientos, que pueden ser cero si un almacén está parado). La división está deshabilitada en el módulo de reportes y n llega a 10⁵.» ¿Cuál es el plan?

### Opciones
- [x] Dos pasadas acumulando productos: en la primera dejas en `res[i]` el producto de todo lo que está a la IZQUIERDA de i (prefijo), y en la segunda, recorriendo de derecha a izquierda, multiplicas `res[i]` por el producto acumulado de la DERECHA con una sola variable. El producto de «todos menos yo» es exactamente prefijo × sufijo, O(n) total, sin dividir — y por eso los ceros no lo rompen: nunca inviertes nada.
- Calcular el producto total una vez y dividir entre `r[i]` para cada posición — la prohibición de dividir es un tecnicismo del enunciado que se puede ignorar si el resultado es el mismo.
- Para cada i, recorrer el arreglo completo multiplicando todos los demás — directo y sin memoria extra.
- Sin división no se puede bajar de O(n²): conocer el producto de los demás exige recomputarlo por cada posición.
### Justificación
Es Product of Array Except Self, y la deducción del libro es literal: producto-excepto-i = (producto a la izquierda de i) × (producto a la derecha de i), precalculado en dos pasadas con una variable acumuladora para el sufijo. La división no es solo una regla arbitraria: con UN almacén parado el producto total es 0 y la división devuelve 0/0 o basura para esa posición — el libro señala exactamente que la solución ingenua «además falla si hay un cero», así que ignorar la prohibición produce respuestas incorrectas, no un atajo. Recorrer todo por cada i es O(n²): con n = 10⁵ son ~10¹⁰ multiplicaciones, fuera de cualquier presupuesto. Y «sin división no se puede en O(n)» es exactamente la creencia que este problema existe para romper: prefijo × sufijo lo hace en dos pasadas — este patrón de «precalcula mientras recorres» es de la misma familia de espíritu que el resto del módulo aunque no lleve diccionario.

## Pares co-comprados con órdenes de 50 — cuándo NO sobre-optimizar
type: multiple_choice
tiempo: 3

«Tienes hasta 10⁵ órdenes de compra; cada orden lista a lo más 50 productos. Reporta el par de productos que más veces aparece junto en una misma orden.» Tu primer borrador enumera, por cada orden, todos sus pares con dos bucles, y los acumula en un diccionario global. ¿Está mal?

### Opciones
- [x] No está mal — está exactamente bien dimensionado: el doble bucle es sobre k ≤ 50 productos DE UNA ORDEN, no sobre las 10⁵ órdenes, así que son a lo más 50·49/2 ≈ 1,225 pares por orden y ~1.2×10⁸ actualizaciones O(1) al diccionario en el peor caso total — dentro de presupuesto. La restricción chica (k ≤ 50) es la que autoriza el O(k²); buscar algo más listo aquí quema minutos de examen sin mover la complejidad real del problema.
- Sí: un doble bucle siempre es la señal de que falta un hash map — hay que eliminarlo antes de enviar, sin importar sobre qué itere.
- Sí: lo correcto es precomputar, por producto, el conjunto de órdenes donde aparece, y luego intersectar los conjuntos de cada par de productos del catálogo.
- Sí: contar pares es cuadrático por naturaleza y no entra en tiempo con 10⁵ órdenes; el problema exige aproximar o samplear.
### Justificación
La disciplina que el libro hereda de `oa-0-fundamentos` es leer restricciones ANTES de juzgar el enfoque: el O(n²) prohibido es sobre n = 10⁵-10⁶; un O(k²) con k ≤ 50 es una constante pequeña por orden, y el diccionario global de conteos sigue siendo el patrón del módulo (contar frecuencias de una llave — aquí la llave es el par). «Un doble bucle siempre está mal» es dogma, no análisis: la firma de restricciones decide, y aquí la restricción lo hace barato. Precomputar conjuntos por producto e intersectar pares del CATÁLOGO invierte el costo: intersecciones sobre pares de todo el catálogo pueden ser muchísimo más caras que enumerar los pares que de hecho ocurren en cada orden — más código, más memoria, y peor caso peor. Y «no entra en tiempo, hay que aproximar» confunde k con n: el cuadrático va sobre 50, no sobre 10⁵ — la aritmética del presupuesto (~1.2×10⁸ operaciones O(1)) dice que entra sin aproximar nada.

## La cola que anteponía — el O(n²) que no lanza ningún error
type: trace
tiempo: 4

Un compañero procesa el manifiesto de envíos del día (n = 10⁵ elementos) y quiere el resultado con el más reciente primero:

```python
pendientes = []
for envio in manifiesto:        # n = 100,000 envios
    pendientes.insert(0, envio)  # el mas reciente al frente
```

El código pasa las pruebas chicas del enunciado. ¿Qué va a pasar en el OA con la entrada grande?

### Opciones
- [x] La lógica es correcta y no lanza ningún error, pero el costo real es O(n²): cada `insert(0, ...)` desplaza físicamente TODOS los elementos ya guardados para abrir el hueco (O(n) por inserción), y lo repites n veces — con 10⁵ envíos son del orden de 5×10⁹ desplazamientos, un timeout casi seguro. La cura es no insertar al frente: `append` y un `reverse` al final, o `collections.deque` con `appendleft`, ambos O(n) total.
- Lanza `IndexError` en la primera iteración, porque `insert(0, ...)` sobre una lista vacía no tiene posición 0 válida.
- Corre en O(n): `insert` en una lista de Python es O(1) igual que `append`, sin importar la posición.
- El costo está bien, pero el resultado queda mal ordenado: al final la lista tiene el más antiguo primero y hay que invertirla.
### Justificación
Es la trampa que el libro llama «la más silenciosa de arrays en Python», con sus palabras: `insert(0, x)` dentro de un loop convierte, sin ningún error visible, un algoritmo que «debería» ser O(n) en uno O(n²) — porque insertar fuera del extremo derecho obliga a desplazar físicamente todo lo que viene después. Por eso el síntoma es un timeout con la entrada grande, no un crash: las pruebas chicas pasan y el veredicto malo llega solo con volumen. No hay `IndexError`: `insert(0, ...)` sobre lista vacía es válido (inserta al inicio, que también es el final). `insert` NO es O(1) — solo insertar/eliminar en el extremo derecho lo es, si hay espacio; esa es la asimetría del array en memoria contigua que abre el libro. Y el orden del resultado es correcto (el más reciente queda al frente, que es lo pedido): el defecto de este código es de COSTO, no de lógica — la clase de bug que solo se caza mirando la complejidad, no la salida.

## Presupuesto de operaciones: n = 10⁵ y la firma del par
type: complexity
tiempo: 3

Un problema de OA da hasta 10⁵ registros de clientes y pregunta si existe un PAR de registros con cierta propiedad combinada. Asume el presupuesto clásico de juez: del orden de 10⁸ operaciones simples por segundo, con uno o dos segundos de límite. ¿Qué complejidades caben, y qué te dice eso del patrón esperado?

### Opciones
- [x] O(n²) NO cabe: son ~10¹⁰ operaciones, dos órdenes de magnitud arriba del presupuesto. O(n log n) (~1.7×10⁶) y O(n) caben holgados. Esa combinación —n = 10⁵ y pregunta de par— es exactamente la firma que el libro enseña a oler: el problema fue diseñado para que guardes lo visto en un diccionario y preguntes por lo que te falta en O(1), no para que compares cada par.
- O(n²) sí cabe: 10⁵ es un número pequeño para una computadora moderna, y los jueces dan margen de sobra.
- La complejidad da igual si eliges bien el lenguaje: el juez descuenta el tiempo del runtime, así que un O(n²) en un lenguaje rápido pasa igual que un O(n) en Python.
- Hay que apuntar a O(log n) o mejor: con 10⁵ registros, hasta recorrer la entrada completa una vez ya es demasiado lento.
### Justificación
La aritmética es el argumento entero: (10⁵)² = 10¹⁰ contra un presupuesto de ~10⁸-10⁹ operaciones — no es «apretado», es dos órdenes de magnitud afuera; mientras que n log n ≈ 10⁵ × 17 y n = 10⁵ sobran. Y la lectura de diseño es la del libro: límites de 10⁵-10⁶ combinados con vocabulario de par/frecuencia/duplicado son la firma de «esto se resuelve mapeando», el reconocimiento en 30 segundos que este banco entrena. «10⁵ es pequeño» confunde n con n²: lo que se ejecuta es el cuadrado. El descuento por lenguaje no existe como salvavidas: ningún margen razonable absorbe 100× de trabajo de más — elegir lenguaje cambia la constante, no el orden. Y O(log n) como meta es imposible de entrada: leer los 10⁵ registros ya cuesta O(n); la meta realista —y la que el patrón del diccionario entrega— es O(n), no sublineal.

## Drill: el par de productos más frecuente (desempate lexicográfico)
type: code
tiempo: 15

Reporte de co-compra para el equipo de recomendaciones: dado el listado de órdenes del día, encuentra el par de productos que más veces aparece junto dentro de una misma orden. Si varios pares empatan en frecuencia, el reporte exige el lexicográficamente menor — el desempate que el libro marca como trampa clásica de Amazon: una respuesta válida pero no la menor se marca incorrecta aunque la lógica central esté bien.

### Especificación
`pairMasFrecuente(ordenes)`:
- `ordenes` es un arreglo de órdenes; cada orden es un arreglo de SKUs (strings de minúsculas y dígitos).
- Un par se forma por cada combinación de dos POSICIONES `i < j` dentro de una misma orden (si un SKU se repite en la orden, puede formar par consigo mismo). Cada orden trae a lo más 50 SKUs — el doble bucle por orden está autorizado por la restricción.
- El par es NO ordenado: se cuenta bajo su forma canónica `[a, b]` con `a <= b`.
- Devuelve el par más frecuente como arreglo `[a, b]` en forma canónica; ante empate de frecuencia, el par lexicográficamente menor (compara primero `a`, luego `b`).
- Sin órdenes, o sin ninguna orden con 2 o más SKUs, no existe ningún par: devuelve el arreglo vacío.

### Firma
```javascript
function pairMasFrecuente(ordenes) {
  // TODO: por orden, doble bucle i<j; clave canonica a<=b en un mapa global; desempate lexicografico
  return [];
}
```
```python
def par_mas_frecuente(ordenes):
    # TODO: por orden, doble bucle i<j; clave canonica (a, b) con a<=b; desempate con tuplas
    pass
```

### Casos
```json
[
  { "input": [[["a", "b", "c"], ["a", "b"]]], "expected": ["a", "b"] },
  { "input": [[["b", "c"], ["a", "d"]]], "expected": ["a", "d"] },
  { "input": [[]], "expected": [] },
  { "input": [[["solo"], [], ["x"]]], "expected": [] },
  { "input": [[["a", "a", "b"]]], "expected": ["a", "b"] },
  { "input": [[["z", "y"], ["y", "z"], ["a", "b"]]], "expected": ["y", "z"] },
  { "input": [[["a", "c"], ["a", "b"]]], "expected": ["a", "b"] },
  { "input": [[["p1", "p2", "p3", "p4"]]], "expected": ["p1", "p2"] },
  { "input": [[["c", "d"], ["b", "d"], ["b", "d"], ["c", "d"]]], "expected": ["b", "d"], "hint": true }
]
```

### Solución
```javascript
function pairMasFrecuente(ordenes) {
  const conteo = new Map();               // "a|b" -> frecuencia (SKUs sin '|', separador seguro)
  for (const orden of ordenes) {
    for (let i = 0; i < orden.length; i++) {
      for (let j = i + 1; j < orden.length; j++) {   // O(k^2) con k <= 50: autorizado
        const a = orden[i] <= orden[j] ? orden[i] : orden[j];
        const b = orden[i] <= orden[j] ? orden[j] : orden[i];
        const k = a + "|" + b;                        // clave canonica del par NO ordenado
        conteo.set(k, (conteo.get(k) || 0) + 1);
      }
    }
  }
  let mejor = null;
  let mejorCuenta = 0;
  for (const [k, c] of conteo) {
    const par = k.split("|");
    const gana =
      c > mejorCuenta ||
      (c === mejorCuenta && mejor !== null &&
        (par[0] < mejor[0] || (par[0] === mejor[0] && par[1] < mejor[1])));
    if (gana) {
      mejor = par;
      mejorCuenta = c;
    }
  }
  return mejor === null ? [] : mejor;
}
```
```python
def par_mas_frecuente(ordenes):
    conteo = {}
    for orden in ordenes:
        n = len(orden)
        for i in range(n):
            for j in range(i + 1, n):        # O(k^2) con k <= 50: autorizado
                a, b = sorted((orden[i], orden[j]))   # clave canonica del par NO ordenado
                conteo[(a, b)] = conteo.get((a, b), 0) + 1
    if not conteo:
        return []
    # min sobre (-frecuencia, par): mayor frecuencia primero y, en empate,
    # la tupla lexicograficamente menor -- Python compara tuplas gratis
    mejor = min(conteo.items(), key=lambda kv: (-kv[1], kv[0]))
    return list(mejor[0])
```

### Pistas
- La llave del diccionario es el par en forma canónica (`a <= b`): sin canonizar, («y», «z») y («z», «y») cuentan como pares distintos y ninguno alcanza su frecuencia real.
- El desempate no es un parche al final: en Python, `min()` sobre tuplas `(-frecuencia, par)` resuelve máximo-por-frecuencia y menor-lexicográfico en una sola comparación — el truco de comparar tuplas que el libro enseña en su sección de trampas.
- Una lista no puede ser llave de diccionario en Python (`unhashable`): la forma canónica se guarda como tupla — o como string con un separador que ningún SKU contenga.

## Drill: producto excepto yo, sin división
type: code
tiempo: 12

Plan de contingencia de la red de almacenes: para cada almacén, reporta la capacidad combinada del resto de la red — el producto de los rendimientos de todos los demás. El módulo de reportes tiene la división deshabilitada, y un almacén parado (rendimiento 0) es un caso real, no teórico: la solución de dividir el producto total se rompe exactamente ahí, que es la razón por la que el problema la prohíbe.

### Especificación
`productoExceptoYo(nums)`:
- Devuelve un arreglo donde la posición `i` contiene el producto de TODOS los elementos excepto `nums[i]`.
- Prohibido usar la división; la solución esperada es O(n): una pasada de productos prefijo y una de sufijo.
- Los valores pueden ser cero (uno o varios) y negativos.
- Arreglo vacío → arreglo vacío. Un solo elemento → `[1]` (el producto de «los demás», que no existen, es el producto vacío: 1).
- Las magnitudes de los casos caben en enteros exactos de JavaScript (todo producto intermedio queda por debajo de 2^53).

### Firma
```javascript
function productoExceptoYo(nums) {
  // TODO: pasada de prefijos dejando en res[i] el producto de la izquierda;
  // pasada de sufijos multiplicando con UNA variable acumuladora, sin dividir
  return [];
}
```
```python
def producto_excepto_yo(nums):
    # TODO: prefijos en el arreglo de salida + sufijo acumulado en una variable, sin dividir
    pass
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4]], "expected": [24, 12, 8, 6] },
  { "input": [[3, 4, 5]], "expected": [20, 15, 12] },
  { "input": [[0, 4]], "expected": [4, 0] },
  { "input": [[2, 0, 3, 0]], "expected": [0, 0, 0, 0] },
  { "input": [[-2, 3, -4]], "expected": [-12, 8, -6] },
  { "input": [[7]], "expected": [1] },
  { "input": [[]], "expected": [] },
  { "input": [[1000000, 1000000, 2]], "expected": [2000000, 2000000, 1000000000000] },
  { "input": [[5, 1, 0]], "expected": [0, 0, 5], "hint": true }
]
```

### Solución
```javascript
function productoExceptoYo(nums) {
  const n = nums.length;
  const res = new Array(n).fill(1);
  let prefijo = 1;
  for (let i = 0; i < n; i++) {
    res[i] = prefijo;          // producto de todo a la IZQUIERDA de i
    prefijo *= nums[i];
  }
  let sufijo = 1;
  for (let i = n - 1; i >= 0; i--) {
    res[i] *= sufijo;          // por el producto de todo a la DERECHA de i
    sufijo *= nums[i];         // una sola variable, no un segundo arreglo
  }
  return res;
}
```
```python
def producto_excepto_yo(nums):
    n = len(nums)
    res = [1] * n
    prefijo = 1
    for i in range(n):
        res[i] = prefijo           # producto de todo a la IZQUIERDA de i
        prefijo *= nums[i]
    sufijo = 1
    for i in range(n - 1, -1, -1):
        res[i] *= sufijo           # por el producto de todo a la DERECHA de i
        sufijo *= nums[i]          # una sola variable, no un segundo arreglo
    return res
```

### Pistas
- El producto de «todos menos yo» es exactamente (producto a mi izquierda) × (producto a mi derecha) — dos pasadas que acumulan, nunca una división que invierta.
- Reusa el arreglo de salida como el arreglo de prefijos, y acumula el sufijo con UNA variable en la segunda pasada — el truco de espacio del libro: O(1) adicional en vez de un segundo arreglo completo.
- Verifica a mano el caso con UN cero: todas las posiciones dan 0 excepto la del propio cero, que recibe el producto de los demás — si tu salida no tiene esa forma, algo multiplicó de más o de menos.
