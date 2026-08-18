---
module_id: ce000000-0000-4000-8000-000000000006
spine: OA Amazon
title: Ejercicios — Greedy con observación
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-5-greedy-observation.md)
version: 1
---

# Greedy con observación — banco de reconocimiento

Banco de reflejo OA (OA Amazon): cada ejercicio entrena la disciplina que este libro fija — deducir la OBSERVACIÓN escondida detrás de la regla de negocio (paridad, orden, un extremo) ANTES de tocar el teclado, y probarla con un exchange argument o un contraejemplo deliberado de 3-4 elementos antes de apostar el problema entero a una intuición. Los drills de código son plantillas validadas LOCALMENTE contra casos unitarios; NO son el juez — el veredicto real lo da el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si la excedes, el drill te está diciendo qué reflejo falta todavía. Todo anclado a `oa-5-greedy-observation.md`.

## Centros mínimos para cubrir la demanda regional
type: multiple_choice
tiempo: 3

Amazon Logistics debe surtir una demanda regional de 100,000 unidades. Hay N centros de distribución, cada uno con inventario `c_i`; activar un centro cuesta lo mismo sin importar su tamaño. Encuentra el número MÍNIMO de centros a activar para cubrir la demanda. N hasta 10⁵, inventarios hasta 10⁹. ¿Cuál es la regla correcta, y por qué es correcta y no solo razonable?

### Opciones
- [x] Ordena los inventarios DESCENDENTE y activa siempre el mayor disponible hasta cubrir (−1 si ni con todos alcanza): el exchange argument la protege — si una solución óptima usara un centro chico habiendo uno más grande disponible, intercambiarlos cubre al menos lo mismo sin usar más centros, así que siempre existe un óptimo que prioriza los grandes primero.
- Activa en cada paso el centro cuyo inventario quede MÁS CERCANO a la demanda restante, para no desperdiciar inventario grande en demanda chica.
- Programación dinámica tipo subset-sum sobre la demanda, porque un greedy nunca garantiza el mínimo exacto.
- Ordena ascendente y toma los chicos primero: así reservas los centros grandes para picos de demanda futuros.
### Justificación
Es la sección de proveedores mínimos del libro, con su prueba: el intercambio (centro chico ↔ el más grande disponible) nunca cubre menos ni usa más — por eso la regla no es una corazonada sino un teorema de dos líneas. El «más cercano a la demanda restante» es exactamente la intuición alternativa que el libro manda romper con un contraejemplo: demanda 10 y centros {9, 100} — el «más cercano» activa 9 (queda 1 pendiente) y luego 100, dos centros; mayor-primero activa 100 y termina con uno. La DP subset-sum es pseudo-polinomial en la demanda (hasta 10⁹ aquí: ni cabe en memoria) y además innecesaria — este greedy SÍ está probado, que es distinto de «los greedy no garantizan». Y el orden ascendente hace que cada paso aporte lo MENOS posible: maximiza el número de centros en vez de minimizarlo, como muestra el trace de este mismo banco.

## Dos camiones y una diferencia exacta — la paridad decide sin simular
type: multiple_choice
tiempo: 4

Una estación de carga reparte n contenedores con pesos exactamente 1, 2, …, n toneladas (uno de cada peso) entre dos camiones, A y B. El despachador pregunta si la diferencia (carga de A) − (carga de B) puede ser EXACTAMENTE T (T puede ser negativo). Con n hasta 10⁹, ¿cómo lo decides en O(1), y cuál es la observación que lo permite?

### Opciones
- [x] Alcanzable ⇔ |T| ≤ S y T tiene la MISMA paridad que S, con S = n(n+1)/2: mover el contenedor k de un camión al otro cambia la diferencia en exactamente 2k — una cantidad PAR — así que la paridad de la diferencia queda clavada en la de S desde el arreglo inicial «todo en A»; y como los pesos son 1..n, cualquier déficit par D = S − T se cubre eligiendo un subconjunto que sume D/2 (siempre existe si 0 ≤ D/2 ≤ S: toma greedy el mayor peso que quepa). No hay nada que simular.
- Hace falta backtracking sobre las 2ⁿ asignaciones: decidir una diferencia exacta es subset-sum, y subset-sum no admite atajos.
- Alcanzable ⇔ |T| ≤ S, sin condición extra: con n grande hay granularidad de sobra para ajustar cualquier valor intermedio.
- La paridad que importa es la de n, no la de S: con n par, cualquier T con |T| ≤ S se alcanza.
### Justificación
Es la señal del libro «restricciones de paridad implícitas en la suma»: cada movimiento salta de 2 en 2k, así que la paridad es un invariante — la mitad de los objetivos muere sin simular nada. La estructura 1..n es la que cierra la suficiencia, y por eso el distractor del backtracking es doblemente falso: con pesos ARBITRARIOS la condición de paridad-y-rango no basta (pesos {1,4}: S=5, T=1 cumple ambas y es inalcanzable — los valores posibles son 5, 3, −3, −5), pero con 1..n los subconjuntos alcanzan TODA suma de 0 a S, y la observación mata la exponencial (2ⁿ con n hasta 10⁹ ni siquiera arranca). «Solo |T| ≤ S» falla en el primer impar: T = S−1 es inalcanzable porque todo salto es par. Y la paridad de n no es la heredada: n=4 da S=10 (par) y T=3 sigue siendo imposible aunque n sea par — lo que se conserva es la paridad de S.

## El intercambio que no se arrepiente — qué prueba exactamente
type: multiple_choice
tiempo: 3

Tu compañero propone una regla greedy para un problema de asignación y te dice: «pasa los tres ejemplos del enunciado, dale submit». Según la disciplina del libro, ¿qué es un exchange argument y por qué es el paso que falta antes de enviar?

### Opciones
- [x] Supones una solución ÓPTIMA que en algún paso difiere de tu regla, intercambias esa elección por la que tu regla habría tomado, y muestras que el intercambio no empeora nada (cubre al menos lo mismo, no usa más recursos): eso prueba que siempre EXISTE un óptimo que coincide con tu greedy — y es lo que separa una regla probada de una intuición, porque los ejemplos del enunciado casi nunca están diseñados para exponer el contraejemplo.
- Ejecutar la regla sobre los ejemplos del enunciado: si los pasa todos, la evidencia empírica es suficiente para un OA.
- Probarla contra un caso aleatorio grande (n = 10⁵): si ahí coincide con la fuerza bruta, queda demostrada.
- Los contraejemplos de 3-4 elementos no aportan nada: los casos ocultos del juez son enormes y de otra naturaleza.
### Justificación
Es la prueba de la sección de proveedores, generalizada: intercambia la primera desviación del óptimo por la elección greedy y verifica que nada empeora — de ahí «la elección local no se arrepiente». «Pasa el ejemplo» es la trampa OA nombrada del libro: el ejemplo del enunciado está diseñado para ilustrar, no para romper tu regla, así que pasarlo no es evidencia. El caso aleatorio grande tampoco: los contraejemplos de un greedy suelen ser configuraciones adversariales precisas que el azar casi nunca genera (y comparar contra fuerza bruta con n = 10⁵ ni siquiera es computable). Y la última opción invierte el hábito central del libro: si tu regla está mal, casi siempre falla YA en miniatura — por eso los 30-60 segundos buscando un contraejemplo de 3-4 elementos son la herramienta, no una pérdida de tiempo.

## Corregir la paridad sin sacrificar el mínimo lexicográfico
type: multiple_choice
tiempo: 3

Generas un plan de precios posición por posición eligiendo siempre la opción menor (lexicográficamente óptimo sin restricción), pero la suma total debe ser par y te quedó impar. Tu compañero corrige cambiando la PRIMERA posición ajustable («arréglalo cuanto antes»). ¿Qué está mal y cuál es la regla correcta?

### Opciones
- [x] El ajuste va en la posición MÁS A LA DERECHA donde el cambio arregle la paridad: el orden lexicográfico pesa de izquierda a derecha, así que alterar una posición temprana agranda la secuencia de forma inmediata y definitiva, mientras que el cambio más tardío posible preserva intacto todo el prefijo que ya era óptimo — el mismo exchange argument de siempre: un ajuste que conserva más prefijo domina a uno que lo rompe antes.
- Da lo mismo la posición: el efecto sobre la paridad es idéntico en cualquiera, así que toda posición ajustable produce la misma secuencia final.
- Si la suma base salió impar, no existe secuencia válida: la paridad de la elección menor es la única alcanzable.
- Se necesita DP sobre posiciones × paridad para garantizar el mínimo lexicográfico exacto.
### Justificación
Es la deducción central de la sección de paridad del libro — deducida, no memorizada: comparar lexicográficamente da peso decreciente a cada posición sucesiva, y por eso el ajuste se empuja lo más a la derecha posible. El «da lo mismo» confunde dos efectos: sobre la PARIDAD todas las posiciones ajustables son equivalentes, pero sobre el ORDEN son radicalmente distintas — cambiar la posición 0 produce una secuencia mayor sin importar qué pase después. El «no existe» es falso siempre que alguna posición tenga delta impar entre sus dos opciones: el libro muestra que el ajuste mínimo es cambiar exactamente UNA posición, no reconstruir nada. Y la DP es el martillo pesado que el estilo anti-LLM castiga: el barrido de derecha a izquierda es O(n), correcto, y su corrección se argumenta en dos líneas.

## Treinta segundos antes de teclear
type: multiple_choice
tiempo: 2

Bajo reloj, tienes una regla que «se siente bien» para un problema de construcción paso a paso, pero no sabes por qué sería correcta. ¿Cuál es la jugada correcta según el libro?

### Opciones
- [x] Dedicar 30-60 segundos a construir deliberadamente un contraejemplo de 3-4 elementos; si no aparece Y puedes esbozar el exchange argument que protege la regla, codeas con confianza; si aparece, tu regla está mal y replanteas la observación — 60 segundos de papel son mucho más baratos que un Wrong Answer en un caso oculto.
- Codear de inmediato: el tiempo apremia, y si la regla falla el juez lo dirá y corriges sobre la marcha.
- Abandonar el greedy y escribir una DP exhaustiva por seguridad: nunca es incorrecta, solo más lenta.
- Verificarla contra el ejemplo del enunciado: si lo pasa, es evidencia suficiente de corrección.
### Justificación
Es el hábito protector de la sección de la trampa central, casi literal: contraejemplo deliberado primero, exchange argument como respaldo, y solo entonces teclado. «Que el juez lo diga» ignora cómo falla esta familia: el greedy incorrecto pasa los casos visibles y muere en silencio en los ocultos — para cuando el juez habla, ya gastaste el intento y no sabes ni en qué caso. La DP «por seguridad» es la técnica más pesada de la que el problema necesita (la definición misma del estilo anti-LLM): puede no caber en el tiempo de implementación, y con límites de 10⁹ su tabla de estados puede ni existir. Y el ejemplo del enunciado está diseñado para no exponer el fallo — pasarlo no discrimina entre una regla probada y una corazonada.

## Ruta circular de reparto — la observación que evita O(n²)
type: multiple_choice
tiempo: 4

Una ruta circular tiene n estaciones: en la estación i recargas `gas[i]` y avanzar a la siguiente cuesta `costo[i]`; el tanque nunca puede quedar negativo. Te garantizan que el gas total es ≥ el costo total. ¿Eso asegura que exista un inicio válido, y cómo lo encuentras en UNA pasada con n hasta 10⁵?

### Opciones
- [x] Sí lo asegura, y la observación es la que evita el O(n²): si arrancando en s el tanque se vuelve negativo justo al salir de la estación i, NINGÚN inicio dentro de (s..i] puede sobrevivir a i — cualquiera de ellos llega a cada estación intermedia con tanque menor o igual que el que traía s, que arrancó antes y venía acumulando — así que el siguiente candidato es directamente i+1: una pasada O(n), y el candidato que sobrevive al final es válido porque el total no es negativo.
- No lo asegura: gas total ≥ costo total es necesario pero no suficiente, así que hay que simular los n inicios posibles (O(n²)) para estar seguro.
- El mejor inicio es la estación con el mayor excedente local gas[i] − costo[i]: arrancar con la ganancia más grande maximiza el margen para el resto del recorrido.
- Ordena las estaciones por excedente descendente y recórrelas en ese orden, como el greedy de proveedores.
### Justificación
La observación de descarte-en-bloque es la misma disciplina que el libro conecta con el state-reset: reiniciar el candidato EXACTAMENTE cuando se viola la condición, con un argumento de dominancia detrás (un inicio posterior dentro del tramo muerto nunca trae más tanque que el candidato que ya venía acumulando). Y la suficiencia sí se sostiene: los prefijos descartados suman negativo, así que con total ≥ 0 la cola que queda los compensa — el candidato final completa la vuelta. El «mayor excedente local» es el greedy que se siente bien y está mal: con deltas [5, −6, 3, −1] (gas [6,0,4,1], costo [1,6,1,2]) el delta mayor está en la estación 0, que muere en el siguiente tramo; el único inicio válido es 2. Y ordenar estaciones destruye el problema: la ruta es CIRCULAR y el orden de visita está fijo — ordenar sirve para elegir subconjuntos (proveedores), no para recorrer un circuito.

## El sort que apunta al revés — traza del greedy de proveedores
type: trace
tiempo: 4

Este greedy de cobertura mínima ordena, pero alguien olvidó la dirección:

```python
def proveedores_minimos(demanda, capacidades):
    orden = sorted(capacidades)          # BUG: falta reverse=True
    cubierto, usados = 0, 0
    for cap in orden:
        if cubierto >= demanda:
            break
        cubierto += cap
        usados += 1
    return usados if cubierto >= demanda else -1

print(proveedores_minimos(100, [30, 50, 20, 40, 10]))
```

¿Qué imprime, y qué significa para el envío?

### Opciones
- [x] Imprime 4 (10+20+30+40 = 100) y termina sin ningún error — pero el óptimo es 3 (50+40+30 = 120): el greedy corre, cubre la demanda y devuelve un número plausible, solo que MAYOR que el mínimo. Es el fallo silencioso del libro: la dirección equivocada del sort produce una respuesta que parece legítima, y solo el juez oculto (o el exchange argument que nunca hiciste) la delata.
- Imprime 3: el break corta en cuanto se cubre la demanda, así que la dirección del orden no afecta el conteo final.
- Imprime -1: con el orden ascendente los proveedores chicos se agotan antes de alcanzar la demanda.
- Lanza IndexError al agotar la lista dentro del for.
### Justificación
Traza ascendente: 10→10, 20→30, 30→60, 40→100; al llegar al 50 el check de arriba corta — usados = 4. Descendente habría sido 50→50, 40→90, 30→120 y corte — 3. El break solo evita tomar proveedores DE MÁS una vez cubierta la demanda; no puede deshacer que cada paso ascendente aportó lo menos posible — la dirección del sort ES el resultado, que es exactamente lo que el exchange argument del libro prueba (el más grande disponible nunca se arrepiente). El −1 solo aparece si la SUMA TOTAL no alcanza, y aquí 150 ≥ 100. Un for sobre una lista jamás indexa fuera de rango. La lección: este bug no truena — devuelve un número razonable y sigue su vida, la firma de los greedy sin verificar.

## Dónde se va el tiempo del greedy de cobertura
type: complexity
tiempo: 3

n proveedores (hasta 10⁵), demanda hasta 10⁹. Tu solución: ordenar descendente y una pasada acumulando hasta cubrir. ¿Cuál es la complejidad total y qué término domina? ¿Y qué pasaría si, en vez de ordenar, buscaras el máximo restante con max() en cada paso?

### Opciones
- [x] O(n log n), dominado por el ORDENAMIENTO: la pasada greedy es O(n) y la observación cuesta O(1) de pensamiento — la dificultad nunca estuvo en el código. Buscar el máximo restante con max() en cada paso sería O(n) por extracción, O(n²) total (~10¹⁰ operaciones con n = 10⁵): TLE seguro; y si no pudieras ordenar de antemano, la estructura para «el mayor disponible, repetidamente» es un heap, no max() en un loop.
- O(n): la pasada acumulando es lineal, y el sort de la librería estándar es tan rápido que no cuenta para la cota.
- O(n²): todo greedy que compara cada proveedor contra la demanda restante es cuadrático por definición.
- O(n · demanda): el costo depende de cuántas unidades falten por cubrir, como en una DP pseudo-polinomial.
### Justificación
Sort O(n log n) + barrido O(n): domina el sort, y esa asimetría es el sello del estilo — codificar la regla es trivial una vez que la observación existe. «O(n) porque el sort es rápido» confunde velocidad práctica con cota asintótica: el sort sigue siendo n log n por muy optimizado que esté. «O(n²) por definición» describe justo el error alternativo (max() dentro del loop), no el greedy ordenado — y la salida de ese error es el heap de `oa-6-heap-topk`, que da el mayor disponible en O(log n) cuando no puedes pre-ordenar. Y «O(n · demanda)» sería la DP de cobertura exacta: con demanda hasta 10⁹ ni cabe en memoria, y es innecesaria — el greedy probado por intercambio ya entrega el mínimo.

## Plantilla: proveedores mínimos — ordenar descendente y acumular
type: code
tiempo: 15

Drill de la regla central del libro: la observación (el más grande primero) y su prueba (el intercambio nunca empeora) ya están hechas — aquí se entrena teclearla sin dudar y blindar los bordes que el OA sí evalúa. Validado localmente contra casos unitarios; no es el juez.

### Especificación
`proveedoresMinimos(inventarios, objetivo)`:
- `inventarios`: arreglo de enteros ≥ 0 (unidades disponibles por proveedor). `objetivo`: entero (unidades a cubrir).
- Devuelve el número MÍNIMO de proveedores cuya suma de inventarios alcanza `objetivo`, tomando siempre el de mayor inventario disponible.
- `objetivo <= 0` → `0` (nada que cubrir; también con lista vacía).
- Si ni usando TODOS los proveedores se alcanza → `-1`.
- Lista vacía con `objetivo > 0` → `-1`.
- No muta el arreglo de entrada.

### Firma
```javascript
function proveedoresMinimos(inventarios, objetivo) {
  // TODO: objetivo <= 0 → 0; ordena DESCENDENTE (una copia); acumula hasta cubrir; -1 si ni con todos
  return 0;
}
```
```python
def proveedores_minimos(inventarios, objetivo):
    # TODO: objetivo <= 0 → 0; ordena DESCENDENTE; acumula hasta cubrir; -1 si ni con todos
    return 0
```

### Casos
```json
[
  { "input": [[30, 50, 20, 40, 10], 100], "expected": 3 },
  { "input": [[10, 10, 10], 31], "expected": -1 },
  { "input": [[], 0], "expected": 0 },
  { "input": [[], 5], "expected": -1 },
  { "input": [[5, 5, 5], 0], "expected": 0 },
  { "input": [[100], 100], "expected": 1 },
  { "input": [[1, 2, 3], 6], "expected": 3 },
  { "input": [[3, 7], -5], "expected": 0 },
  { "input": [[50, 50], 100], "expected": 2 },
  { "input": [[9007199254740000, 991], 9007199254740991], "expected": 2 }
]
```

### Solución
```javascript
function proveedoresMinimos(inventarios, objetivo) {
  if (objetivo <= 0) return 0;                       // nada que cubrir: cero proveedores
  const orden = [...inventarios].sort((a, b) => b - a);  // DESCENDENTE, sobre una copia
  let cubierto = 0, usados = 0;
  for (const cap of orden) {
    if (cubierto >= objetivo) break;                 // ya se cubrio: no tomes de mas
    cubierto += cap;
    usados++;
  }
  return cubierto >= objetivo ? usados : -1;         // imposible: -1, nunca un numero optimista
}
```
```python
def proveedores_minimos(inventarios, objetivo):
    if objetivo <= 0:
        return 0                    # nada que cubrir: cero proveedores
    cubierto = 0
    usados = 0
    for cap in sorted(inventarios, reverse=True):   # DESCENDENTE: el mas grande primero
        if cubierto >= objetivo:
            break                   # ya se cubrio: no tomes de mas
        cubierto += cap
        usados += 1
    return usados if cubierto >= objetivo else -1
```

### Pistas
- La dirección del sort ES el resultado: descendente hace que cada proveedor tomado aporte lo máximo posible — el trace de este banco muestra qué devuelve la dirección contraria (un número plausible y equivocado).
- Chequea `cubierto >= objetivo` ANTES de tomar el siguiente proveedor: así `objetivo = 0` sale gratis con 0 proveedores y nunca tomas uno de más.
- El −1 se decide al FINAL, tras agotar la lista — decidirlo antes de intentar con todos es rendirse temprano.

## Plantilla: el circuito de combustible — reinicio probado, una pasada
type: code
tiempo: 20

Drill de la observación de descarte-en-bloque (el ejercicio de la ruta circular de este banco): un fracaso en la estación i descarta de golpe todos los inicios del tramo, y el total decide la existencia. La regla es trivial de teclear una vez que la observación está probada — que es la tesis del libro entero. Validado localmente; no es el juez.

### Especificación
`combustibleCircuito(gas, costo)`:
- `gas` y `costo` son arreglos de enteros ≥ 0 de la MISMA longitud n: la estación i aporta `gas[i]` y avanzar de i a `(i+1) mod n` cuesta `costo[i]`.
- El tanque inicia vacío en la estación elegida, y tras cada tramo no puede quedar negativo.
- Devuelve el MENOR índice de estación desde el cual se completa la vuelta entera (los n tramos), o `-1` si no existe ninguno.
- No se asume unicidad: si varios inicios son válidos, devuelve el menor de ellos.
- `n = 0` → `-1` (sin estaciones no hay de dónde iniciar).

### Firma
```javascript
function combustibleCircuito(gas, costo) {
  // TODO: una pasada; total decide EXISTENCIA; tanque negativo en i → candidato = i + 1, tanque = 0
  return 0;
}
```
```python
def combustible_circuito(gas, costo):
    # TODO: una pasada; total decide EXISTENCIA; tanque negativo en i → candidato = i + 1, tanque = 0
    return 0
```

### Casos
```json
[
  { "input": [[1, 2, 3, 4, 5], [3, 4, 5, 1, 2]], "expected": 3 },
  { "input": [[2, 3, 4], [3, 4, 3]], "expected": -1 },
  { "input": [[1, 1], [1, 1]], "expected": 0 },
  { "input": [[0, 2], [1, 1]], "expected": 1 },
  { "input": [[3, 1, 1, 10], [5, 1, 1, 1]], "expected": 1 },
  { "input": [[5], [5]], "expected": 0 },
  { "input": [[4], [5]], "expected": -1 },
  { "input": [[], []], "expected": -1 },
  { "input": [[9007199254740000, 0], [0, 9007199254740000]], "expected": 0 }
]
```

### Solución
```javascript
function combustibleCircuito(gas, costo) {
  const n = gas.length;
  if (n === 0) return -1;                 // sin estaciones no hay de donde iniciar
  let total = 0, tanque = 0, inicio = 0;
  for (let i = 0; i < n; i++) {
    const delta = gas[i] - costo[i];
    total += delta;
    tanque += delta;
    if (tanque < 0) {                     // ningun inicio en (candidato..i] sobrevive a i
      inicio = i + 1;
      tanque = 0;
    }
  }
  return total >= 0 ? inicio : -1;        // total negativo: imposible desde cualquier inicio
}
```
```python
def combustible_circuito(gas, costo):
    n = len(gas)
    if n == 0:
        return -1                   # sin estaciones no hay de donde iniciar
    total = 0
    tanque = 0
    inicio = 0
    for i in range(n):
        delta = gas[i] - costo[i]
        total += delta
        tanque += delta
        if tanque < 0:              # ningun inicio en (candidato..i] sobrevive a i
            inicio = i + 1
            tanque = 0
    return inicio if total >= 0 else -1
```

### Pistas
- Dos acumuladores con papeles distintos: `total` decide la EXISTENCIA (si termina negativo, es −1 sin importar el candidato) y `tanque` decide el CANDIDATO (si cae bajo cero al salir de i, el siguiente candidato es i+1 y el tanque se reinicia a 0).
- La observación que autoriza el salto: si desde el candidato actual mueres al salir de i, ningún inicio intermedio llega a i con más tanque que tú — descartarlos todos de golpe es lo que vuelve la pasada O(n).
- El candidato que sobrevive hasta el final es automáticamente el MENOR válido: cada inicio anterior a él fue descartado por un fracaso concreto, no por sospecha.
