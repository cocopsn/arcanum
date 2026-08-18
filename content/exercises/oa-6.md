---
module_id: ce000000-0000-4000-8000-000000000007
spine: OA Amazon
title: Ejercicios — Heap / Top-K
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-6-heap-topk.md)
version: 1
---

# Heap / Top-K — banco de reconocimiento

Banco de reflejo OA (OA Amazon): entrena el reconocimiento en segundos de la firma de heap — «los K más frecuentes/grandes» y «el mejor disponible cada vez, repetidamente, cuando ese mejor CAMBIA tras cada operación» — y la memoria muscular de `heapq`: min-heap puro que exige negar para máximos, tuplas para desempates deterministas y heapify sobre la lista completa cuando ya tienes todo de antemano. Los drills de código se validan LOCALMENTE contra casos unitarios; NO son el juez — el veredicto real lo da el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: exceder la meta señala qué reflejo falta. Todo anclado a `oa-6-heap-topk.md`.

## Los diez productos estrella entre un millón de eventos
type: multiple_choice
tiempo: 3

El log del día trae 10⁶ eventos de compra y el reporte pide los 10 productos más frecuentes. ¿Cuál es la estructura correcta, con qué costo, y por qué no ordenar todos los conteos?

### Opciones
- [x] Cuenta frecuencias con un hashmap (O(n)) y mantén un min-heap de tamaño EXACTAMENTE k = 10 sobre los conteos: un conteo nuevo entra solo si supera al mínimo del heap, y ese mínimo sale — O(n log k) total. Frente a ordenar todos los conteos (O(n log n)), la ganancia es real precisamente porque k = 10 es muchísimo menor que n = 10⁶; con k cercano a n la diferencia se vuelve marginal y ordenar sería defendible.
- Inserta los n conteos en un max-heap con heappush uno por uno y extrae 10: cuesta lo mismo que el heap de tamaño 10.
- El hashmap de frecuencias ya lo resuelve solo: sus valores dicen cuáles son los 10 mayores sin ninguna estructura adicional.
- Ordenar siempre gana en la práctica: sort está optimizado en C y las cotas asintóticas no aplican con n = 10⁶.
### Justificación
Es el patrón Top-K del libro con su matiz honesto incluido: O(n log k) gana cuando k es mucho menor que n — que es exactamente este caso (10 contra 10⁶) — y el propio libro admite que con k comparable a n la ganancia es marginal. El heappush uno-por-uno cuesta O(n log n), no lo mismo: pierde justo la ventaja que se buscaba, y si de todos modos vas a meter los n elementos, la construcción correcta es heapify (O(n)), no un loop de inserciones. El hashmap cuenta pero no ordena por valor: un mapa no es una estructura ordenada por frecuencia, así que extraer los 10 mayores de él sigue costando un heap, una selección o un sort — la composición Counter + heap es de dos pasos, no de uno. Y «sort siempre gana» apuesta la cota a una constante: con n = 10⁶ el factor log(n)/log(k) es real, y el reflejo que el OA mide es reconocer la cota, no confiar en la suerte de la constante.

## El máximo con una librería que solo mira hacia abajo
type: multiple_choice
tiempo: 2

En Python necesitas extraer repetidamente el servidor de MAYOR capacidad usando `heapq`. ¿Cuál es la técnica correcta y cuál es su trampa característica?

### Opciones
- [x] Negar en las DOS puntas: `heappush(heap, -x)` al insertar y `-heappop(heap)` al extraer — `heapq` implementa únicamente min-heap, y con los valores negados el «menor» interno es tu máximo real. Olvidar la negación en cualquiera de los dos lados no lanza ningún error: entrega el mínimo (o un valor negativo) y el programa sigue corriendo con la respuesta equivocada.
- `heapq.heapify(lista, reverse=True)` construye el max-heap directo, igual que el reverse de sorted().
- Pasarle `key=lambda x: -x` a heappush, como se hace con sort, min y max.
- Consultar `max(heap)` sobre la lista interna: es O(1) porque el heap ya mantiene sus elementos ordenados.
### Justificación
Es el reflejo de una línea que el libro manda memorizar, y su trampa número uno: la negación es un contrato de dos puntas, y romperlo por cualquiera de las dos produce un bug SILENCIOSO — sin error de sintaxis, con salida plausible. `heapify` no acepta `reverse=True`: esa firma es de sorted/sort, y asumirla es trasplantar la API equivocada. `heappush`/`heappop` tampoco aceptan `key`: la comparación es la de los elementos mismos — por eso existen el truco de negar y las tuplas como sustitutos del comparador. Y `max(heap)` sobre la lista interna es doblemente falso: la lista de un heap NO está ordenada (solo garantiza el mínimo en la posición 0), y ese max() es un barrido O(n) — pagarlo por operación es regresar al costo lineal repetido que el heap existe para evitar.

## Clientes en orden, capacidad que se encoge
type: multiple_choice
tiempo: 4

Los clientes llegan EN ORDEN. Cada uno se asigna al servidor con MAYOR capacidad disponible; el costo de esa asignación es la capacidad disponible del servidor en ese momento, y después la capacidad se reduce por la demanda del cliente. Si ni el mayor alcanza, el cliente se rechaza sin costo. Con n servidores y m clientes (ambos hasta 10⁵), ¿cuál es la estructura correcta y por qué fallan las alternativas?

### Opciones
- [x] Max-heap con extracción y RE-INSERCIÓN: sacas el mayor (O(log n)), cobras su capacidad, la reduces por la demanda y la re-insertas (O(log n)) — el «mayor disponible» CAMBIA tras cada asignación, y el heap es la única de estas opciones que re-ordena incrementalmente a ese precio; total O((n + m) log n). Un orden estático no sobrevive a la primera reducción, y buscar el máximo con max() por cliente es O(n·m).
- Ordena los servidores descendente UNA vez y asigna recorriendo esa lista: como las capacidades solo bajan, el orden inicial se mantiene válido.
- max(capacidades) por cliente, con remove() del elegido y append() del reducido: son operaciones nativas de lista y por eso rápidas.
- Re-ejecuta heapify(lista) completo después de cada asignación, para restaurar la propiedad de heap tras el cambio.
### Justificación
Es la familia «el máximo disponible que cambia» del libro, con su aritmética: muchas operaciones sobre un mejor-candidato dinámico exigen O(log n) por operación, no O(n). El orden estático miente en cuanto el primer valor cambia: con servidores {8, 5} y una demanda de 4, el 8 se convierte en 4 y el líder pasa a ser el 5 — «solo bajan» es precisamente la razón de que el ranking CAMBIE de líder, no de que se conserve. max() + remove() son dos barridos O(n) por cliente — O(n·m) ≈ 10¹⁰ con estos límites, el TLE que la tabla de fundamentos rechaza — y que sean «nativas» no las hace baratas. Y re-heapify completo tras cada asignación es la tercera trampa OA del libro, literal: O(n) por operación reintroduce exactamente el costo que heappush/heappop incrementales (O(log n)) existen para evitar.

## Empates que deben salir siempre igual — el desempate viaja en la tupla
type: multiple_choice
tiempo: 3

El reporte de top-k por frecuencia exige que, en empate de frecuencia, gane el producto alfabéticamente menor — y que el resultado sea idéntico entre corridas. En Python, ¿cómo se codifica ese desempate?

### Opciones
- [x] Mete TUPLAS al heap con el criterio completo: `(-frecuencia, producto)` en un min-heap — la comparación de tuplas evalúa la frecuencia negada primero (más frecuente sale antes) y solo en empate compara el producto ascendente, así que cada heappop entrega directamente el siguiente del orden final: el desempate queda determinista POR CONSTRUCCIÓN, no por suerte de inserción.
- El heap respeta el orden de inserción entre elementos que comparan iguales, así que basta insertar los productos en orden alfabético.
- Usa `(frecuencia, producto)` sin negar y toma los elementos «del final» del heap, que es donde quedan los grandes.
- El desempate no es asunto del heap: extrae los k con cualquier orden y aplica un sort alfabético al resultado final.
### Justificación
El tuple-trick es la manera idiomática de sustituir el comparador que heapq no acepta: el criterio entero viaja DENTRO del elemento. El heap NO es estable ni respeta inserción: sift-up y sift-down reordenan por comparación, y ante tuplas idénticas el layout interno depende del historial de operaciones — nada determinista sale de ahí. «El final del heap» no existe: la lista interna solo garantiza el mínimo en la posición 0; los grandes están regados por cualquier parte. Y el sort posterior tiene dos fallas: un sort SOLO alfabético destruye el orden por frecuencia que el reporte pide; y si el heap era de tamaño acotado k con `(frecuencia, producto)` a secas, los DESCARTES del borde ya se decidieron con el criterio equivocado (ante empate expulsa al alfabéticamente menor — justo el que debía quedarse), y ningún reordenamiento posterior recupera lo que ya se tiró.

## Cien mil capacidades de antemano — construir sin pagar de más
type: multiple_choice
tiempo: 3

Ya tienes las 10⁵ capacidades en una lista ANTES de procesar al primer cliente. ¿Cuál es la construcción inicial correcta del heap y por qué?

### Opciones
- [x] `heapq.heapify(lista)` sobre la lista completa: O(n), contra el O(n log n) del loop de heappush elemento por elemento — cuando todos los elementos iniciales existen de antemano, heapify es estrictamente mejor y además menos código bajo reloj. La inserción incremental queda para lo que LLEGA después de construido.
- heapify también es O(n log n): hace lo mismo que n inserciones, solo que en una sola llamada, así que elegir entre ambos es cuestión de estilo.
- heapify solo es O(n) si la lista ya viene parcialmente ordenada; sobre datos arbitrarios degrada a O(n log n).
- Da igual cómo construyas: lo caro son las extracciones posteriores, y ese costo no depende de la construcción.
### Justificación
Es la nota operativa del libro (heapify sobre la lista completa, no un loop de heappush), respaldada por la prueba de primer principio de `itc-c5-heaps`: la suma de alturas acota heapify en O(n) porque la mayoría de los nodos viven cerca de las hojas y se hunden poco. «Hace lo mismo que n inserciones» es exactamente la concepción errónea que esa prueba desmonta — sift-down desde abajo NO equivale a n sift-up desde arriba. El O(n) de heapify es peor caso sobre datos ARBITRARIOS: no depende de ningún pre-orden de la entrada. Y la construcción sí pesa en el total: con n = 10⁵ son ~10⁵ operaciones contra ~1.7×10⁶ — y el hábito de heapify-cuando-ya-tienes-todo es de los que el libro pide tener automáticos, porque bajo reloj nadie recalcula estas cuentas.

## El reflejo anti-TLE: máximo que cambia, repetido
type: multiple_choice
tiempo: 3

Tu prototipo hace `mayor = max(pendientes)` seguido de `pendientes.remove(mayor)` dentro del loop de clientes, re-agregando el valor procesado si sigue siendo positivo. Con n y m hasta 10⁵, pasa los ejemplos chicos del enunciado. ¿Qué debe disparar tu reflejo antes de enviar?

### Opciones
- [x] La firma «el mayor disponible cada vez, repetidamente, y cambia tras cada operación» exige heap: max() es O(n) y remove() otro O(n) por cliente — O(n·m) ≈ 10¹⁰ con estos límites, TLE aunque la lógica sea correcta en chico; con heap, extracción y re-inserción cuestan O(log n) y el total baja a O((n + m) log n). El error no es de lógica sino de reflejo: reconocer la firma a tiempo, antes de enviar.
- El código es correcto y con eso basta: los jueces de OA ponderan corrección, no velocidad de ejecución.
- El problema es solo remove(), que es O(n): guardando el índice del máximo y sobreescribiéndolo en sitio, max() queda gratis.
- Reemplaza la lista por un sort descendente único al inicio y consume en ese orden: mismo resultado sin heap.
### Justificación
Es la trampa OA del libro casi literal: la búsqueda lineal del máximo dentro de un proceso repetido es O(n²) escrito sin darse cuenta, y el enunciado ya te dio la pista con los límites — en un OA los límites SON parte del problema, y correcto-pero-cuadrático con 10⁵ no pasa: el juez corta por tiempo. Arreglar solo remove() deja el max() O(n) intacto: sigues en O(n·m), solo que con la mitad del desperdicio. Y el sort único no falla solo de costo sino de CORRECTITUD: el valor procesado se re-agrega modificado y puede dejar de ser (o volver a ser) el mayor — el orden estático miente en cuanto el primer elemento cambia, el mismo argumento del ejercicio de asignación de este banco.

## La negación que faltó — traza del pop
type: trace
tiempo: 4

Este fragmento intenta tomar el servidor de mayor capacidad para una demanda de 6:

```python
import heapq

capacidades = [10, 4, 7]
heap = [-c for c in capacidades]
heapq.heapify(heap)

mayor = heapq.heappop(heap)      # BUG: falta negar aqui
if mayor >= 6:
    print("asignado con capacidad", mayor)
else:
    print("rechazado")
```

¿Qué imprime exactamente?

### Opciones
- [x] Imprime «rechazado»: el heap contiene los negados [-10, -4, -7] y la raíz del MIN-heap es −10 (el menor); heappop devuelve −10 tal cual, y como el código no lo vuelve a negar, la comparación es −10 >= 6 → falso. El servidor MÁS grande del parque termina «rechazando» una demanda que cubría de sobra — sin ninguna excepción que delate el bug, que es la mitad olvidada del contrato de negación contra la que el libro advierte.
- Imprime «asignado con capacidad 10»: heapify detecta los valores negativos y reordena la lista como max-heap.
- Imprime «asignado con capacidad -10»: el −10 pasa el umbral porque las comparaciones aplican valor absoluto.
- Lanza TypeError: mezclar negativos con heappop no está permitido en heapq.
### Justificación
La negación es un contrato de DOS puntas — negar al insertar y negar al extraer — y este código solo cumplió la primera: entre los negados, el «menor» interno es el de mayor magnitud (−10), así que heappop lo devuelve crudo y la comparación con 6 falla. heapify no sabe nada de tu convención: ordena por comparación estándar, sin detectar intenciones — creer que «entiende» los negativos es atribuirle semántica que no tiene. No existe ningún valor absoluto implícito en las comparaciones de Python: −10 >= 6 es simplemente falso. Y nada lanza: los enteros negativos son elementos perfectamente válidos de un heap. Lo importante es la FORMA del fallo: salida plausible («rechazado» es un resultado legal del negocio), cero excepciones, y río abajo el sistema asignaría nada y cobraría 0 — el peor tipo de bug para cazar bajo reloj.

## log de QUÉ — el costo real del top-k
type: complexity
tiempo: 3

n = 10⁶ eventos, d ≤ n productos distintos, y un heap de tamaño acotado k = 10 para quedarte con los más frecuentes. ¿Cuál es la complejidad total y sobre qué cantidad va el logaritmo?

### Opciones
- [x] O(n log k): O(n) del conteo, más un costo log k por cada conteo que toca el heap — porque el heap NUNCA crece más allá de k elementos, y la altura que pagas es la del heap concreto que tienes, no la del input. El logaritmo va sobre k, el TAMAÑO del heap: con k = 10 cada operación cuesta ~3 niveles, sin importar que n sea un millón.
- O(n log n): cualquier algoritmo que lleve un heap dentro paga log n por operación, por definición de heap.
- O(n · k): por cada evento comparas linealmente contra los k candidatos actuales del reporte.
- O(n): el conteo es lineal, y una vez contado, seleccionar los k mayores es gratis.
### Justificación
Es la cota del patrón Top-K del libro, y la pregunta discrimina lo mismo que su gemela de binary search: log ¿de qué? La altura de un heap la fija SU tamaño, y aquí el tope es k por diseño — en cuanto sobra un elemento, el mínimo sale — así que log n nunca entra en escena: «heap ⇒ log n» ignora de qué heap se habla. O(n·k) describe la alternativa sin estructura: buscar linealmente entre los k candidatos por cada elemento — la consulta O(1) del mínimo (la raíz) más el ajuste O(log k) es justo lo que la evita. Y O(n) total es falso: contar es lineal, pero la SELECCIÓN de los k mayores entre d conteos no es gratis — algún mecanismo de orden parcial (heap, selección o sort) tiene que cobrar su parte, y fingir que no existe es donde nacen los reportes O(n) que luego no explican su propio sort.

## Plantilla: top-k frecuentes con desempate declarado
type: code
tiempo: 15

Drill del patrón Top-K con el desempate DECLARADO para que el resultado sea determinista — la parte que en el OA se olvida y produce respuestas «casi correctas». En Python, ejercita el heap con el tuple-trick (ese es el drill de memoria muscular); en JavaScript no hay heap en la librería estándar, y ordenar con el comparador equivalente es la jugada honesta bajo reloj — la misma decisión que la nota del libro sobre las utilidades ya hechas: no reimplementes lo que no te da ventaja. Validado localmente; no es el juez.

### Especificación
`topKFrecuentes(items, k)`:
- `items`: arreglo de strings. `k`: entero ≥ 0.
- Cuenta la frecuencia de cada string y devuelve los `k` más frecuentes, como arreglo de strings.
- ORDEN DEL RESULTADO (obligatorio, se verifica exacto): frecuencia DESCENDENTE; en empate de frecuencia, orden lexicográfico ASCENDENTE (comparación estándar de strings del lenguaje).
- Si `k` ≥ número de strings distintos → todos los distintos, en ese mismo orden.
- `k = 0` o `items` vacío → arreglo vacío.

### Firma
```javascript
function topKFrecuentes(items, k) {
  // TODO: cuenta con Map; ordena por (frecuencia DESC, string ASC); toma los primeros k
  return [];
}
```
```python
def top_k_frecuentes(items, k):
    # TODO: Counter + heap de tuplas (-frecuencia, palabra); extrae k veces
    return []
```

### Casos
```json
[
  { "input": [["a", "a", "a", "b", "b", "c"], 2], "expected": ["a", "b"] },
  { "input": [["x"], 1], "expected": ["x"] },
  { "input": [["b", "a", "b", "a"], 2], "expected": ["a", "b"] },
  { "input": [["z", "y", "z", "y", "x"], 5], "expected": ["y", "z", "x"] },
  { "input": [[], 3], "expected": [] },
  { "input": [["a", "b", "c"], 0], "expected": [] },
  { "input": [["manzana", "pera", "manzana", "uva", "pera", "manzana"], 2], "expected": ["manzana", "pera"] },
  { "input": [["d", "b", "c", "a"], 2], "expected": ["a", "b"] }
]
```

### Solución
```javascript
function topKFrecuentes(items, k) {
  const freq = new Map();
  for (const it of items) freq.set(it, (freq.get(it) ?? 0) + 1);
  const entradas = [...freq.entries()];
  // Sin heap en la libreria estandar de JS: el comparador declara el criterio
  // completo (frecuencia DESC, empate lexicografico ASC) y el sort lo aplica.
  entradas.sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entradas.slice(0, Math.max(0, k)).map((e) => e[0]);
}
```
```python
import heapq
from collections import Counter

def top_k_frecuentes(items, k):
    freq = Counter(items)
    # tuple-trick: (-frecuencia, palabra) — el min-heap entrega primero la
    # frecuencia mas alta y, en empate, la palabra lexicograficamente menor.
    tuplas = [(-f, w) for w, f in freq.items()]
    heapq.heapify(tuplas)               # O(d): ya tienes todos los elementos
    salida = []
    for _ in range(min(max(k, 0), len(tuplas))):
        f, w = heapq.heappop(tuplas)
        salida.append(w)
    return salida
```

### Pistas
- Python: la tupla `(-f, palabra)` hace el trabajo completo — el min-heap saca primero la frecuencia más alta y desempata por la palabra menor, sin comparador custom. heapify sobre todas las tuplas (O(d)) y k pops (O(k log d)) entregan el orden declarado directamente.
- Ojo con el heap acotado de tamaño k aquí: con `(frecuencia, palabra)` a secas, los empates del borde expulsan a la palabra alfabéticamente menor — la que debía quedarse. Para este contrato, heapify completo + k extracciones es más simple Y correcto.
- JavaScript: sin heap en la librería estándar, el comparador (frecuencia descendente, y en empate comparación de strings ascendente) sobre las entradas del Map produce exactamente el mismo orden; corta con slice(0, k).

## Plantilla: costo de asignaciones con max-heap y re-inserción
type: code
tiempo: 20

Drill del escenario central del libro — el máximo disponible que CAMBIA tras cada operación: cada cliente se asigna al servidor de mayor capacidad disponible, el costo es esa capacidad en ese momento, y la capacidad reducida se re-inserta porque puede volver a ser (o dejar de ser) la mayor. En Python es el max-heap simulado con negación en las dos puntas; en JavaScript el heap se construye a mano — también es memoria muscular útil para el OA. Validado localmente; no es el juez.

### Especificación
`costoAsignaciones(capacidades, demandas)`:
- `capacidades`: arreglo de enteros ≥ 0 (capacidad disponible por servidor). `demandas`: arreglo de enteros > 0, en ORDEN de llegada de los clientes.
- Por cada demanda, en orden: toma el servidor con MAYOR capacidad disponible en ese momento. Si no hay servidores o esa capacidad máxima es MENOR que la demanda → el cliente se RECHAZA: no suma costo y ninguna capacidad cambia. Si alcanza → suma al costo total la capacidad disponible de ese servidor (ANTES de reducirla), réstale la demanda, y el servidor sigue disponible con la capacidad reducida.
- Devuelve el costo total acumulado (entero).
- Sin servidores, sin clientes, o con todos los clientes rechazados → `0`.
- Empates de capacidad máxima: da igual cuál de los empatados tomes — cuestan lo mismo y dejan el mismo multiconjunto de capacidades, así que el costo total es único.

### Firma
```javascript
function costoAsignaciones(capacidades, demandas) {
  // TODO: max-heap a mano (heapify + sift); rechazo si el mayor < demanda;
  // costo += capacidad ANTES de reducir; re-inserta la capacidad reducida
  return 0;
}
```
```python
def costo_asignaciones(capacidades, demandas):
    # TODO: heapq con negacion en las DOS puntas (max-heap simulado); rechazo si el mayor < demanda;
    # costo += capacidad ANTES de reducir; re-inserta la capacidad reducida
    return 0
```

### Casos
```json
[
  { "input": [[10, 4, 7], [3, 5, 2]], "expected": 24 },
  { "input": [[8, 5], [4, 4]], "expected": 13 },
  { "input": [[5], [6]], "expected": 0 },
  { "input": [[], [1, 2]], "expected": 0 },
  { "input": [[3, 3], []], "expected": 0 },
  { "input": [[4], [4, 1]], "expected": 4 },
  { "input": [[2, 2], [3, 3, 3]], "expected": 0 },
  { "input": [[6, 6], [6, 6]], "expected": 12 },
  { "input": [[9007199254740000], [1]], "expected": 9007199254740000 }
]
```

### Solución
```javascript
function costoAsignaciones(capacidades, demandas) {
  // Max-heap binario sobre un array: sin heap en la libreria estandar de JS, se construye a mano.
  const h = capacidades.slice();
  const bajar = (i) => {
    for (;;) {
      let m = i;
      const izq = 2 * i + 1, der = 2 * i + 2;
      if (izq < h.length && h[izq] > h[m]) m = izq;
      if (der < h.length && h[der] > h[m]) m = der;
      if (m === i) break;
      const t = h[m]; h[m] = h[i]; h[i] = t;
      i = m;
    }
  };
  const subir = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p] >= h[i]) break;
      const t = h[p]; h[p] = h[i]; h[i] = t;
      i = p;
    }
  };
  for (let i = (h.length >> 1) - 1; i >= 0; i--) bajar(i);  // heapify: O(n), no O(n log n)
  const sacar = () => {
    const tope = h[0], ultimo = h.pop();
    if (h.length) { h[0] = ultimo; bajar(0); }
    return tope;
  };
  const meter = (x) => { h.push(x); subir(h.length - 1); };

  let costo = 0;
  for (const d of demandas) {
    if (h.length === 0 || h[0] < d) continue;  // rechazado: sin costo, nada cambia
    const cap = sacar();
    costo += cap;                              // el costo es la capacidad ANTES de reducir
    meter(cap - d);                            // re-inserta: puede volver a competir por ser el mayor
  }
  return costo;
}
```
```python
import heapq

def costo_asignaciones(capacidades, demandas):
    heap = [-c for c in capacidades]      # negar al insertar: heapq solo es min-heap
    heapq.heapify(heap)                   # O(n), no O(n log n)
    costo = 0
    for d in demandas:
        if not heap or -heap[0] < d:      # el mayor disponible no alcanza: rechazo sin costo
            continue
        cap = -heapq.heappop(heap)        # negar de vuelta al extraer (las DOS puntas)
        costo += cap                      # el costo es la capacidad ANTES de reducir
        heapq.heappush(heap, -(cap - d))  # re-inserta reducida: puede volver a ser la mayor
    return costo
```

### Pistas
- El costo se cobra ANTES de reducir: primero suma la capacidad extraída, luego réstale la demanda y re-inserta. Invertir ese orden cobra de menos en cada asignación.
- La re-inserción es el corazón del patrón: el caso [8, 5] con demandas [4, 4] lo delata — tras servir al primero, el 8 se vuelve 4 y el líder pasa a ser el 5; quien no re-inserta (o sigue usando el orden inicial) responde 12 en vez de 13.
- El rechazo consulta sin extraer: la raíz (h[0] en JS, -heap[0] en Python) es O(1) — solo se hace pop cuando la asignación va a ocurrir. Y en Python, la negación va en las DOS puntas: el trace de este banco muestra qué pasa cuando falta una.
