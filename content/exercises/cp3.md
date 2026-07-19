---
module_id: cd000000-0000-4000-8000-000000000003
spine: Competitiva
title: Ejercicios — Prefix sums y difference arrays
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp3-prefix-sums.md)
version: 1
---

# Prefix sums y difference arrays — banco competitivo

Banco de reconocimiento bajo el reloj: cada ejercicio entrena el reflejo de VER la señal (¿arreglo estático con muchas consultas de suma? ¿muchas actualizaciones de rango con solo el resultado final?) y teclear la plantilla correcta sin pensar. Los ejercicios de código destilan las dos plantillas núcleo del libro —consulta de suma de rango con prefix sums, y actualización de rango con difference array— como funciones puras validadas localmente (NO son un juez de contest). Todo está anclado a las señales, plantillas y trampas que este libro realmente enseña.

## La señal de prefix sums estático
type: multiple_choice

Un problema te da un arreglo de n enteros que NO se modifica y luego Q consultas, cada una de la forma "suma del rango [l, r]". Tanto n como Q pueden llegar a 2·10⁵. Bajo el reloj, ¿qué técnica reconoces y cuál es la señal EXACTA que la dispara?

### Opciones
- [x] Prefix sums: la señal es "muchas consultas de suma de rango" + "el arreglo no cambia entre consultas". Precomputas el arreglo de sumas acumuladas una vez en O(n) y respondes cada consulta con una sola resta `prefix[r+1] - prefix[l]`, O(1).
- Un Fenwick tree o segment tree, porque cualquier problema con consultas de rango sobre un arreglo grande los exige por defecto.
- Recalcular la suma de cada rango con un lazo de l a r por consulta; con n y Q de este tamaño sigue siendo suficientemente rápido en la práctica.
- Two pointers, deslizando dos índices por cada consulta para acumular la suma del rango sobre la marcha.

### Justificación
Es el reflejo exacto de la sección de señales: "muchas consultas de suma de rango" + "arreglo estático" → prefix sums, en segundos. Pagas O(n) una sola vez al construir y cobras O(1) por consulta para siempre (total O(n+Q)). El Fenwick/segment tree es la generalización que el libro reserva para cuando el arreglo SÍ cambia entre consultas (la "señal de alerta" y los trade-offs) — la pregunta decisiva es "¿el arreglo cambia?", y aquí no cambia, así que traerlos es complejidad innecesaria. Recalcular por consulta es O(n·Q) ≈ 4·10¹⁰ en el peor caso: justo el enfoque naïve contra el que abre el libro, TLE seguro. Two pointers es para otra forma de problema (subarreglo con una propiedad mientras deslizas), no para consultas arbitrarias [l,r]; deslizar por cada consulta sigue siendo O(n) por consulta.

## Prefix sums vs. recomputar — el costo total
type: complexity

Tienes n elementos y Q consultas de suma de rango sobre un arreglo estático. Comparas dos enfoques: (A) recalcular cada consulta con un lazo de l a r; (B) precomputar el arreglo de prefix sums y responder por resta. ¿Cuál es la complejidad total de cada uno y por qué (B) domina cuando Q crece?

### Opciones
- (A) O(n + Q) y (B) O(n·Q): precomputar el prefix siempre cuesta más que responder directo.
- [x] (A) O(n·Q) en el peor caso (cada consulta recorre hasta n elementos, Q veces); (B) O(n + Q): O(n) para construir el prefix UNA sola vez, más O(1) por cada una de las Q consultas.
- (A) O(Q) y (B) O(n): el número de consultas no afecta al enfoque directo.
- Ambos O(n·Q), porque construir el prefix también recorre todos los rangos posibles.

### Justificación
El enfoque directo recorre hasta O(r−l) ≤ O(n) por consulta; con Q consultas, O(n·Q). Prefix sums construye el acumulado con un solo barrido lineal —O(n), una vez— y cada consulta es una resta O(1), para un total O(n+Q). La primera opción invierte los dos (le adjudica el costo caro a prefix sums, que es justo lo que la técnica evita). La tercera ignora que el costo directo escala con AMBOS n y Q. La cuarta es el malentendido central: construir el prefix es una pasada lineal O(n), no un recorrido de "todos los rangos" — pagar O(n) una sola vez es exactamente la idea de la técnica (sección 1).

## Plantilla — consulta de suma de rango
type: code

Destila la plantilla de la sección 2 a su forma pura: dado un arreglo estático y una lista de consultas `[l, r]` (0-indexadas, inclusive en ambos extremos), responde la suma de cada rango. Construye el prefix con la convención del libro (`prefix[0] = 0`, tamaño `n+1`) para que `l = 0` no necesite ninguna rama especial, y responde cada consulta con la resta `prefix[r+1] - prefix[l]`.

### Especificación
`sumasDeRango(a, consultas)` devuelve un arreglo con una suma por cada consulta, en el mismo orden:
- Construye `prefix` de tamaño `n+1` con `prefix[0] = 0` y `prefix[i+1] = prefix[i] + a[i]`.
- Para cada `[l, r]` en `consultas`, la suma del rango `[l, r]` inclusive es `prefix[r+1] - prefix[l]`.
- Si `consultas` está vacío, devuelve un arreglo vacío. El arreglo `a` puede estar vacío si no hay consultas.

### Firma
```javascript
function sumasDeRango(a, consultas) {
  // TODO: construye el prefix (tamaño n+1, prefix[0]=0) y responde cada consulta con una resta
}
```
```python
def sumas_de_rango(a, consultas):
    # TODO: construye el prefix (tamano n+1, prefix[0]=0) y responde cada consulta con una resta
    pass
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5], [[0, 4]]], "expected": [15] },
  { "input": [[1, 2, 3, 4, 5], [[1, 3]]], "expected": [9] },
  { "input": [[1, 2, 3, 4, 5], [[0, 0]]], "expected": [1] },
  { "input": [[1, 2, 3, 4, 5], [[4, 4]]], "expected": [5] },
  { "input": [[1, 2, 3, 4, 5], [[0, 4], [1, 3], [2, 2]]], "expected": [15, 9, 3] },
  { "input": [[-2, 5, -1, 3], [[0, 3], [1, 2]]], "expected": [5, 4] },
  { "input": [[7], [[0, 0]]], "expected": [7] },
  { "input": [[], []], "expected": [] }
]
```

### Solución
```javascript
function sumasDeRango(a, consultas) {
  const n = a.length;
  const prefix = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + a[i];
  const res = [];
  for (let k = 0; k < consultas.length; k++) {
    const l = consultas[k][0];
    const r = consultas[k][1];
    res.push(prefix[r + 1] - prefix[l]);
  }
  return res;
}
```
```python
def sumas_de_rango(a, consultas):
    n = len(a)
    prefix = [0] * (n + 1)
    for i in range(n):
        prefix[i + 1] = prefix[i] + a[i]
    res = []
    for l, r in consultas:
        res.append(prefix[r + 1] - prefix[l])
    return res
```

### Pistas
- El prefix tiene tamaño `n+1`, no `n`: `prefix[0]=0` es el ancla que hace funcionar la consulta con `l=0` sin un `if` aparte.
- La suma inclusiva de `[l, r]` es `prefix[r+1] - prefix[l]`: el `r+1` incluye hasta `a[r]`, y le restas exactamente lo anterior a `l`.
- Con `a` vacío y `consultas` vacío, el resultado es un arreglo vacío: ni construyes ni consultas nada.

### Patrones
- `` `slice\(|subarray|for\s*\([^)]*l[^)]*r` — Si recorres de l a r DENTRO del lazo de consultas, recomputas O(n) por consulta y pierdes el punto: precomputa el prefix UNA vez, fuera. ``

## Trampa — el arreglo cambia entre consultas
type: trace

Un compañero resuelve un problema con prefix sums: construye el prefix una vez al inicio y responde consultas de suma de rango en O(1). Pero el problema, en realidad, intercala operaciones: "asigna el valor v a la posición p" ENTRE las consultas de suma. Su código sigue usando el mismo prefix construido al principio. ¿Qué ocurre y cuál es el diagnóstico correcto?

### Opciones
- El código es correcto: prefix sums maneja actualizaciones de elementos individuales sin costo extra, porque solo cambia una posición a la vez.
- [x] Da respuestas incorrectas a partir de la primera actualización: cambiar la posición p invalida `prefix[p+1..n]`, y reconstruir esa cola cuesta O(n) por update. Es exactamente la "señal de alerta" del libro — consultas Y actualizaciones intercaladas exigen un Fenwick/segment tree (CP8), no prefix sums estático.
- El código truena con un error de índice en la primera actualización, porque el arreglo prefix no tiene espacio para el valor nuevo.
- El código es correcto siempre que reconstruya el prefix entero tras cada actualización; así sigue siendo O(1) por consulta y O(1) por update.

### Justificación
Prefix sums asume un arreglo que no cambia: cada `prefix[i]` con `i > p` incluye el viejo `a[p]`, así que tras una asignación todos quedan obsoletos y las consultas dan de más o de menos —silenciosamente, no truena—. La señal de alerta del libro nombra este caso al pie de la letra: "el arreglo se actualiza entre consultas de suma de rango → eso exige un Fenwick / segment tree, no prefix sums simple". La primera opción es justo la creencia falsa que la alerta desmonta. La tercera inventa un crash de índice que no ocurre (el peligro real es que dé mal sin avisar). La cuarta se contradice: reconstruir el prefix completo tras cada update es O(n) por update, no O(1) — esa ineficiencia es precisamente la que motiva la estructura de CP8.

## La señal de difference array
type: multiple_choice

Otro problema: partes de un arreglo de n ceros y recibes m operaciones de la forma "suma X a todos los elementos del rango [l, r]". Solo te piden el arreglo FINAL después de aplicar las m operaciones (ninguna consulta intermedia). m puede llegar a 10⁵. ¿Qué reconoces y por qué?

### Opciones
- [x] Difference array: la señal es "muchas actualizaciones de rango" + "solo importa el resultado final". Marcas `diff[l] += X` y `diff[r+1] -= X` (dos escrituras O(1) por operación) y reconstruyes con un solo barrido de acumulación al final — O(n + m) total.
- Prefix sums directo sobre el arreglo original, porque cualquier problema con rangos se resuelve con prefix sums.
- Aplicar cada actualización con un lazo de l a r, sumando X posición por posición, porque es lo más directo de escribir.
- Un segment tree con lazy propagation, porque las actualizaciones de rango siempre lo requieren.

### Justificación
El difference array es la operación INVERSA del prefix sum: en vez de consultar sumas sobre un arreglo estático, actualizas rangos enteros barato sobre un arreglo que cambia, cuando solo necesitas el resultado final. Marcas `+X` en `l` y `−X` en `r+1` (dos escrituras O(1)) y una sola pasada de acumulación reconstruye el arreglo — O(n+m). La segunda opción confunde las dos técnicas: prefix sums responde consultas de suma sobre un arreglo estático, no aplica actualizaciones de rango. La tercera es el naïve O(n·m) (hasta 10¹⁰) que el difference array existe para reemplazar. La cuarta trae artillería de más: la lazy propagation se necesita cuando hay consultas INTERCALADAS con las actualizaciones; aquí no hay consultas intermedias, así que el difference array es estrictamente más simple y suficiente.

## Plantilla — actualización de rango
type: code

Destila la plantilla de la sección 4 (la operación inversa): parte de un arreglo de `n` ceros y aplica una lista de actualizaciones `[l, r, x]` (cada una suma `x` a todo el rango `[l, r]` inclusive). Marca los extremos en un arreglo `diff` y reconstruye el arreglo final con un barrido de acumulación. El truco: convertir "suma x a todo el rango" en dos escrituras O(1), difiriendo el costo real a una única pasada al final.

### Especificación
`aplicarActualizaciones(n, actualizaciones)` devuelve el arreglo final de longitud `n`:
- Usa `diff` de tamaño `n+1` (el slot extra permite `diff[r+1]` cuando `r = n-1`).
- Por cada `[l, r, x]`: `diff[l] += x` y `diff[r+1] -= x`.
- Reconstruye acumulando de izquierda a derecha: `resultado[i] = resultado[i-1] + diff[i]` (con acumulado inicial 0).
- Sin actualizaciones, el resultado es `n` ceros.

### Firma
```javascript
function aplicarActualizaciones(n, actualizaciones) {
  // TODO: marca diff[l]+=x y diff[r+1]-=x; luego reconstruye acumulando
}
```
```python
def aplicar_actualizaciones(n, actualizaciones):
    # TODO: marca diff[l]+=x y diff[r+1]-=x; luego reconstruye acumulando
    pass
```

### Casos
```json
[
  { "input": [5, [[0, 4, 3]]], "expected": [3, 3, 3, 3, 3] },
  { "input": [5, [[1, 3, 2]]], "expected": [0, 2, 2, 2, 0] },
  { "input": [5, [[0, 1, 5], [3, 4, 2]]], "expected": [5, 5, 0, 2, 2] },
  { "input": [5, [[0, 4, 1], [1, 3, 10], [2, 2, 100]]], "expected": [1, 11, 111, 11, 1] },
  { "input": [4, [[3, 3, 9]]], "expected": [0, 0, 0, 9] },
  { "input": [4, [[0, 3, 5], [1, 2, -3]]], "expected": [5, 2, 2, 5] },
  { "input": [1, [[0, 0, 7]]], "expected": [7] },
  { "input": [5, []], "expected": [0, 0, 0, 0, 0] }
]
```

### Solución
```javascript
function aplicarActualizaciones(n, actualizaciones) {
  const diff = new Array(n + 1).fill(0);
  for (let k = 0; k < actualizaciones.length; k++) {
    const l = actualizaciones[k][0];
    const r = actualizaciones[k][1];
    const x = actualizaciones[k][2];
    diff[l] += x;
    diff[r + 1] -= x;
  }
  const resultado = new Array(n).fill(0);
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    acumulado += diff[i];
    resultado[i] = acumulado;
  }
  return resultado;
}
```
```python
def aplicar_actualizaciones(n, actualizaciones):
    diff = [0] * (n + 1)
    for l, r, x in actualizaciones:
        diff[l] += x
        diff[r + 1] -= x
    resultado = [0] * n
    acumulado = 0
    for i in range(n):
        acumulado += diff[i]
        resultado[i] = acumulado
    return resultado
```

### Pistas
- `diff` es de tamaño `n+1`, no `n`: cuando `r = n-1`, `diff[r+1]` cae en el último slot y no se desborda.
- El `-x` en `r+1` es lo que CANCELA el incremento a partir de `r+1`: sin él, el `+x` se propagaría hasta el final.
- El paso de acumulación NO es opcional: `diff` por sí solo es el registro de marcas, no los valores reales.

### Patrones
- `` `return\s+diff` — El `diff` NO es el arreglo final: es el registro de incrementos marcados. Falta el barrido de acumulación antes de devolver. ``

## Trampa — usar diff sin reconstruir
type: multiple_choice

Un compañero escribe el difference array: parte de `diff` en ceros y por cada operación "suma X al rango [l, r]" hace `diff[l] += X; diff[r+1] -= X`. Al terminar, devuelve `diff` directamente como el arreglo final. Sus tests pequeños "casi" dan, pero el resultado está mal. ¿Cuál es el error?

### Opciones
- El error es que `diff` debe tener tamaño `n`, no `n+1`; el índice `r+1` corrompe la última posición.
- [x] Le falta el paso de RECONSTRUCCIÓN: `diff` es solo el registro de incrementos marcados, no los valores reales. El arreglo final se obtiene acumulando `diff` de izquierda a derecha (un prefix sum sobre `diff`); sin esa pasada, `diff[i]` no es el valor de la posición `i`. Es un error de lógica, no de sintaxis, y pasa desapercibido.
- El error es que debió usar `diff[l] -= X; diff[r+1] += X`: los signos están invertidos.
- No hay error real: `diff` ya contiene los valores finales; lo que falla es overflow por no usar enteros de 64 bits.

### Justificación
Es la trampa "difference array sin reconstruir" del libro, textual: `diff` guarda las marcas de incremento, y el arreglo de valores reales surge de acumularlas (la misma técnica de prefix sum de la sección 1, en dirección inversa). Saltarse ese paso da un arreglo que no significa nada como "valores finales" — un bug silencioso que solo cachas verificando contra un caso pequeño a mano. La primera opción invierte la verdad: el tamaño `n+1` con `diff[r+1]` es CORRECTO (el slot extra existe justo para `r = n-1`), no el bug. La tercera rompe el signo: `+X` en `l` y `−X` en `r+1` es lo correcto (el `−X` cancela desde `r+1`); invertirlos sí daría mal. La cuarta confunde una trampa con otra: el overflow es real en otros casos, pero no explica por qué la FORMA está mal — `diff` no contiene los valores finales sin importar el ancho del entero.

## Difference array — el costo total
type: complexity

Con difference array aplicas m actualizaciones de rango sobre un arreglo de tamaño n y luego reconstruyes el arreglo final. ¿Cuál es la complejidad total y por qué cada actualización de rango cuesta O(1) en vez de O(r−l)?

### Opciones
- O(n·m), porque cada actualización toca todas las posiciones de su rango antes de reconstruir.
- [x] O(n + m): cada una de las m actualizaciones son DOS escrituras O(1) (`diff[l] += X`, `diff[r+1] -= X`), y la reconstrucción es un solo barrido O(n) al final. El costo de "esparcir el +X por el rango" se difiere a esa única pasada.
- O(m log n), porque marcar los extremos requiere una búsqueda binaria por actualización.
- O(n²), dominado por la reconstrucción del arreglo final.

### Justificación
La clave de la técnica: aplicar `+X` a un rango costaría O(r−l) si lo hicieras directo, pero marcar solo los dos extremos lo vuelve O(1) por actualización, y el trabajo real de propagar el incremento se paga una sola vez, con el barrido de acumulación O(n) al final — total O(n+m). La primera opción es exactamente el costo naïve que el difference array evita. La tercera inventa una búsqueda binaria: marcar `diff[l]` y `diff[r+1]` es asignación directa por índice, sin búsqueda. La cuarta confunde la reconstrucción (una pasada lineal O(n)) con algo cuadrático.

## Conexión — suma exacta K con negativos
type: multiple_choice

"¿Cuántos subarreglos contiguos tienen suma exacta K?" sobre un arreglo que INCLUYE números negativos. Recuerdas que con solo no-negativos esto era two pointers (CP1). ¿Por qué los negativos rompen two pointers, y cuál es la técnica correcta?

### Opciones
- Two pointers sigue funcionando; los negativos no cambian nada, solo hay que reiniciar el puntero izquierdo en cada paso.
- [x] Con negativos, la suma de la ventana deja de ser monótona al mover los punteros (agregar un elemento puede AUMENTAR o DISMINUIR la suma), así que two pointers pierde su invariante. La técnica correcta es prefix sums + hashmap: un subarreglo `(j, i]` suma K sii `prefix[i] - prefix[j] = K`, es decir `prefix[j] = prefix[i] - K`; cuentas cuántas veces ya viste ese valor de prefix.
- Prefix sums no aplica porque los valores negativos hacen que el arreglo de prefix deje de ser creciente, y prefix sums requiere que sea monótono.
- Difference array, porque los negativos son actualizaciones de rango que hay que cancelar entre sí.

### Justificación
Es la frontera CP1↔CP3 que el libro marca en ambas direcciones: two pointers descansa en que mover un puntero cambie la suma de forma monótona (avanzar suma, retroceder resta); con negativos, avanzar puede bajar la suma, y el invariante que decide cuándo mover cada puntero se rompe. El reemplazo es prefix sums + hashmap: reformulas "subarreglo con suma K" como "dos prefijos cuya diferencia es K" y, recorriendo una vez, cuentas cuántos `prefix[j] = prefix[i] − K` ya aparecieron. La primera opción niega el invariante roto. La tercera es un malentendido: el método del hashmap NO requiere que el arreglo de prefijos sea creciente — funciona precisamente porque no asume monotonía. La cuarta confunde una actualización de rango con una consulta de conteo; no hay rangos que actualizar aquí.

## Trampa — la esquina de la inclusión-exclusión 2D
type: trace

Sobre un grid estático quieres la suma del subrectángulo con esquina superior-izquierda `(r1, c1)` e inferior-derecha `(r2, c2)`, inclusive, usando un prefix 2D donde `prefix[i][j]` es la suma del subrectángulo desde `(0,0)` hasta `(i-1, j-1)`. Un compañero escribe `prefix[r2+1][c2+1] - prefix[r1][c2+1] - prefix[r2+1][c1]` y su resultado sale sistemáticamente MENOR de lo esperado. ¿Qué falta y por qué?

### Opciones
- Nada falta; el resultado menor se debe a overflow, hay que usar enteros de 64 bits.
- Falta sumar las cuatro esquinas por separado; la inclusión-exclusión no aplica a subrectángulos.
- [x] Falta el término `+ prefix[r1][c1]`: al restar la franja de arriba y la franja de la izquierda se restó DOS VECES el rectángulo superior-izquierdo que ambas comparten; hay que sumarlo una vez para compensar. La fórmula completa es `prefix[r2+1][c2+1] - prefix[r1][c2+1] - prefix[r2+1][c1] + prefix[r1][c1]`.
- Falta cambiar todos los `+1` a `+2`: en 2D el offset debe duplicarse porque hay dos dimensiones.

### Justificación
Es el mismo principio combinatorio de la sección 3: la franja superior (`prefix[r1][c2+1]`) y la franja izquierda (`prefix[r2+1][c1]`) se solapan en el rectángulo `[0,r1)×[0,c1)`, así que al restar ambas lo quitaste dos veces; sumar `+prefix[r1][c1]` lo repone una vez. Por eso el resultado sale consistentemente MENOR: falta reponer esa esquina. La primera opción confunde el síntoma: un overflow daría un valor disparatado o envuelto, no un déficit limpio de exactamente una esquina. La segunda niega la herramienta correcta — la inclusión-exclusión es precisamente lo que resuelve el subrectángulo. La cuarta inventa un offset falso: el `+1` es por convención de tamaño `n+1` por dimensión (para el ancla en 0), y no se "duplica" en 2D.
