---
module_id: cd000000-0000-4000-8000-000000000007
spine: Competitiva
title: Ejercicios — DP competitivo
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp7-dp-competitivo.md)
version: 1
---

# DP competitivo — banco de reflejo

Banco competitivo (reflejo bajo el reloj): cada ejercicio entrena RECONOCER, en los primeros dos minutos, cuál de los estados clásicos (knapsack, LIS, grid, bitmask) encaja con el enunciado — y evitar las trampas de diseño e implementación que dan una respuesta incorrecta que no truena. Los ejercicios de código destilan las plantillas núcleo (knapsack 0/1, LIS O(n log n), min-monedas) como funciones puras. No son un juez de contest: no hay veredicto "accepted"; son drills de plantilla contra casos borde.

## La señal de la capacidad — reconocer knapsack en dos minutos
type: multiple_choice

Lees: "tienes N objetos, cada uno con un peso y un valor; elige un subconjunto cuyo peso total no exceda W, maximizando el valor total". Tienes dos minutos antes de escribir código. ¿Cuál estado clásico eliges, y cuál es la señal concreta en el enunciado que lo delata?

### Opciones
- [x] Knapsack 0/1: el estado es `(item actual, capacidad restante)` y la señal es la restricción de capacidad — "peso total ≤ W" acota un recurso consumible mientras eliges un subconjunto, exactamente la forma "máximo valor eligiendo un subconjunto sujeto a una restricción".
- LIS: el estado es la posición y el último valor usado, porque estás eligiendo una subsecuencia de los objetos en el orden dado.
- DP en grid: el estado es la posición `(i, j)`, porque los pesos y valores de los objetos forman una matriz bidimensional.
- DP con bitmask: el estado es el subconjunto exacto de objetos elegidos, porque necesitas recordar cuáles usaste para no repetir ninguno.

### Justificación
Es el reconocimiento del prólogo y de la sección 1: "máximo/mínimo valor eligiendo un subconjunto sujeto a una restricción" con una **restricción de capacidad** es la firma inconfundible de knapsack. El reflejo de encontrar el estado ("¿qué necesito saber del pasado, y nada más?") responde aquí "la capacidad que me queda" — el resumen mínimo. LIS pide "cada elemento mayor/compatible con el anterior", que no aparece (distractor 2). No hay matriz ni posición 2D (distractor 3). El distractor 4 es justo el error que el libro advierte: incluir **demasiada** información en el estado — recordar el subconjunto exacto es innecesario (y solo tratable si n ≤ 20), cuando basta con la capacidad restante para decidir el óptimo.

## El límite n ≤ 20 — qué te está diciendo el autor
type: multiple_choice

Un problema declara explícitamente en las restricciones `n ≤ 18` (ciudades, tareas, o elementos). Antes siquiera de leer el resto del enunciado, ¿qué señala ese límite diminuto de forma más confiable?

### Opciones
- [x] Que el estado casi seguro incluye un subconjunto de los n elementos representado como los bits de un entero (bitmask): `2^18 ≈ 2.6×10⁵` máscaras es tratable, y el autor eligió n pequeño deliberadamente para permitirlo.
- Que el problema es O(n²) y debes usar la DP directa de LIS, porque n ≤ 18 es demasiado pequeño para justificar binary search.
- Que debes usar prefix sums, porque con tan pocos elementos reconstruir el arreglo tras cada cambio es barato.
- Que el problema no es de DP en absoluto: con n tan chico, la fuerza bruta ingenua sobre todas las permutaciones (`18!`) siempre entra en tiempo.

### Justificación
Sección 4: "n ≤ 20 es, casi siempre, una señal deliberada del autor de que el estado incluye un subconjunto representado como los bits de un entero". El límite de n **te dice directamente la complejidad esperada** — "mira los límites antes de pensar en el algoritmo, no después". `2^18` es manejable; el distractor 4 confunde `2^n` con `n!`: `18! ≈ 6.4×10¹⁵` es intratable, y ese salto es exactamente por qué el bitmask (subconjuntos, no permutaciones) es la lectura correcta. O(n²) y prefix sums no tienen relación con un límite tan chico.

## Complejidad de una DP con bitmask
type: complexity

Tienes una DP con bitmask como la plantilla de la sección 4: `dp[máscara]` recorre las `2^n` máscaras y, por cada una, la transición prueba agregar cada uno de los n elementos que aún no están en la máscara. ¿Cuál es la complejidad temporal ajustada, y por qué?

### Opciones
- [x] O(2ⁿ · n): hay `2ⁿ` estados (una por máscara) y la transición de cada estado prueba los n elementos candidatos — número de estados × costo de la transición.
- O(2ⁿ): hay `2ⁿ` máscaras y cada una se procesa en O(1), porque el bucle interno sobre los n elementos es una constante.
- O(n · 2ⁿ⁺¹): cada máscara genera dos submáscaras nuevas, duplicando el trabajo en cada nivel del recorrido.
- O(n!): se recorren todas las permutaciones de los n elementos, una por cada orden posible de inserción.

### Justificación
La complejidad de una DP es **número de estados × costo de la transición**. La plantilla de la sección 4 tiene un bucle externo sobre `1 << n` máscaras y uno interno sobre los n elementos → `O(2ⁿ · n)`. El distractor 2 ignora el bucle interno (los n elementos no son constantes). El distractor 4 confunde bitmask con enumeración de permutaciones: el poder del bitmask es precisamente **colapsar los `n!` órdenes en `2ⁿ` estados de subconjunto**, cargando el resultado en la máscara sin importar en qué orden llegaste a ella. Por eso `2^20 ≈ 10⁶` es tratable y `20!` no lo sería.

## Knapsack 0/1 — el valor máximo
type: code

Implementa el corazón del knapsack 0/1 (sección 1) como función pura: dado un arreglo de `pesos`, uno paralelo de `valores`, y una `capacidad`, devuelve el valor máximo alcanzable eligiendo un subconjunto de items cuyo peso total no exceda la capacidad. Cada item se usa **a lo más una vez** (0/1) — eso obliga a que el bucle interno sobre el peso vaya hacia atrás.

### Especificación
`knapsack(pesos, valores, capacidad)`:
- `pesos[i]` es el peso del item `i` y `valores[i]` su valor; ambos arreglos tienen la misma longitud `n`.
- Devuelve el máximo `Σ valores[i]` sobre subconjuntos con `Σ pesos[i] ≤ capacidad`.
- `n = 0` (sin items) o `capacidad = 0` → 0. Un item más pesado que la capacidad simplemente nunca entra.

### Firma
```javascript
function knapsack(pesos, valores, capacidad) {
  // TODO: dp[w] = mejor valor con peso <= w; bucle interno de peso HACIA ATRÁS
}
```
```python
def knapsack(pesos, valores, capacidad):
    # TODO: dp[w] = mejor valor con peso <= w; bucle interno de peso HACIA ATRÁS
    pass
```

### Casos
```json
[
  { "input": [[], [], 10], "expected": 0 },
  { "input": [[1, 2, 3], [10, 20, 30], 0], "expected": 0 },
  { "input": [[3], [7], 5], "expected": 7 },
  { "input": [[8], [100], 5], "expected": 0 },
  { "input": [[5], [9], 5], "expected": 9 },
  { "input": [[1, 3, 4, 5], [1, 4, 5, 7], 7], "expected": 9 },
  { "input": [[4, 5, 6], [10, 20, 30], 10], "expected": 40 },
  { "input": [[2, 3], [5, 6], 10], "expected": 11 }
]
```

### Solución
```javascript
function knapsack(pesos, valores, capacidad) {
  const dp = new Array(capacidad + 1).fill(0);
  const n = pesos.length;
  for (let i = 0; i < n; i++) {
    for (let w = capacidad; w >= pesos[i]; w--) {
      const cand = dp[w - pesos[i]] + valores[i];
      if (cand > dp[w]) dp[w] = cand;
    }
  }
  return dp[capacidad];
}
```
```python
def knapsack(pesos, valores, capacidad):
    dp = [0] * (capacidad + 1)
    n = len(pesos)
    for i in range(n):
        for w in range(capacidad, pesos[i] - 1, -1):
            cand = dp[w - pesos[i]] + valores[i]
            if cand > dp[w]:
                dp[w] = cand
    return dp[capacidad]
```

### Pistas
- Una sola fila `dp[w]` = mejor valor con peso exactamente hasta `w`, usando los items procesados hasta ahora.
- El bucle de peso va **hacia atrás** (`capacidad → pesos[i]`) para que `dp[w - pesos[i]]` todavía refleje "sin usar el item i" — hacia adelante lo reintroduciría (eso sería knapsack no acotado).
- Un item con `pesos[i] > capacidad` no ejecuta el bucle interno: nunca contamina la tabla.

## El bucle de knapsack al revés — qué bug introduce
type: trace

La plantilla de knapsack 0/1 usa el bucle interno `for w in range(capacidad, pesos[i]-1, -1)` (hacia atrás). Un colega lo "simplifica" a hacia adelante: `for w in range(pesos[i], capacidad+1)`. Con `pesos=[2]`, `valores=[3]`, `capacidad=6`, traza qué devuelve la versión hacia adelante y nombra el bug.

### Opciones
- [x] Devuelve 9 en vez de 3: recorrer hacia adelante deja que `dp[w-2]` ya incluya el item en esta misma pasada, así que el único item de peso 2 se usa tres veces (2+2+2 = 6, valor 3·3 = 9) — convierte el 0/1 en knapsack NO acotado, un bug de lógica silencioso que da respuestas sistemáticamente mayores.
- Devuelve 3, idéntico al backward: el orden del bucle solo afecta la velocidad, no el resultado, porque `max` es conmutativo.
- Devuelve 0: recorrer hacia adelante lee `dp[w-2]` antes de inicializarlo, propagando ceros por toda la tabla.
- Lanza un error de índice: `range(pesos[i], capacidad+1)` accede a `dp[capacidad+1]`, fuera de los límites del arreglo.

### Justificación
Es la trampa de "Orden de evaluación incorrecto" (sección 1 + Trampas). Traza hacia adelante con `dp` de tamaño 7 en ceros: `w=2 → dp[2]=max(0, dp[0]+3)=3`; `w=3 → dp[3]=max(0, dp[1]+3)=3`; `w=4 → dp[4]=max(0, dp[2]+3)=6` (¡reusa el item ya contado en `dp[2]`!); `w=5 → 6`; `w=6 → dp[6]=max(0, dp[4]+3)=9`. El item de peso 2 entró tres veces. El backward daría 3 (una sola vez). El libro lo describe exacto: "da respuestas mayores a las correctas de forma sistemática", un bug de lógica, no de sintaxis — así que no truena (distractor 4: `range(2,7)` llega hasta `w=6`, índice válido) ni da 0, ni es inocuo.

## Complejidad de LIS con `tails` — de dónde sale el log
type: complexity

La versión O(n log n) de LIS (sección 2) mantiene un arreglo `tails` y, por cada uno de los n elementos, hace un `bisect_left` seguido de un `append` o una asignación. ¿Cuál es la complejidad total, y de dónde sale exactamente el factor logarítmico?

### Opciones
- [x] O(n log n): procesas los n elementos y por cada uno haces un binary search sobre `tails` (de largo a lo más n), que es O(log n) — la búsqueda binaria es la que reemplaza el escaneo O(n) de la DP directa.
- O(n²): por cada elemento revisas todos los anteriores para encontrar la mejor subsecuencia que extender, igual que la DP directa `dp[i]`.
- O(n): un solo recorrido del arreglo basta, porque `append` y la asignación son O(1) y el binary search no cuenta.
- O(log n): el binary search domina y el recorrido de los n elementos es despreciable frente a él.

### Justificación
Sección 2: "mantener el menor valor final posible para cada longitud permite usar binary search para encontrar dónde insertar cada nuevo elemento — reemplazas un O(n²) por un O(n log n)". Son n iteraciones, cada una con un `bisect_left` de O(log n) → `O(n log n)`. El distractor 2 es precisamente la DP directa que `tails` viene a mejorar (revisar todos los `j < i` es O(n²)). El distractor 3 olvida el costo del binary search; el distractor 4 olvida que recorres los n elementos. Es la composición directa DP + binary search (conexión con CP2).

## LIS — la longitud de la subsecuencia creciente más larga
type: code

Implementa la plantilla O(n log n) de LIS (sección 2): dado un arreglo `a`, devuelve la **longitud** de la subsecuencia estrictamente creciente más larga. Usa el truco de `tails` — `tails[i]` = el menor valor final posible de una subsecuencia creciente de longitud `i+1` — con `bisect_left` para decidir dónde cae cada elemento. "Estrictamente creciente" significa que valores iguales NO extienden la subsecuencia.

### Especificación
`lisLongitud(a)`:
- Devuelve la longitud de la subsecuencia estrictamente creciente más larga de `a`.
- Arreglo vacío → 0. Un solo elemento → 1. Todos iguales → 1 (estricto).
- El truco: para cada `x`, `bisect_left(tails, x)` da la posición; si iguala el largo, `append`; si no, sobrescribe esa posición (mantiene el menor final para esa longitud).

### Firma
```javascript
function lisLongitud(a) {
  // TODO: tails + bisect_left (primer índice con tails[i] >= x)
}
```
```python
def lis_longitud(a):
    # TODO: tails + bisect_left
    pass
```

### Casos
```json
[
  { "input": [[]], "expected": 0 },
  { "input": [[5]], "expected": 1 },
  { "input": [[1, 2, 3, 4, 5]], "expected": 5 },
  { "input": [[5, 4, 3, 2, 1]], "expected": 1 },
  { "input": [[7, 7, 7, 7]], "expected": 1 },
  { "input": [[3, 1, 2]], "expected": 2 },
  { "input": [[10, 9, 2, 5, 3, 7, 101, 18]], "expected": 4 },
  { "input": [[0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]], "expected": 6 }
]
```

### Solución
```javascript
function lisLongitud(a) {
  const tails = [];
  for (const x of a) {
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo === tails.length) tails.push(x);
    else tails[lo] = x;
  }
  return tails.length;
}
```
```python
import bisect

def lis_longitud(a):
    tails = []
    for x in a:
        pos = bisect.bisect_left(tails, x)
        if pos == len(tails):
            tails.append(x)
        else:
            tails[pos] = x
    return len(tails)
```

### Pistas
- `bisect_left` = el primer índice `i` con `tails[i] >= x`. En JS lo construyes con el binary search `if tails[mid] < x: lo = mid+1 else hi = mid`.
- Si la posición iguala la longitud de `tails`, `x` extiende la mejor subsecuencia → `append`. Si no, `x` mejora (baja) el final de una longitud ya alcanzada → sobrescribe.
- Para "estrictamente creciente" usa `bisect_left` (un valor igual reemplaza en su lugar, no extiende). Para "no decreciente" sería `bisect_right`.

## El estado que no captura todo — el bug que no truena
type: multiple_choice

Para un knapsack 0/1, alguien define el estado como solo `dp[i]` = "mejor valor considerando los primeros `i` items", **sin** incluir la capacidad restante. El código compila, pasa los casos de ejemplo pequeños, y falla en los tests ocultos. ¿Por qué es esta la clase de bug de DP más peligrosa según el libro?

### Opciones
- [x] Porque un estado que omite información que sí afecta las decisiones futuras (aquí, la capacidad restante) produce una respuesta incorrecta que NO truena — compila, corre, y hasta puede pasar casos pequeños por coincidencia, así que el error es silencioso y difícil de detectar.
- Porque omitir la capacidad hace que el programa lance un error de índice al intentar leer `dp[capacidad]` en una tabla unidimensional.
- Porque sin la capacidad en el estado la complejidad sube a O(2ⁿ), causando TLE en los casos grandes aunque la respuesta sea correcta.
- Porque el estado incompleto obliga a usar memoización en vez de tabulación, y la recursión desborda la pila en los casos grandes.

### Justificación
Es la trampa nombrada "el error de diseño más caro" (Trampas): "si tu `dp[estado]` no incluye algo que sí afecta las decisiones futuras, obtienes una respuesta incorrecta que **no truena**, simplemente está mal, y puede pasar los casos de prueba pequeños por coincidencia". El daño es de **correctitud**, no un crash (distractor 2), ni TLE con respuesta correcta (distractor 3 lo describe como lento-pero-correcto, que es lo opuesto), ni un desbordamiento de pila (distractor 4). La defensa es el reflejo de verificación: "dado mi estado propuesto, ¿puedo tomar la decisión óptima del siguiente paso sin necesitar NADA más del historial?".

## Cambio de moneda mínimo — o imposible
type: code

Implementa min-monedas (una DP de knapsack no acotado — cada moneda se usa cuantas veces quieras): dadas las denominaciones `monedas` y un `objetivo`, devuelve el número **mínimo** de monedas que suman exactamente `objetivo`, o `-1` si es imposible. Es la contraparte "minimizar conteo" de las DPs de "de cuántas formas" del prólogo.

### Especificación
`minMonedas(monedas, objetivo)`:
- Devuelve el mínimo número de monedas cuya suma es exactamente `objetivo`; cada denominación es reutilizable sin límite.
- `objetivo = 0` → 0 (cero monedas). Si ninguna combinación llega a `objetivo` (incluye `monedas` vacío) → `-1`.
- `dp[v]` = mínimo de monedas para sumar `v`; `dp[0]=0`, el resto arranca en infinito; `dp[v] = min(dp[v], dp[v-c]+1)` para cada moneda `c ≤ v`.

### Firma
```javascript
function minMonedas(monedas, objetivo) {
  // TODO: dp[v] = min monedas para sumar v; -1 si queda en infinito
}
```
```python
def min_monedas(monedas, objetivo):
    # TODO: dp[v] = min monedas para sumar v; -1 si queda en infinito
    pass
```

### Casos
```json
[
  { "input": [[1, 2, 5], 0], "expected": 0 },
  { "input": [[2], 3], "expected": -1 },
  { "input": [[], 5], "expected": -1 },
  { "input": [[1, 3, 4], 6], "expected": 2 },
  { "input": [[1, 2, 5], 11], "expected": 3 },
  { "input": [[7], 7], "expected": 1 },
  { "input": [[2], 8], "expected": 4 },
  { "input": [[5, 10], 3], "expected": -1 }
]
```

### Solución
```javascript
function minMonedas(monedas, objetivo) {
  const INF = Infinity;
  const dp = new Array(objetivo + 1).fill(INF);
  dp[0] = 0;
  for (let v = 1; v <= objetivo; v++) {
    for (const c of monedas) {
      if (c <= v && dp[v - c] + 1 < dp[v]) {
        dp[v] = dp[v - c] + 1;
      }
    }
  }
  return dp[objetivo] === INF ? -1 : dp[objetivo];
}
```
```python
def min_monedas(monedas, objetivo):
    INF = float('inf')
    dp = [INF] * (objetivo + 1)
    dp[0] = 0
    for v in range(1, objetivo + 1):
        for c in monedas:
            if c <= v and dp[v - c] + 1 < dp[v]:
                dp[v] = dp[v - c] + 1
    return -1 if dp[objetivo] == INF else dp[objetivo]
```

### Pistas
- El centinela de "imposible" es el infinito: `dp[v]` que nunca baja de infinito significa que `v` no es alcanzable → traduce a `-1` solo al final.
- Es knapsack NO acotado: el bucle de `v` va **hacia adelante** (a diferencia del 0/1) precisamente porque quieres reusar la misma moneda varias veces.
- El caso greedy-falla (`monedas=[1,3,4]`, `objetivo=6`): greedy tomaría 4+1+1 = 3 monedas, pero el óptimo es 3+3 = 2. La DP lo captura; un greedy sin prueba de exchange argument, no.

## Contar formas módulo 1e9+7 — dónde aplicar el módulo
type: multiple_choice

Una DP de conteo ("¿de cuántas formas...?") pide la respuesta módulo `10⁹+7`. Una implementación calcula toda la DP con enteros normales y aplica `% (10**9+7)` **solo** a `dp[objetivo]` final antes de imprimir. En C++ con `long long`, ¿por qué está mal?

### Opciones
- [x] Porque los conteos intermedios crecen exponencialmente y desbordan `long long` mucho antes de llegar al final; el módulo debe aplicarse en CADA suma/multiplicación intermedia para mantener cada valor acotado, no solo al resultado final.
- Porque `10⁹+7` no es primo y por lo tanto el módulo final no distribuye sobre la suma; hay que usar un primo verdadero como `998244353`.
- Porque aplicar el módulo al final redondea hacia abajo, y para conteos exactos hay que aplicarlo hacia arriba con `ceil`.
- Porque en Python (enteros de precisión arbitraria) el módulo final sí basta, pero el enunciado exige imprimir el resultado en notación científica.

### Justificación
Trampas, "Overflow al contar formas (módulo 1e9+7)": "aplica el módulo en cada operación de suma/multiplicación, no solo al final". El conteo real crece exponencialmente; si no reduces en cada paso, el acumulador desborda el entero de ancho fijo **antes** de que llegues a aplicar el módulo final, y ya arrastras basura. Reducir mod `p` en cada operación mantiene todo `< p`. El distractor 2 es falso: `10⁹+7` **sí** es primo (el libro lo usa como "un primo grande"), y la aritmética modular distribuye sobre `+` y `×` sin importar eso. El módulo no es un redondeo (distractor 3), y la notación científica es una invención (distractor 4).
