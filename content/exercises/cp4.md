---
module_id: cd000000-0000-4000-8000-000000000004
spine: Competitiva
title: Ejercicios — Sorting y greedy
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro cp4-sorting-greedy.md)
version: 1
---

# Sorting y greedy — banco competitivo

Banco de reconocimiento bajo el reloj, con un sesgo deliberado hacia la DESCONFIANZA: el libro enseña que la mayoría de los greedys que "se sienten bien" están mal, y que un greedy solo es defendible con un exchange argument o con un contraejemplo descartado. Cada ejercicio entrena o el reflejo de ver el patrón (intervalos/deadlines + maximiza/minimiza), o la disciplina de justificar el criterio de orden. Los ejercicios de código destilan dos plantillas núcleo —máximo de intervalos sin solape (ordenar por fin) y SPT (ordenar por duración)— como funciones puras validadas localmente (NO un juez de contest).

## La señal — máximo de intervalos sin solape
type: multiple_choice

Te dan n intervalos `[inicio, fin]` y piden el MÁXIMO número que puedas elegir sin que dos se solapen. Bajo el reloj, ¿qué patrón reconoces y cuál es el criterio de orden correcto?

### Opciones
- [x] Sorting + greedy: ordena por FIN ascendente y recorre eligiendo cada intervalo cuyo inicio no choque con el fin del último elegido. Quedarte con el que termina más pronto deja el máximo espacio libre para los siguientes.
- Ordena por INICIO ascendente y elige de izquierda a derecha; el que empieza antes siempre conviene tomarlo primero.
- Ordena por DURACIÓN ascendente y elige los más cortos primero, porque ocupan menos espacio y así caben más.
- Programación dinámica sobre todos los subconjuntos de intervalos, porque maximizar una selección exige considerar todas las combinaciones.

### Justificación
"Intervalos" + "máximo número sin solape" + "maximiza" es la señal directa de greedy con sort, y el criterio correcto es FIN ascendente: entre los candidatos disponibles, quedarte con el que termina más pronto deja el mayor espacio libre para intervalos futuros (el exchange argument de la sección 3). Ordenar por INICIO no da esa garantía — el libro lo marca como el "se siente razonable pero está mal". Ordenar por DURACIÓN es el contraejemplo clásico de la sección de trampas: un intervalo corto en medio puede bloquear dos largos. Y la DP sobre subconjuntos es exponencial e innecesaria cuando existe un greedy con exchange argument probado (trade-offs greedy vs. DP).

## Trampa — ordenar por duración
type: multiple_choice

Para "máximo número de intervalos sin solape", un compañero propone ordenar por DURACIÓN (el más corto primero), argumentando "los cortos ocupan menos y dejan más espacio". Da un contraejemplo mínimo y explica por qué el criterio correcto es por fin.

### Opciones
- El criterio por duración es correcto; no existe contraejemplo, solo hay que desempatar por inicio.
- [x] Contraejemplo: `[1,5]`, `[4,6]`, `[5,9]`. Por duración eliges primero `[4,6]` (el más corto, duración 2), que se solapa con AMBOS largos y te deja con 1 intervalo. Por fin ascendente eliges `[1,5]` y `[5,9]` → 2. Un intervalo corto en medio de la línea de tiempo puede bloquear dos largos que juntos habrían sumado más.
- El contraejemplo correcto requiere al menos 100 intervalos; con pocos intervalos, duración y fin siempre dan el mismo resultado.
- Ordenar por duración falla solo cuando hay empates de duración; con duraciones todas distintas siempre es óptimo.

### Justificación
Es la trampa "el greedy que se siente bien y es incorrecto", textual del libro. El contraejemplo mínimo `[1,5]`, `[4,6]`, `[5,9]`: por duración tomas `[4,6]` primero, que choca con `[1,5]` (4 < 5) y con `[5,9]` (5 < 6), quedándote con 1; por fin tomas `[1,5]` (fin 5) y luego `[5,9]` (inicio 5 ≥ 5), quedándote con 2. La primera opción niega una falla documentada. La tercera es falsa: bastan 3 intervalos para exhibirla. La cuarta atribuye mal el fallo a los empates — en el contraejemplo las duraciones son 4, 2 y 4, el corto es único y aun así el criterio falla.

## Plantilla — máximo de intervalos sin solape
type: code

Destila la plantilla de la sección 3: dado un arreglo de intervalos `[inicio, fin]`, devuelve el MÁXIMO número que puedas elegir sin solaparse. El criterio es FIN ascendente (no inicio, no duración), y dos intervalos que solo se tocan en un extremo (`inicio == fin_ultimo`) NO se consideran solapados.

### Especificación
`maxIntervalosSinSolape(intervalos)` devuelve un entero:
- Ordena una copia de los intervalos por `fin` ascendente.
- Recorre con `fin_ultimo = -infinito` y un contador en 0; por cada `[inicio, fin]`, si `inicio >= fin_ultimo`, incrementa el contador y actualiza `fin_ultimo = fin`.
- Con la lista vacía, devuelve 0. Tocarse en un extremo (`inicio == fin_ultimo`) cuenta como compatible.

### Firma
```javascript
function maxIntervalosSinSolape(intervalos) {
  // TODO: ordena por fin ascendente; recorre eligiendo si inicio >= fin_ultimo
}
```
```python
def max_intervalos_sin_solape(intervalos):
    # TODO: ordena por fin ascendente; recorre eligiendo si inicio >= fin_ultimo
    pass
```

### Casos
```json
[
  { "input": [[[1, 3], [2, 5], [4, 6]]], "expected": 2 },
  { "input": [[]], "expected": 0 },
  { "input": [[[5, 10]]], "expected": 1 },
  { "input": [[[1, 10], [2, 9], [3, 8]]], "expected": 1 },
  { "input": [[[1, 2], [2, 3], [3, 4]]], "expected": 3 },
  { "input": [[[1, 5], [4, 6], [5, 9]]], "expected": 2 },
  { "input": [[[3, 4], [1, 2], [2, 3], [1, 5]]], "expected": 3 },
  { "input": [[[1, 4], [3, 5], [0, 6], [5, 7], [3, 8], [5, 9], [6, 10], [8, 11], [8, 12], [2, 13], [12, 14]]], "expected": 4 }
]
```

### Solución
```javascript
function maxIntervalosSinSolape(intervalos) {
  const ordenados = intervalos.slice().sort(function (a, b) { return a[1] - b[1]; });
  let contador = 0;
  let finUltimo = -Infinity;
  for (let k = 0; k < ordenados.length; k++) {
    const inicio = ordenados[k][0];
    const fin = ordenados[k][1];
    if (inicio >= finUltimo) {
      contador++;
      finUltimo = fin;
    }
  }
  return contador;
}
```
```python
def max_intervalos_sin_solape(intervalos):
    ordenados = sorted(intervalos, key=lambda x: x[1])
    contador = 0
    fin_ultimo = float('-inf')
    for inicio, fin in ordenados:
        if inicio >= fin_ultimo:
            contador += 1
            fin_ultimo = fin
    return contador
```

### Pistas
- El criterio es `fin` ascendente: `sort((a,b) => a[1]-b[1])` en JS, `key=lambda x: x[1]` en Python — NO por inicio ni por duración.
- La condición de compatibilidad es `inicio >= fin_ultimo` (mayor-o-igual): dos intervalos que se tocan en un punto no se solapan.
- Ordena una COPIA (`slice()` / `sorted`) si no quieres mutar la entrada; para el conteo da igual, pero es buena higiene.

### Patrones
- `` `a\[0\]\s*-\s*b\[0\]|x\[0\]` — Estás ordenando por INICIO. El criterio correcto para máximo sin solape es FIN ascendente (`a[1]-b[1]` / `x[1]`), como prueba el exchange argument de la sección 3. ``

## La complejidad del greedy de intervalos
type: complexity

El greedy de máximo número de intervalos sin solape: ordenas por fin y haces un solo recorrido lineal eligiendo. ¿Cuál es la complejidad total y qué paso la domina?

### Opciones
- [x] O(n log n), dominado por el ordenamiento; el recorrido greedy posterior es un solo barrido O(n) que queda absorbido por el término del sort.
- O(n), porque el recorrido greedy es lineal y el ordenamiento no cuenta para la complejidad.
- O(n²), porque por cada intervalo hay que revisar todos los demás para ver si se solapan.
- O(log n), porque el greedy descarta la mitad de los intervalos en cada paso.

### Justificación
"Ordenar primero" es el paso caro: O(n log n). Tras el orden, el greedy visita cada intervalo una sola vez comparándolo contra `fin_ultimo` (O(1) por intervalo), un barrido O(n) que el término del sort absorbe → total O(n log n). La segunda opción ignora el costo del ordenamiento, que es justamente el dominante. La tercera describe el naïve de revisar todos los pares (O(n²)) que el sort permite EVITAR: gracias al orden, cada intervalo se decide solo contra el último elegido, sin comparar todos con todos. La cuarta confunde greedy con búsqueda binaria — el greedy recorre todos los intervalos una vez, no descarta mitades.

## Qué vuelve defendible a un greedy
type: multiple_choice

Diseñaste un greedy y "funciona en todos los ejemplos del enunciado". Un compañero te dice que eso no basta para confiar en él en un contest. ¿Cuál es la defensa REAL que convierte un greedy en una solución en la que puedes confiar?

### Opciones
- Correr el greedy contra más ejemplos generados al azar; si pasa suficientes, queda demostrado que es correcto.
- [x] Un exchange argument: tomas cualquier solución óptima que difiera de la greedy, muestras que puedes intercambiar dos elementos para acercarla a la greedy SIN empeorarla, y repites — por inducción, la greedy misma es óptima. Es una prueba, no una intuición; su compañero práctico es buscar activamente un contraejemplo y no encontrarlo tras intentarlo en serio.
- Elegir siempre el elemento de mayor valor local; por definición, la suma de máximos locales es el máximo global.
- Correr una DP para verificar el resultado del greedy en cada caso de prueba del enunciado.

### Justificación
Es la tesis central del módulo: un greedy correcto se prueba con un exchange argument —transformar cualquier óptima en la greedy sin empeorar, luego inducción— no con "se ve bien en los ejemplos". En contest, su contraparte práctica es dedicar 30 segundos a cazar un contraejemplo antes de comprometerte. La primera opción es exactamente lo que el libro rechaza: más ejemplos (aunque sean aleatorios) nunca demuestran corrección, solo aumentan la confianza sin garantía. La tercera es la falacia que la desconfianza greedy vigila: la suma de óptimos locales NO es, en general, el óptimo global. La cuarta puede verificar un caso puntual, pero no PRUEBA el greedy en general; y si de todos modos corres la DP, el greedy no te compró nada.

## Traza — el exchange argument de "ordenar por fin"
type: trace

Traza el exchange argument que justifica ordenar por FIN (no por inicio) en el máximo de intervalos sin solape. Supón una solución óptima que, en su primer intervalo elegido, NO toma el de fin más temprano disponible. ¿Qué intercambio hace el argumento y qué prueba?

### Opciones
- Intercambia dos intervalos cualesquiera al azar; si el resultado no empeora, el greedy queda probado.
- [x] Reemplaza el primer intervalo de la óptima por el de fin más temprano disponible: como termina antes o igual, no choca con nada que la óptima elegía después, así que la selección sigue siendo válida y del mismo tamaño. Existe entonces una óptima que coincide con el greedy en ese primer paso; repitiendo el argumento, el greedy es óptimo.
- Ordena por inicio y demuestra que el primer intervalo en empezar nunca bloquea a los demás, lo que probaría que inicio es el criterio correcto.
- Toma el intervalo de MAYOR duración primero, porque cubrir más línea de tiempo por elección maximiza el total.

### Justificación
Es la forma específica del exchange argument de la sección 3: si sustituyes el primer intervalo de la óptima por el de fin más temprano, ese sustituto termina no más tarde, así que no puede entrar en conflicto con nada que la óptima haya elegido después — la selección sigue siendo válida y del mismo tamaño. Eso construye una óptima que coincide con el greedy en el primer paso; por inducción, el greedy es óptimo. La primera opción no es el argumento: un intercambio al azar no tiene la garantía de "no empeora"; debes intercambiar HACIA la elección del greedy. La tercera (por inicio) carece de esa garantía — el libro la marca como el criterio que "se siente razonable pero está mal". La cuarta (mayor duración primero) es lo opuesto a la señal correcta: el más largo puede bloquear más de lo que habilita.

## Plantilla — SPT (minimizar tiempo total de finalización)
type: code

Destila el ejemplo canónico de exchange argument de la sección 1: tienes tareas con duración `d_i` en una sola máquina y quieres MINIMIZAR la suma de los tiempos de finalización. El orden óptimo es SPT (shortest processing time first): duración ascendente. Con las tareas ordenadas, el tiempo de finalización de la k-ésima es la suma de las primeras k duraciones; la respuesta es la suma de todos esos tiempos de finalización.

### Especificación
`sumaTiemposFinalizacion(duraciones)` devuelve un entero:
- Ordena las duraciones ascendentemente (SPT).
- Lleva un acumulado (el reloj) que arranca en 0; por cada duración `d` en orden, suma `d` al acumulado y suma el acumulado al total.
- Con la lista vacía, devuelve 0.

### Firma
```javascript
function sumaTiemposFinalizacion(duraciones) {
  // TODO: ordena ascendente; acumula la duracion y suma el acumulado al total
}
```
```python
def suma_tiempos_finalizacion(duraciones):
    # TODO: ordena ascendente; acumula la duracion y suma el acumulado al total
    pass
```

### Casos
```json
[
  { "input": [[3, 1, 2]], "expected": 10 },
  { "input": [[]], "expected": 0 },
  { "input": [[5]], "expected": 5 },
  { "input": [[4, 1]], "expected": 6 },
  { "input": [[1, 2, 3, 4]], "expected": 20 },
  { "input": [[4, 3, 2, 1]], "expected": 20 },
  { "input": [[2, 2, 2]], "expected": 12 },
  { "input": [[5, 2, 8, 1, 3]], "expected": 40 }
]
```

### Solución
```javascript
function sumaTiemposFinalizacion(duraciones) {
  const ordenadas = duraciones.slice().sort(function (a, b) { return a - b; });
  let acumulado = 0;
  let total = 0;
  for (let k = 0; k < ordenadas.length; k++) {
    acumulado += ordenadas[k];
    total += acumulado;
  }
  return total;
}
```
```python
def suma_tiempos_finalizacion(duraciones):
    ordenadas = sorted(duraciones)
    acumulado = 0
    total = 0
    for d in ordenadas:
        acumulado += d
        total += acumulado
    return total
```

### Pistas
- El tiempo de finalización de la k-ésima tarea (ya ordenada) es la suma de las primeras k duraciones: por eso llevas un acumulado que arrastra el reloj.
- Ordena ASCENDENTE: la tarea más corta primero es la que minimiza la suma total (SPT), como prueba el exchange argument de la sección 1.
- Los casos `[1,2,3,4]` y `[4,3,2,1]` dan lo mismo (20): la respuesta depende del multiconjunto de duraciones, no del orden de entrada — porque ordenas.

### Patrones
- `` `b\s*-\s*a\b|reverse\(` — Estás ordenando descendente. SPT exige duración ASCENDENTE: la más corta primero minimiza la suma de tiempos de finalización. ``

## Trampa — el comparador inconsistente
type: multiple_choice

En C++ escribes un comparador para `std::sort` que, ante dos elementos con el mismo criterio principal, a veces devuelve `true` para `cmp(a,b)` Y también `true` para `cmp(b,a)`. Compila, y a veces corre bien, pero con datos grandes en el juez a veces truena o da un orden raro. ¿Cuál es la causa y la regla?

### Opciones
- Es un problema de rendimiento: el comparador es lento y provoca Time Limit Exceeded con datos grandes.
- [x] Comportamiento indefinido: `std::sort` exige una relación de orden estricta y débil (irreflexiva y consistente); un comparador que afirma `a<b` y `b<a` a la vez la viola, y el resultado va desde un orden silenciosamente incorrecto hasta un crash directo. La regla: incluye siempre un desempate explícito y determinístico cuando el criterio principal puede empatar.
- Es un problema de estabilidad: basta cambiar a `std::stable_sort` y el comparador inconsistente deja de importar.
- El comparador está mal porque debe devolver -1/0/1 como en Python; devolver `bool` es el error.

### Justificación
Es la trampa "comparadores inconsistentes que rompen el sort", textual de la sección de trampas y la sección 2. Un comparador para `std::sort` debe definir una relación de orden estricta y débil —irreflexiva (`cmp(a,a)` es `false`) y consistente—; afirmar `a<b` y `b<a` simultáneamente la rompe y produce comportamiento indefinido, desde un orden mal hasta un crash. El arreglo es un desempate explícito y determinístico. La primera opción confunde UB con lentitud. La tercera es falsa: `stable_sort` TAMBIÉN exige una relación de orden válida — la estabilidad solo fija el orden relativo de elementos EQUIVALENTES, no es una licencia para un comparador inconsistente. La cuarta invierte los lenguajes: en C++ el comparador devuelve `bool` por diseño; el esquema -1/0/1 es el de `cmp_to_key` de Python.

## La disciplina cuando no hay exchange argument
type: multiple_choice

Tienes un greedy que "se siente bien" pero NO logras encontrar un exchange argument que lo respalde. ¿Cuál es la disciplina de contest correcta antes de comprometer el problema completo a ese greedy?

### Opciones
- Escribirlo y enviarlo: si pasa los ejemplos del enunciado, casi siempre pasa el juez completo.
- [x] Dedicar tiempo explícito a buscar un contraejemplo; si lo encuentras, el criterio de orden está mal y hay que replantearlo. Si sospechas que ningún greedy tiene exchange argument disponible, pivota a DP (CP7) —que considera todas las decisiones en vez de comprometerse irreversiblemente en cada paso— sin gastar más tiempo intentando "arreglar" el greedy.
- Aumentar el tamaño de los ejemplos de prueba hasta que el greedy falle; si nunca falla con ejemplos grandes, es correcto.
- Cambiar el criterio de orden al azar hasta que uno pase los ejemplos del enunciado, y quedarte con ese.

### Justificación
El módulo convierte esto en una habilidad de contest explícita: sin exchange argument, caza un contraejemplo; encontrarlo te dice que el criterio de orden está mal ANTES de perder el problema. Si ningún greedy parece probable, pivotar a DP sin seguir "arreglando" la intuición es lo correcto (conexiones con DP y trade-offs greedy vs. DP). La primera opción es justo la apuesta que el libro previene. La tercera repite la falacia de los ejemplos: un caso borde puede ser estructurado, no aleatorio, y nunca aparecer por azar — más ejemplos no prueban corrección. La cuarta es cargo cult: aunque un criterio "pase los ejemplos del enunciado", sigues sin prueba y sin saber por qué funcionaría.

## Conexión — Kruskal ES este módulo
type: multiple_choice

En un problema de árbol de expansión mínima recuerdas Kruskal. ¿Por qué se dice que Kruskal ES este módulo (sorting + greedy) aplicado a un problema específico, y qué papel juega cada pieza?

### Opciones
- Kruskal no tiene relación con greedy; es un algoritmo de programación dinámica sobre las aristas.
- [x] Kruskal es exactamente sorting + greedy (+ DSU): ordena las aristas por peso ascendente (el sort) y las recorre agregando cada una si no forma ciclo (el greedy, justificado por la propiedad del corte), usando DSU para detectar ciclos en casi O(1). Su corrección no es intuición: descansa en un argumento de intercambio sobre la propiedad del corte.
- Kruskal ordena las aristas por peso DESCENDENTE y va eliminando la más cara mientras el grafo siga conexo, sin necesidad de un paso greedy.
- Kruskal es greedy pero sin ordenar: procesa las aristas en el orden en que aparecen en la entrada.

### Justificación
Es la conexión con DSU que el libro señala: Kruskal es "ordena las aristas por peso, aplica greedy con la propiedad del corte, usa DSU para detectar ciclos" — la combinación exacta de sorting + greedy + DSU en un solo algoritmo. El sort pone las aristas en orden de peso; el greedy toma cada arista que no cierre ciclo; el DSU hace la detección de ciclos casi en O(1); y la corrección viene de un exchange argument sobre la propiedad del corte, no de intuición. La primera opción es falsa: Kruskal es el greedy arquetípico de MST, no DP. La tercera describe otro algoritmo (reverse-delete) y de todos modos sigue apoyándose en razonamiento greedy. La cuarta rompe lo esencial: sin ordenar por peso, la propiedad del corte deja de garantizar que la arista elegida sea segura.
