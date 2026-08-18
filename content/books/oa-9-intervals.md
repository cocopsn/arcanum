---
module_id: oa-9-intervals
spine: OA Amazon
title: "Intervalos"
subtitle: "Ordena, luego fusiona"
source_canonical: "cp4-sorting-greedy; patrones Amazon-tagged de Merge Intervals, Meeting Rooms II, Insert Interval"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 28
---

# Intervalos

> **Pregunta raíz.** Casi todo problema de intervalos —fusionar rangos, contar traslapes, encontrar el mínimo de recursos para cubrir un conjunto de reuniones— se resuelve con la misma secuencia de dos pasos: **ordena por el punto de inicio (o, según el problema, procesa inicios y fines como eventos separados), luego recorre una vez fusionando o contando**. Es un patrón corto de aprender y rápido de codear — precisamente por eso vale la pena tenerlo como reflejo absoluto, sin dudar ni un segundo sobre si ordenar primero es necesario.

## Prólogo

Este módulo es deliberadamente compacto — el patrón de intervalos no tiene la profundidad de otros módulos de este eje, y su valor está exactamente en que sea **rápido y automático**, no en que tenga mucha teoría nueva que digerir. Ya tienes de `cp4-sorting-greedy` la disciplina de "ordena primero, greedy después" — este módulo es la aplicación más directa y menos ambigua de esa disciplina.

---

## 1. Merge Intervals — el patrón base

**El problema**: dado un conjunto de intervalos, fusiona todos los que se traslapan.

**La deducción**: si ordenas los intervalos por su punto de **inicio**, cualquier traslape posible entre dos intervalos solo puede ocurrir entre **vecinos consecutivos** en ese orden — nunca entre dos intervalos separados por otro en medio, porque si el de en medio no se traslapa con ninguno de los dos extremos, ninguno de los extremos puede traslaparse entre sí sin traslaparse también con el de en medio. Esto reduce el problema a una sola pasada: recorre en orden, y funde el intervalo actual con el anterior si su inicio es menor o igual al fin del anterior.

```python
def fusionar_intervalos(intervalos):
    if not intervalos:
        return []

    intervalos.sort(key=lambda x: x[0])   # ordena por INICIO
    resultado = [intervalos[0]]

    for inicio, fin in intervalos[1:]:
        ultimo_inicio, ultimo_fin = resultado[-1]
        if inicio <= ultimo_fin:              # se traslapan (o tocan)
            resultado[-1] = (ultimo_inicio, max(ultimo_fin, fin))
        else:
            resultado.append((inicio, fin))

    return resultado


if __name__ == "__main__":
    print(fusionar_intervalos([(1,3), (2,6), (8,10), (15,18)]))
    # [(1, 6), (8, 10), (15, 18)]
```

**Nota `max(ultimo_fin, fin)`, no simplemente `fin`**: el intervalo actual podría estar completamente **contenido** dentro del anterior (fin menor que el fin ya acumulado) — usar `fin` directamente perdería la extensión real del rango fusionado. Este es exactamente el tipo de detalle que un ejemplo de prueba pequeño puede no exponer, y que sí aparece en el juez completo.

---

## 2. Meeting Rooms II — el mínimo de salas simultáneas necesarias

**El problema**: dado un conjunto de reuniones con inicio y fin, encuentra el número mínimo de salas necesarias para que ninguna se traslape dentro de la misma sala.

**La deducción — separa inicios y fines como eventos**: en vez de pensar en "intervalos", piensa en cada inicio como un evento "+1 sala ocupada" y cada fin como "-1 sala ocupada" — exactamente el patrón de sweep line que ya conoces de `cp8-segment-tree` sección 3. Ordena todos los eventos por posición temporal (con una regla de desempate cuidadosa, ver Trampas), recórrelos acumulando el conteo de salas simultáneamente ocupadas, y el máximo de ese acumulado a lo largo de todo el recorrido es la respuesta.

```python
def salas_minimas(intervalos):
    """
    Sweep line: cada inicio es +1, cada fin es -1. El maximo del
    acumulado durante el barrido es el numero minimo de salas.
    """
    eventos = []
    for inicio, fin in intervalos:
        eventos.append((inicio, 1))
        eventos.append((fin, -1))

    # CRITICO: en caso de empate en la posicion, procesa los FINES
    # (-1) ANTES que los inicios (+1) -- si una reunion termina
    # exactamente cuando otra empieza, NO necesitan salas distintas.
    eventos.sort(key=lambda x: (x[0], x[1]))

    salas_activas = 0
    maximo_salas = 0
    for posicion, delta in eventos:
        salas_activas += delta
        maximo_salas = max(maximo_salas, salas_activas)

    return maximo_salas


if __name__ == "__main__":
    print(salas_minimas([(0, 30), (5, 10), (15, 20)]))   # 2
```

**Alternativa con heap** (útil si el problema pide, además, asignar explícitamente qué reunión va a qué sala, no solo contar): ordena los intervalos por inicio; mantén un min-heap de los tiempos de fin de las salas actualmente ocupadas; para cada reunión nueva, si el fin más próximo del heap ya pasó (es `≤` el inicio de la reunión actual), reutiliza esa sala (pop y push); si no, necesitas una sala nueva (push sin pop). El tamaño máximo que alcanza el heap es la respuesta — la misma composición de sorting + heap que ya reconoces como patrón recurrente en `oa-6-heap-topk`.

---

## 3. Insert Interval — insertar y fusionar en una pasada

**El problema**: dado un conjunto de intervalos ya ordenados y sin traslapes, inserta un intervalo nuevo, fusionando donde sea necesario.

**La deducción**: como el conjunto original ya está ordenado, no necesitas volver a ordenar todo — recorre una vez, dividiendo el trabajo en tres fases claras: (1) copia directo todos los intervalos que terminan completamente antes de que el nuevo empiece, (2) fusiona todos los que se traslapan con el nuevo, expandiendo sus límites, (3) copia directo el resto.

```python
def insertar_intervalo(intervalos, nuevo):
    resultado = []
    i = 0
    n = len(intervalos)

    while i < n and intervalos[i][1] < nuevo[0]:
        resultado.append(intervalos[i])
        i += 1

    inicio_fusion, fin_fusion = nuevo
    while i < n and intervalos[i][0] <= fin_fusion:
        inicio_fusion = min(inicio_fusion, intervalos[i][0])
        fin_fusion = max(fin_fusion, intervalos[i][1])
        i += 1
    resultado.append((inicio_fusion, fin_fusion))

    while i < n:
        resultado.append(intervalos[i])
        i += 1

    return resultado
```

**Por qué esto es O(n) y no O(n log n)**: como el input ya está ordenado, no hay ningún `sort()` en esta solución — una sola pasada lineal basta. Si te encuentras ordenando de nuevo un input que el enunciado ya te dice que está ordenado, estás desperdiciando tiempo de examen en un paso innecesario.

---

## Señales de reconocimiento

- **"Reuniones traslapadas"**, **"fusiona los rangos"** → Merge Intervals, ordena por inicio.
- **"Cuántas salas/recursos simultáneos se necesitan"** → sweep line de eventos +1/-1, o la variante con heap si necesitas asignación explícita.
- **Input que el enunciado garantiza ya ordenado** → no vuelvas a ordenar, aprovecha esa garantía para O(n) directo.

---

## Trampas OA

**No ordenar primero**: la trampa más básica y más citada — intentar fusionar o comparar intervalos sin ordenarlos primero produce una lógica que depende del orden arbitrario de entrada, y falla en cualquier caso donde ese orden no sea conveniente. Ordenar por inicio es, casi sin excepción, el primer paso no negociable de cualquier problema de esta familia.

**El borde donde un intervalo toca exactamente al siguiente**: la pregunta de si `[1,5]` y `[5,10]` "se traslapan" (comparten el punto 5) depende de la definición exacta del problema, y es sorprendentemente fácil equivocarse en la dirección incorrecta bajo presión. En Merge Intervals, generalmente **sí** se fusionan (`inicio <= ultimo_fin`, con `<=`, no `<`) porque comparten un punto. En Meeting Rooms, generalmente **no** requieren salas distintas si una termina exactamente cuando la otra empieza — de ahí la regla de desempate explícita en el código de la sección 2 (procesar fines antes que inicios en caso de empate). **Lee el enunciado buscando explícitamente si los límites son inclusive o exclusive**, y ajusta tu comparación (`<=` vs `<`) en consecuencia — no asumas que la convención de un problema aplica automáticamente al siguiente.

---

## Conexiones

**Con `cp4-sorting-greedy`**: el patrón completo de "ordena primero, greedy después" con su exchange argument ya está ahí — este módulo es la aplicación más directa y de menor ambigüedad de esa disciplina general.

**Con `cp8-segment-tree` y `oa-6-heap-topk`**: Meeting Rooms II combina sweep line (de `cp8-segment-tree`) o, en su variante de heap, exactamente el patrón de `oa-6-heap-topk` — otra prueba de que los problemas de dificultad media son composiciones de patrones simples, no técnicas nuevas aisladas.

---

## Síntesis

1. Ordena por inicio, luego recorre una vez fusionando o contando — el patrón base de casi toda esta familia.
2. Meeting Rooms II es sweep line de eventos +1/-1, con el desempate cuidadoso de procesar fines antes que inicios en caso de empate exacto.
3. Si el input ya está ordenado (como en Insert Interval), no lo ordenes de nuevo — aprovecha la garantía para O(n) directo.
4. La trampa más cara es de borde: verificar si los límites son inclusive o exclusive antes de decidir `<=` vs `<` en tu comparación de traslape.

---

## Lo que deberías poder hacer en 30 segundos

1. **Confirmar que ordenaste por inicio** antes de escribir cualquier lógica de fusión o conteo.
2. **Decidir si necesitas sweep line de eventos o solo fusión directa**, según si el problema pide "cuántos simultáneos" o "fusiona los rangos".
3. **Verificar la convención de límites inclusive/exclusive** del enunciado antes de fijar tu comparación de traslape.

---

## Fuentes

- `cp4-sorting-greedy` y `cp8-segment-tree` de esta misma colección — la disciplina de ordenar-antes-de-greedy y el patrón de sweep line.
- "Merge Intervals", "Meeting Rooms II", "Insert Interval" — problemas estándar y ampliamente citados en preparación de entrevistas técnicas de la industria, frecuentemente reportados bajo el tag Amazon.
