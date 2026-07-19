---
module_id: cd000000-0000-4000-8000-000000000001
spine: Competitiva
title: Ejercicios — Two pointers y sliding window
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp1-two-pointers.md)
version: 1
---

# Two pointers y sliding window — banco de reconocimiento

Banco de reflejo competitivo (Competitiva): cada ejercicio entrena tu ojo para RECONOCER el patrón por el olor del enunciado bajo el reloj — la señal exacta que delata sliding window o two pointers, la trampa que hace fallar el enfoque ingenuo, y la plantilla tecleada de memoria. Los dos ejercicios de código son drills de PLANTILLA validados localmente contra casos unitarios; NO son el juez de Codeforces ni emiten veredicto «Accepted» — el veredicto real de un problema de contest lo da el juez externo. Todo está anclado a lo que el libro `cp1-two-pointers.md` realmente enseña: monotonía, sus señales, sus trampas.

## El olor del enunciado — ventana variable
type: multiple_choice

En un examen bajo reloj lees: «Dado un arreglo de enteros NO negativos, encuentra la longitud del subarreglo CONTIGUO más largo cuya suma sea a lo más K.» Sin escribir todavía una sola línea, ¿qué patrón debe disparar tu reflejo, y cuál es la señal EXACTA del enunciado que lo delata?

### Opciones
- [x] Sliding window de tamaño variable: la combinación «subarreglo contiguo» + «el más largo que cumple una restricción acumulativa» es la firma textual de la ventana variable, y como los elementos son no negativos la suma crece monótonamente al expandir — la plantilla expandir-siempre (for) / contraer-con-while aplica directo.
- Prefix sums + hashmap, porque cualquier enunciado que mencione «suma de un subarreglo» se resuelve acumulando prefijos y consultando un hashmap.
- Two pointers de extremos opuestos, porque siempre que haya dos índices moviéndose sobre el mismo arreglo esa es la técnica.
- Binary search sobre la respuesta, porque piden «el más largo» y eso es optimizar un valor.

### Justificación
Es la señal central del libro: «contiguo» + «más largo/corto que cumple X» → ventana variable, y debe tomarte segundos, no minutos. La monotonía la garantizan los no-negativos (expandir solo sube la suma). Prefix sums + hashmap es la técnica de la FRONTERA opuesta — «subarreglo con suma exacta con negativos permitidos» — no la de «el más largo con suma acotada y no-negativos» (confundir las dos es justo lo que el libro te entrena a no hacer). Extremos opuestos exige «arreglo ORDENADO + par que suma X», no una pregunta de longitud de ventana contigua. Y binary search sobre la respuesta es para «mínimo/máximo X tal que un predicado monótono en el VALOR de la respuesta se cumpla»; aquí la longitud óptima sale de un solo barrido lineal, no de binarizar un `feasible(longitud)` — el enunciado no tiene ese espacio de respuestas que bisecar.

## Ordenado + par que suma X — y por qué mover hacia adentro no se salta la respuesta
type: multiple_choice

«El arreglo está ordenado ascendentemente; decide si existen dos elementos cuya suma sea exactamente X.» Aplicas two pointers de extremos opuestos (izq al inicio, der al final). En cierto paso observas `a[izq] + a[der] < X`. ¿Cuál es la jugada correcta, y cuál es el argumento de por qué NO te saltas ninguna respuesta al hacerla?

### Opciones
- [x] Avanzar izq (izq++): como el arreglo está ordenado, `a[der]` es el sumando más grande disponible para `a[izq]`; si ni con él se alcanza X, ningún `der` menor lo logrará (la suma solo bajaría), así que `a[izq]` no puede formar par con NADIE y se descarta entero — avanzar izq es la única jugada que puede acercarse a X. Esa es la monotonía sobre el arreglo ordenado.
- Retroceder der (der--), para probar sumas más pequeñas antes de descartar `a[izq]`.
- Avanzar izq y retroceder der a la vez, para cerrar el rango al doble de velocidad.
- Reiniciar der al final del arreglo y volver a barrer desde ahí con el nuevo izq.
### Justificación
Es exactamente el «por qué es seguro descartar» de la sección 3: con la suma corta, la información que tienes es que `a[izq]` ya agotó su mejor oportunidad (el mayor `der`), luego se elimina del problema y avanzas izq. Retroceder der baja aún más la suma — te ALEJA de X justo cuando ya te quedaste corto. Mover ambos a la vez puede saltarse el par exacto que se formaba dejando uno de los dos punteros quieto. Y reiniciar der al final en cada paso reintroduce el O(n²) que la técnica existe para matar: el costo O(n) depende de que cada puntero solo avance y nunca retroceda (sección 6).

## Dos arreglos ordenados no es lo mismo que un arreglo con dos extremos
type: multiple_choice

«Dados DOS arreglos, ambos ordenados ascendentemente, devuelve su intersección (los valores presentes en ambos).» Un compañero propone reutilizar la plantilla de extremos opuestos de la sección 3 (izq al inicio y der al final DE UN MISMO arreglo). ¿Por qué es la plantilla equivocada, y cuál es la correcta?

### Opciones
- [x] Extremos opuestos resuelve preguntas sobre pares DENTRO de un solo arreglo ordenado; aquí hay DOS arreglos, así que corresponde el patrón de la sección 5: un puntero en cada arreglo, ambos avanzando hacia adelante, comparando `a[i]` con `b[j]` (el merge de dos punteros). Son familias distintas aunque las dos «usen dos punteros».
- Es correcta: basta concatenar los dos arreglos, reordenar el resultado y correr extremos opuestos sobre él.
- Ninguna variante de two pointers aplica; la intersección de dos arreglos ordenados exige un hashmap sí o sí.
- Es correcta, pero hay que poner izq en el arreglo A y der en el arreglo B moviéndose el uno hacia el otro.
### Justificación
La señal de la sección 5 es literal: «dos arreglos, ambos ordenados» + cualquier verbo de comparación/fusión/conteo cruzado → un puntero por arreglo, ambos hacia adelante (el merge de mergesort y sus variantes). Concatenar y reordenar tira a la basura la estructura ya ordenada de ambos, paga un O(n log n) innecesario y pierde de qué arreglo vino cada valor. Un hashmap resuelve, pero desperdicia el orden gratis que te da O(n) con memoria O(1) — no es que two pointers «no aplique». Y poner izq en A / der en B «moviéndose el uno hacia el otro» no tiene sentido: no son un único eje ordenado, no hay condición de encuentro; el patrón de dos arreglos avanza AMBOS punteros hacia adelante, no uno contra el otro.

## La trampa más cara — cuando un solo negativo mata la monotonía
type: multiple_choice

«Cuenta los subarreglos contiguos cuya suma es exactamente K.» Te lanzas con sliding window (expandir; contraer mientras la suma pase de K). Pasa los ejemplos chicos y falla los grandes. Notas que el arreglo incluye valores NEGATIVOS. ¿Cuál es el diagnóstico de raíz, anclado a por qué la técnica no aplica?

### Opciones
- [x] Con negativos, expandir la ventana ya no hace crecer la suma monótonamente (puede subir y bajar), así que «contraer izquierda cuando la suma se pasa» pierde toda garantía de estar descartando solo lo que no puede ser respuesta — sin monotonía, sliding window es INCORRECTO, no solo lento. La familia correcta es prefix sums + hashmap: para cada posición, pregunta cuántas veces se ha visto el prefijo `prefijo_actual − K`.
- Es un bug de tipos: falta usar un acumulador de 64 bits; con el tipo correcto la ventana da bien.
- Es un off-by-one en el tamaño de la ventana; corrigiendo `der − izq + 1` la ventana da bien.
- Hay que cambiar el `while` de contracción por un `if`, porque con negativos solo se contrae una posición por paso.
### Justificación
Es el error más caro del libro porque no es de sintaxis sino de diseño: la señal para detectarlo de antemano es «¿la operación acumulada es monótona al agregar un elemento?» — con no-negativos sí, con negativos no. Roto eso, contraer la izquierda ya no corresponde a descartar algo imposible, y el barrido cuenta mal. La cura es cambiar de FAMILIA (prefix sums + hashmap), no parchar la ventana. El overflow es un bug real pero distinto: no arregla un error de monotonía. El off-by-one es cosmético y no explicaría «pasa los chicos, falla los grandes» de forma estructural. Y cambiar `while` por `if` empeora las cosas — el libro es tajante: siempre `while`, nunca `if`, para contraer.

## Un solo `if` no basta para contraer
type: trace

Este código pretende contar subarreglos contiguos con suma ≤ K sobre un arreglo de no-negativos, pero usa `if (suma > K)` donde la plantilla exige `while (suma > K)`:

```python
izq = 0; suma = 0; conteo = 0
for der in range(len(a)):
    suma += a[der]
    if suma > K:        # BUG: deberia ser while
        suma -= a[izq]
        izq += 1
    conteo += der - izq + 1
```

Con `a = [2, 1, 5]` y `K = 3`, ¿qué produce y por qué?

### Opciones
- [x] En der=2 la suma es 2+1+5=8; el único `if` resta `a[0]=2` y deja izq=1 con suma=6, que SIGUE siendo mayor que 3 (ventana inválida). Como la contracción se detuvo antes de tiempo, `der − izq + 1 = 2` suma dos subarreglos que violan la condición ([1,5]=6 y [5]=5), y el conteo termina en 5 en vez de 3. Con `while`, izq avanzaría hasta 3 y ese paso aportaría 0.
- El conteo sale correcto (3): `if` y `while` son equivalentes mientras el arreglo no tenga negativos.
- Se produce un error de índice fuera de rango porque izq sobrepasa a der.
- El conteo sale corrido por exactamente 1 (da 4) por un off-by-one en `der − izq + 1`.
### Justificación
Verificado a mano: los subarreglos válidos de [2,1,5] con suma ≤ 3 son [2], [2,1] y [1] — exactamente 3. El `if` deja la ventana inválida (suma 6 > 3) porque un solo elemento grande puede exigir contraer VARIAS posiciones de golpe, y contar `der − izq + 1` sobre una ventana inválida sobrecuenta ([1,5] y [5] no cumplen). No son equivalentes ni con no-negativos: ese es precisamente el caso que rompe el `if`. No hay error de índice — el bug es silencioso, que es lo que lo hace caro. Y no es off-by-one: el `+ 1` es correcto; lo que falla es la contracción incompleta. La regla del libro: siempre `while`, nunca `if`, sin excepción.

## Un `for` con un `while` adentro que NO es O(n²)
type: complexity

La plantilla de ventana variable tiene un `for` (que mueve `der`) con un `while` anidado (que mueve `izq`). A primera vista «bucle dentro de bucle» grita O(n²). ¿Cuál es la complejidad REAL de un barrido completo, y por qué?

### Opciones
- [x] O(n): `izq` y `der` solo avanzan, nunca retroceden, y cada uno recorre a lo más n posiciones EN TOTAL a lo largo de toda la ejecución; el trabajo acumulado del `while` sobre el algoritmo completo está acotado por n — no n por cada posición de `der`, sino n en total. Es el mismo argumento amortizado de los arrays dinámicos.
- O(n²): el `while` anidado puede correr hasta n veces por cada una de las n posiciones de `der`.
- O(n log n): el `while` interno se comporta como una búsqueda binaria sobre la ventana.
- O(n·K): el `while` corre un número de veces proporcional al valor de K en cada paso.
### Justificación
Es el argumento amortizado de la sección 6, y la opción O(n²) es la trampa exacta: cuenta el `while` como «n por cada der», pero `izq` es COMPARTIDO entre todas las iteraciones del `for` y nunca se reinicia — su avance total está acotado por n. Una sola iteración del `for` puede, en el peor caso puntual, disparar varias del `while`, pero la SUMA sobre toda la ejecución sigue siendo ≤ n. No hay halving, así que no es O(n log n) (no confundas «explota monotonía» con «divide el espacio a la mitad»). Y el número de contracciones lo acota el movimiento de índices, no el VALOR de K, así que O(n·K) confunde la cota del bucle con una magnitud del dato.

## Cuando el arreglo NO viene ordenado — quién domina el costo
type: complexity

Un problema pide «¿existe un par que sume X?» sobre un arreglo de n elementos que NO viene ordenado. Aplicas la plantilla de la sección 3: primero ORDENAS, luego haces la pasada de dos punteros de extremos opuestos. ¿Cuál es la complejidad TOTAL, y qué la domina?

### Opciones
- [x] O(n log n): ordenar cuesta O(n log n) y la pasada de dos punteros cuesta O(n); el total es su suma, dominada por el ordenamiento. La pasada lineal es «gratis» frente al sort, pero no puedes reclamar O(n) global porque ordenar es un prerequisito real del método cuando el arreglo no viene ordenado.
- O(n): la pasada de dos punteros es O(n), así que el algoritmo completo es O(n).
- O(n²): ordenar y luego barrer con dos índices equivale a comparar todos los pares.
- O(log n): la búsqueda con dos punteros descarta la mitad del espacio en cada paso.
### Justificación
La plantilla de la sección 3 ordena primero (`a.sort()` antes del `while`), y la pasada es O(n) (sección 6), así que el total es O(n log n) + O(n) = O(n log n). Reclamar O(n) olvida el sort obligatorio — y el matiz clave: si el arreglo LLEGARA ya ordenado, entonces sí sería O(n); el costo depende de si ordenar cuenta como trabajo. O(n²) es justamente lo que two pointers EVITA (su razón de existir). Y O(log n) confunde two pointers con binary search: two pointers es un barrido lineal con avance monótono, no un halving del espacio.

## Plantilla: la ventana variable más larga con suma ≤ K
type: code

Implementa el corazón de la ventana variable de tamaño variable como función PURA. Este es un drill de PLANTILLA validado contra casos unitarios locales — no es un juez de contest ni emite veredicto «Accepted»; el veredicto real de un problema lo da el juez externo. Aquí solo entrenas el molde: expandir `der` SIEMPRE, contraer `izq` con `while` mientras la ventana viole la condición, y medir la ventana con `der − izq + 1`.

### Especificación
`longestSubarrayAtMostK(a, K)`:
- `a` es un arreglo de enteros NO negativos; `K ≥ 0`.
- Devuelve la LONGITUD (entero) del subarreglo contiguo más largo cuya suma sea `≤ K`.
- Si ningún subarreglo no vacío cumple (todo elemento individual excede K), devuelve `0`. Arreglo vacío → `0`.

### Firma
```javascript
function longestSubarrayAtMostK(a, K) {
  // TODO: expande der SIEMPRE; contrae izq con while mientras suma > K
  return 0;
}
```
```python
def longest_subarray_at_most_k(a, K):
    # TODO: expande der SIEMPRE; contrae izq con while mientras suma > K
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5], 5], "expected": 2 },
  { "input": [[], 5], "expected": 0 },
  { "input": [[10], 5], "expected": 0 },
  { "input": [[5], 5], "expected": 1 },
  { "input": [[1, 1, 1, 1], 10], "expected": 4 },
  { "input": [[2, 1, 5, 1, 3, 2], 8], "expected": 3 },
  { "input": [[0, 0, 0], 0], "expected": 3 }
]
```

### Solución
```javascript
function longestSubarrayAtMostK(a, K) {
  let izq = 0, suma = 0, mejor = 0;
  for (let der = 0; der < a.length; der++) {
    suma += a[der];              // expandir SIEMPRE primero
    while (suma > K) {           // contraer mientras se viole (nunca un solo if)
      suma -= a[izq];
      izq++;
    }
    mejor = Math.max(mejor, der - izq + 1);  // ventana valida aqui (o vacia = 0)
  }
  return mejor;
}
```
```python
def longest_subarray_at_most_k(a, K):
    izq = 0
    suma = 0
    mejor = 0
    for der in range(len(a)):
        suma += a[der]              # expandir SIEMPRE primero
        while suma > K:             # contraer mientras se viole (nunca un solo if)
            suma -= a[izq]
            izq += 1
        mejor = max(mejor, der - izq + 1)  # ventana valida aqui (o vacia = 0)
    return mejor
```

### Pistas
- El orden importa: `for der` (expandir) es incondicional y externo; `while` (contraer) es condicional e interno. Nunca un `if` para contraer.
- El tamaño de la ventana es `der − izq + 1`, no `der − izq`.
- Cuando un elemento solo ya excede K, la contracción empuja `izq` hasta `der + 1`: la ventana queda vacía y `der − izq + 1 = 0` (con no-negativos y `K ≥ 0` el `while` para solo, sin desbordar).

## Plantilla: contar pares con suma ≤ X en un arreglo ordenado
type: code

Implementa el truco de conteo de two pointers en arreglo ordenado como función PURA. Drill de plantilla, validado localmente — no es un juez. La idea clave: tras ordenar, cuando `a[izq] + a[der] ≤ X`, entonces `a[izq]` forma un par válido con TODOS los elementos entre `izq+1` y `der` (todos son `≤ a[der]`), así que puedes sumar `der − izq` pares de golpe y avanzar `izq`; si la suma se pasa, retrocede `der`.

### Especificación
`countPairsAtMost(a, X)`:
- Cuenta los pares NO ordenados de índices `(i, j)` con `i < j` tales que `a[i] + a[j] ≤ X`.
- La función ORDENA internamente (contar por valor no cambia la respuesta), así que `a` puede venir en cualquier orden.
- Arreglo vacío o de un solo elemento → `0` (no hay pares).

### Firma
```javascript
function countPairsAtMost(a, X) {
  // TODO: ordena; izq/der en los extremos; suma el salto (der - izq) cuando cabe
  return 0;
}
```
```python
def count_pairs_at_most(a, X):
    # TODO: ordena; izq/der en los extremos; suma el salto (der - izq) cuando cabe
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4], 5], "expected": 4 },
  { "input": [[], 5], "expected": 0 },
  { "input": [[5], 5], "expected": 0 },
  { "input": [[1, 1, 1, 1], 2], "expected": 6 },
  { "input": [[3, 1, 4, 1, 5, 9, 2, 6], 7], "expected": 15 },
  { "input": [[10, 20, 30], 5], "expected": 0 },
  { "input": [[2, 2, 2], 4], "expected": 3 }
]
```

### Solución
```javascript
function countPairsAtMost(a, X) {
  const b = [...a].sort((x, y) => x - y);   // comparador NUMERICO (no el lexicografico por defecto)
  let izq = 0, der = b.length - 1, count = 0;
  while (izq < der) {
    if (b[izq] + b[der] <= X) {
      count += der - izq;   // a[izq] pareado con todo izq+1..der
      izq++;
    } else {
      der--;
    }
  }
  return count;
}
```
```python
def count_pairs_at_most(a, X):
    b = sorted(a)
    izq, der = 0, len(b) - 1
    count = 0
    while izq < der:
        if b[izq] + b[der] <= X:
            count += der - izq   # a[izq] pareado con todo izq+1..der
            izq += 1
        else:
            der -= 1
    return count
```

### Pistas
- Ordena primero — la técnica de extremos opuestos depende del orden.
- Cuando `a[izq] + a[der] ≤ X`, no cuentes uno por uno: suma `der − izq` de golpe y avanza `izq`. Si se pasa, la ÚNICA jugada es `der--`.
- En JavaScript, `sort()` por defecto ordena como STRINGS (`10 < 2`); usa el comparador numérico `(x, y) => x - y` o el conteo saldrá mal.

## El tamaño de la ventana es `der − izq + 1`, no `der − izq`
type: trace

Una ventana ocupa los índices `izq = 2` hasta `der = 5` (ambos inclusive). El código actualiza el mejor resultado con `der − izq` en lugar de `der − izq + 1`. ¿Cuál es el síntoma exacto de este error en contest?

### Opciones
- [x] La ventana [2..5] tiene 4 elementos (índices 2, 3, 4, 5), pero `der − izq = 3` reporta 3: el resultado sale sistemáticamente CORTO por 1 en toda ventana. Es un bug que «casi» pasa — los tests chicos pueden coincidir por casualidad y solo se delata cuando la longitud correcta importa, así que tarda más en encontrarse de lo que tardó en escribirse.
- No hay error: `der − izq` y `der − izq + 1` dan lo mismo mientras la ventana no esté vacía.
- Cuenta de MÁS por 1 (reporta 5 en vez de 4), inflando toda longitud.
- Provoca un acceso fuera de rango al leer `a[der + 1]`.
### Justificación
El número de enteros en el rango cerrado [izq, der] es `der − izq + 1`: de 2 a 5 hay 4, no 3. Quitar el `+ 1` resta exactamente 1 a cada longitud — un undercount sistemático, no un overcount (así que «da 5» es falso: da 3). No son iguales salvo el caso degenerado, y para ventanas reales difieren siempre por 1. Y no hay acceso fuera de rango: es un error aritmético sobre la LONGITUD, no una indexación del arreglo. El libro lo marca como trampa de tiempo real precisamente porque «casi» pasa los tests pequeños y esconde el bug bajo el reloj.
