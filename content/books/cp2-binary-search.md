---
module_id: cp2-binary-search
spine: Competitiva
title: "Binary search"
subtitle: "Buscar la respuesta, no el dato"
source_canonical: "USACO Guide (Silver — Binary Search); CP-Handbook; Codeforces tag binary search"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 25
---

# Binary search

> **Pregunta raíz.** Buscar un valor en un arreglo ordenado de n elementos cuesta O(log n) porque cada comparación descarta la mitad del espacio restante. Eso ya lo sabes. El salto que este libro entrena es distinto: **buscar la RESPUESTA, no un dato ya presente en un arreglo**. Si puedes escribir una función `feasible(X)` que responde "¿es posible lograr el objetivo con el valor X?", y esa función es **monótona** (una vez que es `True` para algún X, sigue siendo `True` para todo X mayor — o el análogo para `False`), entonces puedes binarizar sobre el espacio de **todas las respuestas posibles**, no sobre el arreglo. Ese salto —de "busco un dato" a "busco un umbral en un predicado"— es la mitad de los problemas de binary search que vas a ver en contest, y es exactamente lo que este libro entrena a reconocer en segundos.

## Prólogo

En contest, binary search rara vez aparece como "arreglo ordenado, encuentra 7". Aparece como "n y los límites son tan grandes que cualquier solución lineal sobre el espacio de respuestas truena por tiempo, pero puedo verificar una respuesta candidata rápido". Ese patrón —verificar es barato, encontrar el óptimo por fuerza bruta es caro, y la verificación es monótona— es la señal que tienes que oler antes de leer la segunda mitad del enunciado.

---

## Señales de reconocimiento

**Gritan binary search on answer:**
- "el valor mínimo/máximo de X tal que [algo] sea posible/suficiente"
- "¿es posible lograr [objetivo] con capacidad/tiempo/velocidad X?" seguido de "encuentra el X óptimo"
- límites del problema **enormes** (n ≤ 10⁹, o la respuesta puede ser un valor real hasta 10¹⁴) que descartan cualquier barrido lineal sobre el espacio de respuestas
- "minimiza el máximo" o "maximiza el mínimo" (min-max / max-min) — patrón casi universal de binary search on answer
- verbos de partición/asignación con un recurso limitado: repartir, cortar, empacar, agrupar, bajo una restricción de capacidad/tiempo

**Gritan binary search clásico (buscar en arreglo/rango ordenado):**
- "el arreglo está ordenado" + "encuentra la posición de/el primer elemento ≥ X"
- "cuenta cuántos elementos son ≤ X" en un arreglo ordenado (equivalente a encontrar un límite)
- cualquier variante de "primera/última posición donde se cumple una condición" sobre datos ya ordenados

**Señal de alerta — NO apliques binary search si:**
- el predicado `feasible(X)` **no es monótono** (puede ser `True`, luego `False`, luego `True` otra vez conforme X crece) — sin monotonía, descartar la mitad del espacio es simplemente incorrecto, no una optimización.
- verificar `feasible(X)` es, en sí mismo, tan caro que multiplicado por log(rango) sigue siendo demasiado lento — revisa la complejidad total, no solo la de la búsqueda.

**El reflejo**: "mínimo/máximo X tal que..." + límites que gritan "no puedo iterar sobre todas las respuestas" → primero pregúntate **¿es feasible(X) monótono?** Si sí, binary search on answer. Si no estás seguro, prueba mentalmente con 2-3 valores pequeños de X antes de comprometerte con la técnica completa.

---

## 1. Por qué log(n) — el argumento en una frase

Cada comparación descarta, de forma segura, la mitad del espacio de búsqueda restante — porque la monotonía garantiza que esa mitad descartada no puede contener la respuesta. Repetir esto reduce el espacio de tamaño n a 1 en ⌈log₂n⌉ pasos. Sobre un espacio de respuestas de tamaño R (no necesariamente el tamaño del arreglo, sino el rango de valores posibles de la respuesta), el costo es O(log R × costo de feasible(X)).

---

## 2. Plantilla — binary search clásico (buscar límite en arreglo ordenado)

**Patrón**: encontrar la primera posición donde una condición monótona se vuelve verdadera (lower_bound genérico).

```python
def primera_posicion_verdadera(a, condicion):
    lo, hi = 0, len(a)   # hi es EXCLUSIVO -- invariante: condicion(a[hi]) siempre True o fuera de rango
    while lo < hi:
        mid = (lo + hi) // 2
        if condicion(a[mid]):
            hi = mid       # mid podria ser la respuesta, no lo descartes
        else:
            lo = mid + 1   # mid definitivamente NO es la respuesta
    return lo   # primera posicion donde condicion es True (o len(a) si nunca lo es)
```

```cpp
int primeraPosicionVerdadera(vector<int>& a, function<bool(int)> condicion) {
    int lo = 0, hi = (int)a.size();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;   // evita overflow de (lo+hi) si ambos son grandes
        if (condicion(a[mid])) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
```

**Por qué `hi = mid` y no `hi = mid - 1`**: `mid` **podría ser** la respuesta correcta (la condición es verdadera ahí), así que no lo descartes — solo estrechas el rango excluyendo lo que ya sabes que no es la respuesta (`lo = mid + 1`, porque `mid` **no** cumplió). Esta asimetría exacta es la fuente número uno de bugs de bucle infinito, cubierta en Trampas.

---

## 3. Plantilla — binary search ON ANSWER (el salto conceptual)

**Patrón**: `lo`/`hi` ya no son índices de un arreglo — son el rango de **valores posibles de la respuesta**.

```python
def feasible(X, contexto):
    # logica especifica del problema: dado un valor candidato X,
    # responde si es POSIBLE lograr el objetivo con X.
    # DEBE ser monotona: si feasible(X) es True, feasible(X+1)
    # tambien debe serlo (o el analogo para minimizar).
    ...

def buscar_minimo_X_factible(lo, hi, contexto):
    while lo < hi:
        mid = (lo + hi) // 2
        if feasible(mid, contexto):
            hi = mid
        else:
            lo = mid + 1
    return lo   # el minimo X tal que feasible(X) es True
```

```cpp
long long buscarMinimoXFactible(long long lo, long long hi, /* contexto */ ) {
    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;
        if (feasible(mid /*, contexto*/)) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}
```

**Nota que el esqueleto es IDÉNTICO al de la sección 2** — la única diferencia real es qué significan `lo`, `hi`, y `mid`. Ese es exactamente el punto: una vez que reconoces "esto es binary search on answer", el código que tecleas es el mismo molde, solo cambias `feasible`.

---

## 4. Precisión sobre reales — cuando la respuesta no es entera

Si el espacio de búsqueda es continuo (la respuesta puede ser cualquier número real, no solo entero), no puedes usar `lo < hi` con enteros — usas un número fijo de iteraciones o un umbral de precisión:

```python
def buscar_real(lo, hi, feasible, iteraciones=100):
    for _ in range(iteraciones):   # ~100 iteraciones da precision de sobra para doubles
        mid = (lo + hi) / 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid
    return hi
```

**Por qué un número fijo de iteraciones y no `while hi - lo > epsilon`**: con `epsilon` corres el riesgo de elegir un valor demasiado grande (termina antes de la precisión que necesitas) o demasiado pequeño (bucle que tarda de más, o que nunca converge por error de punto flotante) — un número fijo de iteraciones (típicamente 100-200) garantiza precisión de sobra para cualquier tolerancia razonable de contest, sin ese riesgo.

---

## Trampas de contest

**El bucle que no termina**: la causa más común es una asimetría mal aplicada entre `hi = mid` y `lo = mid + 1` (o, en la variante de arreglo cerrado `lo <= hi`, olvidar el `+1`/`-1` correspondiente). Si escribes `hi = mid` en la rama que debería ser `hi = mid - 1` (o viceversa), `mid` puede quedar atrapado sin que `lo`/`hi` converjan nunca — bucle infinito en contest bajo reloj es exactamente el peor momento para depurar esto. **Memoriza un solo estilo de plantilla** (el de este libro, `lo < hi` con `hi` exclusivo) y no mezcles con otro estilo a medio problema.

**Buscar sobre un predicado NO monótono**: si `feasible(X)` da `True, False, True` conforme X crece, binary search simplemente da una respuesta incorrecta **sin ningún error visible** — el código corre, termina, y da mal. Antes de comprometerte, prueba `feasible` a mano con 3-4 valores crecientes de X en tu cabeza o en papel — si no estás seguro de la monotonía, no apuestes el problema a ella.

**Precisión en reales**: usar `epsilon` demasiado grande da una respuesta con error inaceptable; usarlo demasiado pequeño puede causar que el bucle nunca converja por limitaciones de punto flotante. Prefiere iteraciones fijas (sección 4) salvo que el problema exija explícitamente una condición de paro distinta.

**Overflow en `mid = (lo + hi) / 2`**: si `lo` y `hi` son ambos grandes (cercanos al límite de `int` en C++), `lo + hi` puede desbordar antes de dividir. Usa `mid = lo + (hi - lo) / 2` — matemáticamente equivalente, pero nunca suma dos valores grandes antes de dividir.

---

## Trade-offs

**Binary search vs. two pointers**: ambos son O(n) o O(log n) por explotar monotonía, pero resuelven preguntas distintas — two pointers recorre linealmente explotando monotonía **de posición en un arreglo**; binary search on answer explota monotonía **del espacio de posibles respuestas**. Si tu instinto dice "esto huele a monotonía" pero no estás seguro de cuál de las dos, pregúntate: ¿la variable que se mueve es un índice del arreglo, o es el valor candidato de la respuesta? Eso decide cuál técnica aplica.

**Binary search on answer vs. fuerza bruta sobre el espacio de respuestas**: si el rango de respuestas posibles es pequeño (decenas o cientos de valores), iterar linealmente sobre todas y quedarte con la mejor factible puede ser más simple de escribir sin ganar nada real en tiempo — binary search on answer se vuelve indispensable exactamente cuando ese rango es demasiado grande para iterar (10⁶ o más), que es, casi siempre, la señal explícita del enunciado (límites enormes).

---

## Conexiones

**Con two pointers (CP1)**: comparten el principio general de "descartar una parte del espacio de búsqueda sin revisarla" gracias a monotonía — pero aplicado a estructuras distintas (recorrido de arreglo vs. espacio de respuestas). No los confundas por compartir vocabulario ("monotonía", "descartar la mitad").

**Con DSU/greedy (CP4, CP5)**: `feasible(X)` en binary search on answer frecuentemente **es**, en sí misma, una simulación greedy o una verificación con DSU ("¿puedo lograr la conectividad/asignación deseada usando solo aristas de peso ≤ X?") — reconocer esto te permite construir `feasible` reutilizando técnicas que ya dominas de otros módulos, en vez de inventar la verificación desde cero.

**Con DP (CP7)**: en problemas de optimización con restricciones ("¿puedo particionar en K grupos tal que el máximo grupo tenga peso ≤ X?"), `feasible(X)` es frecuentemente una verificación greedy O(n), pero en variantes más restringidas puede requerir una DP interna — la composición "binary search afuera, DP/greedy adentro" es un patrón recurrente en Gold/Platinum de USACO.

---

## Síntesis

1. Binary search clásico busca una posición en un arreglo ordenado; binary search on answer busca un umbral en el espacio de **respuestas posibles**, verificando cada candidato con `feasible(X)`.
2. La condición indispensable es **monotonía de feasible(X)** — sin ella, la técnica da resultados incorrectos sin ningún error visible.
3. La plantilla es idéntica en ambas variantes: `lo < hi`, `mid = lo + (hi-lo)//2`, `hi = mid` si factible, `lo = mid + 1` si no.
4. Señal de contest: límites enormes + "mínimo/máximo X tal que..." + min-max/max-min → binary search on answer, casi siempre.
5. Las trampas caras son de implementación (asimetría hi/lo mal aplicada, overflow en el promedio) y de diseño (aplicar la técnica sin verificar monotonía primero).

---

## Problemas para resolver

1. **CSES — Factory Machines** (Sorting and Searching): "tiempo mínimo para producir N productos dado un conjunto de máquinas" — binary search on answer canónico, `feasible(tiempo)` es una suma simple.
2. **CSES — Array Division** (Sorting and Searching): particionar un arreglo en K subarreglos contiguos minimizando la suma máxima — el min-max clásico, `feasible(X)` es un greedy O(n) que cuenta cuántas particiones necesitas con límite X.
3. Un problema de "primera posición donde una condición se vuelve verdadera" sobre un arreglo ya ordenado, filtrado por el tag `binary search` en Codeforces con rating bajo (~1000-1200) — entrena la plantilla clásica de la sección 2 antes de saltar a on-answer.
4. Un problema tageado **binary search** en el rango 1300-1500 de Codeforces con límites de entrada explícitamente enormes (n o la respuesta hasta 10⁹ o más) — esa combinación de tag + límites es, en sí misma, la señal de reconocimiento de este libro; identifica `feasible(X)` antes de escribir una línea de código.
5. Un problema de partición/asignación bajo capacidad (repartir recursos, empacar en contenedores con límite) tageado **binary search** — practica construir `feasible(X)` como una simulación greedy simple, la composición mencionada en Conexiones.

---

## Fuentes

- USACO Guide, sección Silver — Binary Search: https://usaco.guide/silver/binary-search
- Antti Laaksonen, *Competitive Programmer's Handbook*: https://cses.fi/book/book.pdf
- CSES Problem Set, sección Sorting and Searching: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `binary search`: https://codeforces.com/problemset?tags=binary+search
