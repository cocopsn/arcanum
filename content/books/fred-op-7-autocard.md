---
module_id: fred-op-7-autocard
spine: FrED
path: Operativo
title: "AutoCard — síntesis de capability cards"
subtitle: "Generar contratos de seguridad en los que puedas confiar"
source_canonical: "Dossier AutoCard (Armando); modelo de capability cards (fred-op-4); ORION Bridge (fred-op-0 a fred-op-2)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 48
---

# AutoCard — síntesis de capability cards

> **Pregunta raíz.** Escribir una capability card a mano, dispositivo por dispositivo, funciona para el xArm y el par de PLCs que ya conoces bien — pero no escala a un laboratorio que va a integrar decenas de dispositivos nuevos, cada uno con su propio datasheet, su propio protocolo, sus propios límites físicos. **¿Cómo generas cards correctas y seguras automáticamente a partir de la documentación de un dispositivo, sin que un error de generación produzca una card que parezca razonable pero sea, en realidad, un agujero de seguridad?** Esta es exactamente la pregunta que define AutoCard, y su dificultad central no es técnica en el sentido de "es difícil de programar" — es epistémica: **¿cómo sabe el sistema, a sí mismo, qué tan seguro puede estar de que lo que acaba de generar es correcto?** Ese problema de auto-evaluación de confianza es el corazón intelectual de tu proyecto, y este módulo existe para que lo domines lo suficiente como para construirlo, no solo para entenderlo en abstracto.

## Prólogo — de dónde nace esto

Ya construiste, en el módulo anterior de esta ruta, el schema completo de una capability card y el validador determinista que la hace cumplir. Ese módulo asumía, implícitamente, que la card **ya existía** — escrita a mano, presumiblemente correcta. AutoCard es la pregunta que viene inmediatamente después: ¿de dónde sale esa card en primer lugar, cuando el dispositivo es nuevo y nadie la ha escrito todavía?

La respuesta ingenua —"dale la documentación del dispositivo a un LLM y pídele que genere la card"— tropieza exactamente con el mismo problema que motivó la existencia de las capability cards en primer lugar: un LLM es un sistema probabilístico, y pedirle que genere directamente un contrato de seguridad sin ningún mecanismo de verificación es exactamente el mismo error de categoría que pedirle que se autorregule en tiempo de ejecución. **La solución no es evitar usar generación probabilística — es envolverla en un proceso que se verifica a sí mismo antes de entregar su resultado**, análogo a un traductor que no solo traduce, sino que revisa su propia traducción contra el texto original antes de firmarla como confiable. Ese proceso de generación-más-autoevaluación es, precisamente, la arquitectura de tres etapas de tu dossier, y este módulo la deduce completa, etapa por etapa.

---

## 1. Por qué este problema es genuinamente difícil — la dificultad no es sintáctica

### 1.1 Generar una card con la forma correcta es fácil; generar una card correcta es el problema real

Pedirle a un LLM que produzca un JSON con la estructura del schema que ya construiste en el módulo anterior —`acciones_permitidas`, `envelope`, `requiere_estado`— es, en sí mismo, un problema resuelto: cualquier modelo moderno con generación estructurada puede producir un objeto sintácticamente válido casi siempre. **El problema no es la sintaxis — es si los números dentro de esa sintaxis son correctos.** Un envelope de `[-118, 120]` grados para el joint 2 de un xArm es sintácticamente indistinguible de un envelope de `[-200, 200]` grados para el mismo joint — ambos son JSON perfectamente válido, ambos pasan cualquier verificación de schema — pero solo uno de los dos es una declaración segura del límite físico real, y la diferencia entre ambos es exactamente donde vive el riesgo que ya identificaste en el módulo anterior: una card demasiado permisiva es un agujero disfrazado de mecanismo de seguridad.

### 1.2 La responsabilidad recae en el generador — y AutoCard ES el generador

Ya estableciste, en el módulo de capability cards, que la corrección de una card no es responsabilidad del validador — es responsabilidad de quien la genera. AutoCard **es** ese generador. Esto significa que todo el peso de la pregunta "¿por qué confiar en esta card?" recae directamente sobre la arquitectura que vas a construir este verano — no es un detalle de implementación secundario, es literalmente la pregunta de investigación central de tu proyecto.

---

## 2. La arquitectura de tres etapas — deducida desde el problema, verificada contra tu dossier

### 2.1 Por qué tres etapas, y no una generación directa

Si le pidieras a un LLM que, en un solo paso, leyera un datasheet y produjera una capability card final, estarías confiando en una sola pasada de generación sin ningún mecanismo de verificación intermedio — exactamente el error de categoría de la sección 1.1. La arquitectura de tu dossier descompone el problema en tres etapas **precisamente porque cada etapa reduce un tipo distinto de incertidumbre**, y esa descomposición es lo que permite insertar verificación explícita entre cada paso, en vez de confiar ciegamente en una generación monolítica.

### 2.2 Etapa 1 — Ingesta: de PDF a schema estructurado

**El problema que resuelve**: la documentación de un dispositivo (un datasheet, un manual como el del S7-1200 que ya usaste en el módulo anterior) es texto no estructurado, potencialmente de cientos de páginas, con la información relevante —protocolo de comunicación, comandos disponibles, parámetros con sus rangos, restricciones de seguridad declaradas explícitamente por el fabricante— dispersa entre secciones, tablas, y prosa. El objetivo de esta etapa es extraer esa información hacia una representación estructurada que las etapas siguientes puedan consumir mecánicamente.

**Por qué esto es delegable, según la política de tu propio dossier**: la extracción de schema desde texto no estructurado es un problema de ingeniería con técnicas ya establecidas (RAG sobre el documento, extracción de schema con generación estructurada) — es infraestructura de soporte, no el punto de novedad de tu contribución. Tu dossier es explícito sobre esto: si el componente **no cambia tu entendimiento del problema central** ni determina la confiabilidad del sistema, se delega. La ingesta produce un input mejor para las etapas siguientes, pero no es, en sí misma, donde vive la decisión de qué constituye una card segura — esa decisión vive en la Etapa 2.

### 2.3 Etapa 2 — El loop de exploración simulada: el corazón a mano

Aquí está la etapa que tu dossier declara explícitamente como el corazón intelectual del proyecto, y la razón es exactamente la misma que ya reconoces del principio general de esta ruta operativa: **es el componente que determina la confiabilidad del sistema completo**, así que tienes que escribirlo tú, línea por línea, para poder defenderlo de primer principio ante un revisor.

#### 2.3.1 La estrategia del twin — reutilizar antes de generar

La primera decisión de esta etapa, ya resuelta en tu dossier con una arquitectura híbrida: antes de generar un modelo de comportamiento del dispositivo desde cero, el sistema **busca activamente si ya existe un simulador reutilizable**. Para Arduino y ESP32, tu dossier confirma **Wokwi** como la elección — expone un CLI headless (`wokwi-cli`) diseñado explícitamente para integración continua, con soporte para `--timeout`, `--expect-text` (verificación de output esperado por Serial) y `--serial-log-file` (captura completa de log) — lo que permite validar hipótesis de comportamiento contra un simulador de ciclo de instrucción real, no una aproximación burda. Para PLC/Modbus, tu dossier reconoce que la madurez de simuladores abiertos (la familia OpenPLC y simuladores basados en pymodbus) es menor que la de Wokwi para timing físico real — razón explícita por la que ese tier es más probable que termine en el camino de generación en vez de reutilización.

**Por qué reutilizar antes de generar, deducido y no solo declarado**: un simulador ya construido y mantenido por una comunidad (Wokwi, en este caso) probablemente captura comportamiento del dispositivo con más fidelidad que cualquier cosa que puedas generar mecánicamente desde un datasheet en el tiempo disponible de un verano — pero **solo si genuinamente corresponde al dispositivo real que estás integrando**, no solo a "algo con el mismo nombre". Confiar ciegamente en un twin externo sin verificarlo sería exactamente el mismo error de confianza no verificada que toda esta arquitectura existe para prevenir — de ahí la necesidad del gate de la siguiente sección.

#### 2.3.2 El gate de verificación de twin — por qué es, literalmente, el mecanismo de confianza

Este es, según tu propio dossier, el primer de los cuatro componentes que codificas a mano, y la razón que tú mismo diste es exacta: **es el mecanismo que decide si confías en algo externo** — si no lo escribes tú, línea por línea, no vas vas a poder defender por qué el umbral es el que es cuando un revisor te lo pregunte.

El gate opera en dos pasos secuenciales:

**Paso A — Match rate**: compara el schema declarado por el twin candidato (los comandos que expone, sus rangos, sus unidades) contra lo que la Etapa 1 extrajo de la documentación real del dispositivo. Esto produce una medida numérica de qué tan bien coinciden ambas fuentes de información — el twin "dice" que existe un comando `move_joint` con rango `[-118,120]`; la documentación real dice lo mismo o dice algo distinto, y el match rate cuantifica esa distancia.

**Paso B — Sanity probes**: **solo si** el match rate del Paso A supera un umbral, el sistema ejecuta entre 3 y 5 comandos de bajo riesgo cuyo resultado esperado ya se conoce por la documentación (no comandos elegidos al azar — comandos específicamente seleccionados porque su output correcto ya es conocido de antemano), los corre contra el twin candidato, y compara el resultado obtenido contra el valor documentado. Esto verifica no solo que el twin **declara** el schema correcto (Paso A), sino que **se comporta** de acuerdo a ese schema cuando efectivamente se ejecuta (Paso B) — una distinción real, porque un twin podría declarar metadatos correctos sin que su simulación interna efectivamente los respete.

**Por qué dos pasos y no uno solo**: el Paso A es barato (comparación de metadatos estructurados, sin ejecutar nada) pero superficial (no verifica comportamiento real). El Paso B es más costoso (requiere ejecutar comandos reales contra el twin) pero verifica lo que realmente importa: comportamiento, no solo declaración. Ejecutar el Paso B **solo** si el Paso A ya pasó es una optimización de costo — no gastas el trabajo más caro en candidatos que ya fallaron la verificación más barata y rápida.

**El resultado del gate, y por qué "cae al camino de generación" en vez de fallar silenciosamente**: tu dossier es explícito en que un twin que no pasa ambos filtros **nunca se descarta silenciosamente ni se fuerza su uso** — simplemente cae al camino de generación de la sección 2.3.3, tratado como si no hubiera reutilización disponible. Esta es exactamente la misma disciplina de "fallar de forma explícita y visible, nunca silenciosa" que ya reconoces de las trampas de handlers y de sensores del módulo anterior — un twin rechazado no es un error del sistema, es el sistema funcionando exactamente como debería.

```python
# gate_verificacion_twin.py
# El primero de los cuatro componentes "a mano" del dossier de AutoCard.
# Fiel a la logica de dos pasos (match rate + sanity probes) descrita
# en la Etapa 2 del dossier real.

from dataclasses import dataclass
from typing import Callable

@dataclass
class ResultadoGate:
    twin_aceptado: bool
    match_rate: float
    sanity_probes_pasadas: int
    sanity_probes_totales: int
    razon: str


def calcular_match_rate(schema_extraido: dict, schema_twin: dict) -> float:
    """
    Compara el schema extraido en Etapa 1 contra el schema declarado
    por el twin candidato. Implementacion de referencia usando
    exact-match normalizado (la opcion recomendada en la decision
    abierta #1 del §9 del dossier -- ver seccion 3.1 de este modulo
    para la discusion completa de esta eleccion vs. embeddings).
    """
    comandos_extraidos = set(schema_extraido["acciones_permitidas"].keys())
    comandos_twin = set(schema_twin["acciones_permitidas"].keys())

    if not comandos_extraidos:
        return 0.0

    interseccion = comandos_extraidos & comandos_twin
    match_nombres = len(interseccion) / len(comandos_extraidos)

    # Overlap numerico de rango para cada comando en la interseccion:
    # que fraccion del rango declarado por la documentacion real
    # esta cubierta (sin exceder) por lo que el twin declara.
    scores_rango = []
    for accion in interseccion:
        params_doc = schema_extraido["acciones_permitidas"][accion].get("parametros", {})
        params_twin = schema_twin["acciones_permitidas"][accion].get("parametros", {})
        for nombre_param, spec_doc in params_doc.items():
            spec_twin = params_twin.get(nombre_param)
            if spec_twin is None or "envelope" not in spec_doc or "envelope" not in spec_twin:
                continue
            min_doc, max_doc = spec_doc["envelope"]
            min_twin, max_twin = spec_twin["envelope"]
            # Un twin que declara un rango MAS AMPLIO que el real es
            # peligroso (permitiria mas de lo seguro) -- penalizamos
            # eso mas fuerte que un rango mas ESTRECHO (solo pierde
            # cobertura, no introduce riesgo).
            if min_twin < min_doc or max_twin > max_doc:
                scores_rango.append(0.0)
            else:
                cobertura = (max_twin - min_twin) / (max_doc - min_doc) if max_doc != min_doc else 1.0
                scores_rango.append(cobertura)

    match_rango = sum(scores_rango) / len(scores_rango) if scores_rango else 1.0

    # Ponderacion simple; el peso relativo nombres/rango es EN SI
    # MISMO parte de la decision abierta de calibracion del §9 --
    # no un valor definitivo, un punto de partida a defender.
    return 0.5 * match_nombres + 0.5 * match_rango


def ejecutar_gate_verificacion(
    schema_extraido: dict,
    schema_twin: dict,
    ejecutar_probe: Callable[[str, dict], object],
    probes_conocidas: list[dict],
    umbral_match_rate: float = 0.9,
) -> ResultadoGate:
    """
    umbral_match_rate: NO fijado a priori segun el dossier (decision
    abierta #2 del §9) -- este 0.9 es un placeholder de arranque que
    Armando debe determinar empiricamente con los tres dispositivos
    del alcance de verano y reportar como parte de la metodologia,
    no como un numero elegido sin justificacion.
    """
    match_rate = calcular_match_rate(schema_extraido, schema_twin)

    if match_rate < umbral_match_rate:
        return ResultadoGate(
            twin_aceptado=False,
            match_rate=match_rate,
            sanity_probes_pasadas=0,
            sanity_probes_totales=len(probes_conocidas),
            razon=f"match_rate={match_rate:.3f} por debajo del umbral {umbral_match_rate}",
        )

    # Paso B: solo se ejecuta si el Paso A ya paso -- optimizacion
    # de costo explicita (seccion 2.3.2).
    pasadas = 0
    for probe in probes_conocidas:
        resultado_real = ejecutar_probe(probe["comando"], probe["parametros"])
        if resultado_real == probe["resultado_esperado_documentado"]:
            pasadas += 1

    aceptado = pasadas == len(probes_conocidas)   # exigencia estricta:
                                                     # TODAS las probes,
                                                     # otra decision a
                                                     # defender (por que
                                                     # no, digamos, 4/5)

    return ResultadoGate(
        twin_aceptado=aceptado,
        match_rate=match_rate,
        sanity_probes_pasadas=pasadas,
        sanity_probes_totales=len(probes_conocidas),
        razon="aceptado" if aceptado else f"solo {pasadas}/{len(probes_conocidas)} sanity probes pasaron",
    )
```

**Nota explícita en el código**: el umbral `0.9` y la exigencia de que **todas** las sanity probes pasen (no una mayoría) son decisiones que el código deja visibles y comentadas como pendientes de justificar — exactamente la disciplina que tu dossier exige en la decisión abierta #2 del §9: el umbral no se fija a priori, se determina empíricamente y se reporta como metodología, no como un hiperparámetro arbitrario que apareció de la nada.

#### 2.3.3 Generación de twin desde cero — la taxonomía de fidelidad de tu dossier

Si el gate rechaza cualquier twin candidato reutilizable, el sistema genera uno internamente. Tu dossier define una taxonomía de niveles de fidelidad creciente, con el alcance de este verano limitado explícitamente a los dos primeros:

**Nivel 0 — Contrato I/O simbólico**: una máquina de estados pura, sin ningún modelado de física real — captura únicamente qué secuencias de comandos son válidas y qué restricciones de rango existen, sin simular cómo el dispositivo físico realmente se comporta en el tiempo. Es el nivel de fidelidad más barato de generar, apropiado cuando lo que necesitas verificar es estructura de comandos válidos, no comportamiento dinámico real.

**Nivel 1 — Modelo de parámetros concentrados**: derivado **mecánicamente** de los campos numéricos que la Etapa 1 ya extrajo del datasheet (voltaje, corriente, tiempo de respuesta, resolución, tolerancia) — sin requerir modelado físico experto de primer principio. Es el nivel donde vive, según tu propio dossier, "la decisión de qué constituye una aproximación válida" — exactamente la razón por la que este generador específico es uno de los cuatro componentes que codificas a mano: la traducción de "estos números del datasheet" a "este modelo de comportamiento simulable" no es una operación mecánica trivial, es una decisión de ingeniería sobre qué aproximación es suficientemente fiel sin requerir la complejidad de una simulación física completa (Nivel 2, fuera del alcance de este verano).

### 2.4 Etapa 3 — Validación acotada contra el Bridge real

Una card generada y refinada a través del loop de la Etapa 2, aunque haya superado el gate de verificación de twin y el scoring de confianza (sección 3), sigue siendo una card que **nunca ha tocado hardware real**. La Etapa 3 es la validación final, contra el Bridge real (o un twin de fidelidad suficiente actuando como sustituto controlado), **antes** de que la card se considere lista para uso en producción — el mismo principio de "simulación para iteración, hardware físico para la validación final antes de producción" que ya estableciste en el módulo de arquitectura general del Bridge, aplicado aquí específicamente al proceso de generación de cards, no solo al desarrollo de handlers.

---

## 3. El scoring de confianza y el loop de refinamiento — el segundo componente a mano

### 3.1 Por qué necesitas un número, no solo un veredicto binario

El gate de verificación de twin (sección 2.3.2) produce un veredicto: aceptado o rechazado. Pero la card candidata en sí misma —una vez generada, sea vía twin reutilizado o generado— necesita algo más granular que "sí/no": un **score de confianza** continuo que capture qué tan seguro está el sistema de que cada pieza específica de la card (cada envelope, cada restricción de estado) es correcta. La razón de necesitar granularidad, no solo un veredicto global: una card puede tener 8 de 10 campos con alta confianza y 2 con confianza baja — tratar la card completa como "aceptada" o "rechazada" en bloque desperdicia la información de **cuáles** partes específicamente necesitan más refinamiento, en vez de descartar o aceptar todo indiscriminadamente.

### 3.2 Analogía: el score de confianza como un revisor interno

Piensa en un traductor profesional que, después de producir una traducción, no la entrega inmediatamente — la relee, marca mentalmente las frases donde está seguro de la interpretación y las que le generan duda (un modismo ambiguo, un término técnico sin equivalente claro), y para las dudosas, busca una segunda fuente o reformula antes de entregar. El score de confianza es exactamente ese proceso de auto-revisión, formalizado: no es que el generador "traduzca" el datasheet a una card y confíe ciegamente en el resultado — es que se **califica a sí mismo**, campo por campo, y usa esa calificación para decidir qué necesita otra pasada de refinamiento antes de considerar la card lista.

### 3.3 El loop de refinamiento — estructura general, deducida del problema

```python
# loop_refinamiento_confianza.py
# El segundo componente "a mano" del dossier -- el corazon
# intelectual del proyecto segun tu propia priorizacion en el §4.

from dataclasses import dataclass, field

@dataclass
class CampoConScore:
    valor: object
    score_confianza: float          # [0.0, 1.0]
    fuente: str                     # de donde vino este valor especifico
                                     # (ej. "datasheet pagina 42, tabla 3"
                                     # o "inferido, sin cita directa")

@dataclass
class CardCandidata:
    device_id: str
    campos: dict[str, CampoConScore] = field(default_factory=dict)
    iteracion: int = 0

    def score_global(self) -> float:
        """
        Como agregas scores individuales en un score global es, EN SI
        MISMO, una decision de diseno que tu dossier no fija --
        el minimo (mas conservador: la card es tan confiable como
        su campo mas debil) es un punto de partida defendible.
        """
        if not self.campos:
            return 0.0
        return min(c.score_confianza for c in self.campos.values())

    def campos_bajo_umbral(self, umbral: float) -> list[str]:
        return [nombre for nombre, campo in self.campos.items()
                if campo.score_confianza < umbral]


def calcular_score_campo(valor_generado, evidencia_documental: list[dict]) -> float:
    """
    Heuristica de referencia para asignar un score de confianza a UN
    campo especifico de la card, dada la evidencia documental
    recuperada de la Etapa 1 que lo respalda.

    Senales que un esquema de scoring razonable deberia combinar
    (cada una es, de nuevo, una decision a calibrar y defender):

    1. Presencia de cita directa: el valor aparece TEXTUALMENTE en
       una tabla o especificacion del documento fuente (alta
       confianza) vs. fue inferido por el LLM sin una cita directa
       localizable (confianza mas baja, por diseno).
    2. Consistencia entre multiples pasadas: si generas el mismo
       campo varias veces (con temperatura > 0, o con distintos
       fragmentos de contexto) y obtienes el mismo valor de forma
       consistente, eso es evidencia de estabilidad -- no de
       correctitud garantizada, pero SI de que no es un artefacto
       aleatorio de una sola generacion.
    3. Plausibilidad fisica: el valor cae dentro de rangos tipicos
       para ese tipo de dispositivo/parametro (un chequeo de cordura
       barato, no una prueba, pero util para atrapar errores obvios
       como un signo invertido o un orden de magnitud equivocado).
    """
    tiene_cita_directa = any(e.get("tipo") == "cita_directa" for e in evidencia_documental)
    num_fuentes_consistentes = sum(1 for e in evidencia_documental if e.get("valor") == valor_generado)

    score = 0.0
    if tiene_cita_directa:
        score += 0.6
    score += min(0.3, 0.1 * num_fuentes_consistentes)
    # ... mas senales aqui segun lo que la calibracion empirica muestre
    # que efectivamente correlaciona con correctitud verificada en la
    # Etapa 3, no solo lo que "suena razonable" a priori.

    return min(score, 1.0)


def refinar_card(card: CardCandidata, umbral_aceptacion: float, max_iteraciones: int,
                  funcion_regenerar_campo) -> CardCandidata:
    """
    El loop central: mientras existan campos por debajo del umbral
    y no se haya excedido el numero maximo de iteraciones, intenta
    regenerar especificamente esos campos (no la card completa --
    refinamiento dirigido, no fuerza bruta) usando contexto adicional
    o una estrategia de generacion distinta.
    """
    while card.iteracion < max_iteraciones:
        debiles = card.campos_bajo_umbral(umbral_aceptacion)
        if not debiles:
            break   # todos los campos superan el umbral: card lista

        for nombre_campo in debiles:
            nuevo_valor, nueva_evidencia = funcion_regenerar_campo(nombre_campo, card)
            nuevo_score = calcular_score_campo(nuevo_valor, nueva_evidencia)
            card.campos[nombre_campo] = CampoConScore(
                valor=nuevo_valor, score_confianza=nuevo_score,
                fuente=str(nueva_evidencia),
            )

        card.iteracion += 1

    return card
```

**Por qué el refinamiento es dirigido (solo los campos débiles) y no una regeneración completa en cada iteración**: regenerar toda la card desde cero en cada pasada desperdicia el trabajo ya confiable de los campos que **ya** superaron el umbral, y además reintroduce el riesgo de que una nueva generación completa produzca, por azar, un valor peor en un campo que antes estaba bien — el refinamiento dirigido preserva lo que ya funciona y concentra el esfuerzo (y el riesgo de una nueva generación) exactamente donde la confianza todavía es insuficiente.

**El límite de iteraciones máximas no es cosmético**: sin él, un campo genuinamente ambiguo en la documentación (información contradictoria, o simplemente ausente) podría hacer que el loop nunca converja, consumiendo recursos indefinidamente. Un límite máximo, combinado con reportar honestamente "este campo nunca superó el umbral tras N intentos" (en vez de forzar un valor de baja confianza silenciosamente hacia la card final), es la disciplina de fallar explícitamente que ya reconoces como principio recurrente de toda esta ruta operativa — tu métrica de "iteraciones hasta convergencia" del §8 de tu dossier depende exactamente de tener este límite instrumentado y medido, no solo presente.

---

## 4. Las decisiones abiertas del §9 — armándote para defenderlas, no resolviéndolas por ti

Tu dossier declara estas decisiones explícitamente como **pendientes antes de escribir código** — este módulo no te las va a resolver, porque resolverlas es precisamente el trabajo intelectual que un revisor va a evaluar. Lo que sí puede hacer es darte el marco de razonamiento completo para cada una, de forma que puedas tomar una decisión informada y defenderla con argumentos, no con una elección arbitraria.

### 4.1 Match rate: exact-match normalizado vs. embeddings semánticos

**La pregunta real**: cuando comparas el nombre de un comando extraído de la documentación (`"move_joint"`) contra el nombre que un twin candidato declara (`"MoveJoint"`, o `"set_joint_angle"`, semánticamente equivalente pero léxicamente distinto), ¿cómo decides que "coinciden"?

**Exact-match normalizado** (la recomendación de arranque de tu propio dossier): normalizas ambos strings (minúsculas, sin guiones bajos/espacios) y comparas igualdad exacta tras la normalización. **Ventaja, ya identificada en tu dossier**: determinístico y auditable — puedes mostrarle a un revisor exactamente por qué dos comandos "coincidieron" o no, con una regla simple y verificable. **Desventaja**: frágil ante variación léxica genuina que un humano reconocería como equivalente sin dificultad (`"move_joint"` vs. `"set_joint_angle"` no normalizan a la misma cosa, aunque describan la misma acción).

**Embeddings semánticos**: en vez de comparar strings normalizados, comparas la similaridad vectorial de sus representaciones semánticas — captura equivalencia de significado incluso con vocabulario distinto. **Ventaja**: más flexible, potencialmente atrapa coincidencias reales que exact-match perdería. **Desventaja, y es una desventaja seria para este contexto específico**: la similaridad de embeddings es, ella misma, una medida continua sin un punto de corte naturalmente correcto, y **no es trivialmente auditable** — explicarle a un revisor exactamente por qué dos comandos obtuvieron una similaridad de 0.87 y no 0.75 es mucho más difícil que explicar una comparación de igualdad de string. Para un mecanismo cuya función completa es servir como gate de seguridad defendible, la falta de auditabilidad no es un detalle menor.

**Cómo defender tu elección, no solo declararla**: la recomendación de arranque de tu propio dossier (exact-match) prioriza auditabilidad sobre flexibilidad — una elección coherente con el hecho de que este es, precisamente, el mecanismo que decide si confías en algo externo para un sistema de seguridad física. Si tras las primeras pruebas con Arduino/ESP32 descubres que exact-match rechaza demasiados twins genuinamente equivalentes por variación léxica trivial, la evolución natural no es saltar directamente a embeddings puros, sino considerar un paso intermedio (normalización más agresiva, un diccionario de sinónimos curado manualmente para el vocabulario específico de tu dominio) antes de sacrificar la auditabilidad completa que embeddings implica — pero esa es, precisamente, la decisión empírica que tu dossier deja abierta para resolverse con evidencia real, no en abstracto.

### 4.2 El umbral del match rate — por qué no se fija a priori

Ya lo viste en el código de la sección 2.3.2: el umbral `0.9` está marcado explícitamente como placeholder. Tu dossier es preciso sobre por qué: el umbral correcto depende de la distribución real de match rates que observes al correr el gate contra los tres dispositivos de tu alcance de verano (Arduino, ESP32, PLC) — fijarlo antes de tener esos datos sería elegir un número sin ninguna base empírica, precisamente el tipo de decisión que un revisor exigente cuestionaría de inmediato ("¿por qué 0.9 y no 0.8 o 0.95?"). **La disciplina correcta, ya implícita en tu propio dossier**: corre el gate contra los tres dispositivos, observa la distribución real de match rates entre twins que sabes (por verificación manual) que son genuinamente correctos vs. los que no, y elige el umbral que separa mejor esas dos poblaciones — reportando esa metodología empírica como parte de tu contribución, no como un hiperparámetro arbitrario enterrado en el código.

### 4.3 Cómo validas sin arriesgar hardware — la disciplina detrás de la Etapa 3

La pregunta de "cómo pruebas una card generada sin arriesgar el dispositivo físico real si la card resulta estar mal" tiene una respuesta estructural, no una respuesta de un solo truco: **es exactamente la razón de ser de la arquitectura de tres etapas completa**. La Etapa 2 (exploración simulada, gate de verificación de twin, scoring de confianza) existe precisamente para acumular evidencia de corrección **antes** de que la card se acerque a hardware real. La Etapa 3, cuando finalmente toca hardware o un twin de fidelidad suficiente, debería operar con el mismo principio de **capability restringida** que ya construiste en el módulo de capability cards — las sondas de validación de la Etapa 3 deberían ser, ellas mismas, comandos de bajo riesgo y bien acotados (análogos a las sanity probes del gate de twin), no una prueba abierta de "ejecuta lo que la card permite y observa qué pasa" contra hardware real sin ningún límite adicional de seguridad. La métrica de tu propio dossier —"tasa de violación de seguridad durante exploración debe ser exactamente cero, por diseño"— no es una aspiración, es un requisito de arquitectura: la exploración nunca debería tener, estructuralmente, un camino que toque hardware real sin pasar primero por el gate de confianza y el Bridge.

### 4.4 El soft-PLC para Tier 3 — una decisión genuinamente pendiente de evaluación práctica

A diferencia de las decisiones anteriores, donde tu dossier ya da una recomendación de arranque razonada, la elección de simulador Modbus/soft-PLC para el Tier 3 (OpenPLC vs. alternativas) está declarada como pendiente de evaluación práctica una vez que el equipo llegue a esa fase — no hay todavía suficiente información para razonar la elección con el mismo rigor que las decisiones 4.1-4.3. Vale la pena reconocer esto explícitamente como una diferencia de **naturaleza** entre las decisiones abiertas: algunas (match rate, umbral) son preguntas de diseño que puedes razonar desde principios generales incluso antes de tener datos completos; otras (qué simulador específico) son preguntas que genuinamente requieren evaluación práctica comparativa antes de poder argumentar una elección informada — reconocer la diferencia es, en sí mismo, parte de la madurez de ingeniería que un revisor va a notar.

---

## 5. Edge cases y trampas explícitas

### 5.1 Una card que "parece" correcta pero tiene un envelope peligroso — por qué el scoring importa

Este es exactamente el escenario que motivó la sección 1.1: una card sintácticamente perfecta, con todos los campos presentes y con el formato correcto, puede tener un envelope numéricamente incorrecto sin que ninguna verificación de schema lo detecte — solo el scoring de confianza (¿qué evidencia documental respalda específicamente este número?) y la validación contra el Bridge real (¿el hardware real se comporta consistentemente con este envelope?) pueden atrapar este tipo de error. Es la razón exacta de que "parece correcta" y "es correcta" sean, en este dominio, dos afirmaciones completamente distintas, y de que el scoring de confianza exista específicamente para no confundirlas.

### 5.2 Documentación ambigua o incompleta del dispositivo

Un datasheet real puede tener información contradictoria entre secciones (un valor en la tabla de especificaciones que no coincide con un valor mencionado en el texto narrativo), o simplemente omitir información necesaria (un rango de operación seguro que el fabricante nunca especificó explícitamente, dejándolo implícito o ausente). El sistema de scoring, si está bien calibrado, debería reflejar esta ambigüedad con un score bajo para el campo afectado — **nunca debería "rellenar" silenciosamente un valor plausible sin evidencia documental real y reportarlo con la misma confianza que un valor con cita directa**. Esta es exactamente la trampa que la señal de "presencia de cita directa" del código de la sección 3.3 existe para prevenir — un valor inferido sin respaldo documental explícito debe, por diseño, recibir menos confianza que uno con evidencia textual directa, sin importar qué tan "razonable" parezca el valor inferido.

### 5.3 El riesgo de confiar en una card no validada — por qué la Etapa 3 no es opcional

Una card que superó el gate de verificación de twin y el loop de refinamiento de confianza ha acumulado evidencia sustancial de corrección — pero **ninguna de esas dos etapas involucró al hardware real**. Saltarse la Etapa 3 y desplegar una card directamente tras la Etapa 2, aunque su score de confianza global sea alto, reintroduce exactamente el riesgo que toda la arquitectura existe para mitigar: la confianza acumulada en simulación, sin importar qué tan rigurosa, no es sustituto de verificación contra la realidad física — el mismo principio, ya establecido repetidamente en esta ruta, de que simulación es para iteración rápida y segura, pero la validación final antes de producción necesita tocar (de forma acotada y controlada) el sistema real.

### 5.4 Sobre-confianza del generador — la calibración del score es, en sí misma, un problema abierto

Aquí hay una trampa más sutil y más profunda que las anteriores: un sistema de scoring mal calibrado puede ser **sistemáticamente sobre-confiado** — asignar scores altos a campos que, en verificación posterior contra hardware real, resultan estar mal con más frecuencia de lo que el score alto sugeriría. Esto no es un bug de implementación específico, es un problema de **calibración estadística**: un score de confianza de 0.9 debería significar, idealmente, que aproximadamente el 90% de los campos con ese score resultan correctos cuando se verifican — si en la práctica solo el 60% resulta correcto, el sistema está sobre-confiado, y esa sobre-confianza es peligrosa precisamente porque **se disfraza de certeza** en vez de anunciarse como incertidumbre. La única forma real de detectar y corregir esto es exactamente la métrica que tu dossier ya declara en el §8: comparar sistemáticamente el score de confianza asignado contra el resultado real de la Etapa 3 (¿el campo con score 0.9 efectivamente pasó la validación física?), acumulando suficientes casos para poder hablar de calibración real, no solo de intuición sobre si el número "se siente" razonable.

### 5.5 Qué pasa si AutoCard genera una card para un dispositivo que puede dañar algo

Esta pregunta no tiene una respuesta puramente técnica dentro de AutoCard mismo — conecta directamente con la disciplina de margen de seguridad que ya estableciste en el módulo de capability cards (sección 5.1 de ese módulo): incluso una card que pasó todas las verificaciones de esta arquitectura debería, por defecto, declarar envelopes conservadores respecto al límite físico absoluto documentado, no el límite exacto. AutoCard, como generador automático, hereda esa misma responsabilidad explícitamente — el margen de seguridad no es algo que decidas caso por caso al final, es una política que el generador debería aplicar sistemáticamente (por ejemplo, reducir automáticamente un envelope extraído directamente del datasheet por un porcentaje de margen configurable) antes de que cualquier card, sin importar su score de confianza, se considere lista para la Etapa 3.

---

## 6. Trade-offs explícitos

**Automatización vs. seguridad**: el valor completo de AutoCard es eliminar el cuello de botella de escribir cards manualmente para cada dispositivo nuevo — pero cada grado de automatización adicional (menos verificación humana en el loop, umbrales más permisivos, menos sanity probes) acelera el proceso a costa de reducir la evidencia acumulada de corrección antes de que una card se considere lista. No hay una resolución universal de este trade-off — es exactamente el mismo tipo de decisión de costo relativo que ya viste con `contamination` en el módulo de ML y con el envelope de capability cards: depende de qué tan caro es, en tu contexto específico, un falso positivo (una card generada incorrectamente que pasa como confiable) contra un falso negativo (rechazar una card genuinamente correcta y exigir trabajo manual innecesario).

**Umbral de confianza alto (pocas cards, seguras) vs. bajo (muchas cards, riesgosas)**: un umbral de aceptación muy exigente en el loop de refinamiento (sección 3.3) produce cards en las que puedes confiar más, pero puede rechazar campos que en realidad eran correctos simplemente porque la evidencia documental era escasa o el fenómeno de calibración de la sección 5.4 estaba subestimando la confianza real — el mismo trade-off de falsos positivos/negativos, aplicado aquí a la decisión de "¿esta card ya está lista?" en vez de a la detección de una anomalía física.

**Exact-match vs. embeddings**: ya desarrollado completo en la sección 4.1 — auditabilidad y determinismo vs. flexibilidad semántica, con la recomendación de arranque de tu dossier priorizando lo primero por la naturaleza de seguridad crítica del mecanismo.

**Validar en simulación vs. hardware real**: simulación (Wokwi, o los niveles 0/1 de generación de twin) es rápida, segura, y repetible — apropiada para las etapas tempranas del loop de refinamiento, donde vas a iterar muchas veces. Hardware real es lento, tiene riesgo físico real, y no es trivialmente repetible sin desgaste — apropiado únicamente para la validación final de la Etapa 3, donde el objetivo no es iterar rápido sino confirmar, con la máxima fidelidad posible, que la card generada efectivamente se comporta como se espera contra la realidad que finalmente importa.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico del dossier citado arriba.)*

**El patrón "genera + verifica" que la propia Arcanum ya usa con contenido de IA.** Reconoce esto directamente: cuando Arcanum genera contenido educativo asistido por IA (los mini-libros de esta misma serie, por ejemplo), el patrón correcto —el que tú mismo has insistido en aplicar a lo largo de esta serie completa, con las notas explícitas de "honestidad de anclaje" cada vez que un dato no pudo verificarse contra fuente real— es exactamente el mismo principio que AutoCard formaliza para capability cards: **nunca confiar ciegamente en una generación de IA sin un mecanismo explícito de verificación contra una fuente de verdad**, ya sea un manual real (como hiciste en el módulo de Modbus/PLC), un README verificado (como en los módulos de arquitectura del Bridge), o, aquí, un gate de verificación de twin y validación contra hardware real. Reconocer que ya has estado aplicando este principio, en un dominio distinto, a lo largo de toda esta serie de módulos, es evidencia directa de que entiendes el principio general lo suficientemente bien como para formalizarlo en código para AutoCard.

**LLMs como generadores con incertidumbre — por qué el scoring de confianza es un problema abierto y profundo, conectado con DEPAS.** El problema de "¿cómo un sistema generativo sabe, de forma calibrada y no sobre-confiada, qué tan seguro puede estar de lo que acaba de generar?" no es un problema resuelto en la literatura de machine learning — es un área de investigación activa (calibración de modelos, cuantificación de incertidumbre, self-consistency checking), y tu trabajo en AutoCard es, en efecto, una instancia aplicada y acotada de ese problema general, en el dominio específico de generación de contratos de seguridad para hardware físico. Esto conecta directamente con tu programa de investigación DEPAS (Dynamic Endogenous Persistent Agency Systems): la pregunta de qué precondiciones arquitectónicas permiten que un sistema computacional mantenga una noción confiable de su propia incertidumbre a lo largo de un proceso extendido de decisión —no solo generar una respuesta, sino saber cuándo esa respuesta necesita más verificación antes de actuar sobre ella— es, en esencia, la misma pregunta de fondo que el scoring de confianza de AutoCard responde en miniatura, para un dominio acotado y con una definición de "correcto" externamente verificable (el hardware real). AutoCard, en ese sentido, no es solo un proyecto de verano aislado — es un caso de estudio concreto y con datos reales sobre exactamente el tipo de pregunta que tu investigación de más largo plazo está explorando de forma más general.

**Human-in-the-loop — dónde encaja el juicio humano en esta arquitectura.** Ninguna etapa de esta arquitectura elimina completamente la necesidad de juicio humano — la Etapa 1 delega parsing pero no la decisión de qué constituye información de seguridad relevante; la Etapa 2 automatiza generación y verificación pero deja explícitamente pendientes las decisiones de calibración del §9 para que **tú** las razones y defiendas; la Etapa 3 exige, en la práctica, que un humano supervise la primera validación contra hardware real de cualquier card nueva, sin importar qué tan alto sea su score de confianza acumulado. Esto no es una limitación temporal de la versión actual del sistema — es, argumentablemente, una propiedad de diseño correcta y permanente para un sistema que genera contratos de seguridad sobre hardware físico: el objetivo de AutoCard no es eliminar el juicio humano del proceso, es **reducir drásticamente cuánto trabajo manual repetitivo se necesita** para llegar al punto donde ese juicio humano final, más informado y mejor dirigido por las métricas de confianza acumuladas, puede aplicarse eficientemente.

---

## Síntesis — el mapa mental

1. El problema central de AutoCard no es sintáctico (generar JSON con la forma correcta es fácil) — es epistémico: cómo el sistema sabe, de forma auto-evaluada y no sobre-confiada, qué tan correcta es la card que acaba de generar.
2. La arquitectura de **tres etapas** (ingesta → exploración simulada con gate de twin y refinamiento de confianza → validación acotada contra el Bridge real) descompone el problema en fases donde cada una reduce un tipo distinto de incertidumbre, permitiendo verificación explícita entre cada paso.
3. **Etapa 1 (ingesta)** es delegable — infraestructura estándar de extracción de schema, no el punto de novedad de tu contribución.
4. **Etapa 2** es el corazón a mano, con dos componentes específicos que codificas tú: el **gate de verificación de twin** (match rate + sanity probes, en ese orden por costo) y el **loop de refinamiento con scoring de confianza** (refinamiento dirigido a campos débiles, no regeneración completa, con límite de iteraciones explícito).
5. La estrategia de **twin híbrida** (reutilizar si existe y verifica; generar Nivel 0 o Nivel 1 si no) evita tanto confiar ciegamente en simuladores externos como reinventar modelado físico completo cuando no es necesario.
6. **Etapa 3** valida contra hardware real de forma acotada — ninguna cantidad de confianza acumulada en simulación sustituye esta verificación final.
7. Las **decisiones abiertas del §9** (match rate, umbral, soft-PLC para Tier 3) no son preguntas retóricas — son exactamente lo que un revisor va a examinar, y tu dossier ya te da recomendaciones de arranque razonadas (exact-match, umbral empírico) que puedes defender con argumentos de auditabilidad y determinismo, mientras dejas explícitamente abierta la evidencia empírica que falta.
8. El riesgo de **sobre-confianza del generador** (un score de 0.9 que en realidad solo acierta 60% de las veces) es un problema de calibración estadística, no solo de implementación — solo se detecta comparando sistemáticamente el score asignado contra el resultado real de validación en la Etapa 3, la misma métrica que tu dossier ya declara en el §8.

---

## Preguntas que deberías poder responder

*(Estas son, deliberadamente, de defensa — ante el equipo ORION y ante ti mismo, porque este es tu proyecto central del verano.)*

1. Explica por qué generar una capability card sintácticamente válida es un problema resuelto, mientras que generar una card **correcta** es el problema real de investigación de AutoCard — ¿qué distingue ambas afirmaciones con un ejemplo concreto?
2. Defiende, con argumentos (no solo con la preferencia declarada en tu dossier), por qué exact-match normalizado es la elección de arranque razonable para el match rate del gate de verificación de twin, y bajo qué evidencia empírica reconsiderarías moverte hacia embeddings.
3. ¿Por qué el umbral del match rate no se fija a priori? Describe el procedimiento empírico concreto que usarías con los tres dispositivos de tu alcance de verano para determinarlo y justificarlo ante un revisor.
4. Explica por qué el gate de verificación de twin ejecuta el Paso A (match rate) antes que el Paso B (sanity probes), y no al revés o simultáneamente — ¿qué principio de costo computacional justifica ese orden específico?
5. ¿Por qué el loop de refinamiento de confianza regenera solo los campos por debajo del umbral, en vez de regenerar la card completa en cada iteración? ¿Qué se perdería con el enfoque de regeneración completa?
6. Explica la diferencia entre "un score de confianza alto" y "un score de confianza bien calibrado" — ¿cómo detectarías, con datos reales de tu propio sistema, si tu scoring está sistemáticamente sobre-confiado?
7. ¿Por qué la Etapa 3 (validación contra el Bridge real) no es opcional, incluso para una card con score de confianza global muy alto tras la Etapa 2? Conecta tu respuesta con el principio de simulación-vs-hardware-real ya establecido en módulos anteriores de esta ruta.
8. Describe, en tus propias palabras, la conexión estructural entre el problema de scoring de confianza de AutoCard y la pregunta más general de cuantificación de incertidumbre en sistemas generativos — ¿por qué esta conexión hace que tu trabajo de verano sea relevante más allá del alcance específico de tres dispositivos de FrED Factory?

---

## Fuentes

- Dossier técnico de AutoCard (Armando Flores Salazar, proyecto central del Physical AI Summer Internship, FrED Factory / MIT.nano, verano 2026) — fuente primaria de este módulo. La arquitectura de tres etapas, la política de codificación a mano vs. delegada del §4, la taxonomía de niveles de fidelidad de twin (0/1/2), las métricas de evaluación del §8, y las tres decisiones abiertas del §9 fueron recuperadas y verificadas contra el contenido real de ese dossier, discutido y refinado en trabajo previo de coautoría técnica con este mismo asistente.
- El modelo de capability cards y su schema, construidos en `fred-op-4-capability-cards` de esta misma serie — la estructura que AutoCard genera y a la que este módulo se ancla directamente.
- La arquitectura del ORION Bridge (`fred-op-0-bridge` a `fred-op-2-dispatcher`) — el sistema contra el que las cards generadas se validan en la Etapa 3.
- Wokwi (wokwi.com) y su CLI headless (`wokwi-cli`), confirmado en el dossier como el simulador reutilizable para los tiers Arduino/ESP32 del alcance de verano.
