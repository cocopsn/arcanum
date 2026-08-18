---
module_id: ce000000-0000-4000-8000-000000000001
spine: OA Amazon
title: Ejercicios — Fundamentos del OA
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-0-fundamentos.md)
version: 1
---

# Fundamentos — leer el problema antes de resolverlo

Banco del nodo cero: entrena EL reflejo que sostiene todo el path — leer las restricciones de tamaño y deducir en segundos qué complejidad espera el examinador (presupuesto ~10^8 operaciones/segundo), juzgar overflow y formato antes de enviar, y tener las herramientas de Python 3 (Counter, dict/set, deque) en la mano sin ceremonia. Estos drills se validan LOCALMENTE contra casos unitarios; no son el examen — el juez real es el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: la meta es parte del drill.

## Un millón de órdenes y un solo escaneo
type: complexity
tiempo: 2

Un servicio de Amazon recibe una lista de hasta `n = 1,000,000` de órdenes y debe responder cuál es el monto máximo. El enunciado no dice nada más. ¿Qué complejidad máxima tolera el problema y qué te dice eso sobre el algoritmo esperado?

### Opciones
- [x] O(n) o a lo más O(n log n): con n = 10^6 y un presupuesto de ~10^8 operaciones por segundo, una O(n²) serían ~10^12 operaciones (horas) — el examinador está pidiendo un escaneo lineal (o un sort a lo más), y esa lectura sale de la restricción, no del texto del problema.
- O(n²): un millón de elementos es poco para una máquina moderna y los jueces toleran soluciones cuadráticas si están bien escritas.
- O(2^n): como no especifican límite de tiempo, cualquier complejidad es aceptable mientras el código sea correcto.
- O(log n): siempre hay que aspirar a lo logarítmico; un escaneo lineal completo nunca es la respuesta esperada en un OA.
### Justificación
La tabla de oro del libro: n ≈ 10^6 → O(n) u O(n log n), porque 10^6 y hasta ~2·10^7 operaciones caben holgadas en el presupuesto de ~10^8 por segundo, mientras que n² = 10^12 lo revienta por cuatro órdenes de magnitud (una espera de horas, no de segundos). La opción de O(n²) confunde «poco espacio en memoria» con «pocas operaciones». La de O(2^n) ignora que el límite de tiempo SIEMPRE existe aunque el enunciado no lo repita — está implícito en la restricción de tamaño. Y O(log n) es imposible aquí: para saber el máximo hay que MIRAR cada orden al menos una vez — logarítmico solo aplica cuando puedes descartar zonas enteras sin mirarlas (datos ordenados, respuesta binarizable).

## Veinte paquetes y todos los subconjuntos
type: complexity
tiempo: 2

Debes decidir qué combinación de a lo más `n = 20` paquetes cabe exactamente en un contenedor, probando combinaciones de inclusión/exclusión. ¿Qué te dice n = 20 sobre el enfoque esperado?

### Opciones
- [x] Exponencial está PERMITIDO: 2^20 ≈ 10^6 subconjuntos caben en el presupuesto — un n diminuto (≤ 20-25) es la firma de que el examinador espera fuerza bruta sobre subconjuntos (o bitmask/backtracking), y sería un error gastar el reloj buscando un algoritmo polinomial elegante.
- Hay que encontrar una solución O(n log n): el examinador nunca espera algoritmos exponenciales en un examen cronometrado.
- n = 20 es una errata del enunciado: ningún problema real tiene entradas tan pequeñas.
- La única lectura válida es programación dinámica O(n·suma), porque los subconjuntos siempre se resuelven con DP.
### Justificación
Es la lectura inversa de la tabla de oro y el libro la subraya: un n minúsculo es una PISTA tan fuerte como un n gigante. 2^20 ≈ 1,048,576 — cabe de sobra en ~10^8, así que enumerar subconjuntos es exactamente lo esperado. Creer que «exponencial nunca» te haría perder minutos preciosos buscando estructura que quizá no existe (y el OA premia velocidad). La «errata» no existe: los límites se eligen a propósito. Y la DP O(n·suma) puede aplicar en variantes con sumas acotadas, pero afirmar que es «la única lectura» ignora que con n = 20 la enumeración directa ya cabe — bajo reloj, lo simple que cabe LE GANA a lo elegante que tarda en escribirse.

## Tres mil centros y comparaciones por pares
type: complexity
tiempo: 3

Una red tiene hasta `n = 3,000` centros de distribución y debes encontrar el PAR de centros con demanda combinada máxima bajo una regla arbitraria por par (no hay estructura aprovechable declarada). ¿Qué enfoque tolera el límite?

### Opciones
- [x] El doble loop O(n²) es viable y probablemente lo esperado: 3,000² = 9·10^6 comparaciones — un décimo del presupuesto de ~10^8. Cuando la regla por par es arbitraria (sin monotonía ni orden que explotar), no hay atajo garantizado, y el límite en 3,000 (no 10^5) es la señal de que el cuadrático está bendecido.
- O(n²) nunca pasa un OA: hay que ordenar y usar dos punteros aunque la regla por par sea arbitraria.
- Con 3,000 elementos se necesita un segment tree para que las consultas por par sean O(log n).
- El enfoque correcto es aleatorizar: probar 10,000 pares al azar da la respuesta con probabilidad suficiente para el juez.
### Justificación
La tabla de oro: n ≤ ~3,000-5,000 → O(n²) cabe (9·10^6 ≪ 10^8), y el libro insiste en leer el límite como mensaje del examinador — si quisieran prohibir el cuadrático habrían puesto 10^5. Dos punteros EXIGE una estructura monótona (orden que garantice hacia dónde mover cada puntero); con una regla arbitraria por par no existe esa garantía y la respuesta sería incorrecta, no solo lenta. El segment tree acelera consultas de RANGO, no evalúa reglas arbitrarias par-por-par. Y el muestreo aleatorio entrega probablemente-correcto — un OA compara contra la respuesta exacta: un par no visto = respuesta equivocada.

## La suma que desborda en silencio
type: multiple_choice
tiempo: 3

Vas a sumar los pesos de hasta `10^5` paquetes, cada uno de hasta `10^9` unidades. Tu solución la escribirás en Python 3, pero el enunciado advierte «usa enteros de 64 bits». ¿Cuál es la lectura correcta de esa advertencia?

### Opciones
- [x] La suma alcanza ~10^14, que desborda un entero de 32 bits (~2.1·10^9) — en C++/Java sería un bug real de tipo (long long / long). En Python el int es de precisión arbitraria y no desborda, así que ahí estás cubierto de gracia; PERO la advertencia sigue siendo tuya: si usas floats (una división, un promedio) pierdes exactitud a esa escala, y si el juez compara formato estricto, un `1e14` impreso en notación científica falla contra `100000000000000`.
- En Python también desborda: hay que usar `numpy.int64` explícitamente o la suma se corrompe.
- La advertencia es irrelevante siempre: los jueces nunca prueban valores en el extremo de las restricciones.
- Basta con usar `round()` al final para reparar cualquier pérdida de precisión de los floats intermedios.
### Justificación
El libro dedica su sección de overflow exactamente a esto: 10^5 × 10^9 = 10^14 > 2^31−1 (y también > 2^53 quedaría cerca si fueran más términos — el límite exacto de float64), así que en lenguajes de tipos fijos el acumulador DEBE ser de 64 bits. Python te regala el int arbitrario — no desborda — pero el peligro migra a los FLOATS (dividir, promediar) y al FORMATO de salida. numpy.int64 es innecesario y de hecho REINTRODUCE el desborde de 64 bits que el int nativo no tiene. «Los jueces no prueban extremos» es exactamente al revés: los casos límite del rango son los favoritos del juez. Y `round()` no recupera precisión ya perdida en un float — repara síntomas cosméticos, no el error acumulado.

## Tres minutos sin ver el patrón
type: multiple_choice
tiempo: 2

Llevas tres minutos frente al problema 1 del OA y todavía no identificas el patrón. El reloj corre (meta: cerrar el problema 1 en 35-40 minutos). Según el protocolo del examen, ¿qué haces?

### Opciones
- [x] Escribes la fuerza bruta correcta AHORA y la optimizas después si el tiempo alcanza: una solución que corre y pasa casos parciales vale infinitamente más que una elegante incompleta — y muchas veces al escribir la bruta el patrón aparece solo, porque ya estás manipulando la estructura real del problema.
- Sigues pensando en silencio el tiempo que haga falta: enviar algo subóptimo daña más que no enviar nada.
- Saltas inmediatamente al problema 2 y regresas al 1 con la mente fresca al final.
- Escribes pseudocódigo detallado del enfoque ideal para demostrar que entendiste el problema aunque no compile.
### Justificación
Es la regla literal del protocolo del Plan: «si en tres minutos no lo tienes, escribe la fuerza bruta y optimiza después». Los OA dan crédito por casos que pasan; una bruta correcta captura los casos chicos aunque muera por tiempo en los grandes — eso es estrictamente mejor que cero. Pensar sin escribir quema el recurso más escaso (el reloj) sin generar crédito parcial. Saltar al problema 2 a los tres minutos es pánico, no estrategia — la meta de 35-40 min aún tiene margen de sobra. Y el pseudocódigo es la trampa mortal documentada: Amazon lo marca — todo lo que escribas debe COMPILAR (regla tres del cuaderno: «escribe código real, no pseudocódigo»).

## Membresía un millón de veces
type: multiple_choice
tiempo: 2

Debes verificar, para cada uno de `10^5` SKUs entrantes, si ya existe en un catálogo de `10^5` SKUs registrados. En Python, ¿qué estructura usas para el catálogo y por qué?

### Opciones
- [x] Un `set`: la verificación de membresía `sku in catalogo` es O(1) esperado — las 10^5 verificaciones cuestan ~10^5 operaciones. Con una `list`, cada `in` es un barrido O(n) y el total se vuelve O(n²) = 10^10: el clásico programa que «funciona en el ejemplo» y muere por tiempo en el caso grande.
- Una `list`, porque mantiene el orden de inserción y eso hace la búsqueda más rápida.
- Un `set` o una `list` dan igual: Python optimiza el operador `in` automáticamente según el tamaño.
- Una cadena gigante concatenada, usando `sku in cadena` para aprovechar la búsqueda de substrings de C.
### Justificación
Es la herramienta número uno del setup de Python del libro: dict/set dan membresía O(1) sin ceremonia, y la diferencia no es estilística — es la frontera entre 10^5 y 10^10 operaciones, es decir entre pasar y morir por tiempo. El orden de inserción de la lista no acelera nada: `in` sobre lista siempre barre. Python NO cambia el algoritmo de `in` según el tamaño — el operador despacha a la estructura, y la lista solo sabe barrer. Y la cadena concatenada es además INCORRECTA: `"b1" in "ab12"` da True por coincidencia de substring — un falso positivo, no una optimización.

## El doble loop que se ve inocente
type: trace
tiempo: 3

Este código busca si algún par de pedidos suma exactamente el objetivo, con `n = 100,000` pedidos:

```python
def hay_par(pedidos, objetivo):
    n = len(pedidos)
    for i in range(n):
        for j in range(i + 1, n):
            if pedidos[i] + pedidos[j] == objetivo:
                return True
    return False
```

En el peor caso (no existe el par), ¿qué pasa al correrlo contra el juez?

### Opciones
- [x] Ejecuta ~n²/2 = 5·10^9 comparaciones: contra un presupuesto de ~10^8 operaciones/segundo son ~50 segundos — el juez lo mata por límite de tiempo aunque la lógica sea perfectamente correcta. El veredicto no es «incorrecto», es «fuera de tiempo», y la salida es el patrón de complemento con set (lo ve el nodo oa-1).
- Devuelve un resultado incorrecto: el `range(i + 1, n)` se salta pares válidos.
- Corre en ~5 segundos y pasa raspando, porque Python ejecuta ~10^9 operaciones por segundo.
- Falla con desbordamiento de pila por la profundidad de los dos loops anidados.
### Justificación
El conteo es el del libro: n²/2 con n = 10^5 da 5·10^9 operaciones, y con el presupuesto realista (~10^8/s para Python; el libro es aún más conservador para bytecode interpretado) son decenas de segundos — muerte segura por tiempo, con lógica CORRECTA. Esa distinción (correcto-pero-lento vs incorrecto) es exactamente lo que las restricciones te avisaban desde antes de escribir. El `range(i+1, n)` es correcto: evita repetir pares y compararse consigo mismo, no se salta ninguno. Python NO corre 10^9 operaciones por segundo (eso es territorio de C compilado; el intérprete anda en ~10^7-10^8). Y los loops anidados no consumen pila — no hay recursión aquí.

## El SKU más frecuente, con desempate estricto
type: code
tiempo: 10

El equipo de catálogo quiere saber cuál producto aparece más veces en el registro de picks del día. Recibes la lista de SKUs (strings) en orden de pick. Devuelve el SKU más frecuente; si hay empate en la frecuencia máxima, devuelve el lexicográficamente MENOR (formato estricto: el juez compara el string exacto). Lista vacía → devuelve la cadena vacía.

### Especificación
- Cuenta la frecuencia de cada SKU en una sola pasada (dict/Counter).
- Gana la frecuencia máxima; empate → el menor en orden lexicográfico de string.
- `[]` → `""` (caso borde declarado: sin picks no hay SKU).

### Firma
```javascript
function skuMasFrecuente(skus) {
  // TODO: cuenta con un Map; luego elige max frecuencia con desempate lexicográfico
  return "";
}
```
```python
def sku_mas_frecuente(skus):
    # TODO: Counter; max por (frecuencia, -orden lexicografico) o barrido explicito
    return ""
```

### Casos
```json
[
  { "input": [["b7", "a1", "b7", "c3", "a1", "b7"]], "expected": "b7" },
  { "input": [["a1", "b7", "a1", "b7"]], "expected": "a1" },
  { "input": [[]], "expected": "" },
  { "input": [["z9"]], "expected": "z9" },
  { "input": [["c3", "b7", "a1"]], "expected": "a1" },
  { "input": [["x2", "x10", "x2", "x10"]], "expected": "x10" },
  { "input": [["a", "A", "a", "A"]], "expected": "A", "hint": true }
]
```

### Solución
```javascript
function skuMasFrecuente(skus) {
  const conteo = new Map();
  for (const s of skus) conteo.set(s, (conteo.get(s) ?? 0) + 1);
  let mejor = "";
  let mejorFrec = 0;
  for (const [sku, frec] of conteo) {
    if (frec > mejorFrec || (frec === mejorFrec && (mejor === "" || sku < mejor))) {
      mejor = sku;
      mejorFrec = frec;
    }
  }
  return mejor;
}
```
```python
def sku_mas_frecuente(skus):
    from collections import Counter
    if not skus:
        return ""
    conteo = Counter(skus)
    mejor_frec = max(conteo.values())
    return min(s for s, f in conteo.items() if f == mejor_frec)
```

### Pistas
- Una pasada para contar (Map/Counter), otra sobre el conteo para decidir — no anides búsquedas.
- El desempate es sobre el STRING: `"x10" < "x2"` lexicográficamente (compara carácter por carácter, no números).
- En Python, `min(...)` sobre los candidatos con frecuencia máxima resuelve el desempate en una línea.

## La suma que el juez compara carácter por carácter
type: code
tiempo: 8

Logística te pide el peso total de una ruta: hasta `10^5` paquetes de hasta `10^9` unidades cada uno (el total puede llegar a ~10^14 — la advertencia de 64 bits del enunciado es para esto). Devuelve el total como NÚMERO entero exacto. Ruta vacía → 0. Pesos negativos no existen, pero un peso puede ser 0.

### Especificación
- Suma entera exacta de todos los pesos (nada de floats intermedios: ninguna división ni promedio).
- `[]` → `0`.
- Los valores de prueba llegan hasta el orden de 10^13-10^14: exactos en int de Python y en el number de JS (< 2^53).

### Firma
```javascript
function pesoTotalRuta(pesos) {
  // TODO: acumulador entero; sin floats intermedios
  return 0;
}
```
```python
def peso_total_ruta(pesos):
    # TODO: suma entera; el int de Python no desborda
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3]], "expected": 6 },
  { "input": [[]], "expected": 0 },
  { "input": [[0, 0, 0]], "expected": 0 },
  { "input": [[999999999]], "expected": 999999999 },
  { "input": [[1000000000, 1000000000, 1000000000]], "expected": 3000000000 },
  { "input": [[999999999999, 999999999999, 2]], "expected": 2000000000000 },
  { "input": [[123456789, 987654321, 555555555]], "expected": 1666666665 }
]
```

### Solución
```javascript
function pesoTotalRuta(pesos) {
  let total = 0;
  for (const p of pesos) total += p;
  return total;
}
```
```python
def peso_total_ruta(pesos):
    return sum(pesos)
```

### Pistas
- El drill es de JUICIO, no de código: nota que 3·10^9 ya no cabe en 32 bits — en C++/Java este acumulador sería un bug de tipo.
- En JS el number es exacto hasta 2^53 (~9·10^15): estos totales caben; si el problema real pudiera excederlo, la herramienta sería BigInt.
- Si te sorprende lo trivial del código: esa es la lección — el overflow se decide LEYENDO restricciones, no depurando.

## Tu tabla de oro, de memoria
type: production
tiempo: 5

Sin mirar el libro: escribe TU tabla restricciones → complejidad esperada (las cuatro filas que usarás en el examen), y debajo, en una línea, de dónde sale el presupuesto que la justifica.

### Modelo
- n ≤ 20-25 → exponencial permitido (2^n / backtracking / bitmask): 2^20 ≈ 10^6.
- n ≤ ~3,000-5,000 → O(n²) cabe: ~10^7 operaciones.
- n ≤ ~10^5-10^6 → O(n log n) u O(n): sort, heap, hashmap, un escaneo.
- n ≥ ~10^7 o consultas masivas → O(n) apretado u O(log n) por consulta (binary search / precómputo).
Presupuesto: ~10^8 operaciones por segundo de juez — toda fila sale de comparar n^k o 2^n contra ese número.

### Regla
Las restricciones son el mensaje del examinador sobre qué algoritmo espera: cada fila de la tabla es solo «¿cuántas operaciones hace mi enfoque con el n máximo?» comparado contra ~10^8/segundo. Leer la tabla en segundos evita el error caro del OA — construir una solución correcta que muere por tiempo — y también el inverso: buscar elegancia polinomial donde la fuerza bruta ya cabía.

### Rúbrica
- Las cuatro filas están, cada una con su complejidad tope y un orden de magnitud del conteo de operaciones.
- Puedes DERIVAR cualquier fila desde el presupuesto (~10^8 ops/s), no solo recitarla.
- Incluiste el caso chico (n ≤ 20 → exponencial OK) — la fila que más candidatos olvidan.
- La escribiste en menos de 5 minutos sin consultar nada.
