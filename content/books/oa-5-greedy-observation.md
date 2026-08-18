---
module_id: oa-5-greedy-observation
spine: OA Amazon
title: "Greedy y Observación"
subtitle: "Observa, prueba, y sé codicioso"
source_canonical: "cp4-sorting-greedy; patrones de observación de paridad y asignación mínima de proveedores reportados en OAs de la industria"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Greedy y Observación

> **Pregunta raíz.** Este es el estilo que define al OA de Amazon en su forma más "anti-LLM": el problema no te va a decir qué algoritmo usar — te va a esconder una **observación matemática pequeña** (frecuentemente sobre paridad, sobre orden, sobre una propiedad estructural del input) detrás de una regla de negocio, y tu trabajo es **deducir esa observación antes de escribir una sola línea de código**. Una vez que la tienes, la implementación es casi siempre trivial — unas pocas líneas de greedy. La dificultad real nunca está en el código; está en el momento de silencio antes de escribir, donde tienes que preguntarte "¿qué patrón estructural hace que la respuesta obvia sea correcta?" y, crucialmente, **probarlo** con un exchange argument antes de apostar el problema completo a una intuición sin verificar.

## Prólogo

Ya tienes la plantilla y la prueba de exchange argument completas en `cp4-sorting-greedy`. Este módulo no las repite — las aplica al estilo específico de "observación escondida" que Amazon favorece en 2026: problemas donde la regla de negocio disfraza una propiedad matemática simple (frecuentemente paridad, frecuentemente una desigualdad de orden), y donde el greedy correcto es casi trivial de codificar **una vez que ves la observación**, pero completamente invisible si intentas atacar el problema con fuerza bruta o con una técnica más pesada de la que necesita.

---

## 1. El estilo "anti-LLM" — por qué la observación viene antes del código

### 1.1 Qué significa que un problema esté diseñado para esconder el patrón

Un problema "anti-LLM" no es difícil porque exija un algoritmo sofisticado — es difícil porque el algoritmo correcto es **simple**, pero solo se vuelve visible después de notar una propiedad del problema que no está explícita en el enunciado. Un modelo (o un candidato) que salta directo a codear sin pasar por ese momento de observación va a escribir algo que "parece razonable" pero no está anclado en ninguna prueba — exactamente el tipo de greedy no verificado que `cp4-sorting-greedy` ya te enseñó a desconfiar.

### 1.2 La disciplina de dos pasos, sin excepción

**Paso 1 — observa**: antes de escribir código, pregúntate explícitamente qué propiedad estructural del input determina la respuesta. ¿Depende de la paridad de algo? ¿De un orden específico? ¿De un valor extremo (máximo/mínimo)? Dedica los primeros minutos del problema exclusivamente a esto, en papel o mentalmente, sin tocar el teclado.

**Paso 2 — prueba, aunque sea informalmente**: una vez que tienes una hipótesis de observación, verifica con un exchange argument (o al menos con un par de contraejemplos mentales deliberados) que tu regla greedy no puede fallar. Solo entonces escribes código — y cuando lo haces, va a ser rápido, porque la lógica ya está resuelta en tu cabeza.

---

## 2. Observación de paridad — secuencia lexicográficamente mínima con restricción de suma

### 2.1 El tipo de problema

Una familia común: construir una secuencia (de longitud fija, o eligiendo entre opciones limitadas por posición) que satisfaga una restricción de suma o de paridad, y que sea **lexicográficamente mínima** entre todas las que cumplen la restricción.

### 2.2 La observación que hay que encontrar

En problemas de este tipo, la restricción de suma frecuentemente se reduce a una condición de **paridad**: por ejemplo, "la suma total debe ser par" cuando cada posición puede tomar uno de dos valores con paridades distintas. La observación clave: si ya tienes una secuencia base y necesitas ajustar la paridad de la suma total, **el ajuste mínimo posible es cambiar exactamente una posición** — y para mantener la secuencia lexicográficamente mínima, ese cambio debe hacerse en la posición **más a la derecha posible** donde el cambio sea válido, nunca en una posición temprana, porque cambiar una posición temprana altera el prefijo de la secuencia de forma que casi siempre la hace lexicográficamente mayor que si hubieras cambiado algo más tarde.

```python
def secuencia_lexicograficamente_minima_suma_par(opciones_por_posicion):
    """
    opciones_por_posicion: lista de tuplas (valor_menor, valor_mayor)
    por posicion, donde valor_menor es SIEMPRE la eleccion lexicografica
    preferida si no hubiera restriccion de paridad.

    Estrategia: elige siempre el valor menor primero (lexicograficamente
    optimo sin restriccion). Si la suma resultante tiene paridad
    incorrecta, ajusta UNA sola posicion -- la MAS A LA DERECHA
    donde el ajuste sea valido -- para corregir la paridad con el
    menor impacto posible en el orden lexicografico.
    """
    secuencia = [menor for menor, _ in opciones_por_posicion]
    suma = sum(secuencia)

    if suma % 2 == 0:
        return secuencia   # ya es par, no hace falta ajuste

    # Busca DE DERECHA A IZQUIERDA la primera posicion donde cambiar
    # a la opcion mayor arregla la paridad -- el cambio mas tardio
    # posible preserva el prefijo lexicografico optimo.
    for i in range(len(secuencia) - 1, -1, -1):
        menor, mayor = opciones_por_posicion[i]
        if mayor != menor and (mayor - menor) % 2 == 1:
            secuencia[i] = mayor
            return secuencia

    return None   # imposible ajustar la paridad con las opciones dadas


if __name__ == "__main__":
    print(secuencia_lexicograficamente_minima_suma_par([(1, 2), (3, 4), (5, 6)]))
```

**Por qué "más a la derecha" y no "más a la izquierda", deducido, no memorizado**: el orden lexicográfico compara posiciones de izquierda a derecha, dando peso decreciente a cada posición sucesiva — cambiar la posición 0 (la más a la izquierda) casi siempre produce una secuencia mayor de forma inmediata y definitiva, sin importar qué pase después. Cambiar la posición más a la derecha posible dentro de las que pueden corregir la paridad **preserva intacto todo el prefijo que ya era óptimo**, afectando solo la parte de la secuencia con menor peso en la comparación lexicográfica. Esta es, en esencia, la misma lógica de exchange argument que ya conoces: cualquier ajuste que preserve más del prefijo óptimo domina a uno que lo altera antes.

---

## 3. Proveedores mínimos — ordenar descendente y greedy directo

### 3.1 El tipo de problema

Otra familia común: tienes una demanda total que cubrir, y una lista de proveedores con capacidades distintas — encuentra el **número mínimo de proveedores** que necesitas contratar para cubrir la demanda.

### 3.2 La observación y la prueba

**La observación**: para minimizar el número de proveedores, siempre conviene tomar, en cada paso, el proveedor con la **mayor capacidad restante disponible** — nunca uno más pequeño mientras haya uno más grande disponible.

**La prueba por exchange argument**: supón una solución óptima que no usa el proveedor de mayor capacidad en algún punto donde sí estaba disponible, usando en su lugar uno más pequeño. Intercambia ambos en la solución: la demanda cubierta no disminuye (el más grande cubre al menos lo mismo que el más pequeño), y el número total de proveedores usados no aumenta. Por lo tanto, siempre existe una solución óptima que prioriza los proveedores de mayor capacidad primero — exactamente la misma estructura de prueba que ya viste con "ordena por fin, no por duración" en `cp4-sorting-greedy`.

```python
def proveedores_minimos(demanda_total, capacidades):
    """
    Ordena capacidades descendente, toma greedy la mayor disponible
    hasta cubrir la demanda. O(n log n) por el ordenamiento.
    """
    capacidades_ordenadas = sorted(capacidades, reverse=True)
    cubierto = 0
    proveedores_usados = 0

    for capacidad in capacidades_ordenadas:
        if cubierto >= demanda_total:
            break
        cubierto += capacidad
        proveedores_usados += 1

    if cubierto < demanda_total:
        return -1   # imposible cubrir la demanda con los proveedores disponibles

    return proveedores_usados


if __name__ == "__main__":
    print(proveedores_minimos(100, [30, 50, 20, 40, 10]))   # 3 (50+40+30=120 >= 100)
```

---

## 4. La trampa central — el greedy que "se siente bien" y está mal

### 4.1 Por qué esto es la trampa más cara de todo el módulo

En problemas de observación escondida, es fácil convencerte de una regla greedy que "suena razonable" sin haberla probado — y a diferencia de un bug de sintaxis, un greedy incorrecto **pasa los ejemplos pequeños del enunciado** (que casi siempre están diseñados para no exponer el contraejemplo) y falla silenciosamente en el juez completo.

### 4.2 El hábito que te protege

Antes de comprometerte con cualquier regla greedy en este estilo de problema, dedica explícitamente 30-60 segundos a intentar **construir un contraejemplo** — un caso pequeño, de 3-4 elementos, diseñado deliberadamente para romper tu regla. Si no lo encuentras rápido, y además puedes esbozar por qué un exchange argument protege tu regla, procede con confianza. Si lo encuentras, tu regla está mal, y necesitas replantear la observación — mucho mejor descubrirlo en 60 segundos de papel que después de enviar y recibir "Wrong Answer" en un caso oculto.

**Ejemplo del tipo de contraejemplo que hay que buscar activamente**: en el problema de proveedores mínimos, alguien podría intuir erróneamente "toma siempre el proveedor cuya capacidad esté más cerca de la demanda restante" en vez de "toma siempre el de mayor capacidad" — un contraejemplo simple con tres proveedores de capacidades muy dispares expone rápido por qué esa intuición alternativa puede requerir más proveedores que la estrategia de mayor-capacidad-primero.

---

## Señales de reconocimiento

- **"Maximiza/minimiza eligiendo..."** con una construcción paso a paso — candidato directo a greedy con observación.
- **Restricciones de paridad implícitas** en la suma, el conteo, o la estructura del resultado pedido.
- **"Número mínimo de [recurso] para cubrir/lograr..."** — candidato a greedy de orden descendente/ascendente según el problema.
- **El problema se siente resoluble con una regla simple, pero no estás seguro de por qué esa regla es correcta** — exactamente la señal de que necesitas parar y buscar el exchange argument antes de codear.

---

## Trampas OA

**El greedy que se siente bien y es incorrecto**: ya cubierto en profundidad en la sección 4 — la trampa central de todo este módulo.

**No probar la correctitud**: escribir la regla greedy directamente porque "funciona en el ejemplo del enunciado" sin verificar con un exchange argument o un contraejemplo deliberado — el ejemplo del enunciado casi nunca está diseñado para exponer el caso donde tu regla falla, así que "pasa el ejemplo" no es evidencia suficiente de corrección.

---

## Conexiones

**Con `cp4-sorting-greedy`**: la plantilla del exchange argument, el patrón de comparador custom, y la disciplina general de "ordena primero, greedy después" ya están completos ahí. Este módulo aplica esa disciplina específicamente al estilo de observación escondida detrás de reglas de negocio que caracteriza al OA de Amazon 2026.

**Con `oa-2-prefix-sum`**: el patrón de state-reset de ese módulo **es**, en esencia, otro ejemplo de esta misma familia — una observación greedy (reiniciar exactamente cuando se viola la condición) probada por exchange argument. Reconocer que ambos módulos comparten la misma disciplina de fondo, aplicada a problemas de forma distinta, es exactamente el tipo de transferencia que acelera tu reconocimiento de patrones nuevos.

---

## Síntesis

1. El estilo "anti-LLM" esconde una observación matemática simple (frecuentemente paridad u orden) detrás de una regla de negocio — la dificultad está en encontrar la observación, no en el código.
2. Disciplina de dos pasos sin excepción: observa antes de codear, prueba (exchange argument o contraejemplo deliberado) antes de comprometerte.
3. Ajustes de paridad lexicográficamente mínimos se hacen en la posición más a la derecha posible, preservando el prefijo óptimo.
4. Problemas de "mínimo número de recursos para cubrir una demanda" casi siempre se resuelven ordenando descendente y tomando greedy el de mayor capacidad disponible.
5. La trampa más cara: un greedy no verificado que pasa el ejemplo del enunciado y falla en el juez completo.

---

## Lo que deberías poder hacer en 30 segundos

1. **Resistir el impulso de codear inmediatamente** — dedicar los primeros minutos a buscar la observación estructural.
2. **Articular la observación en una frase** antes de escribir cualquier código.
3. **Intentar un contraejemplo deliberado de 3-4 elementos** antes de comprometerte con la regla greedy.
4. **Reconocer paridad y orden descendente/ascendente** como las dos observaciones estructurales más comunes de esta familia.

---

## Fuentes

- `cp4-sorting-greedy` de esta misma colección — la plantilla completa de exchange argument y comparadores custom.
- Patrones de observación de paridad y asignación mínima de recursos — ampliamente documentados como estilo de diseño de problemas en assessments técnicos de la industria orientados a evaluar razonamiento antes que memorización de algoritmos.
