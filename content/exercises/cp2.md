---
module_id: cd000000-0000-4000-8000-000000000002
spine: Competitiva
title: Ejercicios — Binary search
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp2-binary-search.md)
version: 1
---

# Binary search — banco de reconocimiento

Banco de reflejo competitivo (Competitiva): cada ejercicio entrena el salto que este libro enseña — de «buscar un dato en un arreglo ordenado» a «buscar la RESPUESTA binarizando un predicado monótono `feasible(X)`». Reconocer la señal en segundos (límites enormes + «mínimo/máximo X tal que…»), oler cuándo NO hay monotonía, y teclear la plantilla `lo < hi` sin dudar. Los dos ejercicios de código son drills de PLANTILLA validados contra casos unitarios locales; NO son el juez de Codeforces ni emiten veredicto «Accepted» — el veredicto real de un problema lo da el juez externo. Todo anclado a `cp2-binary-search.md`.

## Límites enormes + «mínimo X tal que sea posible» = binariza la respuesta
type: multiple_choice

«Tienes n máquinas; la máquina i tarda `t_i` segundos por producto y todas trabajan en paralelo. ¿Cuál es el tiempo MÍNIMO para fabricar al menos P productos en total?» Con n hasta 10⁵ y `t_i`, P hasta 10⁹. ¿Qué patrón dispara tu reflejo, y por qué?

### Opciones
- [x] Binary search sobre la respuesta: binarizas el TIEMPO candidato X, con `feasible(X)` = «¿se fabrican ≥ P productos en X segundos?» = suma de ⌊X / t_i⌋ sobre todas las máquinas, que es monótona (más tiempo nunca produce menos). Los límites enormes descartan iterar linealmente sobre todos los tiempos posibles, y verificar un X es barato — esa combinación es la firma del libro.
- Ordenar las máquinas por `t_i` y con dos punteros de extremos opuestos emparejar la más rápida con la más lenta.
- Prefix sums sobre los `t_i` para responder cada consulta de rango en O(1).
- Iterar X = 1, 2, 3, … y devolver el primer X factible; con límites hasta 10⁹ es de sobra rápido.
### Justificación
El enunciado calca la señal de la sección de reconocimiento: «¿es posible lograr el objetivo con tiempo X?» seguido de «encuentra el X óptimo», con límites que gritan «no puedo barrer todas las respuestas». El predicado `feasible(X) = Σ⌊X/t_i⌋ ≥ P` es monótono, que es la condición indispensable. Extremos opuestos resuelve pares en un arreglo ordenado — aquí no hay pregunta de pares. Prefix sums responde consultas de rango — aquí no hay ninguna consulta de rango. Y iterar X de 1 en 1 hasta 10⁹ es EXACTAMENTE lo que los límites enormes prohíben: ese barrido lineal sobre el espacio de respuestas es lo que binary search on answer reemplaza (por eso se vuelve indispensable cuando el rango es grande).

## «Minimiza el máximo» — el estampado de binary search on answer
type: multiple_choice

«Divide un arreglo de n enteros positivos en K subarreglos CONTIGUOS; minimiza la suma MÁXIMA entre esos subarreglos.» ¿Qué patrón aplica, y cómo se ve `feasible(X)`?

### Opciones
- [x] Binary search on answer en su forma min-max: binarizas el candidato X = «la suma máxima permitida por grupo»; `feasible(X)` recorre el arreglo de forma greedy abriendo un grupo nuevo cada vez que agregar el siguiente elemento pasaría de X, y responde «¿bastaron ≤ K grupos?». Es monótona (si X sirve, todo X mayor también), y «minimiza el máximo» es casi universalmente la señal de este patrón.
- Two pointers de ventana variable: expandes hasta que la suma pasa un umbral fijo y ahí cortas un grupo.
- Programación dinámica pura sobre todas las particiones, sin binary search, porque «minimizar» exige explorar el óptimo exacto.
- Prefix sums para calcular cada suma de grupo en O(1), lo cual ya resuelve el problema por sí solo.
### Justificación
«Minimiza el máximo / maximiza el mínimo» es la señal casi universal de binary search on answer, y la sección de Conexiones lo dice explícito: `feasible(X)` de «¿puedo particionar en K grupos con cada grupo ≤ X?» es un greedy O(n) que cuenta particiones — la composición «binary search afuera, greedy adentro». La ventana variable necesita un umbral FIJO, pero aquí el umbral X es justo lo que estás BUSCANDO (esa es la capa de binary search). La DP pura sobre particiones es un martillo demasiado grande y pierde que la factibilidad es un check greedy barato. Y prefix sums es un auxiliar para sumar rápido, pero por sí solo no decide el X óptimo — sigues necesitando la búsqueda más la verificación.

## Cuándo es binary search «de toda la vida» y no on-answer
type: multiple_choice

«El arreglo ya viene ordenado ascendentemente; devuelve la posición del primer elemento `≥ X`.» ¿Cuál es la lectura correcta de este enunciado?

### Opciones
- [x] Es binary search CLÁSICO (buscar un límite en un arreglo ordenado — la plantilla lower_bound de la sección 2): el dato ya existe en la estructura ordenada y buscas la primera posición donde una condición monótona (`a[i] ≥ X`) se vuelve verdadera. No hace falta construir un `feasible(X)` externo; la condición se evalúa directo sobre `a[mid]`.
- Es binary search on answer: hay que binarizar el espacio de valores de X construyendo un predicado `feasible`.
- No es binary search: «primer elemento ≥ X» exige un barrido lineal porque el arreglo podría tener duplicados.
- Es two pointers de extremos opuestos sobre el arreglo ordenado.
### Justificación
La señal de la sección de reconocimiento para el clásico es literal: «arreglo ordenado + primer elemento ≥ X». El libro contrasta las dos variantes: el clásico busca una POSICIÓN en datos ya ordenados; on-answer busca un UMBRAL en el espacio de respuestas verificando cada candidato con `feasible`. Aquí no hay espacio de respuestas que bisecar — la condición se lee directo de `a[mid]`, así que montar un `feasible` externo sería aplicar on-answer donde no toca. Los duplicados NO rompen binary search: lower_bound los maneja devolviendo el índice más a la izquierda que cumple (justo lo que hace la plantilla). Y two pointers resuelve pares/ventanas, no «primera posición ≥ X».

## El predicado que dice True, False, True — y por qué no truena
type: multiple_choice

Modelas un problema como binary search on answer, pero al probar a mano `feasible(X)` con X = 3, 5, 7 obtienes True, False, True. Corres tu binary search y entrega UNA respuesta, sin ningún error en tiempo de ejecución. ¿Qué está pasando y qué debes concluir?

### Opciones
- [x] `feasible` NO es monótono, así que la premisa de binary search (descartar media zona porque la respuesta no puede estar ahí) es falsa: la búsqueda puede saltarse la respuesta correcta y devolver una equivocada, y lo hace EN SILENCIO — corre y termina sin error visible. La conclusión es que binary search no aplica a este modelado; hay que rehacer el predicado (o reformular el problema) para que sea monótono, o usar otra técnica.
- Es un overflow en `mid = (lo + hi) / 2`; con `mid = lo + (hi − lo) / 2` el predicado se vuelve monótono.
- Es correcto: binary search siempre encuentra ALGÚN X factible, y con True en X=7 basta para garantizar que la respuesta es válida.
- Es un problema de precisión de punto flotante; subiendo el número de iteraciones a 200 se corrige.
### Justificación
La condición indispensable del libro es la monotonía de `feasible(X)`; sin ella, descartar la mitad del espacio es simplemente incorrecto, no una optimización, y el síntoma característico es que «da mal sin ningún error visible» — el código corre y termina. El consejo del libro es exactamente lo que hiciste: probar `feasible` con 3-4 valores crecientes ANTES de comprometerte; True/False/True es la prueba de que no apliques la técnica. El overflow es un bug real pero ortogonal (no tiene nada que ver con la monotonía). «Encuentra ALGÚN X factible» es falso: un X factible cualquiera no es el óptimo/correcto, y sin monotonía la búsqueda puede errar el umbral. Y la precisión/iteraciones es de la variante sobre reales, no de un predicado no monótono. La lección: sin error visible ≠ correcto.

## `lo = mid` sin el `+ 1` — el bucle que nunca termina
type: trace

Este binary search busca la primera posición con `a[i] ≥ objetivo`, pero en la rama `else` escribe `lo = mid` en vez de `lo = mid + 1`:

```python
lo, hi = 0, len(a)
while lo < hi:
    mid = (lo + hi) // 2
    if a[mid] >= objetivo:
        hi = mid
    else:
        lo = mid        # BUG: deberia ser lo = mid + 1
return lo
```

Con `a = [1, 2]` y `objetivo = 5`, ¿qué ocurre?

### Opciones
- [x] El rango se reduce a dos posiciones adyacentes y ahí se atasca: lo=0, hi=2 → mid=1, `a[1]=2 < 5` → lo=1; luego lo=1, hi=2 → mid=1 otra vez, y `lo = mid` deja lo=1 SIN cambio → el rango nunca se estrecha y el `while` gira para siempre. La plantilla exige `lo = mid + 1` porque mid YA se probó y NO cumplió, así que excluirlo es seguro y además necesario para que `lo` avance.
- Termina, pero devuelve una posición corrida por 1 (da 1 en vez de 2).
- Termina de inmediato con un acceso fuera de rango al leer `a[mid]`.
- Termina bien: `lo = mid` y `lo = mid + 1` son equivalentes cuando el objetivo es mayor que todos los elementos.
### Justificación
Verificado a mano: cuando `hi = lo + 1`, entonces `mid = (lo + hi) // 2 = lo`, y si la condición es falsa, `lo = mid = lo` no avanza — bucle infinito, la causa más común de «el bucle que no termina» del libro. La asimetría correcta es `hi = mid` (mid PODRÍA ser la respuesta) frente a `lo = mid + 1` (mid definitivamente NO lo es, así que se excluye); ese `+ 1` es justo lo que garantiza progreso cuando mid coincide con lo. Como no termina, «devuelve 1» y «termina bien» son ambas falsas. No hay acceso fuera de rango: mid=1 es un índice válido. El libro insiste: memoriza un solo estilo de plantilla (`lo < hi`, `hi` exclusivo) y no lo mezcles a medio problema.

## log de QUÉ, exactamente — n o el rango de la respuesta
type: complexity

En binary search on answer, la respuesta puede valer entre 1 y R = 10⁹, y cada evaluación de `feasible(X)` recorre los n = 10⁵ elementos una vez. ¿Cuál es la complejidad total, y sobre qué cantidad se toma el logaritmo?

### Opciones
- [x] O(n · log R): el logaritmo es sobre R, el RANGO de valores posibles de la respuesta (no sobre n, el tamaño del arreglo), porque lo que se biseca es el espacio de respuestas; cada uno de los ⌈log₂R⌉ ≈ 30 pasos paga el costo de `feasible`, que es O(n). Aquí ≈ 10⁵ · 30 ≈ 3×10⁶ operaciones.
- O(log n): binary search siempre es logarítmico en el tamaño del arreglo, sin importar `feasible`.
- O(n): `feasible` es O(n) y la búsqueda solo lo llama un número constante de veces.
- O(R): hay que recorrer todos los valores posibles de la respuesta de 1 a R.
### Justificación
La sección 1 lo fija: sobre un espacio de respuestas de tamaño R, el costo es O(log R × costo de `feasible`). La sutileza que el libro subraya es que el log va sobre R (el rango de la RESPUESTA), no sobre n (el tamaño del arreglo) — son cosas distintas y suelen tener magnitudes muy distintas. O(log n) yerra en las dos cosas: confunde el eje (R, no n) y olvida que cada paso cuesta `feasible`. O(n) olvida que la búsqueda llama a `feasible` log R veces, no un número constante. Y O(R) es precisamente el barrido lineal sobre el espacio de respuestas que binary search REEMPLAZA — la razón de ser de la técnica cuando R es enorme.

## Reales: por qué 100 iteraciones fijas y no `while hi − lo > epsilon`
type: multiple_choice

El espacio de respuestas es CONTINUO (la respuesta puede ser cualquier real, no solo entero). Un compañero insiste en `while (hi − lo > epsilon)` con doubles. ¿Por qué el libro prefiere un número FIJO de iteraciones (p.ej. 100)?

### Opciones
- [x] Con un `epsilon` te expones a dos fallas simétricas: elegirlo muy grande termina ANTES de alcanzar la precisión que el problema exige, y elegirlo muy chico puede hacer que el bucle NUNCA converja por el error inherente del punto flotante (la resta `hi − lo` se estanca por encima de ese epsilon). Un número fijo de iteraciones parte el intervalo a la mitad cada vez —tras 100 pasos, ancho inicial / 2¹⁰⁰— dando precisión de sobra sin ningún riesgo de no-terminación.
- Porque un número fijo de iteraciones es asintóticamente más rápido que el bucle con epsilon.
- Porque sobre reales no se puede usar `hi = mid`; hay que usar `hi = mid − 1`, y eso obliga a contar iteraciones.
- Porque el punto flotante hace que binary search sobre reales sea incorrecto, salvo que se redondee la respuesta a entero al final.
### Justificación
Es el argumento de la sección 4 y de Trampas: `epsilon` demasiado grande da error inaceptable; demasiado chico puede colgar el bucle por límites de punto flotante. Las iteraciones fijas (100-200) garantizan precisión Y terminación a la vez. No es cuestión de velocidad asintótica — ambos son lineales en el número de iteraciones; el punto es corrección y terminación segura. `hi = mid` es EXACTAMENTE lo que se usa en la plantilla de reales (`hi = mid − 1` es la variante de intervalo cerrado sobre enteros, que aquí no aplica). Y binary search sobre reales es correcto —es de lo que trata toda la sección—: no se redondea a entero, la respuesta es genuinamente real.

## Plantilla: lower_bound (primer índice con a[i] ≥ objetivo)
type: code

Implementa la plantilla clásica de la sección 2 como función PURA: encontrar la primera posición donde una condición monótona se vuelve verdadera. Drill de plantilla validado localmente — no es un juez. Memoriza UN estilo: `lo < hi` con `hi` exclusivo, `hi = mid` cuando la condición se cumple (mid podría ser la respuesta, no lo descartes), `lo = mid + 1` cuando no (mid definitivamente no lo es).

### Especificación
`lowerBound(a, target)`:
- `a` está ordenado ascendentemente.
- Devuelve el menor índice `i` tal que `a[i] >= target`, o `a.length` (`len(a)`) si ningún elemento cumple.
- Arreglo vacío → `0`.
- Con duplicados del `target`, devuelve el índice MÁS A LA IZQUIERDA que cumple.

### Firma
```javascript
function lowerBound(a, target) {
  // TODO: lo/hi con hi exclusivo; hi = mid si a[mid] >= target, si no lo = mid + 1
  return 0;
}
```
```python
def lower_bound(a, target):
    # TODO: lo/hi con hi exclusivo; hi = mid si a[mid] >= target, si no lo = mid + 1
    return 0
```

### Casos
```json
[
  { "input": [[1, 3, 5, 7, 9], 5], "expected": 2 },
  { "input": [[1, 3, 5, 7, 9], 6], "expected": 3 },
  { "input": [[1, 3, 5, 7, 9], 0], "expected": 0 },
  { "input": [[1, 3, 5, 7, 9], 10], "expected": 5 },
  { "input": [[], 5], "expected": 0 },
  { "input": [[2, 2, 2, 2], 2], "expected": 0 },
  { "input": [[5], 5], "expected": 0 },
  { "input": [[5], 6], "expected": 1 }
]
```

### Solución
```javascript
function lowerBound(a, target) {
  let lo = 0, hi = a.length;          // hi EXCLUSIVO
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);  // evita sumar dos grandes antes de dividir
    if (a[mid] >= target) hi = mid;   // mid podria ser la respuesta: no lo descartes
    else lo = mid + 1;                // mid NO cumple: exclúyelo
  }
  return lo;
}
```
```python
def lower_bound(a, target):
    lo, hi = 0, len(a)          # hi EXCLUSIVO
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if a[mid] >= target:    # mid podria ser la respuesta: no lo descartes
            hi = mid
        else:
            lo = mid + 1        # mid NO cumple: exclúyelo
    return lo
```

### Pistas
- `hi` empieza en `len(a)` (exclusivo): así el «no encontrado» devuelve `len(a)` de forma natural.
- La asimetría es la clave y la fuente número uno de bugs: `hi = mid` (conserva mid como candidato) vs `lo = mid + 1` (descarta mid). No la mezcles.
- El bucle termina cuando `lo == hi`, y ese valor ES la primera posición verdadera (o `len(a)` si nunca lo fue).

## Plantilla: binary search on answer — minimiza la suma máxima al partir en K
type: code

Implementa el salto conceptual de la sección 3 como función PURA: `lo`/`hi` ya no son índices de un arreglo, son el RANGO de valores posibles de la respuesta, y el corazón es un `feasible(X)` greedy. Drill de plantilla validado localmente — no es un juez; el veredicto real de un problema lo da el juez externo. Aquí el candidato X es «la suma máxima permitida por grupo», y `feasible(X)` cuenta cuántos grupos contiguos se necesitan si ninguno puede pasar de X.

### Especificación
`minLargestSum(a, K)`:
- `a` es un arreglo de enteros POSITIVOS; `K ≥ 1` es el número MÁXIMO de subarreglos contiguos no vacíos.
- Devuelve la mínima «suma máxima» posible al partir `a` en a lo más K subarreglos contiguos.
- Casos límite naturales: `K = 1` → suma total; `K ≥ len(a)` → el elemento máximo. Arreglo vacío → `0`.
- La cota inferior de la respuesta es `max(a)` (ningún grupo puede sumar menos que su mayor elemento); la cota superior es `sum(a)` (un solo grupo).

### Firma
```javascript
function minLargestSum(a, K) {
  // TODO: lo = max(a), hi = sum(a); feasible(X) greedy cuenta grupos; hi = mid / lo = mid + 1
  return 0;
}
```
```python
def min_largest_sum(a, K):
    # TODO: lo = max(a), hi = sum(a); feasible(X) greedy cuenta grupos; hi = mid / lo = mid + 1
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5], 2], "expected": 9 },
  { "input": [[1, 2, 3, 4, 5], 1], "expected": 15 },
  { "input": [[1, 2, 3, 4, 5], 5], "expected": 5 },
  { "input": [[5], 1], "expected": 5 },
  { "input": [[7, 2, 5, 10, 8], 2], "expected": 18 },
  { "input": [[2, 2, 2, 2], 2], "expected": 4 },
  { "input": [[], 3], "expected": 0 }
]
```

### Solución
```javascript
function minLargestSum(a, K) {
  if (a.length === 0) return 0;
  let lo = Math.max(...a);                 // ningun grupo suma menos que su mayor elemento
  let hi = a.reduce((s, v) => s + v, 0);   // un solo grupo = suma total
  const feasible = (X) => {
    let parts = 1, cur = 0;
    for (const v of a) {
      if (cur + v > X) { parts++; cur = v; }  // abrir grupo nuevo
      else { cur += v; }
    }
    return parts <= K;
  };
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (feasible(mid)) hi = mid;           // X sirve: intenta bajarlo
    else lo = mid + 1;                     // X no alcanza: súbelo
  }
  return lo;
}
```
```python
def min_largest_sum(a, K):
    if not a:
        return 0
    lo = max(a)          # ningun grupo suma menos que su mayor elemento
    hi = sum(a)          # un solo grupo = suma total

    def feasible(X):
        parts = 1
        cur = 0
        for v in a:
            if cur + v > X:      # abrir grupo nuevo
                parts += 1
                cur = v
            else:
                cur += v
        return parts <= K

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):        # X sirve: intenta bajarlo
            hi = mid
        else:
            lo = mid + 1         # X no alcanza: súbelo
    return lo
```

### Pistas
- El esqueleto es IDÉNTICO al de lower_bound (`lo < hi`, `hi = mid` / `lo = mid + 1`) — lo único distinto es que `lo`/`hi`/`mid` son VALORES de la respuesta, no índices.
- Las cotas no son arbitrarias: `lo = max(a)` (un grupo no puede bajar de su mayor elemento) y `hi = sum(a)` (todo en un grupo). La respuesta vive en ese intervalo.
- `feasible(X)` es un greedy O(n): acumula, y cada vez que agregar el siguiente pasaría de X, cierra el grupo y abre otro. La respuesta es «¿bastaron ≤ K grupos?».

## ¿Se mueve un índice o el valor de la respuesta? — la frontera con two pointers
type: multiple_choice

Tu instinto dice «esto huele a monotonía», pero no sabes si es two pointers (CP1) o binary search on answer (CP2). Según el libro, ¿cuál es la pregunta ÚNICA que decide entre ambas técnicas?

### Opciones
- [x] ¿La variable que se mueve es un ÍNDICE del arreglo o el VALOR candidato de la respuesta? Two pointers recorre linealmente explotando monotonía de POSICIÓN en el arreglo; binary search on answer biseca el espacio de VALORES posibles de la respuesta. La monotonía existe en ambos, pero sobre estructuras distintas, y eso decide la técnica.
- ¿El arreglo está ordenado? Si lo está siempre es binary search; si no, siempre es two pointers.
- ¿La complejidad objetivo es O(n) o O(log n)? O(n) obliga a two pointers y O(log n) a binary search, sin más criterio.
- ¿Cuántos punteros hay en el código? Con dos es two pointers; con `lo` y `hi` (que también son dos) es binary search.
### Justificación
Es el criterio literal de la sección de Trade-offs: pregúntate si la variable que se mueve es un índice del arreglo o el valor candidato de la respuesta. Comparten el principio de «descartar parte del espacio por monotonía», pero aplicado a estructuras distintas — no los confundas por compartir vocabulario. «¿Está ordenado?» no es el discriminador: binary search on answer corre a menudo sobre entrada NO ordenada (en Factory Machines binarizas el tiempo, no ordenas las máquinas). La complejidad objetivo es una consecuencia, no el criterio (y two pointers puede llevar un sort que lo hace O(n log n), mientras el costo de binary search depende de `feasible`). Y contar punteros (`izq`/`der` vs `lo`/`hi`) es sintaxis superficial: ambos «tienen dos», así que no decide nada. El eje real es posición-en-arreglo vs valor-de-la-respuesta.
