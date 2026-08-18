---
module_id: ce000000-0000-4000-8000-000000000010
spine: OA Amazon
title: Ejercicios — Intervals
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-9-intervals.md)
version: 1
---

# Intervals — banco de examen

Banco de reflejo OA (Amazon SDE Intern): cada ejercicio viste el patrón de intervalos con una regla de negocio —ventanas de mantenimiento, muelles de carga, turnos, pedidos con ventana de entrega— y entrena la secuencia que el libro fija como automática: **ordena por inicio (o separa inicios y fines como eventos), luego una sola pasada fusionando o contando**, más la decisión de borde que decide puntos enteros del examen: si `[1,4]` y `[4,5]` se tocan, ¿fusionan o no? Los drills de código están validados LOCALMENTE contra sus propios casos; NO son el juez — el veredicto real lo emite el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si excedes la meta, el patrón todavía no es reflejo. Todo anclado a `oa-9-intervals.md`.

## Consolidar ventanas de mantenimiento — el primer movimiento
type: multiple_choice
tiempo: 3

Un equipo de infraestructura tiene N ventanas de mantenimiento `[inicio, fin]` registradas por distintos ingenieros, posiblemente traslapadas y en orden arbitrario. Hay que entregar la lista consolidada mínima de ventanas efectivas (fusionando toda ventana que se traslape o toque con otra). Con N hasta 10⁵, ¿cuál es el plan correcto y por qué su primer paso no es negociable?

### Opciones
- [x] Ordenar por INICIO y hacer una sola pasada: tras ordenar, cualquier traslape posible ocurre solo entre vecinos consecutivos, así que basta comparar cada ventana con la última consolidada — si su inicio es menor o igual al fin acumulado, se funde extendiendo el fin con `max(fin_acumulado, fin)`; si no, abre ventana nueva. Sin ordenar primero, la lógica de fusión depende del orden arbitrario de entrada y falla en cualquier caso donde ese orden no sea conveniente.
- Comparar cada ventana contra todas las demás y unir las que se traslapen con un union-find; con N = 10⁵ las comparaciones por pares siguen siendo viables.
- Recorrer las ventanas en el orden en que llegaron, fusionando contra la última emitida; como los ingenieros suelen registrar en orden cronológico, ordenar es un paso redundante.
- Ordenar por FIN y recorrer al revés, porque el fin de cada ventana es lo que determina hasta dónde se extiende la fusión.
### Justificación
Es el patrón base del libro (Merge Intervals): ordenar por inicio garantiza que todo traslape posible sea entre vecinos consecutivos — si el de en medio no se traslapa con ninguno de los dos extremos, los extremos no pueden traslaparse entre sí — y eso reduce el problema a una pasada O(n). Comparar todos contra todos es O(n²) (10¹⁰ comparaciones con N = 10⁵: no cabe en el tiempo del OA) y el union-find es maquinaria innecesaria para un problema de una pasada. Confiar en que «suelen llegar en orden» es exactamente la trampa más citada del libro: no ordenar primero produce lógica que depende del orden arbitrario de entrada — «suele» no es una garantía del enunciado. Y ordenar por FIN al revés no aporta la propiedad clave (traslapes solo entre vecinos se obtiene ordenando por inicio, que es la convención del patrón); además invita a olvidar el detalle `max(fin_acumulado, fin)` que protege contra ventanas contenidas.

## Un solo robot, máximo de pedidos — ¿por inicio, por fin o por duración?
type: multiple_choice
tiempo: 3

Un robot de picking puede atender un solo pedido a la vez. Cada pedido tiene una ventana rígida `[inicio, fin]`. Quieres aceptar el MÁXIMO número de pedidos sin que dos aceptados se traslapen (equivalentemente: remover el mínimo de pedidos para que el resto sea compatible). ¿Cuál es la estrategia correcta?

### Opciones
- [x] Greedy ordenando por FIN: acepta siempre el pedido compatible que termina más temprano, porque terminar antes deja el máximo margen libre para todo lo que sigue. El argumento de intercambio lo prueba: si una solución óptima acepta en algún punto un pedido que termina después, puedes intercambiarlo por el que termina antes sin perder compatibilidad con el resto — así que aceptar el de fin más temprano nunca te aleja del óptimo. El mínimo de remociones es N menos los aceptados.
- Greedy ordenando por INICIO: aceptar siempre el pedido que empieza más temprano maximiza el uso del robot desde el primer instante.
- Greedy por DURACIÓN: aceptar primero los pedidos más cortos, porque los cortos estorban menos y caben más.
- Programación dinámica O(n²) sobre pares de pedidos compatibles: los greedy son heurísticas y solo la DP garantiza el óptimo exacto.
### Justificación
Es la aplicación directa de la disciplina «ordena primero, greedy después» que el libro hereda de `cp4-sorting-greedy`, con el exchange argument como prueba: el pedido que termina más temprano deja el mayor margen posible, y cualquier óptimo que elija otro se puede intercambiar sin pérdida. Ordenar por INICIO falla con un contraejemplo inmediato: un pedido que empieza a las 8:00 y dura todo el día bloquea tres pedidos cortos que empezaban a las 9, 12 y 15 — empezar temprano no dice nada de cuánto estorbas después. Por DURACIÓN también falla: un pedido corto colocado justo en el cruce de dos largos compatibles elimina dos por aceptar uno. Y la DP O(n²) sí da el óptimo pero es tiempo de examen desperdiciado: este greedy es demostrablemente óptimo y corre en O(n log n) — «los greedy son heurísticas» es falso cuando hay argumento de intercambio que los prueba.

## Ventana de emergencia sobre un calendario ya ordenado
type: multiple_choice
tiempo: 3

El calendario de mantenimiento de una celda de almacén ya está consolidado: ventanas ordenadas por inicio y sin traslapes. Llega UNA ventana de emergencia nueva que hay que insertar, fusionando donde toque. El enunciado garantiza el orden del calendario existente. ¿Cuál es la lectura correcta?

### Opciones
- [x] Tres fases en una sola pasada O(n), sin volver a ordenar: (1) copia directo las ventanas que terminan completamente antes de que empiece la nueva; (2) fusiona todas las que se traslapan con la nueva, expandiendo `inicio_fusion` con el mínimo y `fin_fusion` con el máximo; (3) copia directo el resto. Re-ordenar un input que el enunciado ya garantiza ordenado es desperdiciar un O(n log n) — la garantía existe para que la aproveches.
- Añadir la ventana al final, re-ordenar todo por inicio y correr el merge estándar completo; con n hasta 10⁵ la diferencia entre O(n) y O(n log n) es irrelevante y el código es más corto.
- Binary search para encontrar la posición de inserción y empalmar la ventana ahí; como el arreglo está ordenado, la búsqueda binaria es siempre la herramienta correcta y no hace falta fase de fusión.
- Recorrer desde el final hacia el principio, porque la ventana de emergencia probablemente es reciente y estará cerca del final del calendario.
### Justificación
Es la sección de Insert Interval del libro, literal: el input ya ordenado convierte el problema en tres fases lineales — copiar lo que termina antes, fusionar lo que traslapa (con min del inicio y max del fin), copiar lo que sigue. El libro es explícito: si te encuentras ordenando de nuevo un input que el enunciado dice ordenado, estás desperdiciando tiempo de examen en un paso innecesario — y la señal de reconocimiento «input garantizado ordenado → no vuelvas a ordenar» es una de las tres del módulo. Re-ordenar sí produce la respuesta correcta pero entrena el reflejo equivocado: en el OA la garantía del enunciado es información de diseño, no decoración. El binary search encuentra dónde insertar pero no resuelve la fusión en cadena (la ventana nueva puede tragarse varias existentes) — «arreglo ordenado → binary search» aplicado a ciegas es un reflejo de otro patrón. Y recorrer desde el final apuesta a una suposición («probablemente es reciente») que el enunciado no da; la corrección no puede depender de dónde caiga la ventana.

## El turno que termina a las 14:00 y el que empieza a las 14:00
type: multiple_choice
tiempo: 2

Dos turnos de una estación de empaque: `[8,14]` y `[14,20]`. En un problema el sistema los consolida en un solo bloque `[8,20]`; en otro problema el sistema reporta que UNA sola estación basta para ambos. ¿Cuál es la conclusión correcta sobre los bordes que se tocan?

### Opciones
- [x] No hay una respuesta universal: que dos intervalos que comparten exactamente un punto «se traslapen» depende de la definición del problema concreto. En fusión de rangos, la convención general es que SÍ fusionan (comparación con menor-o-igual, porque comparten el punto 14); en conteo de recursos simultáneos, la convención general es que NO exigen recurso extra (un turno que termina exactamente cuando empieza el otro reutiliza la estación). Hay que leer el enunciado buscando explícitamente si los límites son inclusive o exclusive y ajustar la comparación en consecuencia.
- Los dos comportamientos son contradictorios: uno de los dos sistemas tiene un bug, porque «traslapar» es una relación matemática única que no puede cambiar entre problemas.
- Siempre se fusionan y siempre exigen recursos distintos: compartir el punto 14 es traslape en ambos sentidos, por definición de intervalo cerrado.
- La comparación estricta o no estricta da igual en la práctica: los casos de borde exacto son tan raros que el juez del OA no los incluye.
### Justificación
Es la trampa central del libro, citada palabra por palabra: la pregunta de si `[1,5]` y `[5,10]` se traslapan depende de la definición exacta del problema, y es sorprendentemente fácil equivocarse en la dirección incorrecta bajo presión. El libro fija las dos convenciones dominantes — en Merge Intervals generalmente SÍ fusionan (por eso el código compara con menor-o-igual), en Meeting Rooms generalmente NO exigen salas distintas (por eso el desempate procesa fines antes que inicios) — y ordena leer el enunciado en vez de asumir que la convención de un problema aplica al siguiente. «Uno tiene un bug» es falso: son dos problemas con definiciones distintas, ambas legítimas. «Siempre ambas cosas» elige una convención y la impone donde no aplica. Y «los casos de borde son raros» es exactamente al revés: el juez completo del OA incluye el borde que el ejemplo pequeño del enunciado no expone — apostar a que no lo prueban es regalar puntos.

## Muelles de carga mínimos — contar simultáneos, no fusionar
type: multiple_choice
tiempo: 3

Un centro de distribución recibe N camiones, cada uno con ventana `[llegada, salida]`. Cada camión ocupa un muelle completo durante su ventana; un muelle queda libre en el instante exacto de la salida y puede recibir a un camión que llega en ese mismo instante. ¿Cuántos muelles se necesitan como mínimo, y con qué patrón se calcula?

### Opciones
- [x] Sweep line de eventos: cada llegada es un evento +1 y cada salida un evento -1; se ordenan todos por posición temporal procesando, en caso de empate exacto, las salidas ANTES que las llegadas (porque el muelle liberado en ese instante se reutiliza); el máximo del acumulado durante el barrido es el mínimo de muelles. La pregunta «cuántos recursos simultáneos» pide el pico de ocupación, no la lista de rangos fusionados.
- Fusionar las ventanas de todos los camiones con el merge estándar y devolver cuántos bloques quedan: cada bloque fusionado corresponde a un muelle.
- Ordenar por salida y aplicar el greedy de aceptar el máximo de camiones compatibles: los camiones aceptados caben en un muelle y los rechazados dan el número de muelles extra.
- Devolver el máximo de camiones cuyas ventanas comparten al menos un punto por pares, calculado comparando todos los pares en O(n²), porque el traslape por pares es lo que define la concurrencia.
### Justificación
Es Meeting Rooms II del libro con piel de logística: separar inicios y fines como eventos +1/-1, ordenar con el desempate crítico (fines antes que inicios en empate — el enunciado aquí lo pide explícitamente: el muelle liberado se reutiliza en el instante exacto), y el máximo del acumulado es la respuesta. La señal de reconocimiento del libro es literal: «cuántas salas/recursos simultáneos se necesitan» dispara sweep line, no fusión. Fusionar y contar bloques responde otra pregunta — dos camiones traslapados y uno separado dan dos bloques, pero el pico simultáneo es 2, y con tres camiones traslapados entre sí el merge da UN bloque cuando se necesitan 3 muelles. El greedy por fin maximiza cuántos caben en UN muelle, no minimiza muelles para atender a TODOS (y «los rechazados» no dan el número de muelles extra: pueden traslaparse entre sí). Y el máximo de traslape por pares en O(n²) ni siquiera es la cantidad correcta: tres ventanas pueden traslaparse por pares sin compartir las tres un mismo instante — el pico real lo da el barrido, no los pares.

## El desempate invertido — trace del sweep line
type: trace
tiempo: 4

Este conteo de muelles usa sweep line, pero la clave de ordenamiento procesa las llegadas ANTES que las salidas cuando empatan en el mismo instante:

```python
def muelles_minimos(ventanas):
    eventos = []
    for llegada, salida in ventanas:
        eventos.append((llegada, 1))
        eventos.append((salida, -1))
    eventos.sort(key=lambda e: (e[0], -e[1]))   # BUG: +1 antes que -1 en empates
    activos, maximo = 0, 0
    for _, delta in eventos:
        activos += delta
        maximo = max(maximo, activos)
    return maximo
```

La política del centro dice que un muelle liberado en el instante exacto de una salida puede recibir al camión que llega en ese mismo instante. Con `ventanas = [(1, 4), (4, 5)]`, ¿qué devuelve esta función y qué significa?

### Opciones
- [x] Devuelve 2, y es una sobreestimación: los eventos son (1,+1), (4,-1), (4,+1), (5,-1), pero la clave `(e[0], -e[1])` ordena el empate en t=4 poniendo el +1 (clave 4,-1) antes que el -1 (clave 4,1) → la caminata es 1, 2, 1, 0 y el máximo registrado es 2. Con el desempate correcto — salidas antes que llegadas, clave `(e[0], e[1])` — la caminata es 1, 0, 1, 0 y devuelve 1: el segundo camión reutiliza el muelle que se libera exactamente en t=4, como dicta la política.
- Devuelve 1: el sort de Python es estable, así que en el empate de t=4 conserva el orden de inserción, y la salida del primer camión se insertó antes que la llegada del segundo.
- Devuelve 0: el +1 y el -1 del instante 4 se cancelan entre sí antes de que el máximo se actualice, y el acumulado nunca sube de 0.
- Devuelve 2, y es correcto: dos camiones cuyas ventanas comparten el instante 4 ocupan el muelle al mismo tiempo en ese instante, así que hacen falta dos muelles sin importar la política.
### Justificación
Verificado a mano: la clave `(e[0], -e[1])` da al evento (4,+1) la tupla (4,-1) y al evento (4,-1) la tupla (4,1), y como -1 < 1, el +1 se procesa primero — el acumulado toca 2 antes de bajar. Es exactamente la regla CRÍTICA que el código del libro marca en mayúsculas: en empate de posición, procesar los fines (-1) ANTES que los inicios (+1), porque si una reunión termina exactamente cuando otra empieza NO necesitan salas distintas — aquí la política del centro dice lo mismo de los muelles. La opción de la estabilidad es un señuelo: el sort estable solo preserva orden de inserción entre elementos con claves IGUALES, y aquí las claves difieren justamente por el `-e[1]` — la estabilidad nunca entra en juego. «Devuelve 0» ignora que el acumulado ya subió a 1 en t=1 y a 2 en t=4 antes de cualquier cancelación (el máximo se actualiza en cada paso, no al final). Y «2 es correcto» contradice la política declarada en el enunciado: ese borde es una DECISIÓN del problema, y este problema la declara — compartir el instante exacto de relevo no exige segundo muelle.

## El costo real de consolidar — dónde vive el logaritmo
type: complexity
tiempo: 3

Fusionar N ventanas de mantenimiento desordenadas toma cierto costo; insertar UNA ventana nueva en un calendario que el enunciado garantiza ya ordenado y sin traslapes toma otro. ¿Cuál es el par de complejidades correcto, y de dónde sale cada término?

### Opciones
- [x] Fusionar desde cero es O(n log n) y el término dominante es el SORT — la pasada de fusión posterior es O(n); insertar sobre un calendario ya ordenado es O(n) porque las tres fases (copiar, fusionar, copiar) son una sola pasada sin ningún ordenamiento. La diferencia entre ambos es exactamente la garantía del enunciado: cuando el orden ya existe, el logaritmo desaparece.
- Ambos son O(n log n): toda operación sobre intervalos requiere mantenerlos ordenados, y eso impone el logaritmo aunque el input ya venga ordenado.
- Fusionar es O(n²) porque cada ventana debe compararse contra todas las consolidadas hasta el momento; insertar es O(log n) porque con binary search basta localizar la posición.
- Ambos son O(n): ordenar N ventanas de tiempo se hace en lineal con counting sort, así que el logaritmo nunca es necesario.
### Justificación
El libro lo dice en ambas secciones: el patrón base ordena por inicio (ahí vive el O(n log n) — la fusión posterior es una pasada lineal contra el último consolidado, no contra todos), y la sección de Insert Interval subraya que la solución es O(n) y no O(n log n) precisamente porque no hay ningún sort — el input ya ordenado es una garantía que se aprovecha, y re-ordenarlo es desperdiciar tiempo de examen. «Ambos O(n log n)» ignora esa garantía: el logaritmo viene del sort, no de una propiedad mística de los intervalos. «O(n²) / O(log n)» yerra dos veces: la fusión compara solo contra el ÚLTIMO intervalo del resultado (por eso ordenar primero importa — reduce los candidatos de traslape a vecinos), y el binary search localiza pero no fusiona la cadena de traslapes, que puede tocar O(n) ventanas. Y el counting sort exige un rango de valores acotado y pequeño que el problema no garantiza (los tiempos pueden ser arbitrariamente grandes) — asumirlo es cambiar el enunciado para que la respuesta cuadre.

## Drill: fusionarIntervalos
type: code
tiempo: 15

El drill del patrón base, con piel de operación: consolida las ventanas de mantenimiento de una flota en la lista mínima de bloques efectivos. Validado localmente contra los casos de abajo — no es el juez del OA. Meta: teclearlo sin pausas, con el sort por inicio y el detalle del fin acumulado como reflejos.

### Especificación
`fusionarIntervalos(intervalos)`:
- `intervalos` es un arreglo de pares `[inicio, fin]` de enteros con `inicio <= fin`, en orden arbitrario, posiblemente traslapados o contenidos unos en otros.
- Devuelve la lista consolidada mínima como arreglo de pares `[inicio, fin]`, ordenada ascendentemente por inicio.
- CONVENCIÓN DE BORDES (declarada): dos ventanas que se TOCAN en un punto (el fin de una es igual al inicio de la otra) SÍ se fusionan — la comparación es con menor-o-igual.
- Una ventana contenida completamente dentro de otra no extiende el bloque: el fin del bloque es el máximo entre el fin acumulado y el fin nuevo.
- Arreglo vacío → arreglo vacío. Una sola ventana → ella misma.
- Los valores caben en enteros seguros (< 2^53); no debes mutar el arreglo de entrada.

### Firma
```javascript
function fusionarIntervalos(intervalos) {
  // TODO: ordena por inicio; una pasada; fusiona si inicio <= fin acumulado; fin = max(acumulado, fin)
  return [];
}
```
```python
def fusionar_intervalos(intervalos):
    # TODO: ordena por inicio; una pasada; fusiona si inicio <= fin acumulado; fin = max(acumulado, fin)
    return []
```

### Casos
```json
[
  { "input": [[[1, 3], [2, 6], [8, 10], [15, 18]]], "expected": [[1, 6], [8, 10], [15, 18]] },
  { "input": [[]], "expected": [] },
  { "input": [[[5, 7]]], "expected": [[5, 7]] },
  { "input": [[[1, 4], [4, 5]]], "expected": [[1, 5]] },
  { "input": [[[1, 10], [2, 3]]], "expected": [[1, 10]] },
  { "input": [[[8, 10], [1, 3], [2, 6]]], "expected": [[1, 6], [8, 10]] },
  { "input": [[[1, 4000000000000], [2, 3]]], "expected": [[1, 4000000000000]] },
  { "input": [[[1, 2], [3, 4]]], "expected": [[1, 2], [3, 4]], "hint": true }
]
```

### Solución
```javascript
function fusionarIntervalos(intervalos) {
  if (intervalos.length === 0) return [];
  const orden = intervalos.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0]);
  const resultado = [orden[0]];
  for (let i = 1; i < orden.length; i++) {
    const inicio = orden[i][0];
    const fin = orden[i][1];
    const ultimo = resultado[resultado.length - 1];
    if (inicio <= ultimo[1]) {
      ultimo[1] = Math.max(ultimo[1], fin);   // contenida: NO pierdas el fin acumulado
    } else {
      resultado.push([inicio, fin]);
    }
  }
  return resultado;
}
```
```python
def fusionar_intervalos(intervalos):
    if not intervalos:
        return []
    orden = sorted([list(p) for p in intervalos], key=lambda p: p[0])
    resultado = [orden[0]]
    for inicio, fin in orden[1:]:
        ultimo = resultado[-1]
        if inicio <= ultimo[1]:
            ultimo[1] = max(ultimo[1], fin)   # contenida: NO pierdas el fin acumulado
        else:
            resultado.append([inicio, fin])
    return resultado
```

### Pistas
- Ordena por INICIO antes de cualquier lógica — es el paso no negociable: tras ordenar, solo el último bloque consolidado puede traslaparse con la ventana actual.
- La comparación de fusión es `inicio <= fin_acumulado` (menor-o-igual: la Especificación declara que los bordes que se tocan fusionan).
- El fin del bloque se extiende con `max(fin_acumulado, fin)`, nunca con `fin` a secas — una ventana contenida ([1,10] y luego [2,3]) encogería el bloque y ese es el bug que el ejemplo pequeño no expone.

## Drill: remocionesMinimas
type: code
tiempo: 15

El drill del greedy por fin: de todos los pedidos con ventana rígida, ¿cuántos hay que rechazar como mínimo para que los aceptados no se traslapen? Validado localmente contra los casos de abajo — no es el juez del OA. Meta: reconocer que «mínimo de remociones» es el complemento de «máximo de compatibles» y teclear el greedy sin dudar del criterio de orden.

### Especificación
`remocionesMinimas(intervalos)`:
- `intervalos` es un arreglo de pares `[inicio, fin]` de enteros con `inicio <= fin`, en orden arbitrario, posiblemente con duplicados exactos.
- Devuelve el número MÍNIMO de intervalos a remover para que los restantes no se traslapen entre sí.
- CONVENCIÓN DE BORDES (declarada): dos intervalos que solo se TOCAN en un punto ([1,2] y [2,3]) NO se traslapan — son compatibles y ninguno debe removerse por el otro.
- Arreglo vacío → 0. Un solo intervalo → 0.
- Los valores caben en enteros seguros (< 2^53); no debes mutar el arreglo de entrada.

### Firma
```javascript
function remocionesMinimas(intervalos) {
  // TODO: ordena por FIN; conserva todo intervalo cuyo inicio >= fin del ultimo conservado; respuesta = total - conservados
  return 0;
}
```
```python
def remociones_minimas(intervalos):
    # TODO: ordena por FIN; conserva todo intervalo cuyo inicio >= fin del ultimo conservado; respuesta = total - conservados
    return 0
```

### Casos
```json
[
  { "input": [[[1, 2], [2, 3], [3, 4], [1, 3]]], "expected": 1 },
  { "input": [[[1, 2], [1, 2], [1, 2]]], "expected": 2 },
  { "input": [[[1, 2], [2, 3]]], "expected": 0 },
  { "input": [[]], "expected": 0 },
  { "input": [[[5, 9]]], "expected": 0 },
  { "input": [[[1, 100], [2, 3], [4, 5], [6, 7]]], "expected": 1 },
  { "input": [[[1, 9000000000000], [2, 3]]], "expected": 1 }
]
```

### Solución
```javascript
function remocionesMinimas(intervalos) {
  if (intervalos.length === 0) return 0;
  const orden = [...intervalos].sort((a, b) => a[1] - b[1]);   // por FIN: el que termina antes deja mas margen
  let conservadas = 0;
  let finPrevio = -Infinity;
  for (const par of orden) {
    if (par[0] >= finPrevio) {   // tocar el borde NO es traslape (>=, segun la convencion declarada)
      conservadas++;
      finPrevio = par[1];
    }
  }
  return intervalos.length - conservadas;
}
```
```python
def remociones_minimas(intervalos):
    if not intervalos:
        return 0
    orden = sorted(intervalos, key=lambda p: p[1])   # por FIN: el que termina antes deja mas margen
    conservadas = 0
    fin_previo = float('-inf')
    for inicio, fin in orden:
        if inicio >= fin_previo:   # tocar el borde NO es traslape (>=, segun la convencion declarada)
            conservadas += 1
            fin_previo = fin
    return len(intervalos) - conservadas
```

### Pistas
- El criterio de orden es el FIN, no el inicio: conservar el que termina más temprano deja el máximo margen para lo que sigue, y el argumento de intercambio prueba que nunca pierdes con eso.
- Cuenta los CONSERVADOS con el greedy y devuelve `total - conservados` — remover el mínimo y conservar el máximo son el mismo problema visto de los dos lados.
- La comparación de compatibilidad es `inicio >= fin_previo` (con igual incluido): la Especificación declara que tocar el borde no es traslape. Cambiarla a estricta rompe el caso [1,2],[2,3].
