---
module_id: itc-c8-dp
spine: ITC
title: "Programación dinámica"
subtitle: "Recursión que se niega a repetir trabajo"
source_canonical: "MIT 6.006 L15-L16; CLRS cap. 14"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Programación dinámica

> **Pregunta raíz.** Algunos problemas, planteados de la forma más natural, parecen exigir explorar un número **exponencial** de posibilidades — probar cada subconjunto, cada partición, cada combinación. Y sin embargo, un subconjunto sorprendentemente grande de esos problemas se resuelve en tiempo **polinomial**, sin sacrificar ni un ápice de correctitud. **¿Qué estructura tiene que tener un problema para que esa reducción de exponencial a polinomial sea posible? ¿Y qué mecanismo concreto la explota?** La respuesta corta, que vas a deducir con todo rigor en este módulo: la mayoría de esos problemas, resueltos ingenuamente por fuerza bruta recursiva, terminan **resolviendo exactamente el mismo subproblema una y otra vez**, miles o millones de veces, sin darse cuenta. Programación dinámica es, en su esencia más pura, **recursión que se rehúsa a repetir trabajo** — y todo lo demás en este módulo es la maquinaria concreta para lograr eso.

## Prólogo — de dónde nace esto

Imagina que te piden calcular, a mano, el término 40 de la secuencia de Fibonacci, y decides hacerlo "correctamente" siguiendo la definición matemática literal: `F(40) = F(39) + F(38)`. Para calcular F(39) necesitas F(38) y F(37). Para calcular F(38) —que ya necesitabas para F(40) directamente— lo vuelves a necesitar aquí, y lo recalculas desde cero, sin recordar que ya lo habías calculado hace un momento como parte de F(39). Multiplica esto por cada nivel de la recursión, y terminas recalculando los mismos valores pequeños (F(2), F(3), F(4)...) un número **astronómico** de veces — no porque el problema sea intrínsecamente difícil, sino porque tu método de resolverlo tira a la basura, sistemáticamente, todo el trabajo que ya hiciste.

Esto es exactamente lo que le pasa a una función recursiva ingenua sobre un problema con subproblemas repetidos: no es lento porque el problema sea difícil, es lento porque **olvida** lo que ya calculó. Programación dinámica es, en el fondo, la disciplina de nunca dejar que eso pase — ya sea recordando explícitamente cada resultado la primera vez que lo calculas (memoización), o siendo lo suficientemente inteligente sobre el **orden** en que calculas las cosas para que cada subproblema se resuelva exactamente una vez, de forma natural, sin siquiera necesitar "recordar" nada de forma especial (tabulación). Todo el resto del módulo — desde Fibonacci hasta knapsack — es la exploración rigurosa de cómo reconocer cuándo esta técnica aplica, y cómo aplicarla correctamente cuando sí.

---

## 1. Las dos condiciones — deducidas, no memorizadas

Antes de tocar cualquier algoritmo específico, hay que responder la pregunta de diseño más importante: **¿cómo sabes, mirando un problema nuevo, si programación dinámica va a funcionar?** No aplica a todos los problemas recursivos — hay dos condiciones estructurales específicas que un problema tiene que cumplir, y vale la pena deducir cada una desde por qué es necesaria, con un contraejemplo de qué pasa cuando falta.

### 1.1 Subestructura óptima — la condición sobre la NATURALEZA del problema

**Definición**: un problema tiene subestructura óptima si la solución óptima del problema completo se puede construir a partir de las soluciones óptimas de sus subproblemas — es decir, si resolver óptimamente las partes pequeñas te garantiza poder ensamblar, a partir de ellas, la solución óptima del problema grande, sin necesitar reconsiderar decisiones ya tomadas dentro de esas partes.

**Por qué esta condición es indispensable, no opcional**: si el problema **no** tiene esta propiedad, entonces la solución óptima del problema grande podría requerir una solución **subóptima** de alguna de sus partes — y en ese caso, calcular la solución óptima de cada subproblema por separado, y ensamblarlas, simplemente no te da la respuesta correcta del problema completo. No es que el algoritmo sea "un poco menos eficiente" — es que **la estrategia entera de construir sobre subproblemas resueltos independientemente deja de ser válida**.

**Contraejemplo concreto donde la subestructura óptima falla**: considera el problema de encontrar el **camino simple más largo** entre dos vértices en un grafo (sin repetir vértices — si permitieras repetir vértices con ciclos positivos, la respuesta sería infinita, así que la restricción de "simple" es parte de la definición del problema). Podrías intentar aplicar la misma lógica que usaste para caminos **más cortos** (donde sí hay subestructura óptima, como vas a confirmar en la sección de Conexiones con Bellman-Ford): "el camino más largo de A a C, pasando por B, es el camino más largo de A a B, más el camino más largo de B a C". **Esto es falso en general**, y la razón es exactamente la restricción de "simple": el camino más largo óptimo de A a B podría usar un vértice `x` que el camino más largo óptimo de B a C **también** necesita usar — pero como no puedes repetir vértices en el camino combinado completo, no puedes simplemente concatenar ambas soluciones "óptimas" por separado; podría ser necesario sacrificar la optimalidad de una de las dos mitades para evitar la repetición, y no hay garantía de que la combinación resultante siga siendo la mejor combinación global posible. **Esta es la firma de la ausencia de subestructura óptima**: las decisiones óptimas de los subproblemas interfieren entre sí de una forma que impide ensamblarlas libremente — y por eso el problema del camino simple más largo es, de hecho, NP-difícil (no se conoce ningún algoritmo polinomial para resolverlo en el caso general), a diferencia del camino más corto, que sí tiene subestructura óptima y se resuelve en polinomial (Dijkstra, Bellman-Ford, ya construidos en el módulo anterior).

### 1.2 Subproblemas superpuestos — la condición sobre la EFICIENCIA de la técnica

**Definición**: un problema tiene subproblemas superpuestos si, al descomponerlo recursivamente, el **mismo** subproblema (idéntico, no solo similar) aparece múltiples veces en distintas ramas del árbol de recursión.

**Por qué esta condición determina si vale la pena aplicar DP, distinta de la primera**: subestructura óptima te dice que la estrategia de "resolver subproblemas y ensamblar" es **correcta**. Subproblemas superpuestos te dice si esa estrategia, tal cual (recursión ingenua sin memoria), es **eficiente** o no. Si un problema tiene subestructura óptima pero **no** tiene subproblemas superpuestos (cada subproblema en el árbol de recursión es genuinamente distinto, nunca se repite), entonces la recursión ingenua ya es óptima — no hay ningún trabajo redundante que "recordar" te ahorre, porque no hay redundancia en primer lugar. Esto es exactamente lo que distingue **divide y vencerás** (mergesort, quicksort — donde los subproblemas de cada rama son genuinamente distintos, sobre porciones disjuntas del input) de **programación dinámica** (donde los subproblemas se solapan masivamente): ambas técnicas descomponen el problema en subproblemas más pequeños con subestructura óptima, pero solo DP necesita el mecanismo adicional de "recordar" porque solo DP enfrenta el problema de recalcular lo mismo repetidamente.

**Las dos condiciones juntas, resumidas con precisión**: subestructura óptima es la condición de **correctitud** (¿puedo construir la solución grande a partir de soluciones óptimas de partes?); subproblemas superpuestos es la condición de **eficiencia** (¿vale la pena guardar esas soluciones de partes, o cada una es única de todas formas?). Necesitas **ambas** para que DP sea la herramienta correcta y ofrezca una ganancia real de rendimiento sobre la recursión ingenua.

---

## 2. Fibonacci ingenuo — el "hola mundo" de por qué la recursión explota

### 2.1 La definición recursiva directa, y por qué "obviamente correcta" no implica "eficiente"

```python
def fib_ingenuo(n):
    """
    Traduccion literal de F(n) = F(n-1) + F(n-2), F(0)=0, F(1)=1.
    Correcta. Catastroficamente ineficiente para n moderado.
    """
    if n <= 1:
        return n
    return fib_ingenuo(n - 1) + fib_ingenuo(n - 2)
```

Este código es, sin ambigüedad, **correcto** — es literalmente la definición matemática de Fibonacci, traducida palabra por palabra a código. Y sin embargo, calcular `fib_ingenuo(40)` en una computadora moderna tarda un tiempo perceptible (segundos), y `fib_ingenuo(50)` puede tardar minutos — para una secuencia que, calculada correctamente, no debería requerir más que unas cuantas decenas de sumas.

### 2.2 El árbol de recursión — visualizando exactamente dónde se repite el trabajo

Traza mentalmente las primeras llamadas de `fib_ingenuo(5)`:

```
                    fib(5)
                   /      \
              fib(4)        fib(3)
             /     \        /    \
        fib(3)   fib(2)  fib(2)  fib(1)
        /   \     /  \    /  \
    fib(2) fib(1) fib(1) fib(0) fib(1) fib(0)
    /  \
 fib(1) fib(0)
```

**Cuenta cuántas veces aparece `fib(2)` en este árbol**: tres veces, en ramas completamente distintas, cada una recalculando exactamente el mismo resultado desde cero, sin ninguna comunicación entre las ramas. `fib(3)` aparece dos veces. Conforme n crece, este patrón se agrava exponencialmente: el número total de llamadas para calcular `fib(n)` crece como **Θ(φⁿ)** (donde φ es la razón áurea, la misma constante que ya viste emerger en la derivación de la altura de un AVL en el módulo de árboles — no es coincidencia: la recurrencia de Fibonacci genera, estructuralmente, el mismo tipo de crecimiento que la recurrencia de altura mínima de un AVL, ambas siendo variantes de la misma ecuación característica) — **exponencial**, a pesar de que solo existen `n+1` valores *distintos* de Fibonacci entre F(0) y F(n) que en realidad hace falta calcular.

**El diagnóstico preciso**: el árbol de recursión completo tiene un número exponencial de **nodos** (llamadas), pero un número apenas **lineal** de valores *distintos* que esos nodos representan. Toda la ineficiencia viene exclusivamente de recalcular, una y otra vez, esos mismos pocos valores distintos — exactamente la firma de subproblemas superpuestos de la sección 1.2, en su forma más pura y visible.

---

## 3. Memoización — la cura directa: recuerda lo que ya calculaste

### 3.1 El mecanismo, deducido directamente del diagnóstico

Si el problema es que recalculas el mismo subproblema múltiples veces, la solución más directa posible es: **la primera vez que resuelves un subproblema específico, guarda el resultado en una estructura de búsqueda rápida (un diccionario/tabla hash — exactamente la estructura que ya construiste completa en el módulo de hashing). Antes de calcular cualquier subproblema, revisa primero si ya está guardado — si sí, devuélvelo directamente sin volver a hacer ningún trabajo recursivo.**

```python
def fib_memo(n, memoria=None):
    """
    Misma recursion que fib_ingenuo, pero con memoria explicita
    que evita recalcular subproblemas ya resueltos.
    """
    if memoria is None:
        memoria = {}
    if n in memoria:
        return memoria[n]           # ya calculado: O(1), sin recursion
    if n <= 1:
        return n
    resultado = fib_memo(n - 1, memoria) + fib_memo(n - 2, memoria)
    memoria[n] = resultado          # guardar ANTES de retornar
    return resultado
```

**Por qué esto colapsa el costo de exponencial a lineal**: con memoización, cada valor distinto de `n` se calcula, como máximo, **una sola vez** — la primera llamada con ese valor específico de n hace el trabajo recursivo real y lo guarda; **cualquier** llamada subsecuente con el mismo n, sin importar desde qué rama del árbol de recursión original venga, encuentra el valor ya guardado y regresa inmediatamente en O(1). Como hay exactamente `n+1` valores distintos posibles (de F(0) a F(n)), y cada uno hace una cantidad constante de trabajo la única vez que se calcula genuinamente, el costo total colapsa a **O(n)** — de exponencial a lineal, sin cambiar ni una línea de la lógica matemática del problema, solo agregando la disciplina de "nunca recalcules algo que ya calculaste".

### 3.2 Analogía: dejar notas para no re-resolver lo mismo

Piensa en resolver un rompecabezas complejo compartido entre un equipo, donde cada pieza del rompecabezas depende de sub-ensambles más pequeños. Sin coordinación, dos personas del equipo podrían, sin saberlo, estar resolviendo exactamente el mismo sub-ensamble por separado, cada una sin darse cuenta de que la otra ya lo resolvió. Memoización es, literalmente, poner una nota visible ("el sub-ensamble X ya está resuelto, aquí está el resultado") la primera vez que alguien lo termina — cualquiera que después necesite ese mismo sub-ensamble consulta la nota primero, en vez de rehacerlo desde cero. La "memoria" del algoritmo es, exactamente, ese tablero compartido de notas.

---

## 4. Tabulación — deducida como la inversión de la memoización

### 4.1 La pregunta que motiva un enfoque distinto

Memoización sigue siendo, en su estructura, **recursión** — solo que con memoria. Eso significa que sigue pagando el overhead de llamadas de función recursivas, y sigue expuesto al riesgo de desbordar la pila de llamadas en problemas con recursión muy profunda (exactamente el mismo problema que ya identificaste con DFS recursivo en el módulo de grafos). ¿Existe una forma de obtener el mismo resultado —cada subproblema calculado exactamente una vez— **sin** usar recursión en absoluto?

### 4.2 La inversión: si sabes en qué orden se necesitan los subproblemas, simplemente iteras en ese orden

**La observación central**: en memoización, la recursión "desciende" desde el problema grande hacia los subproblemas pequeños, y solo "asciende" de vuelta ensamblando resultados una vez que golpea los casos base. Pero si puedes determinar, de antemano, **el orden correcto** en que los subproblemas dependen unos de otros (típicamente: de los más pequeños/simples hacia los más grandes/complejos), puedes simplemente **iterar en ese orden explícitamente**, llenando una tabla, sin ninguna recursión — cada subproblema, cuando lo calculas, ya tiene todos sus subproblemas dependientes calculados y guardados en la tabla, porque los procesaste primero por construcción del orden de iteración.

```python
def fib_tabulacion(n):
    """
    Mismo resultado que fib_memo, CERO recursion.
    Llena la tabla de "abajo hacia arriba" (bottom-up),
    en el orden EXACTO en que las dependencias lo requieren:
    F(k) depende de F(k-1) y F(k-2), asi que calcular en orden
    creciente de k garantiza que ambas dependencias ya existen.
    """
    if n <= 1:
        return n
    tabla = [0] * (n + 1)
    tabla[0], tabla[1] = 0, 1
    for k in range(2, n + 1):
        tabla[k] = tabla[k - 1] + tabla[k - 2]   # dependencias YA calculadas
    return tabla[n]
```

**Por qué esto funciona sin recursión, deducido y no solo observado**: la recurrencia `F(k) = F(k-1) + F(k-2)` solo depende de valores **estrictamente menores** que k. Si iteras k de menor a mayor, en el momento de calcular `tabla[k]`, tanto `tabla[k-1]` como `tabla[k-2]` **ya fueron calculados** en iteraciones anteriores del mismo bucle — no hay ninguna necesidad de "descender" recursivamente a buscarlos, porque ya están ahí, exactamente en el orden en que la recurrencia los necesita. Esta es la esencia completa de tabulación: **determina el orden de dependencia entre subproblemas, itera en ese orden, y cada cálculo encuentra sus dependencias ya resueltas de forma trivial.**

### 4.3 La analogía de la tabla como memoria que se llena en orden

Piensa en llenar una hoja de cálculo donde cada celda tiene una fórmula que referencia celdas anteriores — si llenas las celdas en el orden correcto (de la primera a la última, respetando qué celda depende de cuál), cada fórmula, al momento de evaluarse, encuentra los valores que necesita ya escritos en las celdas de las que depende. Si intentaras llenar las celdas en un orden arbitrario, algunas fórmulas se encontrarían con celdas todavía vacías — exactamente la trampa del orden de evaluación que se explora explícitamente en la sección de trampas.

---

## 5. El método general de diseño de un DP — el proceso repetible

Aquí está el proceso sistemático, aplicable a cualquier problema nuevo que sospeches que tiene la estructura de DP — la plantilla que vas a aplicar en cada uno de los ejemplos canónicos que siguen:

1. **Define el subproblema**: ¿qué pregunta más pequeña, parametrizada de alguna forma (típicamente por uno o más índices), captura una versión reducida del problema completo? Esta es, con frecuencia, la parte más difícil y creativa del diseño de un DP — no hay una receta mecánica universal, pero un patrón común es "la mejor solución considerando solo los primeros k elementos del input" o "la mejor solución para el subrango entre los índices i y j".

2. **Define la recurrencia**: ¿cómo se relaciona la solución del subproblema actual con las soluciones de subproblemas más pequeños? Esto exige razonar sobre la **última decisión** que se toma para llegar a la solución del subproblema actual (¿incluyo o no el elemento k? ¿el último carácter coincide o no?) y expresar el subproblema actual en términos de qué pasa en cada caso de esa decisión.

3. **Identifica el caso base**: ¿cuál es el subproblema más pequeño posible, cuya respuesta es trivial de determinar sin necesitar ninguna recursión adicional?

4. **Determina el orden de evaluación**: dado que la recurrencia depende de subproblemas "más pequeños" en algún sentido específico, ¿en qué orden concreto hay que calcular los subproblemas para garantizar que, cuando calculas uno, todas sus dependencias ya están resueltas? (Esta pregunta es automática con memoización —la recursión la resuelve implícitamente— pero exige razonamiento explícito para tabulación.)

5. **Reconstruye la solución si es necesario** (no solo el valor óptimo, sino la solución concreta que lo logra): frecuentemente necesitas guardar, además del valor óptimo de cada subproblema, **qué decisión** llevó a ese valor óptimo, para poder reconstruir la solución completa retrocediendo por esas decisiones al final.

---

## 6. Knapsack (mochila 0/1) — trabajado completo desde primer principio

### 6.1 El problema, y por qué la fuerza bruta es exponencial

Tienes `n` objetos, cada uno con un peso `w_i` y un valor `v_i`, y una mochila con capacidad máxima `W`. Quieres elegir un subconjunto de objetos que **maximice el valor total**, sujeto a que el **peso total no exceda W** — y cada objeto se puede incluir completo o no incluirse en absoluto (de ahí "0/1": no puedes tomar una fracción de un objeto, a diferencia de la variante fraccionaria, que resulta ser resoluble con una estrategia greedy simple, precisamente porque permitir fracciones elimina la tensión combinatoria que hace a la versión 0/1 interesante).

**Por qué la fuerza bruta es exponencial**: hay `2^n` subconjuntos posibles de los n objetos — probar cada uno explícitamente y verificar cuáles caben en la capacidad, quedándote con el de mayor valor, es exactamente O(2ⁿ).

### 6.2 Aplicando el método de diseño

**Paso 1 — define el subproblema**: `DP[i][c]` = el valor máximo alcanzable usando **solo los primeros i objetos** (de un total de n), con una capacidad de mochila disponible de **exactamente c**. Nota la elección deliberada de parametrizar por "los primeros i objetos" — esta es la forma natural de reducir el problema, porque te permite razonar sobre "¿qué pasa con el objeto i específicamente?" como la última decisión.

**Paso 2 — define la recurrencia, razonando sobre la última decisión**: para el objeto `i` (el más "reciente" considerado en este subproblema), hay exactamente dos posibilidades: **no incluirlo**, en cuyo caso el valor máximo es el mismo que con los primeros i-1 objetos y la misma capacidad c (`DP[i-1][c]`); o **incluirlo** (solo posible si `w_i ≤ c`, porque si pesa más que la capacidad disponible, ni siquiera es una opción válida), en cuyo caso el valor es `v_i` más el mejor valor alcanzable con los primeros i-1 objetos y la capacidad **restante** después de reservar espacio para el objeto i, es decir `DP[i-1][c - w_i]`. La recurrencia toma el **máximo** de ambas opciones:

```
DP[i][c] = DP[i-1][c]                                    si w_i > c (no cabe, sin opcion)
DP[i][c] = max( DP[i-1][c],  v_i + DP[i-1][c - w_i] )     si w_i <= c (ambas opciones posibles)
```

**Paso 3 — caso base**: `DP[0][c] = 0` para cualquier c (sin objetos disponibles, el valor máximo es cero, sin importar cuánta capacidad tengas) — trivial y sin ambigüedad.

**Paso 4 — orden de evaluación**: la recurrencia para `DP[i][c]` depende únicamente de valores en la fila `i-1` — así que calcular las filas en orden creciente de i (de 0 hasta n) garantiza que cada fila nueva tenga toda la fila anterior ya completamente calculada.

```python
def knapsack_01(pesos, valores, capacidad):
    """
    Knapsack 0/1 via tabulacion. Fiel al esquema de CLRS 
    (introducido como ejemplo de aplicacion de DP en el capitulo 14/
    seccion de ejercicios relacionados).
    """
    n = len(pesos)
    # DP[i][c]: valor maximo usando los primeros i objetos, capacidad c
    dp = [[0] * (capacidad + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        peso_i, valor_i = pesos[i - 1], valores[i - 1]
        for c in range(capacidad + 1):
            dp[i][c] = dp[i - 1][c]           # opcion: no incluir objeto i
            if peso_i <= c:                    # opcion: incluir objeto i, si cabe
                dp[i][c] = max(dp[i][c], valor_i + dp[i - 1][c - peso_i])

    return dp[n][capacidad]


def knapsack_01_reconstruir(pesos, valores, capacidad):
    """
    Version que ademas reconstruye QUE objetos especificos se eligieron,
    retrocediendo por la tabla comparando dp[i][c] contra dp[i-1][c].
    """
    n = len(pesos)
    dp = [[0] * (capacidad + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        peso_i, valor_i = pesos[i - 1], valores[i - 1]
        for c in range(capacidad + 1):
            dp[i][c] = dp[i - 1][c]
            if peso_i <= c:
                dp[i][c] = max(dp[i][c], valor_i + dp[i - 1][c - peso_i])

    # Reconstruccion: si dp[i][c] != dp[i-1][c], el objeto i FUE incluido
    seleccionados = []
    c = capacidad
    for i in range(n, 0, -1):
        if dp[i][c] != dp[i - 1][c]:
            seleccionados.append(i - 1)   # indice del objeto (0-based)
            c -= pesos[i - 1]
    seleccionados.reverse()
    return dp[n][capacidad], seleccionados


if __name__ == "__main__":
    pesos = [2, 3, 4, 5]
    valores = [3, 4, 5, 6]
    capacidad = 5
    valor_max, elegidos = knapsack_01_reconstruir(pesos, valores, capacidad)
    print(f"Valor maximo: {valor_max}, objetos elegidos (indices): {elegidos}")
    assert valor_max == knapsack_01(pesos, valores, capacidad)
```

**Costo**: la tabla tiene `(n+1) × (W+1)` entradas, cada una calculada en O(1) — **O(nW)**. Nota que esto es **pseudo-polinomial**, no estrictamente polinomial en el tamaño de la entrada — depende del **valor numérico** de W, no solo de cuántos bits necesitas para representarlo (si W es un número astronómicamente grande representado con pocos dígitos, la tabla sería astronómicamente grande) — una distinción sutil que vale la pena reconocer: knapsack 0/1 es, de hecho, NP-difícil en el sentido estricto de complejidad computacional, y esta solución de DP no lo contradice, porque su costo depende del **valor** de W, no de su tamaño en bits.

---

## 7. Longest Common Subsequence (LCS) — trabajado completo

### 7.1 El problema

Dadas dos secuencias (por ejemplo, dos strings), encuentra la **subsecuencia común más larga** — una secuencia de caracteres que aparece en ambas cadenas, en el mismo orden relativo, pero **no necesariamente contigua** (a diferencia de un "substring", que sí exige contigüidad). Por ejemplo, para `"ABCBDAB"` y `"BDCABA"`, una LCS es `"BCBA"` (longitud 4).

### 7.2 Aplicando el método de diseño

**Paso 1 — subproblema**: `DP[i][j]` = la longitud de la LCS entre el prefijo de la primera cadena de longitud i, y el prefijo de la segunda cadena de longitud j.

**Paso 2 — recurrencia, razonando sobre la última decisión (el último carácter de cada prefijo)**: si el carácter `i` de la primera cadena es **igual** al carácter `j` de la segunda, ese carácter puede formar parte de la LCS —extiende, en uno, la mejor LCS encontrada entre los prefijos sin esos últimos caracteres (`DP[i-1][j-1] + 1`). Si son **distintos**, el último carácter de al menos una de las dos cadenas no puede ser parte de la LCS de ambos prefijos completos simultáneamente — así que la respuesta es el máximo entre "ignora el último carácter de la primera cadena" (`DP[i-1][j]`) y "ignora el último carácter de la segunda" (`DP[i][j-1]`).

```
DP[i][j] = DP[i-1][j-1] + 1                    si char_1[i] == char_2[j]
DP[i][j] = max(DP[i-1][j], DP[i][j-1])         si char_1[i] != char_2[j]
```

**Paso 3 — caso base**: `DP[0][j] = 0` para cualquier j, y `DP[i][0] = 0` para cualquier i (una LCS contra una cadena vacía tiene, trivialmente, longitud 0).

**Paso 4 — orden de evaluación**: cada celda depende de la celda diagonal superior izquierda, la de arriba, y la de la izquierda — todas con índices estrictamente menores. Iterar i y j en orden creciente (por filas, o por columnas, cualquiera funciona mientras ambos índices crezcan) garantiza que las dependencias ya estén calculadas.

```python
def lcs(s1, s2):
    """
    Longest Common Subsequence via tabulacion.
    Fiel al esquema de CLRS 14.4.
    """
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # Reconstruccion de la subsecuencia real, retrocediendo desde (m,n)
    i, j = m, n
    subsecuencia = []
    while i > 0 and j > 0:
        if s1[i - 1] == s2[j - 1]:
            subsecuencia.append(s1[i - 1])
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
    subsecuencia.reverse()

    return dp[m][n], "".join(subsecuencia)


if __name__ == "__main__":
    longitud, secuencia = lcs("ABCBDAB", "BDCABA")
    print(f"LCS longitud: {longitud}, secuencia: {secuencia}")
    assert longitud == 4
```

**Costo**: O(mn) — la tabla tiene (m+1)(n+1) celdas, cada una O(1).

### 7.3 Edit distance — la extensión natural de LCS, esbozada

**Edit distance** (distancia de Levenshtein) pregunta algo relacionado pero distinto: el número **mínimo** de operaciones (insertar, eliminar, sustituir un carácter) para transformar una cadena en otra. La estructura del DP es prácticamente idéntica a LCS —mismo subproblema parametrizado por prefijos `(i,j)`, misma idea de razonar sobre el último carácter de cada prefijo— pero la recurrencia cambia: si los caracteres coinciden, no hay costo adicional (`DP[i-1][j-1]`); si no coinciden, tomas el **mínimo** de tres operaciones posibles (sustituir: `DP[i-1][j-1]+1`; insertar: `DP[i][j-1]+1`; eliminar: `DP[i-1][j]+1`), en vez del máximo de dos opciones que usaba LCS. Reconocer esta similitud estructural —el mismo "esqueleto" de subproblema por prefijos, con una recurrencia adaptada al objetivo específico (maximizar longitud común vs. minimizar operaciones de edición)— es exactamente el tipo de transferencia de patrón que el método de diseño de la sección 5 te permite hacer una vez que lo dominas sobre un ejemplo completo como LCS.

---

## 8. Edge cases y trampas explícitas

**Aplicar DP donde no hay subestructura óptima**: ya se estableció el contraejemplo formal en la sección 1.1 (camino simple más largo) — la trampa práctica es no verificar esta condición antes de lanzarte a diseñar una recurrencia, asumiendo que "cualquier problema con subproblemas parece resolverse con DP". Si construyes una tabla y una recurrencia sobre un problema sin subestructura óptima, obtienes un algoritmo rápido que da **respuestas incorrectas** — no un error visible, un resultado silenciosamente equivocado, exactamente el tipo de falla más peligrosa porque no se anuncia como tal.

**La trampa del orden de evaluación en tabulación**: si tu recurrencia depende de una celda que **todavía no has calculado** en el orden de iteración que elegiste, obtienes un valor incorrecto (típicamente 0 o el valor inicial de la tabla, no un error) silenciosamente. Esto ocurre concretamente cuando la dependencia entre subproblemas no es tan simple como "estrictamente menor en un solo índice" — por ejemplo, en problemas sobre intervalos `DP[i][j]` donde la recurrencia depende de `DP[i+1][j]` y `DP[i][j-1]` simultáneamente (i creciendo mientras j decrece, o viceversa), el orden correcto de iteración no es simplemente "i de menor a mayor, j de menor a mayor" — frecuentemente necesitas iterar por **longitud del intervalo** (de intervalos más cortos a más largos), no por los índices individuales directamente. Verificar explícitamente, para cada celda de la tabla, que **todas** sus dependencias según la recurrencia ya fueron visitadas por el orden de iteración elegido es un paso de diseño que no se puede saltar.

**Memoización desbordando la pila en problemas profundos**: exactamente el mismo problema que ya identificaste con DFS recursivo — si el subproblema más profundo de la recursión de memoización requiere miles de niveles de profundidad (por ejemplo, un DP parametrizado por un índice que puede llegar a cientos de miles), la recursión puede exceder el límite de profundidad de pila del runtime. **La mitigación estándar**: si sospechas que un problema de DP va a tener recursión profunda, prefiere tabulación desde el principio (que nunca usa la pila de llamadas del lenguaje, exactamente como ya viste con la ventaja de DFS iterativo sobre recursivo) — o, si memoización es más natural de expresar para ese problema específico, aumenta explícitamente el límite de recursión del runtime (con las precauciones correspondientes sobre memoria real disponible) o reescribe la recursión de forma iterativa con una pila explícita en el heap.

**"Parece greedy pero necesita DP"**: una trampa conceptual sutil y común — algunos problemas *parecen* resolubles con una estrategia greedy simple (toma siempre la decisión localmente óptima, sin reconsiderar) pero en realidad requieren considerar **todas** las combinaciones posibles porque una decisión local aparentemente óptima puede cerrar la puerta a una solución global mejor. Knapsack 0/1 es exactamente este caso: greedy "toma siempre el objeto con mejor relación valor/peso" **no** garantiza la solución óptima (a diferencia de la variante fraccionaria del problema, donde sí funciona, precisamente porque ahí no hay ninguna decisión "todo o nada" que pueda arrepentirse de una elección parcial) — necesitas, genuinamente, considerar la interacción entre todas las decisiones de inclusión/exclusión, que es exactamente lo que la tabla de DP hace sistemáticamente en vez de comprometerse prematuramente con una sola decisión local. **Reconocer esta distinción — cuándo una decisión local es segura de tomar sin reconsiderar (greedy, como en MST con la propiedad del corte) vs. cuándo necesitas mantener abiertas todas las posibilidades hasta el final (DP)— es, en la práctica, una de las habilidades más valiosas y más difíciles de este curso, y no tiene un criterio mecánico universal: exige, cada vez, verificar explícitamente si la propiedad de subestructura óptima realmente se sostiene bajo una decisión greedy local, o si requiere el espacio completo de posibilidades que DP explora sistemáticamente.**

---

## 9. Trade-offs explícitos

**Memoización vs. tabulación**: memoización frecuentemente es **más natural de escribir** — traduces directamente la recurrencia matemática a código recursivo, sin tener que razonar explícitamente sobre el orden de evaluación (la recursión lo resuelve implícitamente, "descendiendo" hasta encontrar lo que necesita). Además, memoización **solo calcula los subproblemas que genuinamente se necesitan** para resolver el problema original — si algunas combinaciones de parámetros nunca son alcanzadas por ninguna llamada recursiva real, memoización simplemente nunca las calcula, mientras que tabulación, tal como se presentó arriba, típicamente llena **toda** la tabla, incluyendo posiblemente celdas que el problema original nunca necesitó. Tabulación, a cambio, evita el overhead de llamadas recursivas y el riesgo de desbordamiento de pila, y **da control explícito sobre el uso de memoria** — lo cual lleva directamente a la siguiente optimización.

**Optimización de espacio: guardar solo la fila anterior**: en muchos DPs de dos dimensiones (knapsack, LCS), la recurrencia de la fila `i` depende **únicamente** de la fila `i-1` (nunca de filas más antiguas) — esto significa que, si solo te interesa el valor final (no la reconstrucción completa de la solución, que sí necesita la tabla histórica completa para retroceder), puedes **descartar** todas las filas excepto la actual y la inmediatamente anterior, reduciendo el uso de memoria de O(nW) o O(mn) a **O(W)** o **O(n)** respectivamente — una mejora sustancial cuando la dimensión descartada es grande. Esta optimización es exactamente análoga, en espíritu, a por qué el análisis amortizado del array dinámico se preocupaba por el costo real de memoria, no solo de tiempo — space-time trade-offs aparecen constantemente en ingeniería real, y reconocer cuándo puedes sacrificar la tabla histórica completa (porque no necesitas reconstruir la solución, solo su valor) es una optimización de producción genuina, no solo un ejercicio académico.

```python
def knapsack_01_espacio_optimizado(pesos, valores, capacidad):
    """
    Misma logica que knapsack_01, pero SOLO guarda una fila --
    O(W) de espacio en vez de O(nW). Sacrifica la capacidad de
    reconstruir QUE objetos se eligieron (solo da el valor optimo).
    NOTA: se itera c de MAYOR a MENOR dentro de cada fila --
    esto es CRITICO: iterar de menor a mayor usaria, por error,
    el valor YA ACTUALIZADO de esta misma iteracion de i, en vez
    del valor de la fila anterior, violando la recurrencia.
    """
    n = len(pesos)
    dp = [0] * (capacidad + 1)

    for i in range(n):
        for c in range(capacidad, pesos[i] - 1, -1):   # de mayor a menor
            dp[c] = max(dp[c], valores[i] + dp[c - pesos[i]])

    return dp[capacidad]
```

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Bellman-Ford ES programación dinámica — cierre formal del módulo anterior.** Ya lo adelantaste conceptualmente en `itc-c7-grafos-ii`: Bellman-Ford, con el marco de este módulo en la mano, se puede describir con precisión completa usando el método de diseño de la sección 5. Subproblema: `DP[k][v]` = la distancia mínima desde el origen hasta v, usando **a lo más k aristas**. Recurrencia: `DP[k][v] = min(DP[k-1][v], min sobre todas las aristas (u,v) de DP[k-1][u] + peso(u,v))` — exactamente "o no mejoras respecto a k-1 aristas, o mejoras relajando una arista más". Caso base: `DP[0][origen] = 0`, `DP[0][v] = infinito` para cualquier otro v. Orden de evaluación: k de 0 hasta V-1, exactamente las "pasadas" que ya construiste. **Cada pasada completa de relajación de Bellman-Ford es, literalmente, calcular una fila completa de esta tabla de DP** — y esto explica, con el rigor que faltaba en el módulo anterior, por qué Bellman-Ford tolera pesos negativos donde Dijkstra no: la tabla de DP nunca "cierra" ni descarta ningún subproblema prematuramente, considera sistemáticamente **todas** las formas de llegar a cada vértice con cada número de aristas permitido, exactamente la propiedad que la estrategia greedy de Dijkstra sacrifica a cambio de velocidad.

**DP en bioinformática — alineamiento de secuencias es, literalmente, edit distance.** El problema de **alineamiento de secuencias** en biología computacional (comparar dos secuencias de ADN, ARN, o proteínas para medir su similitud evolutiva o funcional, identificando inserciones, eliminaciones, y sustituciones entre ellas) es, con precisión matemática exacta, el mismo problema que edit distance de la sección 7.3 — la única diferencia práctica es que las "operaciones" (sustitución, inserción, eliminación de un nucleótido o aminoácido) suelen tener **costos distintos entre sí** según el contexto biológico específico (algunas sustituciones son evolutivamente más "baratas"/probables que otras, según matrices de sustitución específicas como BLOSUM o PAM en el caso de proteínas), pero la estructura del DP —el algoritmo de Needleman-Wunsch para alineamiento global, y Smith-Waterman para alineamiento local— es exactamente la misma tabla bidimensional, la misma recurrencia sobre prefijos, el mismo razonamiento sobre la última decisión de cada posición. Reconocer esta equivalencia estructural es exactamente el tipo de transferencia de conocimiento entre dominios aparentemente distintos (algoritmos de texto vs. biología molecular) que programación dinámica, como técnica general, habilita — el mismo patrón de razonamiento resuelve problemas que superficialmente no tienen nada que ver entre sí.

**Por qué DP es de lo más preguntado en entrevistas técnicas y en programación competitiva.** DP recompensa, de forma más directa que casi cualquier otra técnica algorítmica, la habilidad de **razonamiento estructurado desde primer principio** bajo presión de tiempo: no hay una biblioteca que resuelva "tu problema de DP específico" — cada problema nuevo exige, genuinamente, identificar el subproblema correcto, derivar la recurrencia correcta razonando sobre la última decisión, y determinar el orden de evaluación correcto, exactamente el método de la sección 5 aplicado desde cero cada vez. Esto lo convierte en una señal particularmente informativa en entrevistas técnicas (revela si alguien puede descomponer un problema nuevo sistemáticamente, no solo si memorizó soluciones de problemas ya vistos) y en el terreno central de la programación competitiva (donde los problemas de DP van desde variantes directas de los ejemplos canónicos de este módulo hasta formulaciones mucho más sutiles que exigen encontrar una parametrización de subproblema genuinamente no obvia) — el puente natural hacia la espina Competitiva de tu propio currículo, donde este mismo método de diseño se va a aplicar repetidamente contra problemas cada vez menos parecidos a los ejemplos de libro de texto.

---

## Síntesis — el mapa mental

1. Programación dinámica existe porque ciertos problemas, resueltos por recursión ingenua, **recalculan el mismo subproblema exponencialmente muchas veces** — el costo no viene de la dificultad intrínseca del problema, sino de olvidar sistemáticamente el trabajo ya hecho.
2. Dos condiciones, independientes y ambas necesarias: **subestructura óptima** (¿puedo ensamblar la solución grande a partir de soluciones óptimas de partes? — condición de correctitud) y **subproblemas superpuestos** (¿se repite el mismo subproblema múltiples veces? — condición de que valga la pena "recordar").
3. **Fibonacci ingenuo** es la demostración mínima y más clara: árbol de recursión con Θ(φ⁙) nodos, pero solo n+1 valores distintos — toda la explosión exponencial es trabajo redundante puro.
4. **Memoización** cura esto directamente: guarda cada resultado la primera vez que se calcula, consúltalo antes de recalcular — colapsa exponencial a polinomial sin cambiar la lógica matemática, solo agregando memoria.
5. **Tabulación** invierte el enfoque: determina el orden de dependencia entre subproblemas, itera explícitamente en ese orden, llena una tabla sin ninguna recursión — mismo resultado, sin overhead de pila de llamadas ni riesgo de desbordamiento.
6. El **método general de diseño** (subproblema → recurrencia → caso base → orden de evaluación → reconstrucción si hace falta) es un proceso repetible, aplicado completo tanto a knapsack (razonando sobre incluir/no incluir el último objeto) como a LCS (razonando sobre si el último carácter de cada prefijo coincide).
7. La trampa más peligrosa no es un error de sintaxis — es aplicar DP a un problema **sin** subestructura óptima (respuesta rápida pero incorrecta, silenciosamente) o llenar una tabla en el **orden equivocado** de dependencias (mismo síntoma: resultado incorrecto sin ningún error visible).
8. **Bellman-Ford es DP**, formalizado con el mismo marco de este módulo — la razón exacta de por qué tolera pesos negativos donde la estrategia greedy de Dijkstra no puede.

---

## Preguntas que deberías poder responder

1. Dado un problema nuevo cualquiera, describe el proceso concreto para verificar si tiene subestructura óptima — ¿qué tendrías que intentar construir, y qué contradicción buscarías si sospechas que la propiedad falla?
2. Explica, con tus propias palabras y sin ver el texto, por qué el problema del camino simple más largo en un grafo NO tiene subestructura óptima, usando el argumento de interferencia entre las soluciones óptimas de los subproblemas.
3. Dibuja (mentalmente o en papel) el árbol de recursión completo de `fib_ingenuo(6)`, cuenta cuántas veces aparece `fib(2)`, y usa ese conteo para argumentar por qué el costo total crece exponencialmente y no linealmente.
4. Convierte, sin ver el texto, la función `fib_memo` en una versión de tabulación equivalente — explica explícitamente cuál es el "orden de dependencia" que la tabulación tiene que respetar.
5. Para knapsack 0/1, explica por qué la estrategia greedy "toma siempre el objeto con mejor relación valor/peso" no garantiza la solución óptima — construye un contraejemplo concreto con 3 objetos donde greedy falla.
6. Reproduce, sin ver el texto, la derivación completa de la recurrencia de LCS — ¿por qué el caso "los caracteres coinciden" solo tiene una opción, mientras el caso "no coinciden" necesita tomar un máximo entre dos opciones?
7. Explica la trampa del orden de evaluación en tabulación con un ejemplo concreto donde "i creciente, j creciente" NO es el orden correcto de iteración — ¿qué tipo de recurrencia rompe ese supuesto simple?
8. Formaliza Bellman-Ford completamente como programación dinámica, siguiendo el método de diseño de la sección 5 (subproblema, recurrencia, caso base, orden de evaluación) — y usa esa formalización para explicar, en una frase, por qué tolera pesos negativos donde Dijkstra no.

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lectures 15-16 (Dynamic Programming): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 14 (Dynamic Programming): elementos de programación dinámica, subestructura óptima (14.1), matrix-chain multiplication como ejemplo canónico adicional (14.2), LCS (14.4), y las notas sobre complejidad de knapsack.
- Needleman, S. B. y Wunsch, C. D., "A general method applicable to the search for similarities in the amino acid sequence of two proteins", *Journal of Molecular Biology*, 1970 — el algoritmo de alineamiento global en bioinformática, estructuralmente equivalente a edit distance (mencionado en Conexiones).
