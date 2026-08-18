---
module_id: ce000000-0000-4000-8000-000000000005
spine: OA Amazon
title: Ejercicios — Binary search sobre la respuesta
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-4-binary-search-answer.md)
version: 1
---

# Binary search sobre la respuesta — logística bajo el reloj del OA

Banco del nodo oa-4: el enunciado del OA jamás dice «usa binary search» — te describe camiones, capacidades y días de entrega, y tu trabajo es destapar el `feasible(X)` monótono escondido, derivar `lo`/`hi` de los propios datos, re-verificar todo cuando Amazon le monta una regla de negocio encima, y detectar el caso imposible ANTES de buscar (la plantilla converge siempre y jamás va a emitir el -1 por ti). Estos drills se validan LOCALMENTE contra casos unitarios; no son el examen — el juez real es el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: la meta es parte del drill.

## La banda que no se puede reordenar
type: multiple_choice
tiempo: 3

Un centro de surtido debe despachar n = 10^5 paquetes por una banda, EN EL ORDEN en que están etiquetados (reordenar viola la promesa de entrega). Cada día sale un camión que carga paquetes consecutivos del frente hasta su capacidad. La operación exige terminar en a lo más D días. ¿Cuál es la capacidad mínima del camión? Pesos hasta 10^9. ¿Qué patrón, y cómo se ve su verificación?

### Opciones
- [x] Binary search sobre la respuesta: binarizas la CAPACIDAD candidata; feasible(cap) es la simulación greedy que recorre los pesos en orden acumulando carga, abre un día nuevo cuando el siguiente paquete no cabe, y responde «¿días usados ≤ D?». Es monótono (más capacidad jamás aumenta los días) y los límites salen del propio problema: lo = peso máximo (ese paquete tiene que caber en algún día) y hi = suma total (todo en un solo día).
- Ordenar los pesos de mayor a menor y asignarlos greedy al día menos cargado, quedándote con la carga máxima resultante como capacidad.
- Programación dinámica sobre subconjuntos de paquetes por día, tipo mochila, minimizando la capacidad usada.
- Two pointers de extremos opuestos: emparejar el paquete más pesado con el más ligero para balancear los días.
### Justificación
Es el caso canónico del libro, y la señal es la que su catálogo pone primero: «el valor mínimo tal que algo sea posible» disfrazado de logística, con verbos de asignación (enviar, cargar) bajo un límite de días. La opción de ordenar viola el enunciado dos veces: el orden de despacho es FIJO (reordenar rompe la promesa de entrega) y «asignar al día menos cargado» responde otra pregunta — además de que el problema pide una capacidad mínima, no una asignación. La mochila también rompe la estructura: los días no cargan subconjuntos libres sino tramos CONSECUTIVOS del orden dado, y una DP de subconjuntos con n = 10^5 ni siquiera cabe en memoria. Y extremos opuestos responde preguntas de PARES sobre un arreglo ordenado — aquí no hay pares y no se puede ordenar; compartir la palabra «punteros» no lo vuelve aplicable.

## Dos enunciados gemelos, dos familias
type: multiple_choice
tiempo: 4

Enunciado A: «Recorres en orden las lecturas de carga de una banda; cada vez que el acumulado del tramo actual excede el límite L (dado), haces una pausa y el acumulado se reinicia. ¿Cuántas pausas hace el turno completo?» Enunciado B: «Elige el límite L MÍNIMO de la banda tal que el turno complete con a lo más P pausas.» Comparten vocabulario («límite», «mínimo», «pausas»). ¿Cuál es la lectura correcta?

### Opciones
- [x] A es una simulación greedy punto a punto (la condición se vigila a lo largo del recorrido y L está DADO — se responde con UNA pasada); B es binary search sobre la respuesta (L es un escalar único que gobierna todo el proceso y piden su mínimo tal que sea posible). Y la conexión que ahorra minutos: feasible(L) de B ES exactamente la simulación de A — la búsqueda se monta ENCIMA de un patrón que ya tienes, no sobre algo nuevo.
- Ambos son binary search sobre la respuesta: los dos hablan de un límite y de minimizar, así que en ambos se binariza L.
- Ambos son la misma simulación greedy: en B basta correr la pasada de A una sola vez y deducir L del resultado.
- A es binary search sobre la respuesta y B es la simulación greedy punto a punto.
### Justificación
Es la distinción de diagnóstico que el libro deja en sus conexiones: si la pregunta es una condición punto a punto a lo largo del arreglo con parámetros dados, es greedy de reinicio de estado; si piden el valor de un escalar único que gobierna todo el proceso, es binary search sobre la respuesta — comparten vocabulario, no familia. Binarizar L en A no tiene sentido: L está dado, no hay nada que buscar — el conteo de pausas sale de simular. Una sola corrida en B tampoco alcanza: simular con UN L solo te dice si ESE L cumple con ≤ P pausas; el mínimo exige explorar el espacio de valores de L, que con límites grandes es exactamente lo que la búsqueda hace en ~30-50 evaluaciones. Y la asignación invertida delata no haber leído QUÉ se busca: en A un conteo (salida de la simulación), en B un parámetro (entrada de la simulación) — esa dirección es la frontera entre las dos familias.

## El -1 que la plantilla jamás va a emitir sola
type: multiple_choice
tiempo: 3

Variante con reglamento: ningún camión puede exceder la capacidad C_max por norma de seguridad. «Si ni con C_max alcanza para terminar en D días, devuelve -1.» Un candidato corre su búsqueda binaria sobre [max(pesos), C_max] con la plantilla estándar y devuelve lo que converja. ¿Cuál es el defecto?

### Opciones
- [x] La plantilla lo < hi SIEMPRE converge y devuelve un número del rango — sin garantizar que sea factible: si ningún candidato en [max(pesos), C_max] cumple, devuelve C_max (el último sobreviviente del rango) como si fuera respuesta, sin ningún error visible. El caso imposible se maneja APARTE, como manda el libro: verifica la factibilidad en el tope (o la condición de imposibilidad directa) ANTES de reportar, y emite el -1 exacto que el enunciado exige.
- La búsqueda lanza una excepción cuando ningún candidato es factible, así que basta envolverla y devolver -1 en el catch.
- No hay defecto: si nada es factible, lo y hi nunca se cruzan y el bucle no termina, lo cual ya delata el caso en el primer test.
- El caso imposible es decorativo: los jueces de OA no incluyen casos donde la respuesta sea el centinela, así que el if es tiempo perdido.
### Justificación
El libro lo pone como trampa con nombre propio: verifica los casos imposibles antes de invertir tiempo en la búsqueda — muchos problemas de Amazon exigen un centinela (-1) para el caso sin solución, y la plantilla no lo va a producir por sí misma: converger no es verificar, y el número devuelto solo es válido si ALGO en el rango era factible. No hay excepción que atrapar: feasible devolviendo false una y otra vez no lanza nada — la búsqueda simplemente estrecha el rango y termina. Tampoco hay bucle infinito: con lo < hi y el avance lo = mid + 1, el rango se estrecha SIEMPRE, haya o no solución — creer que el cuelgue te avisará es esperar una alarma que no existe. Y apostar a que el juez no prueba el centinela es exactamente al revés: el caso imposible declarado en el enunciado es de los favoritos de los casos ocultos — está escrito ahí porque lo van a cobrar.

## Carga frágil: qué cambia y qué sobrevive
type: multiple_choice
tiempo: 4

Al problema base le montan una regla: si el envío de un día incluye al menos un paquete FRÁGIL, la capacidad efectiva de ese día se reduce (un porcentaje de la nominal, o restando un margen fijo). Sigue pidiéndose la capacidad nominal mínima para terminar en D días. ¿Cuál es el ajuste correcto?

### Opciones
- [x] Cambia feasible (la simulación aplica la capacidad efectiva del día según contenga frágil o no) y hay que RE-derivar los límites bajo la regla nueva — con reducción, la nominal necesaria puede superar la suma de pesos, así que hi sube (suma/factor + 1, o suma + margen) — y RE-verificar explícitamente la monotonía (aquí se sostiene: la reducción es función fija de la nominal, así que más nominal siempre da más efectiva). La ESTRUCTURA de búsqueda queda idéntica.
- La monotonía se pierde: más capacidad nominal puede requerir más días por culpa de la reducción, así que binary search deja de aplicar y toca programación dinámica.
- Los límites lo = max(pesos), hi = suma(pesos) siguen válidos: la respuesta jamás puede superar la suma de los pesos, con o sin regla de fragilidad.
- Solo cambia una constante: resuelve el problema base sin frágiles y multiplica el resultado por 1/factor al final.
### Justificación
Es la sección de la variante del libro, casi literal: las variantes de Amazon complican feasible, no la estructura — reconoce el esqueleto primero, ajusta el cuerpo después, y verifica que lo/hi sigan cubriendo la respuesta bajo la regla adicional. La monotonía NO se pierde y el libro argumenta por qué: la reducción es una función fija de la nominal (más nominal nunca da menos efectiva) — pero la disciplina es preguntárselo explícitamente, no heredarlo del problema base. El distractor de los límites es LA trampa de diseño que el libro subraya: con reducción, la nominal que «seguro basta» en el peor caso es más alta que la suma sin ajuste, y un hi corto deja la respuesta FUERA del rango — la búsqueda converge igual y no avisa. Y el escalado global es falso porque la reducción aplica POR DÍA según su contenido: los días sin frágiles operan a nominal completa, así que multiplicar el resultado base por 1/factor sobre-corrige justo en los casos mixtos, que son casi todos.

## Estaciones de recarga: maximizar el mínimo
type: multiple_choice
tiempo: 4

Una flotilla necesita K estaciones de recarga elegidas entre n posiciones dadas sobre una carretera (posiciones ordenadas ascendentes, valores hasta 10^9). Se pide MAXIMIZAR la distancia MÍNIMA entre estaciones consecutivas instaladas. ¿Qué patrón, y qué cambia respecto del «mínimo tal que sea posible»?

### Opciones
- [x] Binary search sobre la respuesta en su forma maximizar-el-mínimo: el candidato X es «la separación mínima exigida»; feasible(X) es un greedy que recorre las posiciones colocando estación cada vez que la distancia desde la última colocada es ≥ X, y responde «¿caben al menos K?». La monotonía corre INVERTIDA (a mayor X, más difícil: feasible pasa de true a false), así que buscas el ÚLTIMO X factible — la rama de la plantilla se voltea respecto del minimizar, no se copia a ciegas.
- Two pointers de extremos opuestos: posiciones ordenadas y distancias entre pares es exactamente la señal de pares en un arreglo ordenado.
- Ventana deslizante de tamaño K sobre las posiciones: las K estaciones elegidas forman la ventana que deslizas.
- Geometría directa: la distancia óptima es (última posición − primera) / (K − 1); redondeas y colocas lo más cerca posible de esos puntos.
### Justificación
El catálogo de señales del libro cubre ambas direcciones — «el valor mínimo/máximo de X tal que algo sea posible» — y esta es la máxima: un escalar (la separación exigida) gobierna todo el proceso y la verificación es un greedy barato de colocación. El detalle que cuesta puntos es la dirección de la monotonía: en el problema de capacidad feasible es falso-luego-verdadero y buscas el primer true; aquí es verdadero-luego-falso y buscas el último true — copiar la rama del template sin voltearla devuelve el candidato equivocado sistemáticamente. Extremos opuestos no aplica: no buscas UN par que cumpla algo, eliges K posiciones optimizando un mínimo global — no hay condición de encuentro entre dos punteros. La ventana exige contigüidad que aquí no existe: las estaciones óptimas rara vez son posiciones consecutivas del arreglo. Y la fórmula equiespaciada ignora la restricción dura del problema: solo puedes instalar en las posiciones DADAS, y el punto ideal de la fórmula puede no existir en el terreno.

## El logaritmo sale de los datos, no del arreglo
type: complexity
tiempo: 4

Para la capacidad mínima de la banda (n = 10^5 pesos, cada peso hasta 10^9) tu feasible greedy es O(n) y binarizas la capacidad entre lo = max(pesos) y hi = suma(pesos). ¿Cuál es el costo total y qué detalle de formato acecha en esos límites?

### Opciones
- [x] O(n · log R) con R = suma(pesos) − max(pesos): la búsqueda evalúa ~⌈log₂ R⌉ candidatos y cada evaluación paga el greedy O(n). Con la suma rondando 10^14 son ~47 pasos × 10^5 ≈ 5·10^6 operaciones — holgado. El rango sale de los DATOS (de max a suma), y el detalle de formato: 10^14 cabe exacto en el número de JS (< 2^53) y en el int de Python, pero ya reventó un entero de 32 bits — el acumulador de la suma es de 64 bits o nada.
- O(suma(pesos)): hay que probar cada capacidad candidata desde max(pesos) hasta la suma, una por una, hasta la primera factible.
- O(n log n): domina el ordenamiento previo de los pesos, y la búsqueda posterior es más barata.
- O(log R) a secas: la búsqueda binaria es logarítmica y la verificación no cuenta para el costo porque solo verifica, no construye la respuesta.
### Justificación
La cuenta viene del esqueleto del libro: el espacio de respuestas va de max(pesos) a suma(pesos), y cada paso de la bisección corre la simulación greedy completa — identificar lo y hi en segundos es parte del entrenamiento, y de ahí sale R sin que nadie te lo regale en el enunciado. El barrido O(suma) es exactamente lo que la técnica reemplaza: 10^14 verificaciones no terminan hoy — los límites enormes en el VALOR preguntado, con un arreglo manejable, son la señal de que se biseca. El O(n log n) delata un reflejo de otra familia: aquí NO se ordena nada — el orden de despacho es fijo y ordenarlo destruiría el problema. Y O(log R) «a secas» omite el factor dominante: cada candidato cuesta una pasada O(n) entera; la búsqueda sin su feasible no es un algoritmo, es un contador de iteraciones.

## Los límites copiados del problema base
type: trace
tiempo: 5

Alguien adaptó el problema de capacidad a la variante frágil con margen fijo, pero dejó los límites de búsqueda del problema BASE:

```python
def capacidad_minima_fragil(paquetes, dias, margen):
    # paquetes: lista de (peso, es_fragil); si el envio de un dia incluye
    # al menos un paquete fragil, ese dia opera con capacidad - margen.
    def feasible(cap):
        dias_usados, carga, fragil_hoy = 1, 0, False
        for peso, es_fragil in paquetes:
            efectiva = cap - margen if (fragil_hoy or es_fragil) else cap
            if carga + peso > efectiva:
                dias_usados += 1
                carga, fragil_hoy = 0, False
                efectiva = cap - margen if es_fragil else cap
            carga += peso
            fragil_hoy = fragil_hoy or es_fragil
        return dias_usados <= dias

    lo = max(p for p, _ in paquetes)
    hi = sum(p for p, _ in paquetes)   # BUG: limites del problema BASE, sin la regla nueva
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

Con `paquetes = [(6, True)]`, `dias = 1` y `margen = 2`, ¿qué devuelve y qué revela?

### Opciones
- [x] Devuelve 6 — sin haber llamado a feasible NI UNA VEZ: lo = hi = 6, el while ni arranca, y 6 no es factible (efectiva 6 − 2 = 4 < 6: el paquete no cabe en ningún día). La respuesta real es 8 (efectiva 6 ≥ 6), pero quedó FUERA de [lo, hi] porque los límites se copiaron del problema base; la plantilla converge SIEMPRE a algo dentro del rango y no avisa. El arreglo es re-derivar los límites bajo la regla nueva: hi = suma + margen, y lo cubriendo peso + margen para los frágiles.
- Entra en bucle infinito: como feasible nunca devuelve True, lo y hi jamás se cruzan.
- Lanza una excepción al evaluar feasible(6), porque la capacidad efectiva queda menor que el paquete y el greedy no puede colocarlo.
- Devuelve 8: el greedy interno detecta la reducción y la búsqueda expande su rango automáticamente hasta cubrir la respuesta correcta.
### Justificación
Trazado a mano: max = 6 y suma = 6 dejan el rango en un solo punto, el while exige lo < hi y se lo salta, y la función reporta 6 — un número que NADIE verificó, porque feasible jamás se ejecutó. Es la trampa de diseño que el libro marca en las variantes de Amazon: si dejas hi sin el ajuste de la regla nueva, la búsqueda puede no cubrir el rango real de la respuesta — y el modo de fallo es el peor: sin error visible, con un resultado que parece razonable. No hay bucle infinito posible: la plantilla lo < hi con lo = mid + 1 estrecha el rango siempre, haya o no solución. No hay excepción: un paquete que no cabe solo infla dias_usados en la simulación (y aquí ni eso, porque la simulación nunca corre). Y la búsqueda binaria JAMÁS sale de su rango inicial — no existe ninguna expansión automática: garantizar que la respuesta esté dentro de [lo, hi] es responsabilidad de quien deriva los límites, que es exactamente lo que este código no re-hizo.

## Capacidad mínima con contrato de examen
type: code
tiempo: 18

El caso canónico del libro, con el contrato de bordes que el OA sí cobra: paquetes en orden FIJO, un camión por día cargando paquetes consecutivos, y la capacidad mínima para terminar a tiempo. La estructura primero (idéntica siempre), feasible después, y los bordes ANTES de binarizar. Drill validado localmente contra casos unitarios; el juez real es el OA.

### Especificación
`capacidadMinima(pesos, dias)`:
- `pesos`: arreglo de enteros POSITIVOS en el orden fijo de despacho (no se reordena); `dias`: entero.
- Cada día sale UN camión que carga paquetes CONSECUTIVOS del frente de la fila; un paquete no se parte.
- Devuelve la capacidad mínima entera con la que todo se despacha en a lo más `dias` días.
- Contrato de bordes, EXACTO y en este orden: `pesos` vacío → `0` (nada que enviar), SIN IMPORTAR `dias` — incluso con `dias = 0`. `pesos` no vacío y `dias < 1` → `-1` (imposible: no hay días). En el OA este contrato lo fija el enunciado que tienes enfrente — léelo ahí, no lo recuerdes de otro juez.
- Sumas hasta ~10^14: enteros siempre (caben exactos en el número de JS, < 2^53); nada de floats.

### Firma
```javascript
function capacidadMinima(pesos, dias) {
  // TODO: bordes primero (vacio -> 0; dias < 1 -> -1); lo = max, hi = suma;
  // feasible(cap) = greedy que cuenta dias; hi = mid si cabe, lo = mid + 1 si no
  return 0;
}
```
```python
def capacidad_minima(pesos, dias):
    # TODO: bordes primero (vacio -> 0; dias < 1 -> -1); lo = max, hi = suma;
    # feasible(cap) = greedy que cuenta dias; hi = mid si cabe, lo = mid + 1 si no
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5], "expected": 15, "hint": true },
  { "input": [[3, 2, 2, 4, 1, 4], 3], "expected": 6 },
  { "input": [[7], 1], "expected": 7 },
  { "input": [[], 5], "expected": 0 },
  { "input": [[], 0], "expected": 0 },
  { "input": [[5, 5, 5], 0], "expected": -1 },
  { "input": [[4, 4, 4, 4], 4], "expected": 4 },
  { "input": [[1, 2, 3], 1], "expected": 6 },
  { "input": [[1000000000, 1000000000], 1], "expected": 2000000000 }
]
```

### Solución
```javascript
function capacidadMinima(pesos, dias) {
  if (pesos.length === 0) return 0;      // nada que enviar: gana sobre cualquier dias
  if (dias < 1) return -1;               // imposible declarado ANTES de binarizar
  const feasible = (cap) => {
    let usados = 1, carga = 0;
    for (const p of pesos) {
      if (carga + p > cap) { usados++; carga = 0; }
      carga += p;
    }
    return usados <= dias;
  };
  let lo = Math.max(...pesos);                    // ese paquete tiene que caber
  let hi = pesos.reduce((s, p) => s + p, 0);      // todo en un solo dia
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (feasible(mid)) hi = mid;                  // cabe: intenta bajar la capacidad
    else lo = mid + 1;                            // no cabe: subela
  }
  return lo;
}
```
```python
def capacidad_minima(pesos, dias):
    if not pesos:
        return 0        # nada que enviar: gana sobre cualquier dias
    if dias < 1:
        return -1       # imposible declarado ANTES de binarizar

    def feasible(cap):
        usados = 1
        carga = 0
        for p in pesos:
            if carga + p > cap:
                usados += 1
                carga = 0
            carga += p
        return usados <= dias

    lo, hi = max(pesos), sum(pesos)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):      # cabe: intenta bajar la capacidad
            hi = mid
        else:                  # no cabe: subela
            lo = mid + 1
    return lo
```

### Pistas
- feasible(cap) es exactamente «¿diasParaEnviar(pesos, cap) ≤ dias?» — la búsqueda se monta encima de la simulación; escríbela como función aparte y la estructura de búsqueda queda limpia e idéntica a la de siempre.
- Los límites no son adorno: lo = max(pesos) porque el paquete más pesado tiene que caber en algún día; hi = suma porque todo-en-un-día siempre alcanza (con dias ≥ 1). Dentro de ese rango la respuesta existe, y por eso la plantilla puede converger sin verificación final.
- El orden de los bordes está DECLARADO en la Especificación (vacío gana sobre dias < 1). Los casos del juez cobran exactamente esa línea — el par de casos con arreglo vacío difiere solo en dias.

## La simulación del despacho, aislada
type: code
tiempo: 12

La otra mitad del patrón: el feasible del libro convertido en función de negocio por derecho propio. Dado un camión de capacidad FIJA, ¿cuántos días toma despachar la fila? — con el check de imposibilidad ANTES de simular: un paquete que excede la capacidad no cabría JAMÁS, en ningún día. Drill validado localmente contra casos unitarios; el juez real es el OA.

### Especificación
`diasParaEnviar(pesos, capacidad)`:
- `pesos`: arreglo de enteros POSITIVOS en el orden fijo de despacho; `capacidad`: entero.
- Simula el greedy del libro: acumula en el día actual; si el siguiente paquete no cabe, abre un día nuevo. Un paquete que cabe EXACTO (peso igual a la capacidad restante del día) SÍ entra en ese día.
- Devuelve el número de días que usa el greedy.
- Bordes EXACTOS: `pesos` vacío → `0`. Si ALGÚN paquete excede `capacidad` → `-1` (imposible: jamás cabría) — esto cubre también toda `capacidad ≤ 0` frente a pesos positivos.

### Firma
```javascript
function diasParaEnviar(pesos, capacidad) {
  // TODO: vacio -> 0; algun paquete > capacidad -> -1; greedy: dias arranca en 1,
  // abre dia nuevo cuando carga + p > capacidad
  return 0;
}
```
```python
def dias_para_enviar(pesos, capacidad):
    # TODO: vacio -> 0; algun paquete > capacidad -> -1; greedy: dias arranca en 1,
    # abre dia nuevo cuando carga + p > capacidad
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 15], "expected": 5, "hint": true },
  { "input": [[3, 2, 2, 4, 1, 4], 6], "expected": 3 },
  { "input": [[], 10], "expected": 0 },
  { "input": [[5], 5], "expected": 1 },
  { "input": [[5, 6], 5], "expected": -1 },
  { "input": [[2, 2, 2], 2], "expected": 3 },
  { "input": [[1, 1, 1, 1], 100], "expected": 1 },
  { "input": [[1000000000, 999999999], 1000000000], "expected": 2 }
]
```

### Solución
```javascript
function diasParaEnviar(pesos, capacidad) {
  if (pesos.length === 0) return 0;          // nada que enviar
  for (const p of pesos) {
    if (p > capacidad) return -1;            // jamas cabria: imposible ANTES de simular
  }
  let dias = 1, carga = 0;
  for (const p of pesos) {
    if (carga + p > capacidad) {             // estricto: igual-a-capacidad SI cabe
      dias++;
      carga = 0;
    }
    carga += p;
  }
  return dias;
}
```
```python
def dias_para_enviar(pesos, capacidad):
    if not pesos:
        return 0        # nada que enviar
    for p in pesos:
        if p > capacidad:
            return -1   # jamas cabria: imposible ANTES de simular
    dias = 1
    carga = 0
    for p in pesos:
        if carga + p > capacidad:   # estricto: igual-a-capacidad SI cabe
            dias += 1
            carga = 0
        carga += p
    return dias
```

### Pistas
- El -1 se decide en una pasada de validación ANTES del greedy — es el check de imposibilidad del libro convertido en código: si un paquete no cabe solo, ninguna cantidad de días lo salva.
- La comparación es estricta (carga + p > capacidad): el paquete que llena el día EXACTO se queda en ese día. Cambiarla a ≥ abre días de más y corre todos los conteos.
- Con pesos no vacíos, dias arranca en 1 — el primer paquete no «abre» un día extra. Verifica con [5] y capacidad 5: un día, no dos ni cero.

## El ritual de los 30 segundos antes de binarizar
type: production
tiempo: 5

Sin mirar el libro, escribe la checklist que corres ANTES de teclear una búsqueda binaria sobre la respuesta en el OA: las cuatro verificaciones en orden, la pregunta exacta de cada una, y qué haces si alguna falla.

### Modelo
1. ¿Hay UN escalar que gobierna todo el proceso y piden su mínimo/máximo tal que algo sea posible? Si lo que se vigila es una condición punto a punto con parámetros ya dados, es simulación/greedy directa — no hay nada que binarizar.
2. ¿Puedo bosquejar feasible(X) como una simulación barata, y es MONÓTONA? La pregunta explícita: ¿más recurso (capacidad, tiempo, presupuesto) puede EMPEORAR la factibilidad bajo alguna regla del enunciado? Re-verifícala bajo CADA regla de negocio adicional (fragilidad, prioridades) — no la heredes del problema base. Si no hay monotonía, binary search no aplica y hay que remodelar.
3. ¿lo y hi cubren la respuesta BAJO la regla nueva? Re-deriva los límites (¿la respuesta puede superar la suma? ¿el mínimo por elemento subió?) en vez de copiarlos del esqueleto conocido — un rango corto converge igual y devuelve basura sin avisar.
4. ¿Existe el caso imposible y qué centinela exige el enunciado? Detéctalo ANTES de buscar (o verifica la factibilidad del resultado al final) y devuelve EXACTAMENTE lo pedido (-1 o lo que el contrato diga) — la plantilla converge siempre y jamás va a emitir el centinela por ti.
Después de las cuatro: teclea la ESTRUCTURA de búsqueda primero (idéntica siempre) y llena feasible al final.

### Regla
Los cuatro puntos atacan los cuatro modos de fallo del patrón bajo reloj, en orden de costo: elegir la familia equivocada (1), binarizar un predicado sin monotonía — que da mal SIN error visible — (2), converger dentro de un rango que no contiene la respuesta (3), y reportar un número donde el juez esperaba el centinela (4). El orden importa porque cada verificación es más barata que teclear: cualquiera que falle te ahorra los 15 minutos de implementar una búsqueda condenada, y las cuatro juntas caben en 30 segundos.

### Rúbrica
- El punto 1 formula la frontera con la simulación directa: escalar único que gobierna el proceso contra condición punto a punto con parámetros dados.
- El punto 2 hace la pregunta de monotonía EXPLÍCITA («¿más recurso puede empeorar?») y la re-verifica bajo cada regla de negocio adicional, no la hereda.
- El punto 3 re-deriva lo y hi bajo la regla nueva en vez de copiar max/suma del problema base, y nombra el modo de fallo (converge a basura sin avisar).
- El punto 4 nombra el centinela exacto del enunciado y DÓNDE se decide (antes de buscar, o verificando la factibilidad del resultado).
- Cierra con «estructura primero, feasible después», y lo escribiste de memoria en 5 minutos o menos.
