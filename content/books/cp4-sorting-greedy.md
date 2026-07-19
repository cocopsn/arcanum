---
module_id: cp4-sorting-greedy
spine: Competitiva
title: "Sorting y greedy"
subtitle: "Ordena primero, y prueba que tu codicia funciona"
source_canonical: "USACO Guide (Bronze/Silver — Intro Sorting, Sorting with Custom Comparators, Intro Greedy, Greedy with Sorting)"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 22
---

# Sorting y greedy

> **Pregunta raíz.** Un algoritmo greedy toma, en cada paso, la decisión que se ve mejor **ahora mismo**, sin reconsiderar. Eso suena peligroso —¿por qué confiar en decisiones locales para un resultado global?— y con razón: la mayoría de los greedys que "se sienten bien" son incorrectos. Los que sí funcionan lo hacen porque **puedes probarlo** con un argumento de intercambio (exchange argument): tomas cualquier solución óptima hipotética que difiera de la tuya, muestras que puedes intercambiar dos elementos para que se parezca más a la tuya sin empeorarla, y repites hasta que son idénticas. Sin esa prueba —o sin al menos la intuición sólida de por qué el intercambio no puede empeorar nada— un greedy en contest es una apuesta, no una solución.

## Prólogo

Ordenar primero es, con mucho, el paso más común antes de un greedy correcto: una vez que los elementos están en el orden correcto (por deadline, por tamaño, por relación de intervalos), la decisión local de cada paso deja de depender de mirar el futuro. Este módulo entrena dos reflejos distintos: reconocer cuándo un problema es candidato a greedy, y —el más importante, el que te salva de perder el problema completo— **desconfiar** de un greedy hasta que puedas justificarlo con un argumento de intercambio o un contraejemplo que descartes explícitamente.

---

## Señales de reconocimiento

**Gritan sorting + greedy:**
- "maximiza/minimiza [algo] eligiendo un orden/subconjunto" sobre elementos con dos atributos comparables (peso/valor, inicio/fin, deadline/duración)
- problemas de **intervalos**: "número máximo de intervalos que no se solapan", "cubre la línea con el mínimo de intervalos", "asigna recursos a intervalos sin conflicto"
- problemas de **deadlines**: "completa el máximo de tareas antes de su fecha límite", "minimiza el retraso total"
- "el comparador debe ordenar por [criterio compuesto]" — señal explícita de que necesitas un comparador custom, no el orden natural

**Señal de alerta — greedy candidato a estar MAL:**
- si tu argumento para el greedy es "se siente correcto" o "en los ejemplos funciona" sin un exchange argument o sin haber buscado activamente un contraejemplo, **desconfía**. La mayoría de los greedys intuitivos y no verificados fallan en algún caso borde que los ejemplos del enunciado no cubren.

**El reflejo**: intervalos/deadlines + "maximiza/minimiza" → candidato fuerte a greedy con sort. Antes de escribir código, dedica 30 segundos a intentar un contraejemplo mental — si no encuentras uno rápido, busca el exchange argument; si sí encuentras uno, tu greedy está mal y necesitas replantear el criterio de orden.

---

## 1. Por qué probar con exchange argument, no solo con ejemplos

**El argumento de intercambio, en su forma general**: supón una solución óptima `O` que no coincide con tu solución greedy `G` en algún punto. Encuentra dos elementos en `O` cuyo orden difiere del que tu greedy usaría, e intercambia su posición dentro de `O`. Si puedes probar que ese intercambio **nunca empeora** el resultado (a lo más lo deja igual), entonces existe una solución óptima que se parece un paso más a `G` — repite este argumento y, por inducción, `G` mismo es óptimo. **Esto es una prueba real, no una intuición** — y es exactamente lo que distingue un greedy defendible de uno que "se ve bien" en los ejemplos que probaste.

### Ejemplo clásico de exchange argument: scheduling para minimizar el retraso total

Si tienes tareas con duración `d_i` y quieres minimizar la suma de tiempos de finalización, ordenar por duración ascendente (SPT — shortest processing time first) es óptimo. El exchange argument: si en cualquier orden dos tareas adyacentes `i, j` están en orden `j` antes que `i` con `d_i < d_j`, intercambiarlas reduce el tiempo de finalización de `i` (que ahora termina antes) sin aumentar el de ninguna tarea posterior a ambas — un intercambio que estrictamente no empeora y potencialmente mejora, la firma exacta de un exchange argument válido.

---

## 2. Plantilla — comparador custom

```python
from functools import cmp_to_key

# Ejemplo: ordenar intervalos por tiempo de FIN ascendente (el criterio
# correcto para el clasico "maximo numero de intervalos sin solape").
intervalos = [(1, 3), (2, 5), (4, 6)]
intervalos.sort(key=lambda x: x[1])   # basta un key simple aqui

# Cuando el criterio de orden es mas complejo (varios campos con
# logica condicional, no solo "ordena por este campo"), usa cmp_to_key:
def comparador(a, b):
    if a[1] != b[1]:
        return a[1] - b[1]   # negativo si a va antes que b
    return a[0] - b[0]       # desempate

intervalos.sort(key=cmp_to_key(comparador))
```

```cpp
#include <algorithm>
#include <vector>
using namespace std;

bool comparador(const pair<int,int>& a, const pair<int,int>& b) {
    if (a.second != b.second) return a.second < b.second;   // ordena por FIN ascendente
    return a.first < b.first;                                 // desempate
}

// sort(intervalos.begin(), intervalos.end(), comparador);
```

**Regla de comparador válido en C++**: debe ser una **relación estricta de orden débil** — irreflexivo (`comparador(a,a)` es `false`) y consistente. Un comparador mal escrito (por ejemplo, que devuelve `true` para `a<b` Y para `b<a` simultáneamente en algún caso) produce comportamiento indefinido en `std::sort` de C++ — no un error visible, sino un posible crash o un orden silenciosamente incorrecto, cubierto en Trampas.

---

## 3. Plantilla — greedy de intervalos (máximo número sin solape)

```python
def max_intervalos_sin_solape(intervalos):
    intervalos.sort(key=lambda x: x[1])   # CRITERIO: fin ascendente, no inicio
    contador = 0
    fin_ultimo = float('-inf')
    for inicio, fin in intervalos:
        if inicio >= fin_ultimo:
            contador += 1
            fin_ultimo = fin
    return contador
```

**Por qué ordenar por FIN y no por INICIO**: el exchange argument aquí es específico — quedarte con el intervalo que termina más pronto posible, entre los candidatos disponibles, deja el máximo espacio libre para intervalos futuros. Ordenar por inicio no da esa garantía; es exactamente el tipo de "se siente razonable pero está mal" que la sección de trampas señala explícitamente.

---

## Trampas de contest

**El greedy que "se siente bien" y es incorrecto — contraejemplo clásico**: ordenar intervalos por **duración** (el más corto primero) en vez de por fin, para el problema de máximo número de intervalos sin solape, es el error intuitivo más común — parece razonable ("toma primero los que ocupan menos espacio"), pero falla: un intervalo corto colocado en medio de la línea de tiempo puede bloquear dos intervalos largos que, juntos, habrían permitido más selecciones totales que ese uno corto. El criterio correcto es fin ascendente (sección 3), no duración. **Lección general**: cuando definas el criterio de orden para un greedy de intervalos, pregúntate específicamente "¿por qué ESTE campo y no otro que también parece razonable?" — y si no tienes una respuesta de exchange argument, desconfía.

**Comparadores inconsistentes que rompen el sort**: en C++, un comparador que no define una relación de orden estricta y consistente (por ejemplo, comparar por múltiples criterios sin un desempate determinístico, causando que `comparador(a,b)` y `comparador(b,a)` sean ambos `true` en algún caso) produce comportamiento indefinido — desde resultados silenciosamente mal ordenados hasta un crash directo. Siempre incluye un criterio de desempate explícito y determinístico cuando el criterio principal puede empatar.

**Empates mal manejados**: en problemas donde el criterio principal se repite entre varios elementos, olvidar un desempate explícito puede hacer que el orden relativo entre elementos empatados sea inconsistente entre ejecuciones o entre lenguajes (el estándar de estabilidad de sort varía) — si el problema depende de ese orden relativo para ser correcto, un desempate ausente es un bug silencioso.

---

## Trade-offs

**Greedy vs. DP**: si puedes probar el exchange argument, greedy es casi siempre más simple de implementar y más rápido que la alternativa de DP para el mismo problema — pero si no puedes encontrar un exchange argument y sospechas que el greedy podría fallar en algún caso borde, no apuestes el problema completo a la intuición: considera si el problema en realidad exige DP (CP7), donde consideras explícitamente todas las decisiones posibles en vez de comprometerte de forma irreversible en cada paso.

**Ordenar por un criterio vs. varios**: un criterio simple de ordenamiento (una sola clave) es más rápido de escribir y menos propenso a errores de comparador; un criterio compuesto (varios campos con lógica condicional) da más flexibilidad pero exige más cuidado en la implementación del comparador (sección 2) y en probar que sigue siendo una relación de orden válida.

---

## Conexiones

**Con binary search (CP2)**: `feasible(X)` en binary search on answer frecuentemente **es** un greedy sobre datos ya ordenados — reconocer un buen greedy de intervalos/asignación te da directamente una pieza reutilizable para construir `feasible` en problemas de CP2.

**Con DSU (CP5)**: el algoritmo de Kruskal para árbol de expansión mínima es, literalmente, "ordena las aristas por peso, aplica greedy con la propiedad del corte, usa DSU para detectar ciclos" — la combinación exacta de sorting + greedy + DSU en un solo algoritmo. Si ya conoces Kruskal de tu estudio de teoría (ITC C7), reconoce que su estructura ES este módulo aplicado a un problema específico.

**Con DP (CP7)**: cuando un greedy que "se ve bien" falla al buscar contraejemplo, la alternativa casi siempre es DP — reconocer rápido que un greedy no tiene exchange argument disponible y pivotar a DP sin perder más tiempo intentando "arreglar" el greedy es una habilidad de contest en sí misma.

---

## Síntesis

1. Un greedy correcto se prueba con un **exchange argument**: cualquier solución óptima puede transformarse, paso a paso, en la solución greedy sin empeorar — no con "se ve bien en los ejemplos".
2. Ordenar primero desbloquea la mayoría de los greedys de intervalos/deadlines — pero el **criterio** de orden (fin, no duración; deadline, no tamaño) es exactamente donde vive la corrección o el error.
3. Antes de comprometerte con un greedy, dedica tiempo explícito a buscar un contraejemplo — encontrarlo te ahorra perder el problema completo por una intuición no verificada.
4. Comparadores custom en C++ deben ser una relación de orden estricta y consistente, con desempate explícito — de lo contrario, comportamiento indefinido, no un error visible.

---

## Problemas para resolver

1. **CSES — Tasks and Deadlines** (Sorting and Searching): greedy con exchange argument directo sobre orden de tareas con deadlines y duraciones — el ejemplo canónico de la sección 1.
2. **CSES — Movie Festival** (Sorting and Searching): máximo número de intervalos sin solape — la plantilla exacta de la sección 3, con la trampa del criterio de orden incorrecto (duración vs. fin) lista para tropezarte si no lo recuerdas.
3. Un problema tageado **greedy** + **sortings** en Codeforces de rating 1200-1400 que involucre intervalos o deadlines — practica identificar el criterio de orden correcto antes de escribir código, y busca activamente un contraejemplo antes de comprometerte.
4. Un problema de asignación de recursos limitados (ej. "asigna trabajadores a tareas maximizando el total") tageado **greedy** — entrena reconocer cuándo el criterio de orden correcto no es obvio a primera vista y requiere pensar el exchange argument con cuidado.
5. Un problema con comparador custom explícito (ordenar strings/pares por un criterio compuesto no estándar, como "el orden que minimiza la concatenación resultante") — un clásico de "comparador no trivial" que entrena exactamente la disciplina de la sección 2.

---

## Fuentes

- USACO Guide, secciones Bronze/Silver — Intro Sorting, Sorting with Custom Comparators, Intro Greedy, Greedy with Sorting: https://usaco.guide/bronze/sorting-custom y https://usaco.guide/silver/greedy-sorting
- CSES Problem Set, sección Sorting and Searching: https://cses.fi/problemset/
- Codeforces, problemset filtrable por tag `greedy`: https://codeforces.com/problemset?tags=greedy
