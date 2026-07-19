---
module_id: cp1-two-pointers
spine: Competitiva
title: "Two pointers y sliding window"
subtitle: "Cuando dos índices matan un O(n²)"
source_canonical: "USACO Guide (Silver); CP-Handbook; CSES/Codeforces"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 25
---

# Two pointers y sliding window

> **Pregunta raíz.** Un enfoque de fuerza bruta prueba todos los subarreglos o todos los pares — O(n²). Two pointers lo baja a O(n) recorriendo el arreglo con dos índices que se mueven **coordinadamente, siempre hacia adelante, nunca hacia atrás**. Eso solo funciona si el problema tiene una propiedad específica: **monotonía** — si una ventana/par en la posición actual no sirve, ningún ajuste que "retroceda" el puntero que ya avanzaste puede arreglarlo; solo avanzar sirve. Sin monotonía, la técnica no aplica, punto. Todo este libro es entrenar tu ojo para detectar esa monotonía en segundos, y tu mano para teclear la plantilla sin pensar.

## Prólogo

En contest no tienes tiempo de rederivar por qué two pointers funciona cada vez que lo ves. Tienes que **reconocerlo por el olor del enunciado**, escribir la plantilla de memoria, y gastar tu cerebro en la parte específica del problema que sí es nueva. Este libro no es teoría — es entrenamiento de reflejo. La teoría profunda (la prueba de correctitud rigurosa) la tienes en tus mini-libros de MIT 6.006/CLRS si necesitas rederivarla. Aquí: señales, plantilla, trampas, y a resolver problemas.

---

## Señales de reconocimiento — la sección que importa más

Lee estas frases como las verías en un enunciado real. Si ves algo de esta lista, tu primer instinto debe ser "two pointers / sliding window", no "voy a pensar desde cero".

**Gritan sliding window (ventana variable):**
- "el subarreglo/substring **contiguo** más largo/corto que cumple [condición]"
- "la ventana más larga sin repetir [algo]"
- "el menor rango de días/elementos tal que la suma/conteo sea al menos/como máximo K"
- "número de subarreglos cuya suma es exactamente/a lo más K" (con **todos los elementos no negativos** — sin eso, no hay monotonía, ver Trampas)
- cualquier variante de "encuentra el segmento contiguo que minimiza/maximiza [algo] sujeto a una restricción acumulativa"

**Gritan two pointers en arreglo ordenado:**
- "el arreglo está ordenado" (o "puedes ordenarlo primero sin romper la respuesta") + "encuentra un par cuya suma sea X"
- "encuentra si existen dos elementos tales que..."
- "el número de pares (i,j) tales que a[i] + a[j] ≤ X" (conteo sobre pares en arreglo ordenado)
- fusionar/comparar dos secuencias ordenadas elemento por elemento ("merge", "intersección de dos arreglos ordenados")

**Gritan two pointers de un mismo arreglo, direcciones opuestas:**
- "¿es palíndromo?" / comparar desde los extremos hacia el centro
- "contenedor con más agua" (maximizar área entre dos barreras, achicando desde el extremo más corto)

**Señal de alerta que NO es two pointers a pesar de parecerlo:**
- "subarreglo con suma exacta K" cuando el arreglo **tiene negativos** → eso es prefix sums + hashmap, no two pointers (ver Trampas y Conexiones).
- "todos los pares/tripletas posibles sin restricción de orden ni rango contiguo" → probablemente no hay monotonía explotable, revisa antes de comprometerte.

**El reflejo a entrenar**: en cuanto veas "contiguo" + "más largo/corto que cumple X" → sliding window variable. En cuanto veas "ordenado" + "par que suma X" → two pointers de extremos opuestos. Esto debe tomarte **segundos**, no minutos.

---

## 1. Por qué funciona — la monotonía, en una frase

Si al mover el puntero derecho la ventana deja de cumplir la condición, **nunca conviene mover el derecho hacia atrás para arreglarlo** — la única forma de recuperar la condición es mover el **izquierdo** hacia adelante (achicando la ventana). Esto es monotonía: la respuesta óptima para la posición derecha `r` no requiere reconsiderar posiciones de `l` menores a la última usada para `r-1`. Sin esa garantía, no puedes descartar posiciones pasadas del puntero izquierdo sin perder la respuesta correcta — y ahí la técnica se cae.

---

## 2. Plantilla — sliding window de tamaño VARIABLE (la forma canónica)

**Patrón**: expande derecha siempre; mientras la ventana viola la condición, contrae izquierda.

```python
def ventana_mas_larga_suma_maxima_K(a, K):
    izq = 0
    suma = 0
    mejor = 0
    for der in range(len(a)):
        suma += a[der]                    # expandir SIEMPRE primero
        while suma > K:                   # contraer mientras se viola
            suma -= a[izq]
            izq += 1
        mejor = max(mejor, der - izq + 1)  # ventana actual es valida aqui
    return mejor
```

```cpp
int ventanaMasLargaSumaMaximaK(vector<long long>& a, long long K) {
    int izq = 0, mejor = 0;
    long long suma = 0;
    for (int der = 0; der < (int)a.size(); der++) {
        suma += a[der];
        while (suma > K) {
            suma -= a[izq];
            izq++;
        }
        mejor = max(mejor, der - izq + 1);
    }
    return mejor;
}
```

**El orden importa**: expandir (`for der`) es el bucle externo, siempre incondicional. Contraer (`while`) es interno y condicional. Si inviertes esto o contraes con `if` en vez de `while`, te comes casos donde hace falta contraer más de una posición — trampa clásica cubierta abajo.

---

## 3. Plantilla — two pointers en arreglo ORDENADO, extremos opuestos

**Patrón**: un puntero al inicio, otro al final; muévanse el uno hacia el otro según si la suma actual es mayor o menor al objetivo.

```python
def existe_par_con_suma(a, objetivo):
    a.sort()
    izq, der = 0, len(a) - 1
    while izq < der:
        s = a[izq] + a[der]
        if s == objetivo:
            return True
        elif s < objetivo:
            izq += 1
        else:
            der -= 1
    return False
```

```cpp
bool existeParConSuma(vector<long long> a, long long objetivo) {
    sort(a.begin(), a.end());
    int izq = 0, der = (int)a.size() - 1;
    while (izq < der) {
        long long s = a[izq] + a[der];
        if (s == objetivo) return true;
        else if (s < objetivo) izq++;
        else der--;
    }
    return false;
}
```

**Por qué es seguro descartar**: si `a[izq] + a[der] < objetivo`, ningún `der` más pequeño va a ayudar (la suma solo bajaría más) — así que avanzar `izq` es la única jugada que puede acercarte al objetivo. Simétrico para el otro caso. Esa es, otra vez, monotonía — aquí sobre el arreglo ordenado, no sobre una ventana.

---

## 4. Ventana fija vs. variable

**Fija** (tamaño K constante, el caso más simple — "máxima suma de cualquier subarreglo de exactamente K elementos"): mantén una suma corriente, resta el elemento que sale al desplazar, suma el que entra. No hay `while` de contracción — es un solo desplazamiento por paso.

```python
def max_suma_ventana_fija(a, K):
    suma = sum(a[:K])
    mejor = suma
    for i in range(K, len(a)):
        suma += a[i] - a[i - K]
        mejor = max(mejor, suma)
    return mejor
```

**Variable** (la de las secciones 2 y 6.1): el tamaño de la ventana cambia dinámicamente según la condición — requiere el patrón expandir/contraer completo.

**Señal para distinguirlas**: si el enunciado dice "de tamaño K" explícito → fija. Si dice "el más largo/corto que cumple..." sin tamaño fijo → variable.

---

## 5. Dos punteros en el MISMO arreglo vs. en DOS arreglos

Todo lo de arriba fue un arreglo. La otra familia común: **fusionar/comparar dos arreglos ordenados** con un puntero en cada uno — el merge de mergesort es el ejemplo canónico, y "intersección de dos arreglos ordenados" o "¿es el arreglo A un subconjunto ordenado del B?" son variantes directas.

```python
def interseccion_ordenados(a, b):
    i, j = 0, 0
    resultado = []
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            resultado.append(a[i])
            i += 1
            j += 1
        elif a[i] < b[j]:
            i += 1
        else:
            j += 1
    return resultado
```

**Señal de reconocimiento**: "dos arreglos, ambos ordenados" + cualquier verbo de comparación/fusión/conteo cruzado → este patrón, no el de la sección 3.

---

## 6. Por qué es O(n) — el argumento amortizado, en tres líneas

Cada uno de los dos punteros **solo avanza, nunca retrocede**, y cada uno tiene un rango de `0` a `n`. El puntero derecho avanza a lo más `n` veces (el `for`). El puntero izquierdo, sumado a lo largo de **todas** las iteraciones del `while` en todo el algoritmo completo, también avanza a lo más `n` veces en total — no `n` veces por cada posición de `der`, sino `n` veces en total, porque nunca retrocede. Esto es exactamente el mismo argumento de análisis amortizado que ya conoces de arrays dinámicos (CLRS/6.006): el trabajo total del `while` a lo largo de toda la ejecución está acotado por `n`, aunque una sola iteración del `for` externo pueda, en el peor caso puntual, disparar varias iteraciones del `while`. Costo total: O(n) + O(n) = O(n).

---

## Trampas de contest — donde se pierde tiempo real

**Off-by-one al contraer**: el tamaño de la ventana es `der - izq + 1`, no `der - izq`. Confundir esto produce un resultado sistemáticamente corrido por 1 — y en contest, ese bug tarda más en encontrarse de lo que tarda en escribirse, porque "casi" pasa los tests pequeños.

**Olvidar actualizar el acumulador al mover el puntero**: si contraes `izq` sin restar `a[izq]` de la suma **antes** de incrementar `izq` (o lo haces en el orden invertido), la suma queda corrupta silenciosamente — no truena, solo da mal en algún test que no sea trivial. Verifica siempre: resta/actualiza primero, incrementa el índice después (o viceversa, pero sé consistente y verifícalo con un caso a mano antes de enviar).

**Usar `if` en vez de `while` para contraer**: si la condición puede violarse por más de una unidad de una sola vez que expandes (por ejemplo, un elemento negativo/cero que hace que quepan varios elementos de golpe, o simplemente que necesites contraer varias posiciones seguidas), un solo `if` contrae solo una posición y deja la ventana todavía inválida. Siempre `while`, nunca `if`, para la contracción — sin excepción.

**Aplicar la técnica donde NO hay monotonía**: el error más caro, porque no es un bug de sintaxis, es un error de diseño que te hace perder el problema completo. Ejemplo canónico: "subarreglo con suma exacta K" con elementos **negativos permitidos**. Aquí, expandir la ventana no garantiza que la suma solo crezca — puede subir y bajar de forma no monótona, así que "contraer izquierda cuando la suma es muy grande" ya no tiene ninguna garantía de que sea la jugada correcta. La señal para detectar esto de antemano: **¿la operación acumulada (suma, conteo) es monótona al agregar un elemento?** Con solo no-negativos, sí. Con negativos permitidos, no — y ahí el problema se resuelve con prefix sums + hashmap (ver Conexiones), no con two pointers.

**Overflow en C++**: si sumas muchos elementos y el rango de valores es grande, `int` (típicamente 32 bits, ~2.1×10⁹ de rango) se desborda silenciosamente sin ningún error en tiempo de ejecución — el resultado da un número simplemente incorrecto, frecuentemente negativo por wraparound. Usa `long long` para cualquier acumulador de suma en C++ si el problema no garantiza explícitamente que la suma cabe en `int` — este es, sistemáticamente, uno de los bugs más comunes y más caros en tiempo de contest, porque el código compila, corre, y da mal solo en los casos de prueba grandes que revelan el overflow.

---

## Trade-offs — cuándo two pointers vs. la alternativa

**Two pointers vs. prefix sums**: si necesitas la suma de **muchos rangos arbitrarios no contiguos en el tiempo de consulta** (no un solo barrido con ventana móvil), prefix sums con O(1) por consulta tras O(n) de preprocesamiento es la herramienta correcta, no two pointers. Two pointers gana cuando el problema es, genuinamente, un solo barrido con una ventana que se mueve monótonamente — no consultas aleatorias repetidas.

**Two pointers vs. binary search sobre la respuesta**: si la condición no es sobre una ventana contigua sino sobre "encuentra el valor mínimo/máximo de X tal que [predicado monótono en X]" (no en la posición del arreglo, sino en el **valor de la respuesta misma**), eso es binary search sobre la respuesta, un patrón distinto aunque comparta la palabra "monotonía" — la monotonía ahí es sobre el espacio de posibles respuestas, no sobre el recorrido del arreglo.

---

## Conexiones

**Con prefix sums**: "subarreglo con suma exacta K" con negativos permitidos rompe two pointers (Trampas) precisamente porque rompe la monotonía — pero se resuelve con prefix sums: acumula la suma prefijo hasta cada posición, guarda en un hashmap cuántas veces se ha visto cada valor de prefijo, y para cada posición pregunta si `prefijo_actual - K` ya se vio antes. Reconoce la frontera exacta entre ambas técnicas: **misma familia de pregunta ("subarreglo con propiedad de suma"), técnica completamente distinta según si hay negativos**.

**Con binary search**: comparten el mismo principio de fondo (descartar la mitad del espacio de búsqueda que sabes que no puede contener la respuesta), pero binary search opera sobre un espacio de valores mediante log n pasos de división, mientras two pointers opera sobre un recorrido lineal con avance monótono — no confundas "ambos son O(log n) o O(n) por monotonía" con "son la misma técnica".

**Con problemas de strings**: "el substring más largo sin caracteres repetidos", "la ventana más pequeña que contiene todos los caracteres de un patrón" — son, literalmente, sliding window de la sección 2, con la condición de validez de ventana expresada sobre un conjunto/contador de caracteres en vez de una suma numérica. El reflejo de reconocimiento es idéntico: "substring/subarreglo contiguo" + "más largo/corto que cumple X" → sliding window, sin importar si el contenido es números o caracteres.

---

## Síntesis

1. Two pointers/sliding window baja O(n²) a O(n) **solo si hay monotonía** — al expandir, nunca conviene retroceder el otro puntero para arreglar una violación.
2. Reconoce por el enunciado: "contiguo" + "más largo/corto que cumple X" → ventana variable. "Ordenado" + "par que suma X" → extremos opuestos. "Dos arreglos ordenados" → merge de dos punteros.
3. La plantilla de ventana variable es: expandir siempre (for), contraer con `while` (nunca `if`) mientras se viole la condición.
4. El costo es O(n) porque cada puntero avanza, en total a lo largo de toda la ejecución, a lo más n veces — el mismo argumento amortizado de arrays dinámicos.
5. Las trampas que cuestan tiempo real: off-by-one en el tamaño de ventana, acumulador no actualizado en el orden correcto, `if` en vez de `while`, aplicar la técnica sin monotonía real (negativos rompen todo), y overflow de `int` en C++.
6. Sin negativos → two pointers. Con negativos → prefix sums + hashmap. No es la misma técnica aunque el enunciado se vea parecido.

---

## Problemas para resolver

*(De fácil a difícil. Una línea de por qué cada uno entrena el patrón — no busques la solución antes de intentarlo tú mismo con reloj.)*

1. **CSES — Sum of Two Values** (Sorting and Searching): el caso de libro de texto de two pointers en arreglo ordenado buscando un par con suma exacta — la plantilla de la sección 3, tal cual.
2. **CSES — Ferris Wheel** (Sorting and Searching): greedy con dos punteros de extremos opuestos emparejando elementos bajo una restricción de capacidad — entrena reconocer la variante de "empareja extremos" más allá de solo "suma exacta".
3. **CSES — Playlist** (Sorting and Searching): substring/subarreglo contiguo más largo sin elementos repetidos — sliding window variable puro, con un set/contador como condición de validez en vez de una suma numérica; la conexión directa con "problemas de strings" de este libro.
4. **CSES — Subarray Sums I** (Sorting and Searching, arreglo de no-negativos): ventana variable contando subarreglos con suma objetivo — practica la variante de conteo, no solo de máximo/mínimo.
5. **CSES — Subarray Sums II** (Sorting and Searching, arreglo con posibles valores repetidos/negativos según la versión): resuélvelo primero intentando two pointers, nota exactamente dónde se rompe, y comprueba en carne propia por qué esta versión exige prefix sums + hashmap — el ejercicio más valioso de todo este libro es sentir la frontera entre ambas técnicas, no solo leerla.
6. Un problema tageado **two pointers** de rating aproximado 1200-1400 en el problemset de Codeforces (busca por tag `two pointers` filtrando por ese rango): en esta etapa de tu entrenamiento, resuelve dos o tres de estos filtrando por el tag directamente en vez de que te dé nombres específicos que no puedo verificar con certeza — la práctica de **filtrar por tag y rating tú mismo** es, en sí misma, una habilidad de entrenamiento de ICPC que vale la pena ejercitar desde ahora.
7. El problema clásico de "contenedor con más agua" (maximizar el área entre dos barras moviendo el puntero del lado más corto) — búscalo por nombre en LeetCode o en el tag de Codeforces si prefieres esa plataforma; entrena el patrón de extremos opuestos con una condición de optimización geométrica, no solo aritmética de suma.

---

## Fuentes

- USACO Guide, sección Silver — Two Pointers: https://usaco.guide/silver/two-pointers
- Antti Laaksonen, *Competitive Programmer's Handbook*, capítulo de técnicas de arreglos (sliding window / two pointers): https://cses.fi/book/book.pdf
- CSES Problem Set, sección Sorting and Searching: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `two pointers`: https://codeforces.com/problemset?tags=two+pointers
