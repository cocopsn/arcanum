---
module_id: ce000000-0000-4000-8000-000000000003
spine: OA Amazon
title: Ejercicios — Prefix sum + reinicio de estado
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-2-prefix-sum.md)
version: 1
---

# Prefix sum + reinicio de estado — banco de reconocimiento

Banco de reflejo OA (Amazon SDE Intern): entrena la familia que el libro llama «el patrón que abre el examen» — la resta `prefix[j] - prefix[i]` que responde rangos en O(1), el difference array para actualizaciones de rango, el conteo de periodos con suma exacta vía diccionario de prefijos, el acumulador con REINICIO para «mínimas operaciones» (y por qué reiniciar exactamente en la primera violación es óptimo, no una corazonada), y el costo como flujo que cruza fronteras — todo disfrazado de reglas de negocio de almacenes, inventarios y cajas, que es como Amazon lo empaqueta. Estos drills se validan LOCALMENTE contra casos unitarios; NO son el examen — el juez real es el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si te pasas, anota dónde se te fue y vuelve al libro. Todo anclado a `oa-2-prefix-sum.md`.

## Ventas por rango en el dashboard — precomputa una vez, responde en O(1)
type: multiple_choice
tiempo: 2

«El dashboard de una tienda guarda las ventas diarias de un año fiscal extendido (hasta 10⁵ días, el arreglo no cambia) y los analistas lanzan hasta 10⁵ consultas de la forma "total vendido del día l al día r".» ¿Qué estructura preparas, y por qué?

### Opciones
- [x] Un arreglo de sumas prefijo construido UNA vez en O(n), con la convención `prefix[0] = 0`: cada consulta se responde con la resta `prefix[r+1] - prefix[l]` en O(1), y el total queda en O(n + Q) — la firma exacta de «arreglo estático + muchas consultas de rango» que el libro marca como prefix sum clásico. Sumar por consulta repite trabajo que una sola precomputación deja pagado.
- Sumar el rango elemento por elemento en cada consulta: cada una es a lo más 10⁵ pasos, que es rápido.
- Un difference array: marcar los extremos de cada consulta y reconstruir con un barrido al final.
- Un diccionario que memoriza la respuesta de cada rango `(l, r)` ya preguntado, para no repetir sumas.
### Justificación
Es la primera señal de reconocimiento del libro, literal: «suma de subarreglo/rango repetida muchas veces sobre un arreglo estático → prefix sum clásico, O(1) por consulta» — y la convención con offset (`prefix[0] = 0`, tamaño n+1) resuelve el caso `l = 0` sin rama especial, la trampa de índices que el libro hereda de cp3. Sumar por consulta es O(n·Q) = 10¹⁰ operaciones en el peor caso: dos órdenes de magnitud fuera de cualquier presupuesto de juez. El difference array es la herramienta INVERSA: sirve cuando hay muchas ACTUALIZACIONES de rango y una lectura final — aquí nadie actualiza nada, el arreglo es estático y lo que abundan son lecturas. Y la memoización por rango no acota el peor caso: con 10⁵ rangos distintos cada consulta nueva sigue costando O(n) la primera vez, y hay hasta ~5×10⁹ rangos posibles — el diccionario correcto en esta familia guarda prefijos, no respuestas.

## Ajustes masivos por pasillo — marca los bordes, reconstruye al final
type: multiple_choice
tiempo: 3

«El sistema de reabasto aplica hasta 10⁵ ajustes nocturnos sobre un centro con 10⁵ pasillos; cada ajuste suma `+x` unidades al stock proyectado de TODOS los pasillos del `l` al `r`. Nadie consulta nada durante la noche: solo importa el arreglo final de la mañana.» ¿Cómo procesas los ajustes?

### Opciones
- [x] Un difference array: cada ajuste `(l, r, +x)` se registra en O(1) marcando `diff[l] += x` y `diff[r+1] -= x`, y al final UN solo barrido de suma prefijo reconstruye el arreglo completo — O(n + U) total. La señal es exacta: muchas actualizaciones de rango, cero consultas intermedias, un solo resultado final; pagar el rango completo por ajuste sería pagar por un estado intermedio que nadie va a leer.
- Aplicar cada ajuste recorriendo los pasillos del `l` al `r` y sumando `x` en cada celda, ajuste por ajuste.
- Un arreglo de sumas prefijo del stock inicial, para poder responder el total de cualquier rango de pasillos en O(1).
- Ordenar los ajustes por su `l` y recorrerlos con dos punteros, cerrando cada rango cuando el puntero derecho lo alcanza.
### Justificación
Es la tercera señal del libro palabra por palabra: «muchas actualizaciones de rango, sin consultas intermedias, solo el resultado final → difference array» — la mecánica de marcar `+x` en la entrada y `-x` justo después de la salida deja que el barrido final de prefix sum "arrastre" cada ajuste exactamente sobre su rango. Aplicar celda por celda es O(n·U): con rangos anchos son ~10¹⁰ escrituras para producir el mismo arreglo que las 2×10⁵ marcas más un barrido de 10⁵ producen. El prefix sum del stock inicial responde la pregunta que NADIE hizo (consultas de rango) y no aplica ni un solo ajuste: es la herramienta espejo — consulta contra actualización — y confundirlas es el error de diagnóstico que esta familia castiga. Y ordenar con dos punteros es vocabulario de otra familia (pares y ventanas sobre arreglos ordenados): aquí no hay nada que ordenar ni ventana que mover — cada ajuste ya trae sus dos bordes listos para marcarse.

## Periodos que suman exactamente K — prefijos con complemento, no ventana
type: multiple_choice
tiempo: 4

«Finanzas quiere saber cuántos periodos de días CONSECUTIVOS cerraron con ingreso neto exactamente K. El movimiento de cada día puede ser negativo (reembolsos y contracargos son normales), y hay hasta 10⁵ días.» ¿Cuál es el plan correcto?

### Opciones
- [x] Una pasada acumulando la suma prefijo corriente y un diccionario que cuenta cuántas veces ha aparecido cada valor de prefijo: un periodo `(i, j]` suma K exactamente cuando `prefix[j] - prefix[i] = K`, es decir cuando `prefix[i] = prefix[j] - K` — así que en cada día sumas al resultado cuántas veces YA viste el prefijo `actual - K`, y luego registras el actual. Es la identidad de rangos del libro con el mapeo complemento de la familia de hash maps encima: O(n) total, y los negativos no lo perturban en nada.
- Una ventana deslizante: expandir por la derecha mientras la suma sea menor que K y contraer por la izquierda cuando se pase, contando cada vez que la suma sea exactamente K.
- Probar todos los pares de fronteras `(i, j)` con dos bucles, calculando cada suma con la resta de prefijos en O(1): la resta ya hace eficiente el doble bucle.
- Este conteo solo es posible si K es positivo: con movimientos negativos en el arreglo, ningún método lineal puede contar los periodos exactos.
### Justificación
La identidad `prefix[j] - prefix[i]` = suma del rango es la base del libro, y despejarla (`prefix[i] = prefix[j] - K`) la convierte en la MISMA pregunta de complemento de Two Sum: «¿cuántas veces ya vi exactamente lo que me falta?» — un diccionario de conteos de prefijos la responde en O(1) por día. La ventana deslizante exige monotonía: que expandir solo suba la suma y contraer solo la baje — con negativos la suma sube y baja sin patrón, la decisión de contraer pierde su base lógica, y la ventana se salta periodos válidos; es exactamente la frontera entre familias que los libros marcan (acumulado con reinicio o prefijos contra ventana que se contrae). El doble bucle con resta O(1) sigue siendo O(n²) pares — ~5×10⁹ con n = 10⁵: la resta barata no rescata la enumeración cara. Y la restricción «solo si K es positivo» es falsa: el método de prefijos jamás asume signo — precisamente por eso es EL método cuando hay negativos, que es cuando la ventana muere.

## El corte que no se retrasa — por qué reiniciar en la primera violación
type: multiple_choice
tiempo: 4

«La caja de un mostrador registra entradas y salidas durante el día; política de la empresa: el saldo acumulado desde el último arqueo nunca puede quedar negativo. Cada arqueo (contar y reponer la caja) cuesta una operación y deja el acumulado en cero. Dado el registro del día, calcula el mínimo de arqueos.» Tu solución recorre sumando y hace arqueo EXACTAMENTE cuando la suma corriente se vuelve negativa. Un compañero objeta: «un greedy tan simple no puede ser óptimo; hay que probar todas las posiciones de arqueo con DP». ¿Quién tiene razón, y por qué?

### Opciones
- [x] El greedy es óptimo y hay argumento de intercambio que lo prueba: si la suma se vuelve negativa en la posición i, RETRASAR el arqueo solo arrastra ese déficit hacia adelante (puede arruinar tramos futuros que sin el déficit habrían sido válidos, y jamás salva el tramo ya violado), y arquear ANTES de que haya violación gasta una operación que nadie pidió. Cortar en el primer instante de violación nunca empeora el resto del problema — ni antes ni después — así que la DP explora un espacio cuyo óptimo el greedy ya alcanza en O(n).
- El compañero: un greedy solo da una aproximación razonable, y en un OA el resultado exacto exige programación dinámica sobre todas las posiciones de corte.
- Depende de los datos: con valores negativos grandes el greedy falla y hay que caer a backtracking sobre las posiciones de arqueo.
- El greedy es correcto, pero solo si también haces arqueo cuando la suma queda exactamente en cero, porque cero ya es zona de riesgo.
### Justificación
Es la deducción central del libro (sección 2.2): el momento óptimo de cortar es exactamente el primer instante en que la condición se viola, probado con el argumento de intercambio — retrasar solo deja que la negatividad se acumule y contamine tramos futuros; adelantar desperdicia una operación sin necesidad. La objeción del compañero es la trampa que el libro llama la más cara de esta familia: no reconocer que el greedy simple YA es la solución óptima y quemar minutos de examen construyendo una DP o un backtracking para un espacio que no hace falta explorar. «El greedy aproxima» es falso aquí — la optimalidad está probada, no intuida; «con negativos grandes falla» tampoco: el argumento de intercambio no depende de magnitudes, solo del hecho de que un déficit arrastrado nunca ayuda. Y arquear en cero es adelantarse sin violación: la condición del libro es estricta (`s < 0`) — su propia traza a mano pasa por un acumulado que toca 0 y NO dispara operación, porque cero no es negativo; tratarlo como violación infla el conteo.

## Estantes a nivel objetivo — el costo vive en las fronteras que suben
type: multiple_choice
tiempo: 4

«Un robot de acomodo parte de estantes vacíos (todo en cero) y debe dejarlos en los niveles objetivo `[1, 3, 3, 2, 4]`. Cada operación agrega +1 unidad a un tramo CONTIGUO de estantes, del que tú elijas.» ¿Cuál es el mínimo de operaciones, y con qué regla general se calcula?

### Opciones
- [x] 5 operaciones: el mínimo es la suma de los incrementos POSITIVOS del difference array del objetivo — aquí las subidas son 0→1 (+1), 1→3 (+2) y 2→4 (+2), total 5. Cada frontera donde el perfil SUBE obliga a que esa cantidad de operaciones nuevas inicie ahí (flujo que entra); donde BAJA, operaciones ya abiertas simplemente terminan, sin costo — se paga solo lo que genuinamente necesita una decisión nueva.
- 4 operaciones: el máximo del arreglo objetivo, porque puedes construir el perfil entero en capas horizontales, una operación por nivel de altura.
- 13 operaciones: la suma de los niveles objetivo, porque cada unidad de inventario colocada requiere su propia operación.
- 4 operaciones: una por cada frontera donde el nivel objetivo cambia respecto al estante anterior, sin importar de cuánto sea el cambio.
### Justificación
Es la fórmula que el libro deduce en su sección de flujo acumulado: el mínimo de operaciones de rango es la suma de los valores positivos del difference array (su propio ejemplo es exactamente `[1, 3, 3, 2, 4]`), con la intuición de que por cada frontera cruza `|objetivo[i] - objetivo[i-1]|` de flujo, y solo las SUBIDAS exigen operaciones que inicien ahí. El máximo (4) funcionaría si el perfil nunca bajara y volviera a subir: aquí el valle 3→2→4 rompe las capas — la capa de altura 3 no puede ser UNA operación contigua porque el estante de nivel 2 la parte en dos; por eso el máximo subestima. La suma total (13) ignora por completo que una operación cubre un tramo entero de estantes a la vez: es la cota de operar celda por celda, no la de operar por rangos. Y contar fronteras que cambian (4: las de +1, +2, −1, +2) confunde CUÁNTAS fronteras se mueven con CUÁNTO flujo entra: una subida de +2 necesita dos operaciones nuevas, no una — el costo es en unidades, no en bordes.

## Trazar el reinicio: el acumulado que toca cero y no dispara
type: trace
tiempo: 4

Este es el patrón de reinicio del libro, aplicado al registro de movimientos de un andén (positivo entra, negativo sale). La política exige que el acumulado desde el último reinicio nunca quede negativo; cada reinicio cuenta una operación y deja el acumulado en 0:

```python
def minimas_operaciones_suma_no_negativa(arr):
    operaciones = 0
    suma_corriente = 0
    for x in arr:
        suma_corriente += x
        if suma_corriente < 0:
            operaciones += 1
            suma_corriente = 0
    return operaciones
```

Con `arr = [3, -4, 2, -1, 5, -6, 1]`, ¿qué devuelve y dónde ocurre cada reinicio?

### Opciones
- [x] Devuelve 1, con el único reinicio en el segundo movimiento: `s=3` → `s=-1` (negativa: operación 1, reinicia a 0) → `s=2` → `s=1` → `s=6` → `s=0` (el −6 deja el acumulado EXACTAMENTE en cero, y cero no es negativo: la condición es estricta, no dispara) → `s=1`. El déficit del −4 se consume en el reinicio y no se arrastra al tramo siguiente.
- Devuelve 2: hay reinicio en el −4 (acumulado −1) y otro en el −6, porque quedar en cero también viola la política del andén.
- Devuelve 3: cada movimiento negativo del registro (−4, −1 y −6) fuerza su propia operación de reinicio.
- Devuelve 0: el acumulado se recupera solo después del −4 (con el +2 vuelve a terreno positivo), así que ninguna operación es necesaria.
### Justificación
Es la traza que el libro pide verificar a mano antes de confiar en el código, paso por paso: la única violación es `3 - 4 = -1`, y el momento delicado es el −6 — deja el acumulado exactamente en 0, y la condición `suma_corriente < 0` es ESTRICTA: cero no es negativo, no dispara. Contar 2 es exactamente ese error de borde (tratar `<= 0` como violación cuando la política dice «nunca negativo»): es la clase de off-by-one conceptual que se caza trazando, no releyendo el código. Contar 3 confunde «movimiento negativo» con «acumulado negativo»: el −1 cae con el acumulado en 3 y solo lo baja a 2 — el patrón vigila la SUMA corriente, no el signo de cada elemento. Y devolver 0 ignora que la violación ya ocurrió en el instante en que el acumulado tocó −1: que después se recupere no borra el momento en que quedó negativo — la política se evalúa en TODO punto del recorrido, que es precisamente lo que el acumulado corrido garantiza.

## Greedy O(n) contra DP cuadrática — el presupuesto decide
type: complexity
tiempo: 3

Un problema de «mínimas operaciones para que el acumulado corrido nunca quede negativo» llega con n hasta 10⁶ movimientos y límite de ~2 segundos (presupuesto clásico: del orden de 10⁸ operaciones simples por segundo). Sobre la mesa hay tres planes: (a) el greedy de reinicio en una pasada, (b) una DP sobre pares de posiciones de corte, (c) probar todos los subconjuntos de posiciones de corte. ¿Cuál es la lectura correcta?

### Opciones
- [x] Solo (a) cabe: el greedy es O(n) = 10⁶ pasos, holgadísimo, y además es EXACTO — su optimalidad está probada por argumento de intercambio, no es una aproximación. La DP sobre pares es O(n²) = 10¹² — cuatro órdenes de magnitud fuera del presupuesto, horas de cómputo. Y los subconjuntos son 2^(n−1), que ni se plantea. La firma «n grande + mínimas operaciones sobre condición acumulada» existe precisamente porque el diseño espera el O(n).
- (b) también cabe: 10¹² operaciones son manejables en ~2 segundos si el código evita trabajo extra dentro del doble bucle.
- Solo (b) da el óptimo exacto: (a) es un greedy y los greedy entregan aproximaciones — con n = 10⁶ toca aceptar la DP y confiar en el margen del juez.
- Ninguno funciona: verificar la condición exige examinar todos los subarreglos posibles, que son ~n²/2, así que el problema no admite solución lineal.
### Justificación
La aritmética manda: 10⁶ contra un presupuesto de ~2×10⁸ deja al greedy usando menos del 1%; 10¹² lo excede por ~5,000× — no es «optimizable con código limpio», es otra categoría de costo; y 2^(n−1) es astronómico con cualquier n de OA. La mitad conceptual es la que el libro subraya: el greedy de reinicio NO es heurística — el argumento de intercambio prueba que cortar en la primera violación nunca empeora el resto, así que renunciar a él por «ser greedy» es pagar 10⁶ veces más por la misma respuesta; esa desconfianza es la trampa más cara de la familia. Y «hay que examinar todos los subarreglos» es falso de raíz: el acumulado corrido RESUME el estado — la suma corriente en cada punto es exactamente la resta de prefijos desde el último reinicio, así que una sola pasada evalúa la condición en todo punto del recorrido; es la razón estructural por la que esta familia es O(n) y no O(n²).

## Drill: cierres mínimos para que ninguna racha quede en negativo
type: code
tiempo: 18

La bitácora de un muelle registra el movimiento neto de cada día (positivo entran paquetes, negativo salen). Auditoría marca INCIDENTE cualquier racha de dos o más días consecutivos cuyo neto acumulado sea negativo — un día suelto nunca es incidente, por malo que sea. Antes de publicar puedes insertar CIERRES DE AUDITORÍA entre días: las rachas jamás cruzan un cierre. Devuelve el mínimo de cierres para que no quede ningún incidente posible. Es el patrón de reinicio del libro con el acumulador afinado: lo que se mantiene y se reinicia es la peor suma de una racha que termina en el día actual.

### Especificación
`operacionesMinimas(movimientos)`:
- `movimientos` es el arreglo de netos diarios (enteros, pueden ser negativos).
- Una racha es cualquier tramo de días consecutivos, de DOS o más días, que no cruza ningún cierre. Hay incidente si el neto total de la racha es negativo (estrictamente menor que cero; cero es válido).
- Devuelve el mínimo número de cierres a insertar entre días para que ninguna racha posible quede en incidente.
- Arreglo vacío o de un solo día → 0 (no existe racha de dos días).
- Una pasada O(n): mantén `peor` = la peor suma de una racha que termina en el día anterior; si `peor + x < 0`, una racha de dos o más días quedaría negativa terminando hoy → un cierre justo antes de hoy, y el acumulador se REINICIA al día actual; si no, `peor = min(x, peor + x)`.

### Firma
```javascript
function operacionesMinimas(movimientos) {
  // TODO: peor = primer dia; para cada x: si peor + x < 0 -> cierre y reinicia peor = x;
  // si no, peor = min(x, peor + x)
  return 0;
}
```
```python
def operaciones_minimas(movimientos):
    # TODO: peor = primer dia; si peor + x < 0 -> cierre y reinicia peor = x;
    # si no, peor = min(x, peor + x)
    pass
```

### Casos
```json
[
  { "input": [[2, 5, -3, -1, 2]], "expected": 1 },
  { "input": [[1, 2, 3]], "expected": 0 },
  { "input": [[-5, -5, -5]], "expected": 2 },
  { "input": [[]], "expected": 0 },
  { "input": [[4, -6]], "expected": 1 },
  { "input": [[-7]], "expected": 0 },
  { "input": [[4, -3, 4, -3, 4]], "expected": 1 },
  { "input": [[0, 0]], "expected": 0 },
  { "input": [[10, -4, -4, -4]], "expected": 2 },
  { "input": [[1000000000, -999999999, -2]], "expected": 1, "hint": true }
]
```

### Solución
```javascript
function operacionesMinimas(movimientos) {
  if (movimientos.length === 0) return 0;
  let cierres = 0;
  let peor = movimientos[0];      // peor suma de una racha que termina en el dia anterior
  for (let i = 1; i < movimientos.length; i++) {
    const x = movimientos[i];
    if (peor + x < 0) {           // alguna racha de 2+ dias terminaria hoy en negativo
      cierres++;                  // cierre justo antes de hoy: mata TODAS las rachas que cruzan
      peor = x;                   // reinicio: el tramo nuevo empieza en el dia actual
    } else {
      peor = Math.min(x, peor + x); // la peor racha que termina hoy: hoy solo, o extender la peor previa
    }
  }
  return cierres;
}
```
```python
def operaciones_minimas(movimientos):
    if not movimientos:
        return 0
    cierres = 0
    peor = movimientos[0]         # peor suma de una racha que termina en el dia anterior
    for x in movimientos[1:]:
        if peor + x < 0:          # alguna racha de 2+ dias terminaria hoy en negativo
            cierres += 1          # cierre justo antes de hoy: mata TODAS las rachas que cruzan
            peor = x              # reinicio: el tramo nuevo empieza en el dia actual
        else:
            peor = min(x, peor + x)  # la peor racha que termina hoy: hoy solo, o extender la peor previa
    return cierres
```

### Pistas
- Toda racha termina en algún día: basta vigilar, por día, la PEOR racha que termina ahí — `peor = min(x, peor + x)` es la suma corriente del patrón del libro, con la libertad extra de empezar hoy si extender empeora.
- El cierre va exactamente en la primera violación (`peor + x < 0`), y es el argumento de intercambio del libro: toda racha en incidente que termina hoy cruza la frontera de ayer a hoy, así que ese cierre las mata TODAS; cortar antes desperdicia, cortar después deja el incidente publicado.
- Cuida los dos bordes: cero NO es incidente (condición estricta), y un día aislado tampoco — por eso `[-7]` devuelve 0 pero `[4, -6]` devuelve 1.

## Drill: costo de transferencias entre almacenes vecinos
type: code
tiempo: 15

Rebalanceo nocturno de una fila de almacenes: cada uno amanece con `inv[i]` unidades y debe cerrar la noche con exactamente `dem[i]`. Solo se puede mover inventario entre almacenes VECINOS, y mover una unidad a través de una frontera cuesta 1 (mover una unidad dos almacenes a la derecha cruza dos fronteras y cuesta 2). Es el patrón de flujo por fronteras del libro: el costo total es la suma, sobre cada frontera, del valor absoluto del flujo neto que la cruza — y ese flujo no es una decisión, está determinado por el balance acumulado de la izquierda.

### Especificación
`costoTransferencias(inv, dem)`:
- `inv` y `dem` tienen el mismo largo; entradas no negativas.
- Devuelve el costo mínimo total (unidades × fronteras cruzadas) para que cada almacén termine exactamente con `dem[i]`.
- Si el inventario total es menor que la demanda total, no alcanza: devuelve -1 sin calcular nada más.
- Se garantiza que cuando el inventario alcanza, los totales son IGUALES (redistribución exacta: nada se crea ni se destruye).
- Arreglos vacíos → 0. Un solo almacén → 0 (no hay fronteras que cruzar).
- Una pasada O(n): acumula `acarreo += inv[i] - dem[i]` sobre las primeras n−1 posiciones; el costo es la suma de `|acarreo|` en cada frontera — acarreo positivo fluye a la derecha, negativo exige traer de la derecha, y ambos cuestan lo mismo por unidad.

### Firma
```javascript
function costoTransferencias(inv, dem) {
  // TODO: -1 si el total no alcanza; si no, acumula inv[i] - dem[i] y suma |acarreo| por frontera
  return 0;
}
```
```python
def costo_transferencias(inv, dem):
    # TODO: -1 si el total no alcanza; si no, acumula inv[i] - dem[i] y suma abs(acarreo) por frontera
    pass
```

### Casos
```json
[
  { "input": [[3, 0, 0], [1, 1, 1]], "expected": 3 },
  { "input": [[1, 1, 1], [1, 1, 1]], "expected": 0 },
  { "input": [[0, 4], [2, 2]], "expected": 2 },
  { "input": [[1, 0], [1, 1]], "expected": -1 },
  { "input": [[], []], "expected": 0 },
  { "input": [[5], [5]], "expected": 0 },
  { "input": [[0, 0, 6, 0], [2, 1, 1, 2]], "expected": 7, "hint": true },
  { "input": [[1000000000, 0], [0, 1000000000]], "expected": 1000000000 },
  { "input": [[2, 2], [3, 1]], "expected": 1 },
  { "input": [[0], [1]], "expected": -1 }
]
```

### Solución
```javascript
function costoTransferencias(inv, dem) {
  let totalInv = 0;
  let totalDem = 0;
  for (const v of inv) totalInv += v;
  for (const v of dem) totalDem += v;
  if (totalInv < totalDem) return -1;   // no alcanza: imposible, sin calcular nada mas
  let costo = 0;
  let acarreo = 0;                      // balance acumulado de la izquierda = flujo que cruza
  for (let i = 0; i < inv.length - 1; i++) {
    acarreo += inv[i] - dem[i];
    costo += Math.abs(acarreo);         // |flujo| por esta frontera: derecha o izquierda, cuesta igual
  }
  return costo;
}
```
```python
def costo_transferencias(inv, dem):
    if sum(inv) < sum(dem):
        return -1                      # no alcanza: imposible, sin calcular nada mas
    costo = 0
    acarreo = 0                        # balance acumulado de la izquierda = flujo que cruza
    for i in range(len(inv) - 1):
        acarreo += inv[i] - dem[i]
        costo += abs(acarreo)          # |flujo| por esta frontera: derecha o izquierda, cuesta igual
    return costo
```

### Pistas
- El flujo neto que cruza la frontera entre `i` e `i+1` no es una decisión tuya: es exactamente el balance acumulado `(inv - dem)` de todo lo que queda a la izquierda — si sobra, sale hacia la derecha; si falta, tiene que entrar desde la derecha.
- El costo es la suma de `|acarreo|` sobre las n−1 fronteras — la intuición del libro de «costo = suma del flujo que cruza cada frontera», con valor absoluto porque mover hacia la izquierda cuesta lo mismo que hacia la derecha.
- Verifica el -1 ANTES de recorrer: si el inventario total no cubre la demanda total, ningún plan de movimientos lo arregla — y el enunciado garantiza que, cuando alcanza, los totales empatan.
