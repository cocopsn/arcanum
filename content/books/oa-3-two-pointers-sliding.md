---
module_id: oa-3-two-pointers-sliding
spine: OA Amazon
title: "Two Pointers y Sliding Window"
subtitle: "Dos índices, una pasada"
source_canonical: "cp1-two-pointers; patrones Amazon-tagged de substring/subarreglo; técnica de conteo por número de distintos (tipo LeetCode 395)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 38
---

# Two Pointers y Sliding Window

> **Pregunta raíz.** Dos índices que avanzan coordinadamente, nunca hacia atrás, convierten un O(n²) de "prueba cada subarreglo posible" en un O(n) de "una sola pasada" — pero **solo si el problema tiene monotonía**: si expandir la ventana nunca hace que convenga retroceder el otro extremo. Este módulo ya lo construiste completo, con la prueba y las plantillas, en `cp1-two-pointers`. Lo que este libro agrega es específico del OA: cómo se disfraza este patrón en enunciados de Amazon, y — la parte que más tiempo de examen salva — cómo reconocer **cuándo el problema PARECE sliding window pero no lo es**, porque la condición no es monótona, y qué hacer en ese caso exacto.

## Prólogo

No voy a repetir la plantilla ni la prueba de por qué esto es O(n) — eso ya está completo en `cp1-two-pointers`, y deberías tenerlo como reflejo antes de seguir. Aquí nos enfocamos en tres cosas puntuales: las señales exactas de un enunciado Amazon que gritan este patrón, las trampas que cuestan tiempo real bajo reloj, y el caso especial que separa a quien realmente entiende el patrón de quien solo memorizó la plantilla — el sliding window que **no** es monótono.

---

## 1. Repaso de reflejo — lo que ya debe ser automático

Ventana variable: expande a la derecha siempre (`for`), contrae a la izquierda mientras se viola la condición (`while`, nunca `if`). Ventana fija: desplaza un elemento a la vez, resta el que sale, suma el que entra. Two pointers de extremos opuestos: sobre arreglo ordenado, avanza el puntero cuya suma actual está del lado equivocado del objetivo. Si alguna de estas tres frases no te resulta inmediatamente familiar, vuelve a `cp1-two-pointers` antes de seguir — este módulo asume que la plantilla ya es reflejo.

---

## 2. Señales de reconocimiento — cómo se disfraza en Amazon

- **"El subarreglo/substring contiguo más largo/corto que..."** — la señal más directa, casi siempre ventana variable.
- **"Ventana de tamaño K"** explícito → ventana fija.
- **Arreglo ordenado + "encuentra un par/tripleta cuya suma..."** → two pointers de extremos opuestos, frecuentemente combinado con un bucle externo para fijar el primer elemento de una tripleta (tres números que suman X: fija uno, aplica two pointers sobre el resto).
- **Historias de negocio de Amazon que disfrazan "subarreglo contiguo"**: "el periodo más largo de días consecutivos en que las ventas cumplieron [condición]", "el rango continuo de paquetes que puede procesar un solo camión sin exceder [límite]" — la palabra clave real detrás de la historia siempre es **contiguo/consecutivo**, y en cuanto la detectas, tu instinto debería saltar a sliding window antes de terminar de leer el resto del enunciado.

---

## 3. El caso que rompe la plantilla — sliding window NO monótono

### 3.1 El problema que expone la trampa

Considera: "encuentra el substring contiguo más largo donde **cada carácter que aparece, aparece al menos K veces**." A primera vista, esto suena idéntico a los problemas de ventana variable que ya conoces — pero inténtalo con la plantilla estándar y se rompe.

**Por qué se rompe, con precisión**: en la ventana variable clásica, la condición de validez es monótona respecto al tamaño de la ventana en un sentido específico — agregar un elemento nunca puede convertir una ventana inválida en válida sin haber sido válida antes en algún punto intermedio consistente. Aquí, **no** es así: agregar un carácter nuevo a la ventana puede, simultáneamente, hacer que un carácter que ya cumplía "al menos K apariciones" siga cumpliendo, mientras introduce un carácter nuevo que todavía no llega a K — la validez de la ventana completa no crece ni decrece de forma consistente conforme expandes o contraes. **No puedes decidir, con la lógica simple de "contrae mientras se viole la condición", cuándo contraer, porque la condición no es una desigualdad simple sobre un acumulador — depende de las frecuencias de múltiples caracteres distintos simultáneamente, cada una con su propio umbral.**

### 3.2 La técnica que sí funciona — fija el número de caracteres distintos

**La deducción**: en vez de intentar hacer sliding window directamente sobre "toda combinación posible de caracteres distintos", **fija explícitamente cuántos caracteres distintos vas a permitir en la ventana** (llamemos a ese número `d`, iterando `d` de 1 hasta el número total de caracteres distintos posibles — 26 para minúsculas del alfabeto inglés, un número pequeño y acotado). **Para cada valor fijo de `d`, la condición SÍ se vuelve monótona**: con el número de caracteres distintos permitido fijo, ahora sí puedes aplicar sliding window clásico, contrayendo cuando la ventana excede `d` caracteres distintos, y verificando, dentro de esa ventana, si todos los caracteres presentes cumplen la frecuencia mínima K.

```python
def substring_mas_largo_frecuencia_minima_k(s, k):
    """
    Longest substring donde cada caracter presente aparece >= k veces.
    Tecnica: fija el numero de caracteres DISTINTOS permitidos (d),
    de 1 al numero total de caracteres distintos en s, y corre
    sliding window clasico para cada d fijo -- la condicion SI es
    monotona una vez que d esta fijo.
    O(26 * n) = O(n) en la practica, porque el alfabeto es constante.
    """
    caracteres_distintos_totales = len(set(s))
    mejor = 0

    for d in range(1, caracteres_distintos_totales + 1):
        izq = 0
        conteo = {}
        distintos_en_ventana = 0
        distintos_que_cumplen_k = 0

        for der in range(len(s)):
            c = s[der]
            if conteo.get(c, 0) == 0:
                distintos_en_ventana += 1
            conteo[c] = conteo.get(c, 0) + 1
            if conteo[c] == k:
                distintos_que_cumplen_k += 1

            # Contrae mientras haya MAS caracteres distintos de los
            # que este 'd' permite -- AQUI la condicion SI es monotona,
            # porque d esta fijo.
            while distintos_en_ventana > d:
                c_izq = s[izq]
                if conteo[c_izq] == k:
                    distintos_que_cumplen_k -= 1
                conteo[c_izq] -= 1
                if conteo[c_izq] == 0:
                    distintos_en_ventana -= 1
                izq += 1

            # Ventana valida: exactamente 'd' distintos, y TODOS cumplen k
            if distintos_en_ventana == d and distintos_que_cumplen_k == d:
                mejor = max(mejor, der - izq + 1)

    return mejor


if __name__ == "__main__":
    print(substring_mas_largo_frecuencia_minima_k("aaabb", 3))   # 3 ("aaa")
```

**Por qué esto sigue siendo eficiente**: el número de caracteres distintos posibles es una constante pequeña (26 para el alfabeto inglés en minúsculas) — así que el costo total es `26 × O(n)` = O(n) en la práctica, no una explosión combinatoria. **Este es exactamente el tipo de truco — "fija una dimensión pequeña y acotada del problema, corre el patrón clásico dentro de esa dimensión fija"— que separa a quien reconoce la variante no monótona de quien se queda atascado intentando forzar la plantilla estándar donde no aplica.**

### 3.3 La lección general, más allá de este problema específico

Cuando un problema **parece** sliding window pero la condición de validez involucra múltiples umbrales independientes que no se reducen a una sola desigualdad simple sobre un acumulador, pregúntate: **¿existe alguna dimensión del problema que, si la fijo, hace que la condición vuelva a ser monótona?** Frecuentemente esa dimensión es pequeña y acotada (como el alfabeto aquí), lo que hace que fijarla y recorrer sliding window para cada valor fijo siga siendo eficiente en conjunto.

---

## Trampas OA

**Aplicar sliding window donde no hay monotonía**: ya cubierto en profundidad en la sección 3 — la trampa conceptual más cara de todo este módulo, porque no produce un error de sintaxis, produce una solución que "casi" funciona en los ejemplos pequeños del enunciado y falla silenciosamente en casos donde la falta de monotonía realmente importa.

**Off-by-one al contraer**: la misma trampa exacta de `cp1-two-pointers` — el tamaño de la ventana es `der - izq + 1`, no `der - izq`. Bajo la presión adicional del examen real, esta es la primera trampa en la que caes si tecleas rápido sin verificar.

**Olvidar actualizar el acumulador al mover el puntero**: si contraes `izq` sin actualizar correctamente tu conteo/suma antes de incrementar el índice, el estado queda corrupto silenciosamente — verifica siempre el orden exacto (actualiza el acumulador, después mueve el índice, consistentemente).

**Confundir "casi funciona en el ejemplo" con "es correcto"**: el problema de frecuencia mínima K de la sección 3 es exactamente el tipo de caso donde una plantilla mal aplicada puede dar la respuesta correcta en el ejemplo pequeño del enunciado (por casualidad de que ese ejemplo específico no expone la falta de monotonía) y fallar en el juez completo. **Antes de comprometerte con sliding window clásico, verifica explícitamente, con un contraejemplo mental de dos o tres caracteres, si la condición realmente es monótona respecto al tamaño de ventana.**

---

## Conexiones

**Con `cp1-two-pointers`**: este módulo es una extensión directa, no una técnica nueva — la plantilla, la prueba de O(n), y las trampas básicas ya están ahí completas. Lo único genuinamente nuevo aquí es el reconocimiento de la variante no monótona y su solución vía "fija una dimensión pequeña".

**Con `oa-1-arrays-hashmap`**: nota que la solución de la sección 3.2 combina sliding window **con** un diccionario de conteo (`conteo`) — la mayoría de los problemas reales de OA no son "un patrón puro", son combinaciones de dos o tres patrones que ya conoces por separado. Reconocer que necesitas *ambos* —ventana deslizante para el rango, hash map para las frecuencias dentro de esa ventana— es exactamente la habilidad de composición que separa un problema de dificultad media de uno que se siente imposible al primer vistazo.

**Con el siguiente módulo**: cuando la condición de la ventana no es sobre una suma o un conteo de frecuencias sino sobre una propiedad de orden o rango de valores (por ejemplo, "el rango de valores dentro de la ventana no debe exceder X"), el patrón evoluciona hacia el uso de una estructura de datos ordenada dentro de la ventana (un heap o un árbol balanceado) — territorio que toca binary search y estructuras más avanzadas, el siguiente módulo de este eje.

---

## Síntesis

1. La plantilla y la prueba de O(n) de two pointers/sliding window ya están completas en `cp1-two-pointers` — este módulo no las repite.
2. La señal de Amazon: "el periodo/rango/subarreglo contiguo más largo/corto que..." — sin importar la historia de negocio que lo disfrace, la palabra clave real es contiguo.
3. Cuando la condición de validez de la ventana depende de múltiples umbrales independientes (como frecuencia mínima K de cada carácter distinto), la monotonía se rompe — la solución es **fijar una dimensión pequeña y acotada del problema** (número de caracteres distintos) y correr sliding window clásico dentro de cada valor fijo.
4. La trampa más cara es conceptual: aplicar la plantilla estándar donde no hay monotonía, produciendo una solución que pasa el ejemplo pero falla en el juez completo.
5. Los problemas reales de OA combinan patrones — sliding window + hash map de conteo es una combinación extremadamente común, no una excepción.

---

## Lo que deberías poder hacer en 30 segundos

1. **Detectar la palabra "contiguo/consecutivo" detrás de cualquier historia de negocio** — sin importar cómo esté disfrazada.
2. **Verificar mentalmente la monotonía** con un contraejemplo de 2-3 elementos antes de comprometerte con la plantilla estándar.
3. **Reconocer cuándo necesitas fijar una dimensión pequeña del problema** (como el número de caracteres distintos) para restaurar la monotonía perdida.
4. **Identificar si el problema exige combinar sliding window con un hash map de conteo** — la combinación, no la técnica aislada, es lo más común en problemas reales.

---

## Fuentes

- `cp1-two-pointers` de esta misma colección — la plantilla, la prueba de O(n), y las trampas básicas completas.
- Técnica de "fijar el número de caracteres distintos" para restaurar monotonía en sliding window — patrón estándar de la industria para problemas de frecuencia mínima en substrings (tipo LeetCode 395, "Longest Substring with At Least K Repeating Characters").
