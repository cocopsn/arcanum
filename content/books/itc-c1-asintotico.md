---
module_id: itc-c1-asintotico
spine: ITC
title: "Análisis asintótico y correctitud"
subtitle: "Cómo medir el tiempo sin un reloj"
source_canonical: "MIT 6.006 Introduction to Algorithms, Lectures 1-2; CLRS cap. 2-3"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Análisis asintótico y correctitud

> **Pregunta raíz.** Si dos programadores escriben el mismo algoritmo, uno en una laptop del 2015 y otro en un cluster de 2026, y comparan cuánto tardó cada uno en correr — ¿qué acaban de medir? No el algoritmo. Midieron hardware, compilador, carga del sistema operativo, hasta la temperatura del cuarto. El problema raíz de este módulo es: **¿cómo hablamos del costo de un algoritmo de forma que la afirmación siga siendo verdad en cualquier máquina, en cualquier año, corrida por cualquier persona?**

## Prólogo — de dónde nace esto

Imagina que quieres comparar dos recetas de cocina, no dos platillos. No te importa si un cocinero es más rápido cortando cebolla que otro — eso es "hardware" (destreza motriz, cuchillo afilado, cuántas horas durmió). Te importa la **estructura** de la receta: ¿cuántos pasos tiene en función del número de comensales? Una receta que dice "por cada comensal adicional, agrega un paso" escala linealmente. Una que dice "por cada comensal adicional, cada paso existente se duplica" escala exponencialmente — y no importa qué tan rápido cortes cebolla, esa receta te va a matar en el comensal 40.

Eso es exactamente lo que queremos de un algoritmo: una afirmación sobre su **estructura de crecimiento**, separada del cocinero (el hardware) y separada del tamaño específico del banquete (el input concreto). Necesitamos una vara de medir que:

1. No dependa de la velocidad del procesador.
2. No dependa del lenguaje o el compilador.
3. Nos diga algo verdadero sobre **qué le pasa al algoritmo cuando el input crece sin límite**, porque en la práctica los inputs siempre crecen — hoy tu base de datos tiene 10,000 filas, en 3 años tiene 10,000,000.

El análisis asintótico es la respuesta a esa necesidad. No es "una forma más de medir tiempo" — es la única forma de medir tiempo que sobrevive el cambio de máquina. Todo lo que sigue en este módulo es la consecuencia lógica de tomar en serio esos tres requisitos.

---

## 1. Por qué el tiempo de pared (wall-clock time) es una mala métrica

Empecemos por destruir la métrica ingenua antes de construir la buena — así entiendes *por qué* necesitas algo distinto, no solo *que* existe algo distinto.

Supón que mides con un cronómetro cuánto tarda tu función en ordenar un arreglo de 1000 elementos. Obtienes 3ms. ¿Qué acabas de aprender sobre el algoritmo?

Casi nada, porque ese número es la salida de una función con demasiadas variables ocultas:

```
tiempo_medido = f(algoritmo, hardware, SO, lenguaje, compilador/intérprete,
                   estado de la caché, otros procesos corriendo, input específico)
```

Cambia **cualquiera** de esas variables sin tocar el algoritmo y el número cambia. Corre el mismo código en Python vs. en C: fácil 50-100x de diferencia, y el algoritmo — la *idea* — es idéntica. Corre el mismo binario con la caché fría vs. caliente: puede variar 10x. El tiempo de pared mide el sistema completo, no el algoritmo. Es como intentar medir la "inteligencia" de una receta cronometrando a un cocinero específico un martes por la tarde.

**La trampa común aquí**: alguien optimiza su código, lo corre, ve que bajó de 3ms a 2ms, y concluye "mejoré el algoritmo". Puede que solo haya mejorado la localidad de caché o que la JIT haya calentado. El tiempo de pared no te dice *por qué* cambió, y por lo tanto no te dice si la mejora **escala** — si a 1,000,000 de elementos seguirá siendo mejor, o si esa ganancia era un artefacto de las condiciones específicas de la medición.

Lo que sí necesitamos conservar de la intuición del cronómetro es la pregunta que trata de responder: *¿cuánto trabajo hace el algoritmo?* Solo que vamos a medir **trabajo**, no **tiempo de reloj**.

---

## 2. El modelo de cómputo (RAM model) — qué contamos realmente

Si vamos a contar "trabajo" en vez de tiempo, necesitamos primero acordar **qué cuenta como una unidad de trabajo**. Esto no es un detalle técnico menor — es la fundación sobre la que se para todo lo demás. Sin un modelo de cómputo explícito, "cuento operaciones" es una frase vacía: ¿cuenta una suma como una operación? ¿Y multiplicar dos números de 500 dígitos — eso es "una operación" igual que sumar 2+2?

MIT 6.006 y CLRS usan el **modelo RAM (Random Access Machine)**. Sus supuestos, y el porqué de cada uno:

- **Las operaciones aritméticas y lógicas básicas (suma, resta, comparación, asignación) toman tiempo constante O(1) cada una**, independiente del tamaño de los operandos, *siempre que los operandos quepan en una palabra de memoria* (típicamente 32 o 64 bits). ¿Por qué este supuesto? Porque en hardware real, sumar dos enteros de 64 bits sí toma tiempo constante — el circuito sumador no se hace más lento porque el número sea 3 en vez de 3 mil millones, mientras ambos quepan en el registro. Es una idealización razonable del hardware real, no una fantasía arbitraria.
- **El acceso a cualquier posición de memoria toma tiempo constante O(1)** — de ahí el nombre "Random Access": `arr[i]` cuesta lo mismo sea `i=0` o `i=999999`. Esto también refleja hardware real (RAM literalmente significa esto), aunque es una simplificación — en la práctica la jerarquía de caché hace que acceder a memoria "lejana" (cache miss) sea más lento que acceder a memoria "cercana" (cache hit). El modelo RAM ignora esto a propósito: es una abstracción que captura el 95% del comportamiento sin ahogarte en detalles de microarquitectura. (Cuando ese 5% importa — optimización de bajo nivel, HPC — se usan modelos más finos, pero eso es otro módulo.)

**El punto clave**: el modelo RAM es una elección, no una ley física. Es la elección que hace que "contar operaciones" tenga sentido matemático preciso, y que ese conteo sea una buena aproximación del comportamiento en hardware real para el 95% de los algoritmos que vas a escribir en tu carrera.

Con este modelo, ahora sí podemos preguntar de forma rigurosa: **dado un input de tamaño n, ¿cuántas operaciones O(1) ejecuta el algoritmo, en función de n?** Esa función — llamémosla T(n) — es lo que vamos a analizar. No es tiempo en segundos. Es un conteo de pasos elementales, expresado como función del tamaño del input.

---

## 3. Crecimiento asintótico — por qué las constantes se desvanecen

Ya tenemos T(n), una función exacta. Por ejemplo, para cierto algoritmo podrías derivar (contando línea por línea) que:

```
T(n) = 3n² + 2n + 7
```

Pregunta: ¿por qué no nos quedamos con esta función exacta? Es más informativa, ¿no?

Aquí es donde entra la idea central del módulo, y hay que **deducirla**, no aceptarla. Dos razones, ambas necesarias:

**Razón 1 — las constantes son mentirosas.** El coeficiente "3" en `3n²` depende de decisiones de bajo nivel: cuántas instrucciones de máquina genera tu compilador por cada iteración del loop, qué tan eficiente es tu intérprete de Python vs. un binario de C. Si reescribes el mismo algoritmo en otro lenguaje, obtienes `T'(n) = 1.2n² + 0.5n + 2` — mismo algoritmo, coeficientes distintos. La *estructura* (que crece como n²) es invariante; los coeficientes no lo son. Como queremos una afirmación que sobreviva el cambio de lenguaje/máquina (nuestro requisito original), tenemos que descartar los coeficientes.

**Razón 2 — para n grande, el término dominante se come a todos los demás.** Esta es la parte que hay que sentir con números, no solo aceptar en abstracto. Toma `T(n) = 3n² + 2n + 7` y evalúa la *proporción* que representa cada término del total conforme n crece:

| n | 3n² | 2n | 7 | % que es 3n² del total |
|---|-----|-----|---|---|
| 10 | 300 | 20 | 7 | 91.7% |
| 100 | 30,000 | 200 | 7 | 99.3% |
| 10,000 | 300,000,000 | 20,000 | 7 | 99.993% |
| 1,000,000 | 3×10¹² | 2×10⁶ | 7 | 99.9999% |

A medida que n crece, el término `2n + 7` se vuelve **matemáticamente irrelevante** frente a `3n²`. No es que lo ignoremos por pereza — es que su contribución al total tiende a cero en proporción. Esto es exactamente análogo a la física de sistemas que escalan: si tienes un cohete cuya masa es 99% combustible y 1% carga útil, para análisis de primer orden ("¿cuánta energía necesito?") modelas la masa como "toda combustible" — el 1% no cambia la conclusión cualitativa aunque sí importe para ingeniería fina. El análisis asintótico es precisamente ese "análisis de primer orden": qué domina quién a gran escala.

**Consecuencia lógica, no regla arbitraria**: si dos funciones difieren solo en constantes multiplicativas o en términos de orden inferior, decimos que tienen el **mismo crecimiento asintótico**. `3n² + 2n + 7` y `n²` y `0.001n² + 10⁹` son, asintóticamente, "lo mismo": todas crecen como n². Esto no es una simplificación que perdemos información gratis — es la abstracción correcta para la pregunta que estamos haciendo ("¿cómo escala esto cuando el input crece sin límite?").

---

## 4. Big-O, Big-Θ, Big-Ω — deducidos desde la necesidad, no recitados

Ahora viene la parte que casi todos los estudiantes memorizan sin entender: las notaciones O, Θ, Ω. Vamos a **deducir** por qué necesitamos tres notaciones distintas, no dos ni una.

### 4.1 El problema que resuelve cada una

Cuando decimos "T(n) crece como n²", en realidad estamos haciendo una de tres afirmaciones distintas, y el lenguaje natural las confunde:

1. **"T(n) no crece más rápido que n²"** — una *cota superior*. Es útil cuando quieres garantizar un peor caso: "este algoritmo nunca tardará más que proporcionalmente n²".
2. **"T(n) no crece más lento que n²"** — una *cota inferior*. Es útil cuando quieres probar que no puedes hacerlo mejor: "cualquier algoritmo para este problema necesita al menos proporcionalmente n² pasos".
3. **"T(n) crece exactamente como n²"** — cota ajustada por ambos lados, la afirmación más fuerte y más informativa.

Estas tres son afirmaciones lógicamente distintas y necesitas las tres en distintos contextos. De ahí nacen O (cota superior), Ω (cota inferior), Θ (cota ajustada). No son "tres formas redundantes de decir lo mismo" — son tres relaciones matemáticas distintas, análogas a `≤`, `≥`, `=` pero para el crecimiento de funciones.

### 4.2 Definición formal de Big-O — y por qué la formalidad importa

Aquí está la definición de CLRS:

**f(n) = O(g(n))** si y solo si existen constantes positivas `c` y `n₀` tales que `0 ≤ f(n) ≤ c·g(n)` para todo `n ≥ n₀`.

Vamos a descomponer cada pieza y preguntarnos *por qué está ahí* — porque cada símbolo de esta definición existe para resolver un problema específico que ya identificamos:

- **`c` (la constante)** existe precisamente porque decidimos en la sección 3 que las constantes multiplicativas no importan. `c` es la "licencia" formal para decir "ignoro el coeficiente exacto, solo me importa la forma". Si `f(n) = 3n²` y `g(n) = n²`, eliges `c = 3` (o cualquier número ≥ 3) y la desigualdad se cumple trivialmente. `c` absorbe exactamente la parte de la función que decidimos que no importa.
- **`n₀` (el umbral)** existe porque para valores pequeños de n, el comportamiento puede ser "raro" o inconsistente — quizás para n=1,2,3 la función con término de orden inferior es momentáneamente mayor. No nos importa: solo nos importa el comportamiento **eventual**, cuando n es "suficientemente grande". `n₀` es la licencia formal para decir "ignoro los primeros casos, solo me importa qué pasa cuando el input es grande". Esto conecta directo con nuestro requisito original: nos importa el comportamiento a escala, no el caso trivial de juguete.
- **`para todo n ≥ n₀`** es lo que hace la afirmación universal y verificable, no una observación anecdótica de un par de valores.

Con esto puedes ahora *verificar* una afirmación de Big-O como una prueba matemática, no como una intuición. Ejemplo trabajado:

**Afirmar:** `2n² + 3n = O(n²)`

**Prueba:** Necesitamos encontrar `c` y `n₀` tales que `2n² + 3n ≤ c·n²` para todo `n ≥ n₀`.

```
2n² + 3n ≤ 2n² + 3n²   (para n ≥ 1, ya que n ≤ n²)
         = 5n²
```

Entonces tomando `c = 5` y `n₀ = 1`, se cumple `2n² + 3n ≤ 5n²` para todo `n ≥ 1`. ∎

Nota algo importante: **`c` no es único**. Pudimos haber elegido `c=6, n₀=1` o `c=5.001, n₀=1` — cualquiera funciona. Big-O es una afirmación de existencia ("existe *alguna* constante que funcione"), no de un valor específico. Esto explícitamente es una **trampa común**: los estudiantes a veces buscan "el" valor de c como si fuera único; no lo es, y no importa cuál encuentres mientras la desigualdad se sostenga.

### 4.3 Big-Ω (cota inferior) — la definición espejo

**f(n) = Ω(g(n))** si y solo si existen constantes positivas `c` y `n₀` tales que `0 ≤ c·g(n) ≤ f(n)` para todo `n ≥ n₀`.

Es literalmente la desigualdad de Big-O invertida. Si Big-O dice "f no crece más rápido que g", Ω dice "f no crece más lento que g". Se usa típicamente para afirmar límites teóricos de un *problema* (no de un algoritmo específico): "cualquier algoritmo de comparación para ordenar necesita Ω(n log n) comparaciones en el peor caso" es una afirmación sobre el problema entero, una cota que *ningún* algoritmo puede romper — no solo sobre una implementación particular.

### 4.4 Big-Θ (cota ajustada) — la intersección

**f(n) = Θ(g(n))** si y solo si `f(n) = O(g(n))` **y** `f(n) = Ω(g(n))` simultáneamente. Formalmente: existen `c₁, c₂, n₀` tales que `c₁·g(n) ≤ f(n) ≤ c₂·g(n)` para todo `n ≥ n₀`.

Θ es la afirmación fuerte: "f crece *exactamente* como g, salvo constantes". Cuando alguien dice coloquialmente "este algoritmo es O(n log n)" refiriéndose a su comportamiento típico exacto (no solo una cota superior conservadora), técnicamente debería decir Θ(n log n). En la práctica de la industria, "Big-O" se usa laxamente para lo que formalmente es Θ — es una imprecisión común que ahora tú puedes detectar y, cuando importe (una entrevista técnica rigurosa, un paper), corregir.

**Trampa explícita**: `f(n) = O(n²)` es una afirmación *verdadera* incluso si f(n) en realidad crece como n (lineal) — porque n también está acotado superiormente por n². Es como decir "corro menos de 100 km/h" siendo cierto pero poco informativo si en realidad corres a 10 km/h. Big-O por sí solo nunca te dice que la cota es *ajustada* — solo Θ garantiza eso. Cuando quieras la afirmación más fuerte y honesta sobre el comportamiento real, busca Θ, no O.

### 4.5 Jerarquía de crecimiento — para tener intuición de escala

Ordenadas de menor a mayor crecimiento (referencia de CLRS cap. 3):

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
```

La intuición cualitativa que debes internalizar (no memorizar, sentir):

- **O(log n)**: cada paso descarta una fracción constante del problema (búsqueda binaria descartando la mitad). Con n=1,000,000, log₂(n) ≈ 20. Brutalmente eficiente.
- **O(n)**: tocas cada elemento una vez. El piso natural para cualquier algoritmo que necesita *mirar* todo el input.
- **O(n log n)**: divide-y-vencerás típico (mergesort). n niveles de trabajo O(n) cada uno, repartidos en log n niveles de recursión — o al revés, log n "pasadas" cada una tocando n elementos.
- **O(n²)**: comparar cada par de elementos (loops anidados sobre el mismo rango). Insertion sort y bubble sort viven aquí.
- **O(2ⁿ)**: explorar todos los subconjuntos posibles de un conjunto de n elementos. Esto es lo que separa "tractable" de "intractable" en la práctica — con n=30, 2³⁰ ya son mil millones de operaciones.

---

## 5. Peor caso, mejor caso, caso promedio — y por qué el peor caso gana por defecto

Un mismo algoritmo puede tener T(n) distinto dependiendo de *cuál* input de tamaño n le des, no solo de n. Insertion sort en un arreglo ya ordenado hace mucho menos trabajo que en uno ordenado al revés, aunque ambos tengan el mismo n. Esto genera tres análisis distintos:

- **Peor caso** `W(n)`: el máximo de T(n) sobre todos los inputs posibles de tamaño n. La pregunta que responde: "¿qué garantía absoluta tengo?"
- **Mejor caso** `B(n)`: el mínimo. Casi nunca es útil como garantía — es fácil de engañar (cualquier algoritmo de ordenamiento tiene mejor caso trivial en un arreglo ya ordenado), así que es la métrica menos citada en la práctica.
- **Caso promedio** `A(n)`: el promedio sobre alguna distribución asumida de inputs (típicamente uniforme). Útil pero **requiere declarar explícitamente la distribución asumida**, porque el resultado depende de esa elección — cambiar la distribución cambia el promedio.

**Por qué el peor caso domina la práctica de ingeniería**: cuando construyes un sistema, no controlas qué input te va a llegar. Si tu API de ordenamiento tiene buen caso promedio pero pésimo peor caso, un usuario malicioso (o simplemente mala suerte estadística) puede construir exactamente el input que dispara el peor caso — y ahora tu sistema, que "en promedio" era rápido, colapsa. Esto no es hipotético: quicksort con selección ingenua de pivote tiene peor caso O(n²), y ese peor caso se dispara con arreglos *ya ordenados* — un input extremadamente común en la práctica, no un caso patológico raro. El peor caso te da una **garantía**; el promedio te da una **expectativa**. En sistemas donde alguien más elige el input (APIs públicas, parsers, sistemas de seguridad), la garantía es lo que necesitas.

**Trade-off explícito**: el peor caso, al ser una garantía, tiende a ser más conservador — y a veces eso te lleva a descartar un algoritmo con excelente comportamiento típico por su peor caso raro (hashing con mal manejo de colisiones tiene peor caso O(n) por operación, pero en la práctica, con buena función hash, es O(1) casi siempre). La decisión de ingeniería real es: **¿puedo controlar o descartar el input adversarial?** Si sí (datos internos, confiables), el caso promedio puede ser la métrica correcta. Si no (input de usuarios externos), el peor caso manda.

---

## 6. Preludio al análisis amortizado

Hay una tercera categoría que no encaja limpio en peor/promedio: cuando ejecutas una **secuencia** de operaciones y algunas son caras pero raras, mientras que la mayoría son baratas. Ejemplo canónico: un arreglo dinámico (como Python `list.append()`) que duplica su capacidad cuando se llena. La mayoría de los `append()` son O(1) (hay espacio libre), pero ocasionalmente uno dispara una realocación y copia O(n).

Si analizas *esa operación específica* en su peor caso, dirías "append es O(n)" — técnicamente correcto para esa llamada, pero **engañosamente pesimista** sobre el comportamiento de la secuencia completa. El **análisis amortizado** pregunta en cambio: "sobre una secuencia de n operaciones, ¿cuál es el costo *promedio por operación*, garantizado, sin asumir ninguna distribución de probabilidad?" (la diferencia clave con "caso promedio": el amortizado es una garantía matemática sobre la secuencia, no una esperanza estadística sobre inputs aleatorios).

Para el arreglo dinámico con duplicación: la operación cara (copiar n elementos) ocurre con frecuencia geométricamente decreciente (después de duplicar en 1, 2, 4, 8... elementos), así que el costo total de n `append()` es O(n), dando un costo amortizado de **O(1) por operación** — a pesar de que operaciones individuales ocasionales cuestan O(n). Este es solo el preludio conceptual; el método formal (agregado, contable, potencial) es tema de un módulo posterior — pero necesitas tener sembrada la pregunta: *"¿estoy midiendo una operación aislada, o el costo real de una secuencia?"*, porque confundir estos dos análisis es una fuente constante de conclusiones erróneas sobre el rendimiento de estructuras de datos.

---

## 7. Correctitud — la otra mitad de la pregunta que nadie hace

Hasta ahora hemos preguntado "¿qué tan rápido es este algoritmo?". Pero esa pregunta es **vacía** si el algoritmo no hace lo que dice hacer. Un algoritmo O(1) que da la respuesta incorrecta no vale nada. Necesitamos una forma de **probar**, no de "confiar", que un algoritmo hace lo correcto — para *todo* input, no solo los que probaste.

### 7.1 Por qué "lo probé y funcionó" no es una prueba

Correr tu algoritmo contra 10 casos de prueba y ver que da la respuesta correcta te dice que funciona **en esos 10 casos**. No te dice nada, matemáticamente, sobre el caso 11. Esto es exactamente el mismo problema epistemológico que el de "medir con cronómetro": una observación finita no genera una garantía universal. Para tener una garantía universal, necesitas una **prueba** — un argumento matemático que cubra *todos* los inputs posibles a la vez, sin enumerarlos uno por uno.

### 7.2 El invariante de lazo — la herramienta que hace esto posible

La pregunta que resuelve el invariante de lazo: ¿cómo pruebo algo sobre un loop que corre un número *variable* de veces (depende de n), sin tener que "desenrollar" el loop y verificar cada iteración a mano?

La respuesta, tomada directamente de la técnica de **inducción matemática** (no es casualidad — es literalmente inducción aplicada a la ejecución del programa): en vez de verificar cada iteración, defines una propiedad P que se cumple **antes de cada iteración**, y pruebas tres cosas:

1. **Inicialización**: P es verdadera antes de la primera iteración (el caso base de la inducción).
2. **Mantenimiento**: si P es verdadera antes de una iteración, sigue siendo verdadera antes de la siguiente iteración (el paso inductivo — "si se cumple en k, se cumple en k+1").
3. **Terminación**: cuando el loop termina, P (combinada con la condición de terminación) implica que el algoritmo produjo el resultado correcto.

Si pruebas estas tres cosas, has probado — por inducción — que P se cumple en **cada** iteración, para **cualquier** n, sin tener que enumerar casos. Esto es exactamente análogo a probar que una escalera infinita es segura probando "el primer escalón aguanta" y "si un escalón aguanta, el siguiente también aguanta" — nunca subes toda la escalera, pero la prueba cubre infinitos escalones.

### 7.3 Ejemplo trabajado completo: Insertion Sort, probado formalmente

Vamos a hacer esto con código real, no pseudocódigo de juguete — y luego probarlo.

```python
def insertion_sort(A):
    """
    Ordena la lista A in-place, ascendente.
    Fiel al algoritmo de CLRS cap. 2.1 (adaptado a índices 0-based de Python;
    CLRS usa 1-based).
    """
    for j in range(1, len(A)):
        key = A[j]
        # Invariante de lazo: al iniciar cada iteración de este for,
        # el subarreglo A[0..j-1] está ordenado y contiene los mismos
        # elementos que originalmente estaban ahí.
        i = j - 1
        while i >= 0 and A[i] > key:
            A[i + 1] = A[i]
            i -= 1
        A[i + 1] = key
    return A


if __name__ == "__main__":
    casos = [
        [5, 2, 4, 6, 1, 3],
        [],
        [1],
        [3, 3, 3],
        [9, 8, 7, 6, 5],
    ]
    for c in casos:
        original = list(c)
        resultado = insertion_sort(c)
        assert resultado == sorted(original), f"FALLO en {original}"
        print(f"{original} -> {resultado}  OK")
```

Correr esto contra 5 casos te da confianza informal. Ahora la **prueba real**, usando el invariante que dejé comentado en el código — este es el mismo esqueleto que usa CLRS 2.1:

**Invariante propuesto**: *Al iniciar cada iteración del `for` (para cada valor de j), el subarreglo A[0..j-1] contiene los mismos elementos que tenía originalmente en esas posiciones, pero ordenados ascendentemente.*

**1. Inicialización.** Antes de la primera iteración, `j = 1`, así que el subarreglo relevante es `A[0..0]` — un solo elemento. Un arreglo de un solo elemento está trivialmente ordenado. El invariante se cumple al inicio. ✓

**2. Mantenimiento.** Supón que el invariante se cumple al iniciar la iteración con cierto `j` (hipótesis inductiva: `A[0..j-1]` está ordenado). Debemos probar que se cumple al iniciar la iteración `j+1`, es decir, que `A[0..j]` queda ordenado después de esta iteración.

El cuerpo del loop toma `key = A[j]` y lo inserta en su posición correcta dentro de `A[0..j-1]` (que por hipótesis ya está ordenado), desplazando hacia la derecha todos los elementos mayores que `key`, uno por uno, mientras el `while` los encuentra. Cuando el `while` termina (porque `i < 0` o `A[i] <= key`), la posición `i+1` es exactamente donde `key` debe ir para preservar el orden. Como `A[0..j-1]` estaba ordenado y `key` se insertó en su posición correcta, `A[0..j]` queda ordenado. Además, ningún valor se pierde: solo se desplazan posiciones (los `A[i+1] = A[i]` son movimientos, no sobrescrituras que pierdan datos) y `key` se re-inserta al final. El invariante se mantiene. ✓

**3. Terminación.** El loop `for` termina cuando `j = len(A)`. Por el invariante (que acabamos de probar que se mantiene en cada iteración), al terminar, `A[0..len(A)-1]` — es decir, el arreglo completo — está ordenado y contiene los mismos elementos originales. Eso es exactamente la especificación de "ordenar". El algoritmo es correcto. ∎

Nota la estructura: **no probamos nada corriendo el código**. Probamos algo sobre la *estructura lógica* del algoritmo que se sostiene para cualquier arreglo de cualquier tamaño — incluyendo arreglos que nunca vamos a probar explícitamente. Esa es la diferencia cualitativa entre "testear" y "probar correctitud".

### 7.4 Trampa común: invariante mal elegido

No cualquier propiedad sirve como invariante útil. Si eliges un invariante demasiado débil (ej. "A[0] es un número"), la prueba de mantenimiento es trivial pero la terminación no te dice nada útil sobre correctitud. Si eliges uno demasiado fuerte o mal formulado, puede que ni siquiera sea cierto en la inicialización, o que el paso de mantenimiento sea imposible de probar. Elegir el invariante correcto — usualmente "la parte ya procesada tiene la propiedad que quiero que tenga el resultado final" — es la parte creativa y difícil de este tipo de prueba; no hay receta mecánica universal, aunque el patrón "lo que ya procesé cumple la propiedad final, lo que falta procesar no la rompe" cubre la gran mayoría de algoritmos iterativos.

---

## 8. Trampas y edge cases explícitos (resumen operativo)

- **Confundir Big-O con el comportamiento real (Θ)**: decir "es O(n²)" cuando en realidad el algoritmo es Θ(n) es técnicamente verdadero pero desinformativo. Si vas a comunicar el comportamiento *real* y ajustado, usa Θ; usa O solo cuando genuinamente solo tienes (o solo necesitas) una cota superior.
- **"Más rápido" sin especificar el modelo es una afirmación vacía**: decir "mi algoritmo es más rápido" sin decir *bajo qué medida* (¿wall-clock en qué máquina? ¿worst-case asintótico? ¿para qué rango de n?) no es una afirmación verificable. Siempre ancla la comparación a un modelo y, si aplica, a un rango de n.
- **O(n) puede perder contra O(n log n) para n pequeño**: el análisis asintótico describe el comportamiento cuando `n → ∞` (formalmente, para `n ≥ n₀`), no para todo n. Un algoritmo O(n log n) con constantes pequeñas (ej. mergesort bien implementado) puede vencer a un O(n) con constantes grandes (ej. counting sort con overhead de inicialización de arreglos auxiliares) cuando n es pequeño. La asíntota gana *eventualmente*, no siempre — y "eventualmente" puede requerir un n₀ más grande de lo que tu input real jamás alcanza. Este es el motivo práctico por el que algoritmos híbridos (ej. Timsort usa insertion sort para sublistas pequeñas dentro de un mergesort general) existen: explotan que la constante importa cuando n es chico.
- **Ignorar el espacio (memoria) al optimizar solo tiempo**: el análisis asintótico también aplica a espacio, S(n) — cuánta memoria adicional usa el algoritmo en función de n. Un algoritmo puede ganar en tiempo sacrificando espacio (memoization) o viceversa (recalcular en vez de guardar). No optimices tiempo en el vacío; siempre hay un trade-off tiempo-espacio implícito.
- **Confundir "no puedo probar que es incorrecto" con "es correcto"**: correr N casos de prueba sin encontrar un fallo no es una prueba de correctitud — es evidencia, con la fuerza que N te dé, pero nunca una garantía matemática. Para código en producción crítico, la prueba de invariante (o al menos el hábito mental de poder construirla) es lo que separa "funciona en mis pruebas" de "está probado correcto".

---

## Conexiones — cross-domain

*(Esta sección es expansión enriquecedora, no canon de la fuente citada. Sepárala mentalmente del cuerpo anterior.)*

**Con teoría de la complejidad computacional.** El análisis asintótico de un algoritmo específico es el ladrillo con el que se construye la teoría de la complejidad de *problemas*: cuando decimos que un problema está en la clase P, estamos diciendo que existe *algún* algoritmo con tiempo polinomial (O(n^k) para algún k constante) que lo resuelve. La clase NP y la pregunta P vs NP — posiblemente el problema abierto más famoso de ciencias de la computación — está construida enteramente sobre el vocabulario que acabas de aprender aquí. No puedes ni formular la pregunta sin Big-O.

**Con física de sistemas que escalan.** La idea de que "las constantes se desvanecen a escala" no es exclusiva de algoritmos — es la misma lógica detrás del análisis dimensional en física, donde para sistemas grandes el comportamiento cualitativo lo determina el término dominante en una expansión (piensa en cómo el arrastre aerodinámico crece con v² mientras que la fricción crece linealmente con v — a alta velocidad, el arrastre domina y ya no importa cuán preciso sea tu coeficiente de fricción). El análisis asintótico es, en esencia, la misma disciplina intelectual: identificar qué término sobrevive cuando la escala tiende a infinito, y descartar el resto sin culpa.

**Con la vara de un evaluador de MIT (o de una entrevista técnica seria).** Cuando alguien con este entrenamiento (6.006, CLRS) te evalúa, no está preguntando "¿tu código corrió rápido en mi laptop?". Está preguntando: (1) ¿puedes derivar T(n) para tu algoritmo desde primeros principios, contando operaciones, no adivinando? (2) ¿puedes clasificarlo correctamente en O/Θ/Ω sin confundirlas? y (3) ¿puedes *probar* que es correcto con un invariante, no solo mostrar que pasó tus tests? Estas tres preguntas son exactamente las tres secciones núcleo de este módulo. No es coincidencia — es la razón por la que este es el Módulo 1.

**Con ingeniería de software y AUCTORUM/Kee.** Cada vez que decides entre una estructura de datos (hash map O(1) amortizado vs. árbol balanceado O(log n) pero ordenado) estás haciendo, de forma implícita, el mismo análisis de trade-off tiempo-espacio-garantía de la sección 5. En un sistema como AUCTORUM Med, donde el peor caso puede ser disparado por un input adversarial o simplemente por mala suerte en producción con datos reales de pacientes, la disciplina de razonar en peor caso (no solo caso promedio "en mis pruebas locales") es la misma disciplina de ingeniería que separa un sistema que degrada con gracia bajo carga real de uno que colapsa la primera vez que un hospital grande le manda 500,000 registros de golpe.

---

## Síntesis — el mapa mental

El módulo completo colapsa en una sola cadena de razonamiento, que es lo que debe quedarte grabado:

1. El tiempo de pared mide máquina, no algoritmo → necesitas contar **operaciones**, no segundos.
2. Para contar operaciones necesitas un **modelo de cómputo** explícito (RAM model: operaciones básicas y accesos a memoria son O(1)).
3. La función exacta T(n) tiene constantes y términos de orden inferior que **no sobreviven** el cambio de máquina/lenguaje, y que se vuelven irrelevantes cuando n → ∞ → te quedas con el **crecimiento asintótico**.
4. Para expresar "crece como" con rigor necesitas tres relaciones distintas: **O** (cota superior), **Ω** (cota inferior), **Θ** (cota ajustada = ambas).
5. Un mismo algoritmo tiene T(n) distinto según el input específico → distingues **peor/mejor/promedio caso**, y por defecto en ingeniería confías en el **peor caso** porque es una garantía, no una expectativa.
6. Cuando analizas secuencias de operaciones donde algunas son caras pero raras, el peor-caso-por-operación es engañosamente pesimista → **análisis amortizado**.
7. Todo lo anterior mide *qué tan rápido*, pero eso es vacío si el algoritmo no hace lo correcto → necesitas **probar correctitud**, y la herramienta es el **invariante de lazo** (inicialización, mantenimiento, terminación — inducción matemática aplicada a la ejecución).

Velocidad sin correctitud es basura rápida. Correctitud sin análisis de velocidad es una promesa sin garantía de que sobreviva a escala. Necesitas ambas mitades, y ambas se prueban — no se asumen ni se testean empíricamente y ya.

---

## Preguntas que deberías poder responder

1. ¿Por qué el modelo RAM asume que sumar dos números de 64 bits es O(1), pero no asumiría lo mismo para multiplicar dos números de 10,000 dígitos? ¿Qué se rompe del modelo si no pones ese límite?
2. Dado `T(n) = 100n + 5n²`, encuentra explícitamente constantes `c` y `n₀` que prueben `T(n) = O(n²)`. Ahora prueba que `T(n) ≠ O(n)` (pista: ¿qué pasa si intentas encontrar c y n₀ para esa afirmación falsa?).
3. ¿Por qué `f(n) = O(n²)` es una afirmación *verdadera* incluso cuando f(n) crece en realidad como n (lineal)? ¿Qué notación necesitarías para excluir esa posibilidad?
4. Da un ejemplo (real o construido) donde el peor caso de un algoritmo importa más que su caso promedio para una decisión de ingeniería concreta, y otro donde el caso promedio es la métrica correcta a optimizar.
5. Para `insertion_sort`, ¿cuál es su peor caso T(n) y con qué tipo de input se dispara? ¿Cuál es su mejor caso y con qué input?
6. Escribe el invariante de lazo para un algoritmo de búsqueda lineal (`for i in range(len(A)): if A[i] == x: return i`) y prueba sus tres partes (inicialización, mantenimiento, terminación).
7. ¿Por qué "correr 1000 casos de prueba sin fallos" no es matemáticamente equivalente a "el algoritmo está probado correcto"? ¿Qué tipo de garantía sí te da un invariante de lazo que ningún número finito de pruebas te puede dar?
8. Un algoritmo O(n log n) con constantes grandes puede perder contra uno O(n²) con constantes pequeñas — ¿para qué rango de n es esto posible en principio? ¿Por qué el análisis asintótico no te dice nada falso al respecto, aunque parezca contradecirlo?

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms* — Lecture 1 (Algorithmic Thinking) y Lecture 2 (Asymptotic Complexity): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 2 (Getting Started: Insertion Sort) y Capítulo 3 (Growth of Functions: definiciones formales de O, Ω, Θ).
- MIT OpenCourseWare, portal general de 6.006 y materiales relacionados de algoritmos: https://ocw.mit.edu/
