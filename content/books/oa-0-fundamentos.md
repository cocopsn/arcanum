---
module_id: oa-0-fundamentos
spine: OA Amazon
title: "Fundamentos — leer el problema antes de resolverlo"
subtitle: "Cómo las restricciones te dicen qué algoritmo usar"
source_canonical: "MIT 6.006; Cracking the Coding Interview; patrones generales de OAs de SDE intern reportados por candidatos"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Fundamentos — leer el problema antes de resolverlo

> **Pregunta raíz.** Tienes un cronómetro corriendo y un enunciado enfrente. Antes de escribir una sola línea de código, ¿cómo sabes qué tan rápido tiene que ser tu solución? La respuesta está escondida en un lugar que casi nadie mira con suficiente atención bajo presión: **las restricciones de tamaño del problema** — ese renglón que dice "1 ≤ n ≤ 10^5" que muchos candidatos leen de pasada y descartan. Ese número no es decoración. Es la pista más directa que el examinador te da sobre qué algoritmo espera que uses, y aprender a leerla en segundos es, literalmente, la habilidad que separa a quien resuelve el problema de quien se queda escribiendo una fuerza bruta que nunca va a pasar los casos grandes.

## Prólogo

Vamos a ser directos sobre dónde estás parado: tienes el Online Assessment de Amazon en días, apenas empiezas con estructuras de datos y algoritmos, y vas a dedicarle esta semana completa. Eso significa que este libro no tiene el lujo de construir teoría por el placer de la teoría — cada pieza que vas a leer aquí existe porque la vas a necesitar directamente, bajo reloj, en el examen real. No voy a asumir que ya sabes nada, pero tampoco voy a diluir el rigor — vas a entender **por qué** cada cosa funciona, porque entender el por qué es lo que te permite reconocer el patrón cuando el enunciado lo esconde detrás de una historia de negocio en vez de decírtelo directamente. Y eso, específicamente, es lo que hace un OA moderno: no te va a decir "usa two pointers" — te va a describir un problema de logística de inventario, y tú tienes que deducir que es two pointers.

Este es el módulo fundamento — el que sostiene a todos los que vienen después, uno por patrón. Sin esto, cada patrón nuevo que aprendas va a sentirse como una receta aislada. Con esto, vas a poder mirar un problema nuevo que nunca has visto y saber, en segundos, en qué familia de soluciones vive.

---

## 1. Qué significa que un algoritmo "escale" — deducido, no citado

### 1.1 El problema con medir en segundos

Si corres tu solución contra el ejemplo pequeño del enunciado y tarda 0.01 segundos, ¿qué aprendiste? Casi nada útil todavía. Ese tiempo depende de la velocidad de la máquina que está corriendo el juez automático, de cuántos otros procesos compiten por CPU en ese momento, del lenguaje que usaste — variables que no tienen nada que ver con la calidad real de tu algoritmo. Lo que de verdad importa no es cuánto tarda **en este caso pequeño específico**, sino **cómo crece ese tiempo cuando el tamaño del input crece** — porque el juez de Amazon no te va a probar solo con el ejemplo del enunciado, te va a probar con el caso más grande que las restricciones permiten, y ahí es exactamente donde una solución mal elegida truena.

### 1.2 Contar operaciones, no segundos

La forma correcta de razonar sobre esto: cuenta cuántas operaciones básicas (comparaciones, sumas, accesos a un arreglo) ejecuta tu algoritmo, **en función del tamaño del input n**, no en función de un reloj. Esa cuenta, expresada como una fórmula que crece con n, es lo que los algoritmos de este curso —y lo que cualquier OA— evalúan. Un algoritmo que hace `n` operaciones para un input de tamaño `n` escala de forma completamente distinta a uno que hace `n²` operaciones, y esa diferencia, para valores grandes de n, no es una diferencia pequeña — es la diferencia entre que tu código termine en un segundo o que nunca termine dentro del límite de tiempo del juez.

### 1.3 Por qué las constantes se desvanecen — la intuición que necesitas, rápido

Si tu algoritmo hace `3n + 7` operaciones y otro hace `n²` operaciones, ¿cuál es mejor? Para `n` pequeño (digamos, `n=5`), `3(5)+7=22` contra `25` — casi empatados. Pero para `n=100,000` (un tamaño típico de restricción en un OA real), el primero hace `300,007` operaciones; el segundo hace `10,000,000,000` — diez mil millones. **La diferencia no es de grado, es de categoría completa.** A esta escala, la constante "3" y el "+7" del primer algoritmo son completamente irrelevantes — lo que importa, exclusivamente, es la forma de crecimiento: lineal contra cuadrático. Por eso, en notación Big-O, descartamos constantes y términos de orden inferior: `3n+7` se escribe simplemente `O(n)`, y `n²` se escribe `O(n²)` — la notación captura exactamente la información que sí importa a la escala en la que un OA te va a probar, y descarta la que no.

### 1.4 Las clases de complejidad — con intuición física, no solo fórmulas

**O(1) — constante**: el trabajo no depende del tamaño del input. Acceder a un elemento de un arreglo por su índice, o consultar si una clave existe en un diccionario de Python (`in` sobre un `dict` o `set`) — ambos son O(1). Piensa en esto como "abrir un casillero cuando ya sabes el número exacto".

**O(log n) — logarítmica**: cada paso descarta una fracción del problema (típicamente la mitad). Búsqueda binaria sobre un arreglo ordenado es el ejemplo canónico. Con un millón de elementos, log₂(1,000,000) ≈ 20 — veinte pasos para resolver un problema de un millón de elementos. Brutalmente eficiente.

**O(n) — lineal**: tocas cada elemento del input una vez. Recorrer un arreglo completo, sumar todos sus elementos, buscar el máximo. Es el piso natural para cualquier problema que exige mirar todos los datos al menos una vez — no puedes hacerlo más rápido que esto si genuinamente necesitas ver cada elemento.

**O(n log n) — linearítmica**: la firma de "ordenar, y luego hacer algo lineal" o de "dividir el problema recursivamente y combinar". El ordenamiento eficiente (`sorted()` de Python, Timsort por debajo) es O(n log n). Esta es, en la práctica de un OA, la complejidad "buena" más común para problemas donde necesitas orden.

**O(n²) — cuadrática**: comparar cada elemento contra cada otro elemento — dos bucles anidados sobre el mismo rango. Con `n=100,000`, esto son diez mil millones de operaciones — en la práctica, esto **truena por tiempo (TLE)** en cualquier juez de OA moderno, que típicamente da 1-2 segundos por caso de prueba.

**O(2^n) — exponencial**: explorar todos los subconjuntos posibles de un conjunto de n elementos. Con `n=20`, ya son más de un millón de subconjuntos; con `n=30`, más de mil millones. Esto solo es viable cuando las restricciones del problema garantizan explícitamente un `n` muy pequeño.

**La regla práctica de examen, en una frase**: cuando veas un límite de tiempo de ejecución típico (1-2 segundos), asume que el juez espera que tu algoritmo haga, en el peor caso, del orden de **cien millones a mil millones de operaciones elementales**, no más. Esa cifra, combinada con `n` (dado en las restricciones), te dice de inmediato qué complejidad necesitas — y eso es exactamente la sección siguiente.

---

## 2. La habilidad clave del OA — leer las restricciones para inferir el algoritmo

### 2.1 Por qué esto es, literalmente, una pista que el examinador te está dando

Cuando un problema dice "1 ≤ n ≤ 10^5", esa cota no es un detalle incidental — es información **deliberadamente calculada** por quien diseñó el problema, para que una solución de cierta complejidad pase dentro del límite de tiempo, y una de complejidad peor no pase. El diseñador del problema sabe exactamente qué algoritmo espera que encuentres, y eligió el límite de `n` específicamente para permitir esa complejidad y **descartar** las más lentas. Leer esa cota correctamente es, ni más ni menos, leer la intención del examinador.

**Analogía**: es exactamente como un detective leyendo las pistas de una escena — el tamaño del input no te dice "aquí está la respuesta", pero te dice "descarta estas hipótesis de inmediato, y concéntrate en investigar estas otras". No pierdas tiempo de examen considerando un algoritmo O(n²) si `n` puede llegar a `10^6` — esa hipótesis ya está descartada antes de que escribas una línea.

### 2.2 La tabla de oro — memorízala hasta que sea reflejo

Esta es, sin exagerar, la tabla más valiosa de todo este libro. Apréndela de memoria esta semana, porque la vas a usar en los primeros treinta segundos de cada problema del examen.

| Tamaño de n | Complejidad que necesitas | Patrones candidatos típicos |
|---|---|---|
| n ≤ 10-12 | O(n!) o exponencial con poda fuerte | permutaciones completas, backtracking exhaustivo |
| n ≤ 20-22 | O(2^n) | subconjuntos, DP con bitmask |
| n ≤ 500 | O(n³) | DP con dos estados anidados, fuerza bruta de tripletas |
| n ≤ 2,000-5,000 | O(n²) | comparar cada par, DP con estado O(n²) |
| n ≤ 10^5 - 10^6 | O(n log n) o O(n) | ordenar + barrido, two pointers, sliding window, heap, binary search |
| n ≤ 10^7 - 10^8 | O(n) estricto, o O(n log n) con constante muy baja | un solo recorrido, prefix sums, hashing |
| n muy grande (10^9+) o la RESPUESTA es lo que crece | O(log n) sobre el espacio de respuestas | binary search on answer, matemática cerrada |

**Cómo usar esta tabla en el examen, paso a paso**: lee la restricción de `n`. Ubica en qué fila cae. Esa fila te dice la complejidad objetivo. Esa complejidad objetivo, combinada con qué pide el problema (¿busca un par? ¿un rango? ¿un subconjunto? ¿el óptimo de algo?), te apunta directamente hacia dos o tres patrones candidatos — no hacia los otros treinta que existen. Esto reduce el espacio de búsqueda de "¿qué algoritmo uso?" de minutos de duda a segundos de reconocimiento.

**Ejemplo concreto de cómo se ve esto en la práctica**: un problema dice "el arreglo tiene hasta 100,000 elementos, encuentra si existen dos elementos cuya suma sea igual a un objetivo". La restricción `10^5` te dice O(n log n) o mejor. La pregunta ("dos elementos", "suma objetivo") es la firma exacta de two pointers sobre arreglo ordenado, o de un hashset de complemento — ambos O(n log n) o O(n). Una fuerza bruta de comparar cada par (O(n²), cien millones de operaciones... espera, con n=10^5 serían diez mil millones) truena de inmediato. **Toda esta deducción debería tomarte menos de treinta segundos de lectura, no minutos de duda.**

---

## 3. Overflow y tipos — por qué importa, incluso en Python

### 3.1 El problema real, en otros lenguajes

En lenguajes como Java o C++, un entero estándar (`int`) típicamente ocupa 32 bits, con un rango de aproximadamente ±2.1 mil millones. Si un problema tiene valores individuales de hasta `10^9` (mil millones) y te pide sumar muchos de ellos, esa suma **puede exceder el rango de un entero de 32 bits** mucho antes de que cualquier valor individual lo haga — el resultado se desborda silenciosamente, dando un número incorrecto (frecuentemente negativo, por wraparound) sin ningún error visible en tiempo de ejecución. Amazon, en sus restricciones típicas, frecuentemente da valores hasta `10^9`, precisamente en un rango donde sumar varios de ellos revienta un entero de 32 bits — así que en Java o C++, tienes que usar explícitamente un tipo de 64 bits (`long` en Java, `long long` en C++) para cualquier acumulador de suma.

### 3.2 Por qué esto es gratis en Python — pero por qué necesitas entenderlo igual

Python 3 no tiene este problema — sus enteros son de **precisión arbitraria**, creciendo automáticamente para representar cualquier magnitud sin desbordarse nunca por límite de bits fijo. Esto significa que, si programas en Python (la recomendación de este libro, sección 4), **nunca vas a tener un bug de overflow silencioso** — tu suma va a dar el valor correcto sin importar qué tan grande crezca.

**Por qué de todas formas necesitas entender el concepto**: primero, porque razonar sobre "¿este valor podría desbordar un entero normal?" es parte de cómo lees restricciones correctamente incluso en Python — si ves que las sumas pueden llegar a `10^15` o más, eso te dice algo sobre la magnitud de las respuestas esperadas, información útil para verificar que tu lógica tiene sentido. Segundo, porque si en algún punto de tu carrera trabajas en C++ o Java (o si Amazon evalúa código en un lenguaje distinto en alguna ronda), este es exactamente el tipo de bug silencioso que revienta una solución que "debería" ser correcta — y quiero que lo tengas internalizado ahora, no que lo descubras la primera vez de la forma difícil.

---

## 4. Por qué Python 3 para el examen — el setup mental

### 4.1 Velocidad de escritura gana bajo reloj

Un OA no te evalúa por elegancia de código — te evalúa por **cuántos problemas resuelves correctamente dentro del tiempo asignado**. Eso cambia completamente qué lenguaje es óptimo: no el más rápido en ejecución, sino el que te permite **escribir la lógica correcta más rápido**, con menos ceremonia sintáctica entre tu idea y el código funcionando.

### 4.2 Las herramientas que Python te da gratis, y que vas a usar constantemente

```python
from collections import Counter, deque
import heapq

# Counter: conteo de frecuencias en una linea, sin loop manual
conteo = Counter([1, 2, 2, 3, 3, 3])   # {1: 1, 2: 2, 3: 3}

# dict/set: verificacion de membresia O(1), sin la ceremonia de
# declarar tipos genericos como en Java/C++
vistos = set()
vistos.add(5)
print(5 in vistos)   # O(1), una linea

# deque: cola de dos extremos O(1) en ambos lados -- CRITICO para BFS
cola = deque([1, 2, 3])
cola.append(4)       # O(1)
cola.popleft()        # O(1) -- una lista normal de Python aqui seria O(n)

# heapq: cola de prioridad, sin implementar un heap a mano
heap = []
heapq.heappush(heap, 5)
heapq.heappush(heap, 1)
print(heapq.heappop(heap))   # 1 -- el minimo, en O(log n)

# slicing: subarreglos sin loops manuales
arr = [1, 2, 3, 4, 5]
print(arr[1:3])   # [2, 3]
```

**Por qué esto importa concretamente en el examen**: en Java o C++, implementar una cola de prioridad, o verificar membresía en un conjunto, o contar frecuencias, exige varias líneas de boilerplate — declarar el tipo, importar la clase correcta, a veces escribir un comparador. En Python, cada una de estas operaciones es una línea. Bajo un cronómetro, esa diferencia se traduce directamente en más tiempo disponible para pensar en el algoritmo y menos tiempo perdido en sintaxis — exactamente el trade-off que un OA recompensa.

### 4.3 La trampa de la ceremonia — no la caigas

No te compliques agregando type hints elaborados, clases innecesarias, o abstracciones que no pide el problema. Bajo reloj, escribe la función más directa que resuelve el problema, con nombres de variable claros — la elegancia arquitectónica no vale nada en un OA si te cuesta minutos que no tenías.

---

## 5. Código real — sintiendo la diferencia entre O(n²) y O(n)

```python
import time
import random

def tiene_par_con_suma_lento(arr, objetivo):
    """O(n^2): compara cada par explicitamente."""
    n = len(arr)
    for i in range(n):
        for j in range(i + 1, n):
            if arr[i] + arr[j] == objetivo:
                return True
    return False


def tiene_par_con_suma_rapido(arr, objetivo):
    """O(n): usa un set para verificar el complemento en O(1)."""
    vistos = set()
    for x in arr:
        if (objetivo - x) in vistos:
            return True
        vistos.add(x)
    return False


if __name__ == "__main__":
    n = 10000
    arr = [random.randint(1, 1000000) for _ in range(n)]
    objetivo = -1   # forzamos el peor caso: nunca se encuentra, se recorre todo

    inicio = time.time()
    tiene_par_con_suma_lento(arr, objetivo)
    print(f"O(n^2) con n={n}: {time.time() - inicio:.3f}s")

    inicio = time.time()
    tiene_par_con_suma_rapido(arr, objetivo)
    print(f"O(n) con n={n}: {time.time() - inicio:.3f}s")
```

Corre esto mentalmente o en tu cabeza con la tabla de la sección 1.3: con `n=10,000`, la versión O(n²) hace del orden de 50 millones de comparaciones — notablemente más lenta, aunque todavía corra en un tiempo razonable en esta escala pequeña de prueba. Con `n=100,000` (un tamaño típico de restricción real de OA), la misma versión O(n²) haría del orden de 5 mil millones de operaciones — eso sí truena por tiempo en un juez real, mientras la versión O(n) sigue corriendo en una fracción de segundo. **Esta es exactamente la diferencia que la tabla de la sección 2.2 te permite anticipar sin tener que correr nada — solo leyendo la restricción de n.**

---

## 6. Edge cases y trampas del OA — los que más candidatos pierden

**Arreglo vacío**: ¿qué debería devolver tu función si el input es una lista vacía? Muchos problemas lo permiten como caso válido dentro de las restricciones (a veces el mínimo es 0, no 1) — verifica explícitamente qué dice el enunciado, y prueba tu solución mentalmente contra ese caso antes de enviar. Un bucle que asume al menos un elemento (por ejemplo, inicializando un máximo con `arr[0]` sin verificar que `arr` no esté vacío) revienta con un `IndexError` silencioso que puede costarte el caso completo.

**Un solo elemento**: el caso borde más común que un algoritmo pensado para "pares" o "ventanas" maneja mal si no lo consideras explícitamente — ¿tu solución de two pointers funciona si el arreglo tiene tamaño 1? ¿Tu sliding window? Verifica.

**El caso imposible que devuelve -1 (o un valor centinela)**: muchos problemas de Amazon piden "el mínimo/máximo tal que..., o -1 si no es posible" — y es sorprendentemente común que un candidato resuelva correctamente el caso donde sí existe solución, pero olvide manejar explícitamente el camino donde no existe ninguna, dejando que el código devuelva algo incorrecto (como `0` o `None` sin que el problema lo pida) en vez del centinela exacto que el enunciado especifica. Lee el enunciado buscando explícitamente esta frase — "si no es posible", "en caso contrario" — y verifica que tu código tenga una rama explícita para ese caso.

**Formato de salida estricto**: un juez automático compara tu salida **carácter por carácter** contra la esperada. Un espacio de más, un salto de línea faltante, números en el orden incorrecto cuando el problema pedía un orden específico, o un cero final omitido cuando se esperaba (por ejemplo, `"3.500"` en vez de `"3.5"` si el formato exige tres decimales) — cualquiera de estos hace que un caso de prueba correcto **en lógica** falle por formato. Lee la sección de "output format" del enunciado con la misma atención que la lógica del problema — es, literalmente, tan importante para pasar el caso.

**Overflow (recordado de la sección 3)**: si programas en Python no es tu problema técnico, pero sigue siendo una señal a la que prestar atención — valores de magnitud sorprendentemente grande en las restricciones son una pista de que la respuesta esperada también puede ser grande, y vale la pena verificar que tu lógica no esté implícitamente asumiendo un rango más pequeño.

**Por qué estos edge cases son los que más candidatos pierden, y no los algoritmos en sí**: en la mayoría de los OAs modernos de Amazon, el patrón algorítmico central de cada problema no es exageradamente difícil de identificar una vez que dominas los ~10 patrones que este curso cubre — lo que separa a quien pasa de quien no, con más frecuencia de la que uno esperaría, es exactamente esta disciplina de verificar edge cases y formato antes de enviar, no la sofisticación del algoritmo central.

---

## 7. Trade-offs — la solución que corre vale más que la elegante que no corre

En cualquier otro contexto de ingeniería, preferirías una solución más simple y elegante sobre una más compleja, siempre que ambas resuelvan el problema. **En un OA cronometrado, esa jerarquía se invierte parcialmente**: una solución O(n²) fea, directa, y que definitivamente pasa los casos pequeños (aunque truene en los grandes) vale más, en términos de puntaje parcial, que quedarte a medio terminar una solución O(n log n) elegante que nunca compilas a tiempo. **La estrategia correcta bajo reloj**: si reconoces rápido el patrón óptimo, ve directo a él. Si después de un par de minutos no lo ves, **escribe la fuerza bruta que sabes que es correcta**, asegúrate de que pase, y solo entonces, si te queda tiempo, optimízala. Una solución correcta y lenta que se somete es infinitamente mejor que una rápida y elegante que nunca terminaste de escribir.

---

## Conexiones

**Por qué "leer restricciones" es la habilidad que separa a quien pasa de quien no**: cada patrón que vas a estudiar en los módulos siguientes de este eje —two pointers, sliding window, binary search, BFS/DFS, DP— tiene una **firma de restricciones característica** que, combinada con el vocabulario del enunciado (qué pide el problema: un par, un rango, un óptimo, un conteo), te dice casi de inmediato cuál patrón aplica. La habilidad de este módulo no es un tema aparte de los patrones que siguen — es el filtro que aplicas **antes** de decidir cuál patrón usar, y sin él, cada problema nuevo se siente como empezar de cero en vez de como reconocer una familia ya conocida.

**El puente a cada patrón que viene después**: cuando llegues al módulo de two pointers, vas a reconocer que su firma típica es `n` hasta `10^5`-`10^6` combinado con "arreglo/subarreglo contiguo" o "par en arreglo ordenado". Cuando llegues a DP, vas a reconocer que su firma típica es `n` pequeño-mediano (`≤ 2000-5000` para O(n²), `≤ 20` para bitmask) combinado con "de cuántas formas" o "máximo/mínimo eligiendo un subconjunto". Cada módulo que sigue te va a dar la firma específica de su patrón — pero la disciplina de **leer la restricción primero, antes de leer el resto del problema con atención completa**, es la que este módulo te dio, y la vas a aplicar en cada problema del examen real, sin excepción.

---

## Síntesis

1. Big-O mide **cómo crece** el trabajo de un algoritmo conforme crece el input, no cuánto tarda en un caso específico — las constantes se desvanecen porque, a la escala de un OA real, son irrelevantes frente a la forma de crecimiento.
2. La restricción de tamaño (`n ≤ ...`) es una pista deliberada del examinador — memoriza la tabla de la sección 2.2 hasta que leer una restricción te dé, en segundos, la complejidad objetivo y dos o tres patrones candidatos.
3. Un juez de OA típico tolera del orden de cien millones a mil millones de operaciones elementales por segundo de límite de tiempo — usa esa cifra, combinada con `n`, para verificar mentalmente si tu algoritmo propuesto va a pasar antes de escribirlo completo.
4. El overflow es gratis de evitar en Python (enteros de precisión arbitraria), pero entender el concepto sigue importando para leer restricciones correctamente y para cualquier trabajo futuro en lenguajes con enteros de tamaño fijo.
5. Python 3, con `Counter`, `set`/`dict`, `deque`, `heapq`, y slicing, minimiza la ceremonia entre tu idea y el código funcionando — la ventaja correcta a optimizar bajo reloj.
6. Los edge cases (arreglo vacío, un elemento, el caso imposible, formato de salida estricto) pierden más candidatos que la dificultad algorítmica central — verifícalos siempre antes de enviar.
7. Bajo reloj, una solución correcta y lenta que se somete vale más que una elegante e incompleta — prioriza tener algo que pase, luego optimiza si te queda tiempo.

---

## Lo que deberías poder hacer en 30 segundos

Dado un enunciado nuevo con sus restricciones, deberías poder, en menos de medio minuto:

1. **Localizar la restricción de `n`** (o del parámetro relevante de tamaño) sin leer el resto del problema todavía.
2. **Ubicarla en la tabla de la sección 2.2** y decir en voz alta (o mentalmente) qué complejidad objetivo necesitas: O(n²), O(n log n), O(n), O(2^n), etc.
3. **Identificar, del vocabulario del problema** (¿pide un par? ¿un rango contiguo? ¿el óptimo de un subconjunto? ¿conectividad?), qué familia de dos o tres patrones son candidatos — sin todavía comprometerte a uno.
4. **Descartar explícitamente** cualquier enfoque de fuerza bruta cuya complejidad ya sabes, por la tabla, que va a truenar con el `n` dado — para no perder tiempo de examen considerándolo.
5. **Anticipar mentalmente** al menos un edge case (vacío, un elemento, caso imposible) antes de empezar a escribir código, no después de que el código ya "funcione" en el caso feliz.

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms* — fundamentos de análisis asintótico y notación Big-O: https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Gayle Laakmann McDowell, *Cracking the Coding Interview* — la referencia estándar de la industria para preparación de entrevistas técnicas de ingeniería de software, incluyendo la heurística de tamaño de input vs. complejidad esperada.
- Documentación oficial de Python, módulo `collections` (`Counter`, `deque`) y `heapq`: https://docs.python.org/3/library/collections.html y https://docs.python.org/3/library/heapq.html
- Nota de honestidad: los patrones y firmas de restricciones de este módulo reflejan heurísticas generales, ampliamente documentadas y estables, de preparación para entrevistas técnicas de nivel SDE intern en la industria — no una filtración verificada de preguntas específicas del OA de Amazon 2026. Verifica siempre contra la práctica activa en plataformas de OA reales (LeetCode, HackerRank, o la plataforma específica que Amazon use) en los días que te quedan.
