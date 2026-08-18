---
module_id: oa-4-binary-search-answer
spine: OA Amazon
title: "Binary Search on Answer"
subtitle: "Buscar la respuesta, no el dato"
source_canonical: "cp2-binary-search; Capacity To Ship Packages Within D Days (LeetCode 1011, patrón ampliamente reportado en OAs); variante de capacidad efectiva reducida por carga frágil"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 42
---

# Binary Search on Answer

> **Pregunta raíz.** Este es, con diferencia, el patrón más subestimado por candidatos que apenas empiezan — porque el enunciado **nunca** dice "usa binary search". Te va a describir un problema de logística, de capacidad, de tiempo de entrega, y tu trabajo es notar que, detrás de esa historia, hay una función `feasible(X)` monótona escondida: "¿es posible lograr el objetivo con el valor X?" — y que puedes encontrar el X óptimo binarizando sobre el **espacio de respuestas posibles**, no sobre el arreglo de datos. Ya construiste la plantilla completa y la prueba en `cp2-binary-search`. Este módulo es, casi en su totalidad, entrenamiento de reconocimiento: cómo se ve este patrón cuando Amazon lo disfraza de problema de envíos, capacidad de almacén, o asignación de recursos.

> **Nota de honestidad**: "Capacity To Ship Packages Within D Days" es un problema real, ampliamente documentado (LeetCode 1011) y extremadamente citado como ejemplo canónico de binary search on answer en preparación de entrevistas de la industria — lo uso aquí con confianza. La variante de "carga frágil con capacidad efectiva reducida" que describes como reportada no pude verificarla palabra por palabra contra una fuente primaria; la construyo aquí como una extensión rigurosa y correcta del mismo patrón, exactamente el tipo de variación que Amazon suele aplicar sobre un problema base conocido para que no sea reconocible por memorización directa.

## Prólogo

Ya tienes la plantilla, la prueba de correctitud, y las trampas básicas completas en `cp2-binary-search`. Este módulo no las repite — asume que reconoces `lo < hi`, `mid = lo + (hi-lo)//2`, y la lógica de `hi = mid` / `lo = mid + 1` como reflejo. Lo que sí vas a construir aquí es el entrenamiento específico de reconocimiento bajo la forma que Amazon usa: problemas de capacidad y asignación de recursos, con las restricciones exactas que delatan el patrón.

---

## 1. El caso canónico — "capacidad mínima para enviar paquetes en D días"

### 1.1 El enunciado, y por qué no grita "binary search" a primera lectura

Tienes un arreglo de pesos de paquetes, en orden, y `D` días. Cada día puedes cargar una cantidad de paquetes en un camión hasta una capacidad máxima fija (siempre en el orden dado, sin reordenar), y necesitas terminar de enviar todo en exactamente `D` días o menos. **Encuentra la capacidad mínima del camión que hace esto posible.**

Léelo otra vez: no dice "busca en un arreglo ordenado". Dice "encuentra el valor mínimo que hace algo posible" — y ahí está la señal, exactamente la de la sección de señales de `cp2-binary-search`: **"el valor mínimo/máximo tal que [algo] sea posible"**.

### 1.2 La deducción — construir feasible(capacidad)

**El espacio de respuestas posibles**: la capacidad del camión puede ser, como mínimo, el peso del paquete más pesado (si no, ese paquete nunca cabría en ningún envío) — y como máximo, la suma total de todos los pesos (enviarlo todo en un solo día). Ese es tu `lo` y tu `hi` para la búsqueda.

**feasible(capacidad)**: dado un valor candidato de capacidad, simula el proceso greedy de cargar el camión: recorre los paquetes en orden, acumulando peso en el día actual mientras quepa; en cuanto el siguiente paquete no quepa, empieza un día nuevo. Cuenta cuántos días necesitaste. Si ese conteo es `≤ D`, la capacidad candidata es factible.

**Por qué feasible es monótono, y por qué eso es lo único que necesitas verificar antes de aplicar binary search**: si una capacidad `X` es suficiente para terminar en `D` días o menos, cualquier capacidad **mayor** que `X` también lo es — más capacidad nunca puede *aumentar* el número de días necesarios, porque puedes cargar al menos lo mismo que cargarías con `X` en cada día, potencialmente más. Esa es exactamente la propiedad de monotonía que `cp2-binary-search` exige antes de aplicar la técnica — verifícala siempre explícitamente antes de comprometerte, no la asumas.

```python
def capacidad_minima_envio(pesos, dias):
    """
    Binary search on answer. feasible(capacidad) simula el envio
    greedy y verifica si termina en <= dias.
    O(n log(suma_total - max_peso)) tiempo.
    """
    def feasible(capacidad):
        dias_necesarios = 1
        carga_actual = 0
        for peso in pesos:
            if carga_actual + peso > capacidad:
                dias_necesarios += 1
                carga_actual = 0
            carga_actual += peso
        return dias_necesarios <= dias

    lo, hi = max(pesos), sum(pesos)
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo


if __name__ == "__main__":
    print(capacidad_minima_envio([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5))   # 15
```

**Nota que el esqueleto de búsqueda es exactamente idéntico al de `cp2-binary-search`** — lo único que cambió es qué representa `lo`/`hi` (aquí, capacidades posibles, no índices de arreglo) y el cuerpo de `feasible`. Una vez que reconoces el patrón, escribir esta función es mecánico.

---

## 2. La variante de carga frágil — capacidad efectiva reducida

### 2.1 Cómo Amazon complica el problema base sin cambiar el patrón de fondo

Una variante realista sobre el mismo esqueleto: algunos paquetes están marcados como **frágiles**, y cuando un envío contiene al menos un paquete frágil, la capacidad efectiva del camión para ese envío se reduce (por ejemplo, a un porcentaje de la capacidad nominal, o restando un margen fijo de seguridad). La pregunta sigue siendo la misma: encuentra la capacidad nominal mínima del camión tal que todo se pueda enviar en `D` días.

### 2.2 Por qué esto sigue siendo binary search on answer — solo cambia feasible

**La deducción no cambia**: la monotonía sigue siendo válida —más capacidad nominal nunca puede requerir más días, incluso con la reducción por fragilidad, porque la reducción es una función fija de la capacidad nominal, no algo que empeora de forma no monótona—. Lo único que cambia es que `feasible(capacidad)` ahora necesita, dentro de su simulación greedy, verificar si el envío actual contiene algún paquete frágil y ajustar la capacidad efectiva disponible para ese envío específico.

```python
def capacidad_minima_con_fragiles(paquetes, dias, factor_reduccion_fragil=0.8):
    """
    paquetes: lista de (peso, es_fragil).
    Si un envio contiene al menos un paquete fragil, la capacidad
    EFECTIVA de ese envio se reduce por factor_reduccion_fragil.
    """
    peso_maximo = max(p for p, _ in paquetes)

    def feasible(capacidad_nominal):
        dias_necesarios = 1
        carga_actual = 0
        fragil_en_envio_actual = False

        for peso, es_fragil in paquetes:
            capacidad_efectiva = (capacidad_nominal * factor_reduccion_fragil
                                   if (fragil_en_envio_actual or es_fragil)
                                   else capacidad_nominal)
            if carga_actual + peso > capacidad_efectiva:
                dias_necesarios += 1
                carga_actual = 0
                fragil_en_envio_actual = False
                capacidad_efectiva = (capacidad_nominal * factor_reduccion_fragil
                                       if es_fragil else capacidad_nominal)
            carga_actual += peso
            if es_fragil:
                fragil_en_envio_actual = True

        return dias_necesarios <= dias

    lo = peso_maximo
    # hi conservador: suficiente incluso con la reduccion aplicada a TODO
    hi = int(sum(p for p, _ in paquetes) / factor_reduccion_fragil) + 1

    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo
```

**Por qué `hi` necesita ajustarse, y qué verificar antes de confiar en tus límites**: como la capacidad efectiva puede reducirse, la capacidad nominal que "seguro basta" en el peor caso (todo frágil) es más alta que la suma total de pesos sin ajuste — si dejas `hi` sin ese ajuste, tu búsqueda podría no cubrir el rango real de la respuesta. **Esta es una trampa de diseño específica de las variantes de Amazon**: cuando el problema base se complica con una regla de negocio adicional, siempre verifica si tus límites `lo`/`hi` originales siguen siendo válidos bajo la nueva regla, o si necesitan ajustarse para seguir garantizando que la respuesta correcta está dentro del rango de búsqueda.

---

## 3. Señales de reconocimiento — el catálogo completo para Amazon

- **"El valor mínimo/máximo de X tal que [algo] sea posible/suficiente"** — la señal más directa, sin importar el disfraz de negocio.
- **"¿Es posible completar/lograr [objetivo] con [recurso] = X?"** seguido de pedir el X óptimo.
- **Límites de entrada enormes** (`10^9` o más) en el valor que se pregunta, mientras el arreglo de datos mismo es manejable — la magnitud del espacio de respuestas, no del arreglo, es la que importa aquí.
- **Verbos de asignación/partición con una restricción de capacidad o tiempo**: repartir, dividir, enviar, empacar, asignar — bajo un límite de "días", "camiones", "trabajadores", "capacidad".
- **Variantes con reglas de negocio adicionales** (fragilidad, prioridad, tipos de carga distintos) sobre el mismo esqueleto base — reconoce el esqueleto primero, luego ajusta `feasible` para la regla adicional, exactamente como en la sección 2.

---

## Trampas OA

**El bucle que no termina**: la misma trampa de `cp2-binary-search` — una asimetría entre `hi = mid` y `lo = mid + 1` mal aplicada. Bajo la presión adicional de un problema con una `feasible` más compleja (como la variante frágil), es todavía más fácil perder de vista la plantilla de búsqueda mientras te concentras en la lógica de simulación — escribe la estructura de búsqueda primero, exactamente igual siempre, y solo después llena el cuerpo de `feasible`.

**Predicado no monótono**: antes de comprometerte con binary search on answer, verifica explícitamente que más recurso (capacidad, tiempo, presupuesto) nunca puede *empeorar* la factibilidad — en los problemas de esta familia casi siempre es cierto, pero **no lo asumas sin pensarlo** cuando la regla de negocio se complica (como con fragilidad): pregúntate explícitamente si existe algún escenario donde aumentar la capacidad nominal pudiera, por algún efecto secundario de la regla adicional, empeorar el resultado. En la variante de la sección 2, no lo hace —la reducción por fragilidad es una fracción fija de la capacidad nominal, así que más capacidad nominal siempre da más capacidad efectiva también— pero verificar esto explícitamente, no darlo por sentado, es la disciplina que te protege de aplicar el patrón donde no aplica.

**Los casos imposibles antes de buscar**: verifica, antes de correr la búsqueda binaria, que el problema tenga solución dentro de las restricciones dadas — por ejemplo, si `D` (los días disponibles) es menor que el número de paquetes en algunos planteamientos donde cada paquete necesitaría su propio día en el peor caso, o si algún valor individual excede cualquier límite razonable de recurso. Muchos problemas de Amazon exigen devolver un centinela (-1, o similar) para el caso imposible, exactamente la misma disciplina de `oa-0-fundamentos` sección 6 — verifica esto **antes** de invertir tiempo corriendo la búsqueda binaria completa sobre un caso que nunca tuvo solución.

---

## Conexiones

**Con `cp2-binary-search`**: la plantilla, la prueba de correctitud, y la distinción entre búsqueda clásica y "on answer" ya están completas ahí. Este módulo es, en esencia, entrenamiento de reconocimiento bajo el disfraz específico de logística/capacidad que Amazon favorece.

**Con `oa-2-prefix-sum`**: nota una distinción útil de diagnóstico — si el problema pide "mínimas operaciones para que una condición se cumpla siempre a lo largo del arreglo", sospecha primero state-reset greedy (`oa-2-prefix-sum`). Si pide "el valor mínimo/máximo de un recurso tal que el objetivo completo sea alcanzable", sospecha binary search on answer. Ambos comparten vocabulario ("mínimo", "posible") pero son patrones distintos — la pregunta que los separa es si estás buscando **una condición punto a punto a lo largo del arreglo** (state-reset) o **un valor escalar único que gobierna todo el proceso** (binary search on answer).

**Con `oa-1-arrays-hashmap` y `oa-3-two-pointers-sliding`**: `feasible(X)` en binary search on answer frecuentemente **es**, en sí misma, una simulación que usa un patrón que ya conoces — aquí fue un greedy simple de acumulación, pero en otros problemas puede ser un recorrido con hash map o un sliding window interno. Reconocer que estás construyendo binary search **sobre** otro patrón que ya dominas, no algo completamente nuevo, acelera tu capacidad de resolverlo bajo reloj.

---

## Síntesis

1. Binary search on answer se reconoce por "el valor mínimo/máximo de X tal que [algo] sea posible" — nunca vas a ver esas palabras exactas, vas a verlas disfrazadas en una historia de capacidad o logística.
2. "Capacity To Ship Packages Within D Days" es el caso canónico: `feasible(capacidad)` simula el envío greedy y cuenta días, la monotonía viene de que más capacidad nunca aumenta los días necesarios.
3. Variantes de Amazon (carga frágil, prioridades) complican `feasible`, no la estructura de búsqueda — reconoce el esqueleto primero, ajusta el cuerpo después, y verifica siempre que `lo`/`hi` sigan siendo válidos bajo la regla adicional.
4. Antes de comprometerte, verifica explícitamente la monotonía — no la asumas solo porque el problema "se siente" como los anteriores que ya resolviste.
5. Verifica los casos imposibles antes de invertir tiempo en la búsqueda completa.

---

## Lo que deberías poder hacer en 30 segundos

1. **Detectar "mínimo/máximo valor tal que sea posible" detrás de cualquier historia de logística o asignación de recursos.**
2. **Identificar `lo` y `hi` del espacio de respuestas** (no del arreglo de datos) en los primeros segundos de leer el problema.
3. **Bosquejar mentalmente `feasible(X)`** antes de escribir código: ¿qué simulación o verificación responde "¿es posible con este valor?"
4. **Verificar monotonía explícitamente**, en especial si el problema tiene una regla de negocio adicional sobre el esqueleto base.

---

## Fuentes

- `cp2-binary-search` de esta misma colección — la plantilla, la prueba de correctitud, y la distinción búsqueda clásica vs. on-answer completas.
- "Capacity To Ship Packages Within D Days" (LeetCode 1011) — problema estándar y ampliamente citado como caso canónico de binary search on answer en preparación de entrevistas técnicas de la industria.
