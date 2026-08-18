---
module_id: ce000000-0000-4000-8000-000000000008
spine: OA Amazon
title: Ejercicios — Árboles binarios
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-7-trees.md)
version: 1
---

# Árboles binarios — banco de reflejo OA

Banco de reflejo de examen (OA Amazon): cada ejercicio entrena la estructura central del libro — el DFS que no solo desciende sino que **devuelve información hacia arriba** (escalar, par incluir/no-incluir, o distancia), y su excepción: las cotas que fluyen **hacia abajo** al validar un BST. Los enunciados vienen disfrazados de regla de negocio (jerarquías de categorías, centros de distribución, paquetes) porque el OA nunca dice «esto es un árbol» — reconocer la dirección del flujo de información en segundos es el drill. Los ejercicios de código son drills validados LOCALMENTE contra casos unitarios; NO son el juez real — el veredicto lo da el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: si te pasas, anota el patrón que te frenó y vuelve al libro. Todo anclado a `oa-7-trees.md`.

## Mostrar la jerarquía nivel por nivel — cola o pila
type: multiple_choice
tiempo: 3

El dashboard de Amazon Logistics debe listar la jerarquía de centros de distribución **nivel por nivel**: primero el hub nacional, luego todos los regionales, luego todos los locales — cada nivel como una lista separada. ¿Qué recorrido usas y qué estructura de datos lo sostiene?

### Opciones
- [x] Level-order (BFS) con una cola FIFO: metes la raíz, y en cada iteración procesas exactamente `len(cola)` nodos — los que estaban en la cola al empezar el nivel — encolando sus hijos para el nivel siguiente. Ese truco de congelar el tamaño de la cola al inicio de cada ronda es lo que separa los niveles en listas; los otros tres recorridos (inorder, preorder, postorder) son DFS con pila o recursión y entregan los nodos en un orden que mezcla niveles.
- Inorder recursivo: al visitar izquierda-nodo-derecha, los nodos salen agrupados por profundidad de forma natural.
- Preorder con pila explícita: la pila garantiza que los nodos del mismo nivel salgan juntos antes de bajar al siguiente.
- Postorder, porque procesa los hijos antes que el padre y eso equivale a procesar el nivel de abajo antes que el de arriba.
### Justificación
«Por niveles» es la señal literal de level-order en la sección 1 del libro: BFS puro con cola FIFO y el truco de `range(len(cola))` para procesar un nivel completo antes de pasar al siguiente — el patrón exacto que el libro manda memorizar para «por niveles» o «el valor más a la derecha de cada fila». Los tres distractores comparten el mismo defecto: son DFS (pila o recursión), y un DFS baja hasta el fondo de una rama antes de tocar la siguiente, así que mezcla profundidades — inorder sobre un árbol cualquiera no agrupa nada por nivel (agrupa por posición izquierda-derecha), preorder con pila sigue siendo DFS aunque la pila sea explícita, y postorder procesa hijos antes que padres POR RAMA, no por nivel global: el hijo profundo de la primera rama sale antes que el hijo superficial de la segunda. Cola = niveles; pila/recursión = ramas.

## El validador de catálogo que aprueba un árbol roto
type: multiple_choice
tiempo: 4

Un ingeniero valida el índice BST de precios de un catálogo comparando cada nodo **solo contra sus hijos directos**: `hijo_izq.val < nodo.val < hijo_der.val` en cada nodo. QA reporta que el árbol `[5,1,7,null,null,4,8]` (level-order) pasa su validación pero rompe las búsquedas. ¿Cuál es el defecto de diseño?

### Opciones
- [x] La propiedad BST es sobre TODO el subárbol, no sobre el hijo inmediato: el nodo 4 cumple localmente (4 < 7, es hijo izquierdo de 7) pero está dentro del subárbol DERECHO de 5, donde todo debe ser mayor que 5 — y 4 no lo es. La validación correcta pasa un rango `(minimo, maximo)` hacia abajo: al bajar a la izquierda el máximo se estrecha al valor del padre, al bajar a la derecha el mínimo se estrecha, y cada nodo se verifica contra el rango heredado de TODOS sus ancestros.
- El árbol sí es un BST válido y el problema de QA está en el código de búsqueda, no en el validador.
- El defecto es no comparar también contra el abuelo: verificando padre y abuelo en cada nodo la validación queda completa.
- El defecto es usar comparación estricta: con `<=` en vez de `<` el árbol pasaría a ser válido.
### Justificación
Es la trampa que la sección 3 del libro marca como el error más común y más silencioso de la familia: cada par padre-hijo puede ser localmente correcto y aun así violar la propiedad global dos niveles más abajo — exactamente lo que hace el 4 bajo el 7, que viola el mínimo heredado de 5. La cura es el rango `(minimo, maximo)` que fluye HACIA ABAJO (la excepción a la regla de «información hacia arriba» de la sección 2, porque la pregunta depende de los ancestros, no de los descendientes). El árbol NO es válido: buscar 4 desde la raíz iría por la izquierda de 5 y jamás lo encontraría — por eso las búsquedas rompen. Comparar contra el abuelo solo empuja la falla un nivel más abajo: un árbol más profundo viola la propiedad a tres niveles y pasa igual — ningún número fijo de ancestros basta, se necesita el rango acumulado completo. Y cambiar `<` por `<=` no toca el problema (4 tampoco cumple `4 >= 5`); solo cambiaría la política de duplicados.

## El punto de consolidación de dos paquetes
type: multiple_choice
tiempo: 3

Dos paquetes viajan por la jerarquía de rutas de un centro (un árbol binario). Para consolidarlos en un solo camión necesitas el centro más BAJO de la jerarquía que sea ancestro de ambos — el LCA. En la recursión estándar de LCA, la llamada sobre el hijo izquierdo devuelve un nodo no nulo Y la llamada sobre el hijo derecho también. ¿Qué significa?

### Opciones
- [x] El nodo actual ES el LCA: un paquete apareció en el subárbol izquierdo y el otro en el derecho, así que este nodo es exactamente el punto donde sus caminos desde la raíz se separan — la definición de ancestro común más bajo. Se devuelve el nodo actual hacia arriba, y los niveles superiores lo propagan sin modificarlo (en ellos solo un lado será no nulo).
- Es un estado imposible: cada paquete está en un solo lugar del árbol, así que a lo más una de las dos llamadas puede devolver algo no nulo.
- Significa que ambos paquetes son hijos directos del nodo actual, y hay que verificar aparte el caso en que estén más profundo.
- Significa que hay que seguir descendiendo por el lado izquierdo, porque el LCA siempre está en el subárbol que se explora primero.
### Justificación
Es la deducción literal de la sección 4 del libro: si encuentras `p` en un lado y `q` en el otro, el nodo actual es necesariamente el punto donde sus caminos se separan — no hay ancestro común más bajo posible, porque cualquier nodo más abajo deja fuera a uno de los dos. El «estado imposible» confunde la semántica del retorno: la llamada izquierda no devuelve «encontré a ambos», devuelve «encontré a p, a q, o su LCA dentro de este subárbol» — con uno en cada lado, ambas llamadas devuelven no nulo y eso es justo la señal útil. «Hijos directos» es un caso particular ya cubierto: la recursión corta en `raiz.val == p or raiz.val == q` a cualquier profundidad, sin caso especial. Y «seguir por la izquierda» invierte la lógica: se desciende SOLO cuando ambos están del MISMO lado (una llamada no nula); con lados distintos, descender descartaría al paquete del otro lado.

## Alertar centros a exactamente K saltos — sin punteros al padre
type: multiple_choice
tiempo: 4

Un centro reporta una falla y debes alertar a todos los centros a exactamente K saltos de él en la jerarquía (un árbol binario SIN punteros al padre). Usas el patrón del libro: un DFS que busca el objetivo y devuelve hacia arriba la distancia. La llamada sobre el hijo izquierdo del nodo actual devuelve `d` (el objetivo está a distancia `d` de ese hijo izquierdo). ¿Qué hace ahora el nodo actual?

### Opciones
- [x] El nodo actual está a `d + 1` del objetivo: si `d + 1 == k` se agrega a sí mismo al resultado; si no, lanza una recolección hacia ABAJO en su subárbol DERECHO buscando nodos a distancia restante `k - d - 2` (la raíz de ese subárbol está a `d + 2` del objetivo: `d + 1` hasta el nodo actual más 1 hasta su hijo derecho). En ambos casos devuelve `d + 1` hacia arriba para que su padre repita el mismo razonamiento.
- Devuelve `d + 1` hacia arriba y nada más: los nodos del subárbol derecho se recolectarán cuando la recursión principal baje por ahí buscando el objetivo.
- Explora el subárbol derecho con distancia restante `k - d`, porque la distancia al cruzar de un subárbol al otro se conserva.
- Reinicia una búsqueda BFS desde la raíz del árbol completo con límite K, porque la recursión ya no puede subir más.
### Justificación
Es exactamente la sección 5 del libro, con su aritmética: el objetivo está a `d` del hijo izquierdo, a `d + 1` del nodo actual, y a `d + 2` de la raíz del subárbol derecho — por eso la distancia restante dentro de ese subárbol es `k - d - 2`, el conteo que el libro manda verificar a mano porque es donde el off-by-one se esconde. El primer distractor pierde nodos: la búsqueda principal solo desciende por UNA rama hacia el objetivo; el subárbol derecho del ancestro jamás se explora si no lo hace el propio ancestro en el camino de regreso — ese «explorar el otro lado al regresar» es la idea central del patrón. Usar `k - d` olvida los DOS saltos extra (subir al nodo actual, bajar al otro hijo). Y el BFS desde la raíz con límite K responde otra pregunta — nodos a K de la RAÍZ, no del objetivo; sin punteros al padre no hay forma de arrancar un BFS desde el objetivo que suba, que es justo lo que este patrón sustituye.

## Auditorías sorpresa sin auditar padre e hijo — qué devuelve cada nodo
type: multiple_choice
tiempo: 4

Compliance debe elegir centros para auditoría sorpresa en una jerarquía (árbol binario con un valor por centro), con la regla: nunca auditar dos centros conectados directamente (padre-hijo). Quieren maximizar el valor total auditado — House Robber III. ¿Qué devuelve cada llamada recursiva hacia arriba para que el padre decida óptimamente?

### Opciones
- [x] Un PAR por nodo: `(mejor si INCLUYO este nodo, mejor si NO lo incluyo)`. Incluirse = su valor + el «no incluir» de ambos hijos (los hijos directos quedan vetados); no incluirse = la suma de `max(incluir, no_incluir)` de cada hijo, porque cada hijo decide libre e independientemente. Un solo escalar no basta: la decisión del padre depende de AMBAS posibilidades de cada hijo, no solo de su máximo absoluto.
- Un solo escalar: el máximo botín del subárbol. El padre suma su valor a los máximos de sus nietos cuando decide incluirse.
- La lista completa de nodos elegidos en el subárbol, para que el padre verifique adyacencias antes de sumarse.
- Un booleano que indica si la raíz del subárbol fue auditada, junto con el total: `(fue_incluida, total)`, y el padre solo se incluye si ambos hijos devuelven `False`.
### Justificación
Es la sección 6 del libro: el par incluir/no-incluir es el patrón de DFS-que-devuelve-información con la información siendo un PAR, necesario porque la decisión óptima del padre depende de ambas posibilidades de cada hijo. El escalar «máximo del subárbol» pierde información: si el máximo del hijo se logró incluyendo al hijo, el padre no puede incluirse — pero el escalar no dice cómo se logró; y saltar a los nietos rompe la estructura (el óptimo sin el hijo NO es «valor de los nietos»: es un subproblema propio que justo el par captura). Devolver la lista de elegidos es correcto pero explota en costo — copiar listas en cada nivel arruina el O(n) y bajo reloj es intecleable. Y el booleano `(fue_incluida, total)` fija UNA decisión por subárbol: obliga al hijo a comprometerse antes de que el padre exista, cuando el óptimo global puede necesitar la variante subóptima local del hijo — exactamente lo que el par evita al posponer la elección hasta el padre.

## Trazar las cotas heredadas sobre el árbol trampa
type: trace
tiempo: 5

Ejecutas el validador con rango del libro sobre el árbol `[5,1,7,null,null,4,8]` (level-order: raíz 5, izquierda 1, derecha 7; 7 tiene hijos 4 y 8):

```python
def es_bst_valido(nodo, minimo=float('-inf'), maximo=float('inf')):
    if nodo is None:
        return True
    if not (minimo < nodo.val < maximo):
        return False
    return (es_bst_valido(nodo.izq, minimo, nodo.val) and
            es_bst_valido(nodo.der, nodo.val, maximo))
```

¿En qué llamada exacta se detecta la violación, y con qué rango?

### Opciones
- [x] En el nodo 4, evaluado con rango `(5, 7)`: al bajar de 5 a su hijo derecho 7 el mínimo se estrechó a 5, y al bajar de 7 a su hijo izquierdo 4 el máximo se estrechó a 7. La condición `5 < 4 < 7` es falsa por el lado del MÍNIMO — el 4 viola una cota heredada de su abuelo, no de su padre — y ese `False` se propaga por los `and` hasta la raíz.
- En el nodo 7, evaluado con rango `(5, inf)`: 7 no puede ser hijo derecho de 5 porque estrecha el rango de sus propios hijos.
- En el nodo 8, evaluado con rango `(7, inf)`: 8 queda fuera del rango porque el máximo ya se fijó en 7 al procesar al 4.
- No se detecta nada: cada nodo cumple contra su padre inmediato, así que la función devuelve True y el árbol se acepta.
### Justificación
Traza verificada a mano: 5 entra con `(-inf, inf)` y pasa; 1 entra con `(-inf, 5)` y pasa; 7 entra con `(5, inf)` — la llamada al hijo DERECHO usa `(nodo.val, maximo)` — y 7 > 5, pasa; 4 entra con `(5, 7)` — mínimo 5 heredado del abuelo, máximo 7 del padre — y `5 < 4` es falso: ahí se corta. El distractor del 7 malinterpreta el mecanismo: 7 cumple `5 < 7 < inf` sin problema (estrechar el rango de los hijos es el funcionamiento normal, no una violación). El del 8 inventa un estado compartido que no existe: cada rama recibe su propio rango por parámetros — el 8 se evalúa con `(7, inf)` y pasa; los rangos no se «contaminan» entre hermanos. Y «devuelve True» describe al validador INGENUO de vecino inmediato (la trampa de la sección 3), no a éste: la razón de ser del rango es justamente cazar la violación abuelo-nieto que el ingenuo deja pasar.

## Costo del DFS que devuelve información — y el árbol que parece lista
type: complexity
tiempo: 4

El patrón central del libro (DFS post-order que combina la información de ambos subárboles con trabajo O(1) por nodo — profundidad, diámetro, House Robber III) corre sobre un árbol de n nodos. ¿Cuál es su costo en tiempo y espacio, y qué cambia si el árbol es degenerado (cada nodo con un solo hijo, una «lista»)?

### Opciones
- [x] Tiempo O(n): cada nodo se visita exactamente una vez y combinar cuesta O(1). Espacio O(h) por la pila de recursión, con h la altura — O(log n) si está balanceado, pero en el degenerado h = n, así que la pila crece a O(n) y en árboles muy profundos puede desbordar el límite de recursión; el tiempo sigue siendo O(n) en ambos casos.
- Tiempo O(n log n): en cada uno de los log n niveles se recorre a lo más n nodos, balanceado o no.
- Tiempo O(n) y espacio O(1): la recursión no cuenta como espacio porque el lenguaje la maneja solo.
- Tiempo O(n²) en el degenerado: al perder el balance, cada llamada re-recorre su subárbol completo para combinar.
### Justificación
El patrón de la sección 2 visita cada nodo una sola vez (post-order: resuelve hijos, combina, devuelve) — tiempo O(n) sin importar la forma del árbol. El espacio es la pila de recursión: proporcional a la ALTURA, no a n en general — y la trampa está en asumir h = log n, que solo vale balanceado; el degenerado tiene h = n y es exactamente el riesgo de desbordamiento que un OA puede esconder en un caso de prueba con árbol-lista. O(n log n) confunde este DFS con algoritmos de divide-y-vencerás que hacen trabajo lineal POR NIVEL (como merge sort); aquí el trabajo por nodo es O(1), no por nivel. «Espacio O(1)» ignora que cada llamada pendiente ocupa un marco real en la pila — la recursión ES memoria, la cuente el lenguaje o no. Y O(n²) describiría un algoritmo que re-recorre subárboles (como calcular profundidad DENTRO de cada nodo por separado, el anti-patrón que este DFS evita justamente devolviendo la información hacia arriba en vez de recalcularla).

## Drill: profundidad máxima desde level-order
type: code
tiempo: 15

El sistema de categorías del catálogo llega serializado como array level-order con `null` en las posiciones vacías (el formato estándar del OA). Necesitas la profundidad máxima de la jerarquía — cuántos niveles de categoría anidada existen. Drill del patrón «DFS que devuelve un escalar hacia arriba»; la reconstrucción del árbol desde el array es parte del ejercicio y va dentro de tu solución.

### Especificación
`profundidadMaxima(arbol)`:
- `arbol` es un array level-order con `null` en los huecos: `[3,9,20,null,null,15,7]` es la raíz 3 con hijos 9 y 20, donde 20 tiene hijos 15 y 7. Los `null` no generan descendientes (no aparecen entradas para los hijos de un `null`).
- Reconstruye el árbol internamente (cola: cada nodo real consume las siguientes dos posiciones como sus hijos) y devuelve la profundidad máxima: número de nodos en el camino más largo de la raíz a una hoja.
- Árbol vacío (`[]`) → `0`. Un solo nodo → `1`.
- El valor `0` es un valor de nodo VÁLIDO (no lo confundas con vacío: la comparación es contra `null`, no falsy).

### Firma
```javascript
function profundidadMaxima(arbol) {
  // TODO: reconstruir con cola (cada nodo real consume dos posiciones);
  // luego DFS: profundidad(nodo) = 1 + max(izq, der), null = 0
  return 0;
}
```
```python
def profundidad_maxima(arbol):
    # TODO: reconstruir con cola (cada nodo real consume dos posiciones);
    # luego DFS: profundidad(nodo) = 1 + max(izq, der), None = 0
    return 0
```

### Casos
```json
[
  { "input": [[3, 9, 20, null, null, 15, 7]], "expected": 3 },
  { "input": [[]], "expected": 0 },
  { "input": [[1]], "expected": 1 },
  { "input": [[1, 2, null, 3, null, 4]], "expected": 4 },
  { "input": [[1, null, 2, null, 3]], "expected": 3 },
  { "input": [[1, 2, 3, 4, 5, 6, 7]], "expected": 3 },
  { "input": [[0]], "expected": 1 },
  { "input": [[1, 2, 3, null, null, null, 4]], "expected": 3 }
]
```

### Solución
```javascript
function profundidadMaxima(arbol) {
  if (!Array.isArray(arbol) || arbol.length === 0 || arbol[0] === null) return 0;
  const raiz = { val: arbol[0], izq: null, der: null };
  const cola = [raiz];
  let frente = 0;
  let i = 1;
  while (frente < cola.length && i < arbol.length) {
    const nodo = cola[frente++];
    const vIzq = arbol[i++];                     // primera posicion: hijo izquierdo
    if (vIzq !== null && vIzq !== undefined) {
      nodo.izq = { val: vIzq, izq: null, der: null };
      cola.push(nodo.izq);
    }
    if (i < arbol.length) {
      const vDer = arbol[i++];                   // segunda posicion: hijo derecho
      if (vDer !== null && vDer !== undefined) {
        nodo.der = { val: vDer, izq: null, der: null };
        cola.push(nodo.der);
      }
    }
  }
  const profundidad = (nodo) => {
    if (nodo === null) return 0;                 // caso base: subarbol vacio aporta 0
    return 1 + Math.max(profundidad(nodo.izq), profundidad(nodo.der));
  };
  return profundidad(raiz);
}
```
```python
from collections import deque


def profundidad_maxima(arbol):
    if not arbol or arbol[0] is None:
        return 0
    raiz = {"val": arbol[0], "izq": None, "der": None}
    cola = deque([raiz])
    i = 1
    while cola and i < len(arbol):
        nodo = cola.popleft()
        v_izq = arbol[i]                  # primera posicion: hijo izquierdo
        i += 1
        if v_izq is not None:
            nodo["izq"] = {"val": v_izq, "izq": None, "der": None}
            cola.append(nodo["izq"])
        if i < len(arbol):
            v_der = arbol[i]              # segunda posicion: hijo derecho
            i += 1
            if v_der is not None:
                nodo["der"] = {"val": v_der, "izq": None, "der": None}
                cola.append(nodo["der"])

    def profundidad(nodo):
        if nodo is None:
            return 0                      # caso base: subarbol vacio aporta 0
        return 1 + max(profundidad(nodo["izq"]), profundidad(nodo["der"]))

    return profundidad(raiz)
```

### Pistas
- La reconstrucción es un BFS al revés: una cola de nodos reales pendientes; cada nodo que sale consume las siguientes DOS posiciones del array como sus hijos (los `null` no entran a la cola).
- La profundidad es el patrón de la sección 2 en su forma mínima: `profundidad(null) = 0`, y cada nodo devuelve `1 + max` de lo que suban sus dos hijos.
- Compara contra `null`/`None` explícitamente, nunca por truthiness: el valor `0` es un nodo real y `if (v)` lo tiraría.

## Drill: validar BST con cotas heredadas
type: code
tiempo: 18

El índice de precios del catálogo llega como array level-order y debes validar que sea un BST antes de habilitar las búsquedas — con la validación de RANGO del libro, no la comparación con el vecino inmediato (que acepta árboles rotos como `[5,1,7,null,null,4,8]`). Especificación estricta para este drill: NO se permiten valores duplicados — el subárbol izquierdo es estrictamente menor y el derecho estrictamente mayor. La reconstrucción desde level-order va dentro de tu solución.

### Especificación
`esBstValido(arbol)`:
- `arbol` es un array level-order con `null` en los huecos (misma representación que el drill anterior); reconstrúyelo internamente.
- Devuelve `true` si el árbol cumple la propiedad BST ESTRICTA: para cada nodo, TODO su subárbol izquierdo `< nodo.val` y TODO su subárbol derecho `> nodo.val`. Duplicados → inválido (la desigualdad es estricta en ambos lados).
- La validación pasa cotas `(minimo, maximo)` hacia abajo: bajar a la izquierda estrecha el máximo al valor del padre; bajar a la derecha estrecha el mínimo.
- Árbol vacío (`[]`) → `true`. Un solo nodo → `true`.

### Firma
```javascript
function esBstValido(arbol) {
  // TODO: reconstruir; luego valida(nodo, minimo, maximo) con cotas
  // que se estrechan al descender; duplicado = falso
  return true;
}
```
```python
def es_bst_valido(arbol):
    # TODO: reconstruir; luego valida(nodo, minimo, maximo) con cotas
    # que se estrechan al descender; duplicado = falso
    return True
```

### Casos
```json
[
  { "input": [[2, 1, 3]], "expected": true },
  { "input": [[5, 1, 7, null, null, 4, 8]], "expected": false },
  { "input": [[]], "expected": true },
  { "input": [[1]], "expected": true },
  { "input": [[2, 2, 2]], "expected": false },
  { "input": [[10, 5, 15, null, null, 6, 20]], "expected": false },
  { "input": [[3, 1, 5, 0, 2, 4, 6]], "expected": true },
  { "input": [[1, null, 2, null, 3]], "expected": true }
]
```

### Solución
```javascript
function esBstValido(arbol) {
  if (!Array.isArray(arbol) || arbol.length === 0 || arbol[0] === null) return true;
  const raiz = { val: arbol[0], izq: null, der: null };
  const cola = [raiz];
  let frente = 0;
  let i = 1;
  while (frente < cola.length && i < arbol.length) {
    const nodo = cola[frente++];
    const vIzq = arbol[i++];
    if (vIzq !== null && vIzq !== undefined) {
      nodo.izq = { val: vIzq, izq: null, der: null };
      cola.push(nodo.izq);
    }
    if (i < arbol.length) {
      const vDer = arbol[i++];
      if (vDer !== null && vDer !== undefined) {
        nodo.der = { val: vDer, izq: null, der: null };
        cola.push(nodo.der);
      }
    }
  }
  const valida = (nodo, minimo, maximo) => {
    if (nodo === null) return true;
    if (!(nodo.val > minimo && nodo.val < maximo)) return false; // viola cota heredada
    return valida(nodo.izq, minimo, nodo.val) &&                 // izquierda: maximo se estrecha
           valida(nodo.der, nodo.val, maximo);                   // derecha: minimo se estrecha
  };
  return valida(raiz, -Infinity, Infinity);
}
```
```python
from collections import deque


def es_bst_valido(arbol):
    if not arbol or arbol[0] is None:
        return True
    raiz = {"val": arbol[0], "izq": None, "der": None}
    cola = deque([raiz])
    i = 1
    while cola and i < len(arbol):
        nodo = cola.popleft()
        v_izq = arbol[i]
        i += 1
        if v_izq is not None:
            nodo["izq"] = {"val": v_izq, "izq": None, "der": None}
            cola.append(nodo["izq"])
        if i < len(arbol):
            v_der = arbol[i]
            i += 1
            if v_der is not None:
                nodo["der"] = {"val": v_der, "izq": None, "der": None}
                cola.append(nodo["der"])

    def valida(nodo, minimo, maximo):
        if nodo is None:
            return True
        if not (minimo < nodo["val"] < maximo):     # viola cota heredada
            return False
        return (valida(nodo["izq"], minimo, nodo["val"]) and   # izquierda: maximo se estrecha
                valida(nodo["der"], nodo["val"], maximo))      # derecha: minimo se estrecha

    return valida(raiz, float("-inf"), float("inf"))
```

### Pistas
- La información fluye HACIA ABAJO: cada llamada recibe el rango válido acumulado de todos sus ancestros. Bajar a la izquierda reemplaza el máximo por `nodo.val`; bajar a la derecha reemplaza el mínimo.
- La desigualdad estricta en ambos lados (`minimo < val < maximo`) hace que los duplicados fallen solos: el hijo igual al padre no cabe en ningún rango estrechado — no necesitas un caso especial.
- Verifica tu solución mentalmente contra `[5,1,7,null,null,4,8]`: el 4 debe evaluarse con rango `(5, 7)` y fallar por el mínimo. Si tu versión lo acepta, estás comparando contra el padre, no contra las cotas.
