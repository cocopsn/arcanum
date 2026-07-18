---
module_id: fred-op-4-capability-cards
spine: FrED
path: Operativo
title: "Capability Cards — el contrato de seguridad"
subtitle: "Cómo le pones límites a un robot que un LLM comanda"
source_canonical: "ORION platform docs (equipo); orion-bridge-v2 (validación)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Capability Cards — el contrato de seguridad

> **Pregunta raíz.** Le puedes decir a un LLM, en su prompt, "nunca muevas el eje más allá de 90 grados" — y la mayoría de las veces va a respetarlo. Pero "la mayoría de las veces" es exactamente la garantía que un sistema que mueve hardware real no puede aceptar, porque ya estableciste en el módulo de arquitectura general del Bridge que un modelo probabilístico tiene, siempre, una probabilidad no nula de generar algo que se desvía de la instrucción, sin importar qué tan bien redactada esté. **¿Cómo declaras los límites de lo que un dispositivo puede hacer de una forma que un componente que NO alucina pueda verificar mecánicamente, sin depender en absoluto de que el LLM haya "entendido" o "decidido respetar" esos límites?** Esa declaración — estructurada, explícita, verificable por código convencional — es la capability card. Este módulo la construye desde el principio de seguridad que la exige, no desde una lista de campos que memorizas.

> **Nota de honestidad de anclaje, antes de empezar.** Este módulo razona desde el modelo de amenaza y el flujo de arquitectura documentados por el equipo ORION (intent → capability card → validation → protocolo → hardware, ya visto en `fred-op-0-bridge`), que sí están anclados a fuente verificable. La taxonomía específica de "tres tipos de capability card" y el schema exacto de campos del dossier interno de AutoCard **no pudieron verificarse contra ninguna fuente pública accesible durante la investigación de este módulo** — no aparecen en el README público del repositorio, y no tengo acceso a documentación interna del equipo más allá de lo que se me ha descrito. Lo que sigue es una construcción **rigurosa y deducida desde primer principio** de qué campos un schema de capability card necesitaría, dado el modelo de seguridad ya establecido — no una transcripción del dossier real de AutoCard. Donde el texto describe "los tres tipos", lo hace como una categorización razonada por tipo de restricción (discreta, continua, secuencial), útil para tu propio diseño, pero debes verificarla contra el dossier real del equipo antes de asumir que los nombres o la estructura exacta coinciden.

## Prólogo — de dónde nace esto

Piensa en la diferencia entre decirle a un empleado nuevo "por favor sé cuidadoso con la caja fuerte" y darle una llave que **físicamente** solo abre el cajón de suministros de oficina, no la caja fuerte. La primera es una instrucción que depende de que el empleado la recuerde, la entienda correctamente, y elija seguirla — puede fallar por mil razones humanas, ninguna de ellas necesariamente maliciosa. La segunda es una restricción **estructural**: no importa qué instrucción reciba el empleado, qué tan confundido esté, o qué tan mal día tenga — físicamente no puede abrir la caja fuerte con esa llave, porque el mecanismo mismo se lo impide, no su buena voluntad.

La capability card es la decisión de construir la segunda opción, no confiar en la primera. En vez de "pedirle" al LLM que se comporte dentro de límites, le das —a través del Bridge, nunca directamente al LLM— exactamente la información de qué es posible, y luego, **de forma completamente independiente de si el LLM "entendió" esa información o no**, un componente determinista verifica mecánicamente cada propuesta contra esos límites antes de que toque el hardware. Esto es exactamente el principio de **capability-based security**, un concepto con décadas de historia en el diseño de sistemas operativos seguros (retomado en Conexiones), aplicado aquí al problema específico de que el "sujeto" que necesitas restringir no es un proceso de software convencional, sino un modelo generativo probabilístico.

---

## 1. Por qué "pedirle amablemente al LLM" no es seguridad — el modelo de amenaza

### 1.1 El error de categoría: confundir instrucción con restricción

Un prompt que dice "solo mueve el eje entre 0 y 90 grados" es una **instrucción** — información que el LLM procesa como parte de su contexto, con la misma naturaleza estadística que cualquier otro texto que procesa. No hay ningún mecanismo, dentro de la arquitectura de un modelo generativo, que **garantice** que la salida numérica que produce después de leer esa instrucción vaya a respetarla — el modelo genera el token más probable dado su contexto, y "más probable" no es lo mismo que "matemáticamente restringido a un rango". Ya estableciste esto con rigor en el módulo de arquitectura general: la alucinación estructural no es un fallo de "no entender" la instrucción — es una propiedad estadística inherente al mecanismo generativo, que ninguna cantidad de buen prompting reduce a cero.

### 1.2 El modelo de amenaza no requiere malicia — el punto que se malinterpreta con más frecuencia

Aquí hay una distinción importante que hay que dejar completamente clara: el modelo de amenaza de la capability card **no asume que el LLM es adversarial** — no estás defendiéndote de un atacante inteligente tratando deliberadamente de romper el sistema (aunque, como viste en el módulo de arquitectura general, ese escenario también existe y la misma defensa lo cubre). Estás defendiéndote de algo más básico y más inevitable: **un sistema que genera la respuesta estadísticamente plausible, no la respuesta verificadamente correcta**, y que por lo tanto, con una frecuencia baja pero no nula, va a proponer algo fuera de lo que pediste — no porque "quiera" hacerlo, sino porque ese es el comportamiento esperado de cualquier proceso generativo probabilístico operando en el límite de su distribución de confianza. La capability card existe para el caso benigno-pero-inevitable tanto como para el caso adversarial — y de hecho, diseñarla correctamente para el primero automáticamente la hace efectiva contra el segundo, porque ambos casos se manifiestan de la misma forma observable: una propuesta que no coincide con lo permitido.

### 1.3 La consecuencia de diseño: la restricción tiene que ser DECLARATIVA, no imperativa

Si la validación no puede depender de que el LLM "decida" respetar un límite, tiene que existir **independientemente** de cualquier decisión del LLM — como un dato estructurado que un componente determinista (el Bridge) puede leer y verificar mecánicamente, sin ninguna interpretación de lenguaje natural involucrada en el acto de verificación misma. Esto es exactamente lo que significa que la capability card sea **declarativa**: no es una instrucción ("no hagas X") dirigida a un agente que decide si obedecer — es una **declaración de hechos verificables** ("el rango válido del eje 1 es [0, 90] grados") que un validador puede comparar contra un número propuesto con una simple comparación aritmética, sin ninguna ambigüedad de interpretación posible.

---

## 2. Capability-based security — el principio general detrás de la card

### 2.1 El concepto, deducido desde "qué prueba necesitas de que algo está permitido"

En sistemas de seguridad en general, hay dos formas fundamentalmente distintas de decidir si una acción está permitida: **listas de control de acceso (ACL)** — el sistema mantiene, en algún lugar central, una tabla de "quién puede hacer qué", y verifica esa tabla en cada intento de acción; y **capabilities** — en vez de una tabla central que se consulta, **el permiso mismo es un objeto/token que posees**, y poseerlo **es** la prueba de autorización, sin necesidad de consultar ninguna tabla externa en el momento de actuar.

**La analogía que hace esto tangible**: una llave física es una capability. Si tienes la llave específica de un cuarto, puedes abrir ese cuarto — el mecanismo de la cerradura no "consulta una lista" de quién tiene permiso, simplemente verifica si la llave que insertaste tiene la forma correcta. Una llave maestra que abre todo es el extremo opuesto y peligroso de este espectro: en vez de credenciales específicas y acotadas para cada necesidad, un solo objeto que otorga acceso irrestricto — exactamente el mismo problema de diseño que ya reconociste en el módulo de arquitectura general cuando comparaste `anon_key` (una llave específica, acotada por políticas) contra `service_role` (la llave maestra que salta todas las restricciones).

**Cómo esto se traduce a la capability card del Bridge**: la card **es** la credencial — no un permiso genérico "puedes controlar este dispositivo", sino una declaración específica y acotada de exactamente qué acciones, con qué parámetros, dentro de qué rangos. El Bridge, al validar, no está "decidiendo" si algo está permitido basado en juicio — está verificando mecánicamente si la propuesta cae dentro de lo que la credencial específica (la card de este dispositivo, en este momento) autoriza explícitamente. Esto es exactamente **privilegio mínimo aplicado a nivel de esquema de datos**: cada card declara solo lo que ese dispositivo específico, en su estado actual, puede hacer de forma segura — nunca "todo lo que técnicamente el hardware podría hacer si se le diera un comando arbitrario".

---

## 3. El schema de una capability card — deducido campo por campo

### 3.1 Qué información necesita el Bridge para poder validar mecánicamente

Retrocede a la sección 1.3: el validador necesita comparar una propuesta concreta (una acción con parámetros específicos) contra una declaración de qué es válido. Para que esa comparación sea posible sin ambigüedad, la card necesita declarar, como mínimo, tres categorías de información — y cada una existe porque responde una pregunta distinta que el validador tiene que poder resolver:

**1. Qué acciones existen — el vocabulario permitido.** Una lista explícita y cerrada de identificadores de acción válidos para este dispositivo (por ejemplo, `move_joint`, `home`, `stop` para un brazo robótico) — nunca un campo de texto libre que el LLM pueda rellenar con cualquier string. Esto responde la pregunta "¿esta acción propuesta siquiera existe en el vocabulario de este dispositivo?" — el primer filtro, y el más simple: si la acción propuesta no está en esta lista, se rechaza inmediatamente, sin necesidad de evaluar ningún parámetro.

**2. Los parámetros esperados por cada acción, y su envelope (rango válido).** Para cada acción del vocabulario, qué parámetros necesita, y para cada parámetro numérico, el rango físicamente seguro — no el rango que el hardware técnicamente tolera antes de romperse, sino el rango que el equipo ha determinado como **seguro para operación normal**, típicamente con margen de seguridad respecto al límite físico absoluto. Esto responde la pregunta "dado que la acción es válida, ¿estos parámetros específicos están dentro de lo seguro?"

**3. Restricciones de estado — cuándo una acción, aunque en el vocabulario y con parámetros válidos, NO es segura ahora mismo.** Algunas acciones son inseguras no por sus parámetros, sino por el **momento** en que se proponen — mover un eje mientras el dispositivo todavía está ejecutando un movimiento anterior, o mientras está en un estado de error no reconocido. Esto responde la pregunta "¿es seguro ejecutar esto AHORA, dado el estado actual reportado por `get_status()` del handler (ya visto en el módulo de dispatcher)?"

### 3.2 Una construcción razonada del schema — no el dossier real, una deducción rigurosa

```json
{
  "device_id": "xarm-lab1",
  "device_type": "xarm",
  "handler": "physical",
  "issued_at": "2026-07-17T10:00:00Z",

  "acciones_permitidas": {
    "move_joint": {
      "descripcion": "Mueve una articulacion especifica a un angulo objetivo",
      "parametros": {
        "joint_id": {
          "tipo": "entero",
          "valores_permitidos": [1, 2, 3, 4, 5, 6]
        },
        "angulo_grados": {
          "tipo": "flotante",
          "envelope": {
            "1": [-360, 360],
            "2": [-118, 120],
            "3": [-225, 11],
            "4": [-360, 360],
            "5": [-97, 180],
            "6": [-360, 360]
          }
        },
        "velocidad_grados_seg": {
          "tipo": "flotante",
          "envelope": [1, 90]
        }
      },
      "requiere_estado": {
        "no_ejecutando_otro_comando": true,
        "sin_error_activo": true
      }
    },

    "home": {
      "descripcion": "Regresa el brazo a posicion de reposo segura",
      "parametros": {},
      "requiere_estado": {
        "sin_error_activo": true
      }
    },

    "stop": {
      "descripcion": "Detiene cualquier movimiento en curso inmediatamente",
      "parametros": {},
      "requiere_estado": {}
    }
  },

  "acciones_NO_incluidas": "cualquier accion no listada arriba se rechaza por defecto -- el vocabulario es una lista blanca cerrada, no una lista negra de exclusiones."
}
```

**Comentario campo por campo, deducido de la necesidad, no memorizado**:

- `device_id`/`device_type`/`handler` anclan la card a exactamente qué dispositivo y qué handler específico (recordando la distinción `physical` vs. `mujoco` del módulo de dispatcher) — porque, como ya estableciste, la misma acción puede tener envelopes radicalmente distintos entre un handler de simulación y uno físico real, así que la card **tiene que** estar atada a esa distinción específica, no ser genérica para "cualquier xArm".
- `acciones_permitidas` es la lista blanca cerrada — cada clave es un identificador de acción del vocabulario, cada valor describe completamente esa acción.
- Dentro de cada acción, `parametros` declara, por cada parámetro, su tipo y su `envelope` — nota cómo `angulo_grados` tiene un envelope **distinto por cada joint_id**, porque cada articulación física tiene límites de movimiento distintos (información que, en un caso real, vendría directamente del datasheet del fabricante del brazo, no de un supuesto genérico "todos los ejes son iguales").
- `requiere_estado` es la tercera categoría de la sección 3.1 — declara qué condiciones del estado actual del dispositivo deben cumplirse para que esta acción específica sea segura, permitiendo que el validador consulte `get_status()` del handler y compare.
- La nota final (`acciones_NO_incluidas`) no es un campo funcional del schema — es la declaración explícita del principio de **lista blanca, no lista negra**: cualquier acción no mencionada se rechaza por default, nunca se asume permitida a menos que se pruebe lo contrario.

### 3.3 Categorización razonada por tipo de restricción — no "los tres tipos oficiales", una taxonomía útil deducida

Dado que no pude verificar la taxonomía exacta del dossier interno (ver nota inicial), aquí está una categorización que se deduce naturalmente de los **tipos de parámetro** que una capability card necesita restringir, útil como marco de razonamiento propio, no como cita de una fuente verificada:

**Restricciones discretas (enumeración cerrada)**: parámetros cuyo espacio válido es un conjunto finito y enumerable de valores exactos — como `joint_id` en el ejemplo de arriba, que solo puede ser uno de `[1,2,3,4,5,6]`. La validación es una simple pertenencia a conjunto.

**Restricciones continuas (envelope numérico)**: parámetros cuyo espacio válido es un rango continuo — como `angulo_grados` o `velocidad_grados_seg`. La validación es una comparación de desigualdad (`min ≤ valor ≤ max`).

**Restricciones secuenciales/de estado**: no sobre el valor de un parámetro individual, sino sobre el **contexto** en que la acción se propone — el `requiere_estado` de la sección 3.2. La validación aquí no compara un valor contra un rango fijo, compara el estado actual reportado por el dispositivo contra una condición requerida, potencialmente cambiante en el tiempo.

**Por qué distinguir estas tres categorías tiene valor práctico para ti como diseñador de AutoCard**: cada una exige una lógica de validación distinta en el código del Bridge (pertenencia a conjunto vs. comparación numérica vs. consulta de estado), y cada una tiene un origen distinto de dónde saca su información válida (discretas y continuas típicamente vienen del datasheet físico del fabricante; las de estado vienen de la lógica operativa del sistema, no del hardware en sí). Un generador automático de cards, como AutoCard, necesita tratar estas tres fuentes de información de forma diferenciada — no puede inferir un envelope continuo de la misma forma que infiere una restricción de estado.

---

## 4. La validación — el validador determinista, código real

```python
# validador_capability_card.py
# Verifica un comando propuesto contra una capability card + el
# estado actual del dispositivo. Deducido rigurosamente del modelo
# de seguridad de la seccion 1 -- NO transcrito del validador real
# de orion-bridge-v2, cuyo codigo fuente no pudo inspeccionarse.

def validar_comando(comando: dict, card: dict, estado_actual: dict) -> dict:
    """
    comando: {"accion": str, "parametros": dict} -- lo que el LLM propuso,
             ya recibido por el Bridge via el flujo intent -> ... del
             modulo de arquitectura general.
    card: la capability card del dispositivo destino (seccion 3.2).
    estado_actual: el resultado de get_status() del handler correspondiente.

    Devuelve {"valido": bool, "razon": str} -- NUNCA ejecuta nada,
    solo decide. La ejecucion real ocurre en una etapa POSTERIOR y
    separada (el handler, ver modulo anterior), solo si esto aprueba.
    """
    accion = comando.get("accion")
    parametros = comando.get("parametros", {})

    # FILTRO 1: la accion existe en el vocabulario de la lista blanca?
    definicion_accion = card["acciones_permitidas"].get(accion)
    if definicion_accion is None:
        return {"valido": False, "razon": f"accion '{accion}' no esta en la capability card"}

    # FILTRO 2: cada parametro requerido esta presente y dentro de su envelope?
    for nombre_param, spec in definicion_accion.get("parametros", {}).items():
        if nombre_param not in parametros:
            return {"valido": False, "razon": f"falta parametro requerido: '{nombre_param}'"}

        valor = parametros[nombre_param]

        if spec["tipo"] in ("entero", "flotante"):
            envelope = spec.get("envelope")
            if envelope is None:
                continue
            # envelope puede ser una lista [min, max] simple, o un dict
            # keyed por otro parametro (como angulo_grados dependiendo
            # de joint_id en el ejemplo de la seccion 3.2).
            if isinstance(envelope, dict):
                clave_dependiente = str(parametros.get("joint_id"))
                envelope = envelope.get(clave_dependiente)
                if envelope is None:
                    return {"valido": False, "razon": f"sin envelope definido para joint_id={clave_dependiente}"}

            minimo, maximo = envelope
            if not (minimo <= valor <= maximo):
                return {
                    "valido": False,
                    "razon": f"'{nombre_param}'={valor} fuera de envelope [{minimo}, {maximo}]",
                }

        elif spec["tipo"] == "enumeracion" or "valores_permitidos" in spec:
            permitidos = spec.get("valores_permitidos", [])
            if valor not in permitidos:
                return {"valido": False, "razon": f"'{nombre_param}'={valor} no esta en {permitidos}"}

    # FILTRO 3: el estado actual del dispositivo permite esta accion AHORA?
    requisitos_estado = definicion_accion.get("requiere_estado", {})
    if requisitos_estado.get("no_ejecutando_otro_comando") and estado_actual.get("ejecutando"):
        return {"valido": False, "razon": "el dispositivo ya esta ejecutando otro comando"}
    if requisitos_estado.get("sin_error_activo") and estado_actual.get("error_activo"):
        return {"valido": False, "razon": "el dispositivo reporta un error activo"}

    return {"valido": True, "razon": "comando dentro del envelope de la capability card"}


if __name__ == "__main__":
    # Ejemplo: LLM propone mover el joint 2 a 200 grados -- fuera
    # del envelope real [-118, 120] declarado en la card de la
    # seccion 3.2. Esto simula EXACTAMENTE el caso de alucinacion
    # estructural del modulo de arquitectura general: el numero
    # "suena" plausible sintacticamente, pero viola el limite fisico.
    comando_propuesto = {
        "accion": "move_joint",
        "parametros": {"joint_id": 2, "angulo_grados": 200, "velocidad_grados_seg": 30},
    }
    estado = {"ejecutando": False, "error_activo": False}

    # (card cargada del JSON de la seccion 3.2, omitido aqui por brevedad)
    resultado = validar_comando(comando_propuesto, card, estado)
    print(resultado)
    # {'valido': False, 'razon': "'angulo_grados'=200 fuera de envelope [-118, 120]"}
```

**Nota la propiedad central de este validador, remarcada explícitamente porque es el punto de todo el módulo**: es una función **pura**, determinista, sin ningún componente de generación de lenguaje involucrado en su ejecución — dado el mismo comando, la misma card, y el mismo estado, **siempre** produce el mismo veredicto. Esta es exactamente la propiedad que la sección 2.3 del módulo de arquitectura general identificó como necesaria: la falla del LLM (proponer 200 grados cuando el límite real es 120) y el veredicto del validador (rechazar por estar fuera de rango) son **estructuralmente independientes** — ninguna alucinación del LLM puede "convencer" a este código de aceptar algo fuera del envelope, porque el código no interpreta lenguaje, solo compara números contra rangos declarados.

---

## 5. Edge cases y trampas explícitas

### 5.1 Un comando técnicamente permitido pero al límite del envelope

Un ángulo de 119.9 grados, cuando el envelope declarado es `[-118, 120]`, pasa la validación — está técnicamente dentro del rango. Pero si ese envelope fue definido con **cero margen de seguridad** respecto al límite físico absoluto del hardware (es decir, si 120 grados es exactamente donde el brazo físicamente se traba o daña algo), entonces un comando válido según la card, ejecutado repetidamente cerca de ese límite, puede acumular desgaste mecánico o, en el peor caso, exceder el límite real por una pequeña imprecisión de calibración entre lo que el software cree que es "120 grados" y lo que el hardware físico real interpreta. **La mitigación de diseño**: el envelope declarado en la card **debería** incluir explícitamente un margen de seguridad respecto al límite físico absoluto documentado por el fabricante — no declarar el límite físico exacto como el envelope permitido, sino un valor más conservador. Esta es una decisión de ingeniería que AutoCard, como generador automático, necesita tomar explícitamente (con qué margen de seguridad generar cada envelope), no asumir que "el límite del datasheet es el envelope correcto" sin ajuste.

### 5.2 Una card mal definida — demasiado permisiva es un agujero, demasiado restrictiva es inútil

Una card cuyo envelope es más amplio que los límites físicos reales seguros es, literalmente, un agujero de seguridad disfrazado de mecanismo de seguridad — el validador seguirá aprobando "correctamente" (según su propia lógica interna) comandos que en realidad son peligrosos, porque la card misma les mintió sobre qué era seguro. Esto es exactamente análogo a una política RLS de Supabase (ya vista en el módulo de arquitectura general) mal configurada, que permite más acceso del que debería: el mecanismo de enforcement funciona perfectamente, pero está haciendo cumplir una regla incorrecta. **La responsabilidad de que la card sea correcta no vive en el validador — vive en quien (o lo que, en el caso de AutoCard) genera la card**, lo cual significa que la corrección de todo el sistema de seguridad depende, en última instancia, de la corrección del proceso de generación de cards, no solo del proceso de validación contra ellas.

Simétricamente, una card excesivamente restrictiva (envelopes mucho más estrechos que lo que es genuinamente seguro) no es un problema de seguridad, pero sí un problema de **utilidad**: el sistema rechaza comandos legítimos y seguros, frustrando el propósito de que un agente LLM pueda operar el dispositivo de forma efectiva. Ninguno de los dos extremos es gratis — encontrar el envelope correcto, ni demasiado laxo ni demasiado estrecho, es trabajo de ingeniería real que exige entender el hardware físico específico, no un valor por defecto genérico aplicable a cualquier dispositivo.

### 5.3 Qué pasa si el LLM propone algo que no está en la card en absoluto

Ya lo cubre el Filtro 1 del validador (sección 4): una acción cuyo identificador no aparece en `acciones_permitidas` se rechaza inmediatamente, sin evaluar ningún parámetro — esto cubre tanto el caso de alucinación pura (el LLM "inventó" un nombre de acción que nunca existió) como el caso de un intento de usar una acción que técnicamente el hardware podría soportar pero que el equipo deliberadamente decidió no exponer en esta card específica (por ejemplo, una acción de calibración avanzada que solo un técnico humano debería poder invocar, nunca un agente automatizado).

### 5.4 Validar sintaxis del comando vs. seguridad física del movimiento — una distinción que hay que mantener separada

Es fácil confundir dos preguntas distintas que un validador podría, en principio, responder: "¿esta propuesta tiene la forma sintáctica correcta (los campos correctos, los tipos correctos)?" y "¿ejecutar esto es físicamente seguro?". El validador de la sección 4 responde ambas, pero vale la pena notar que son, conceptualmente, capas distintas de verificación: la validación sintáctica (¿existe el campo `angulo_grados`? ¿es un número?) podría, en principio, hacerse con una herramienta de validación de schema genérica (como JSON Schema) sin ningún conocimiento del dominio físico. La validación de seguridad física (¿120 grados es seguro para el joint 2 de este xArm específico?) requiere conocimiento de dominio que **no** puede derivarse de la sintaxis del comando — viene exclusivamente de la capability card, que a su vez viene del datasheet físico real. Un error de diseño común es tratar ambas como si fueran la misma verificación — lo cual puede llevar a que un comando "sintácticamente perfecto" (todos los campos correctos, tipos correctos) se acepte sin la segunda capa de verificación física, exactamente el hueco que un validador bien diseñado, como el de la sección 4, cierra al aplicar ambas capas explícitamente y en orden.

---

## 6. Trade-offs explícitos

**Cards estrictas vs. flexibles**: ya desarrollado en la sección 5.2 — el trade-off central es seguridad (envelopes conservadores) vs. utilidad (el agente puede hacer lo que necesita hacer sin fricción constante). No hay un punto óptimo universal; depende del costo real de cada tipo de error para el dispositivo específico, exactamente el mismo argumento de costo relativo que ya viste para el parámetro `contamination` en el módulo de detección de anomalías — aquí aplicado a seguridad física en vez de a detección estadística, pero con la misma estructura de decisión.

**Validación en runtime vs. en generación**: este módulo se enfocó en validación **en runtime** — verificar cada comando propuesto en el momento en que el LLM lo genera, contra la card ya existente. Una estrategia complementaria (no excluyente) es restringir la **generación** misma del LLM para que estructuralmente no pueda producir valores fuera de rango (por ejemplo, usando function-calling con schemas que ya declaran los mismos rangos, de forma que el mecanismo de generación estructurada del modelo tenga menos probabilidad de producir un valor inválido en primer lugar). **Por qué esto no reemplaza la validación en runtime, sino que la complementa**: incluso con generación estructurada, el argumento de la sección 1.1 sigue aplicando — no hay garantía matemática de que un modelo generativo respete un rango declarado en su schema de generación con probabilidad exactamente 1. La validación en runtime es la capa que **no puede omitirse**, sin importar cuánto mejores mecanismos de generación restringida se agreguen aguas arriba — es defensa en profundidad, no defensa única.

**Expresividad del schema vs. simplicidad de validar**: un schema más expresivo (envelopes condicionales complejos, restricciones que dependen de combinaciones de múltiples parámetros simultáneamente, restricciones temporales sofisticadas) puede capturar reglas de seguridad más precisas y matizadas — pero cada incremento de expresividad hace el código del validador más complejo, con más superficie para que **el validador mismo** tenga un bug (una condición mal evaluada, un caso borde no cubierto). Hay una tensión real aquí: quieres que la card pueda expresar exactamente las reglas de seguridad que el dispositivo real necesita, pero cada pieza adicional de expresividad es, ella misma, código adicional que necesita estar correcto para que la garantía de seguridad se sostenga. La disciplina de "simplicidad sobre sofisticación" que ya has visto aplicada en otros módulos de esta serie aplica aquí con particular fuerza: un schema simple, fácil de auditar visualmente y de validar con código simple, es preferible a uno expresivo pero difícil de verificar que esté correctamente implementado — precisamente porque el costo de un bug en el validador mismo es indistinguible, en sus consecuencias, del costo de una card mal definida.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Capability-based security en sistemas operativos — dónde nació el concepto.** La idea de que "poseer el objeto correcto es la prueba de autorización, sin consultar una tabla central" tiene raíces en sistemas operativos de investigación de los años 60-70 (sistemas como Hydra y CAP, y más adelante influenciando diseños como el de seL4, un microkernel formalmente verificado que usa capabilities como su mecanismo central de control de acceso). El problema que estos sistemas resolvían es estructuralmente el mismo que resuelve la capability card del Bridge: en un sistema con muchos procesos (o, aquí, muchos posibles comandos generados por un LLM) interactuando con recursos sensibles (memoria, dispositivos, o aquí, hardware físico), quieres que el control de acceso sea **verificable localmente y mecánicamente** en el punto de uso, no dependiente de una decisión centralizada de "confianza" que podría fallar o ser eludida. Reconocer esta genealogía te da acceso a décadas de pensamiento riguroso sobre cómo diseñar sistemas de capabilities correctamente — literatura que trasciende por mucho el contexto específico de robots y LLMs.

**El paralelo con sandboxes — el WORKER_SHIELD de tu propia Kee/Arcanum.** Si tu arquitectura de Kee incluye algún mecanismo de sandboxing para limitar qué puede hacer un worker/agente automatizado (acceso a filesystem restringido, llamadas de red limitadas a una whitelist, límites de recursos de cómputo), estás aplicando exactamente el mismo principio que este módulo formaliza para el Bridge: una declaración explícita y acotada de "esto es lo que este proceso puede hacer", verificada por un mecanismo externo al proceso mismo, no confiada a que el proceso "se comporte bien" por instrucción. La diferencia de dominio (un sandbox de software vs. una capability card para hardware físico) es superficial — el principio de diseño subyacente, privilegio mínimo declarado y hecho cumplir mecánicamente, es idéntico, y cualquier intuición que ya tengas sobre cómo diseñar sandboxes correctamente es directamente transferible a diseñar capability cards correctamente, y viceversa.

**Por qué esto es el fundamento de AutoCard — la siguiente milla, ahora con el marco completo.** Todo este módulo ha sido, deliberadamente, la preparación conceptual completa para el trabajo que vas a hacer en AutoCard: un sistema que **genera** capability cards de forma autónoma, en vez de que un humano las escriba manualmente para cada dispositivo nuevo. Con el marco de este módulo, la pregunta de diseño de AutoCard se vuelve mucho más precisa: dado un dispositivo nuevo (posiblemente con documentación técnica, un datasheet, o incluso solo una descripción de sus capacidades), ¿cómo infieres automáticamente las tres categorías de la sección 3.1 — el vocabulario de acciones válidas, los envelopes de parámetros con margen de seguridad apropiado (sección 5.1), y las restricciones de estado relevantes — de forma que la card resultante sea ni demasiado permisiva (un agujero, sección 5.2) ni demasiado restrictiva (inútil)? Este es exactamente el problema de ingeniería que vas a enfrentar, y cada trampa que identificaste en este módulo (el margen de seguridad del envelope, la distinción entre validación sintáctica y física, la responsabilidad de corrección que recae en el generador, no en el validador) es, directamente, una responsabilidad de diseño que AutoCard tiene que asumir explícitamente, no una preocupación abstracta separada de tu trabajo real.

---

## Síntesis — el mapa mental

1. Un prompt que "pide" al LLM respetar un límite es una instrucción, no una restricción — no ofrece ninguna garantía matemática, porque un modelo generativo probabilístico no está estructuralmente obligado a respetar instrucciones con probabilidad 1, sin importar qué tan bien redactadas estén.
2. El modelo de amenaza de la capability card **no** requiere que el LLM sea adversarial — cubre, primero y principalmente, el caso benigno-pero-inevitable de la alucinación estructural, y esa misma defensa cubre incidentalmente el caso adversarial también.
3. **Capability-based security** es el principio general: la credencial misma (la card) es la prueba de autorización — específica y acotada, nunca una llave maestra genérica — verificada mecánicamente sin consultar juicio ni interpretación.
4. Un schema de capability card necesita, como mínimo, tres categorías de información: **vocabulario de acciones** (lista blanca cerrada), **envelopes de parámetros** (rangos seguros, no límites físicos absolutos sin margen), y **restricciones de estado** (cuándo, dado el estado actual, una acción es segura).
5. El **validador** es una función pura y determinista — dado el mismo comando, card, y estado, siempre produce el mismo veredicto, garantizando que la falla del LLM y el veredicto de validación sean estructuralmente independientes.
6. Una card **demasiado permisiva** es un agujero de seguridad disfrazado; una **demasiado restrictiva** es inútil aunque segura — la responsabilidad de encontrar el balance correcto recae en quien genera la card (o en AutoCard), no en el validador, que solo hace cumplir mecánicamente lo que la card declara, correcto o no.
7. Validación sintáctica (¿el comando tiene la forma correcta?) y validación de seguridad física (¿es seguro ejecutarlo?) son capas conceptualmente distintas — confundirlas puede dejar un comando "bien formado" pasar sin la verificación de seguridad real que importa.
8. La validación en runtime, contra la card, **no** puede reemplazarse por mejores técnicas de generación restringida del LLM — es defensa en profundidad complementaria, no sustituible, porque ninguna técnica de generación ofrece la garantía matemática de probabilidad 1 que la validación determinista sí ofrece.

---

## Preguntas que deberías poder responder

*(Las primeras tres son, deliberadamente, del tipo defensa de diseño — porque AutoCard va a producir estas cards, y tendrás que defender su corrección ante el equipo.)*

1. Explica por qué la validación de seguridad no puede vivir como una instrucción dentro del prompt del LLM, ni siquiera una instrucción muy bien redactada y repetida — ¿qué propiedad matemática del proceso generativo hace esto estructuralmente imposible de garantizar, no solo poco confiable?
2. Si tuvieras que definir el envelope de un dispositivo nuevo (por ejemplo, el Arduino/DHT11 del módulo anterior, si tuviera un actuador en vez de solo un sensor), ¿qué información necesitarías, de dónde la obtendrías, y qué margen de seguridad aplicarías respecto al límite físico absoluto documentado?
3. ¿Qué hace peligrosa específicamente a una capability card demasiado permisiva, dado que el validador que la consume funciona perfectamente bien? Conecta tu respuesta con el paralelo de una política RLS de Supabase mal configurada.
4. Explica la diferencia entre validación sintáctica y validación de seguridad física de un comando propuesto — da un ejemplo concreto de un comando que pasaría la primera pero debería fallar la segunda.
5. ¿Por qué el modelo de amenaza de la capability card no necesita asumir que el LLM es adversarial para justificar toda la maquinaria de validación? ¿Qué caso, más básico que un ataque deliberado, ya justifica por sí solo la necesidad de esta defensa?
6. Explica por qué "usar generación estructurada con schemas restringidos en el LLM" no reemplaza la necesidad de validación en runtime contra la capability card — ¿qué garantía específica sigue faltando incluso con esa técnica adicional?
7. Diseña, en palabras, cómo estructurarías las tres categorías de información (vocabulario, envelopes, restricciones de estado) para un dispositivo completamente distinto al xArm de este módulo — por ejemplo, una banda transportadora con velocidad variable y sensores de presencia en cada extremo.
8. ¿Por qué la responsabilidad de que una capability card sea correcta recae en quien la genera (o en AutoCard, si la genera automáticamente) y no en el validador que la consume? ¿Qué significa esto concretamente para el nivel de rigor que tu propio trabajo en AutoCard necesita alcanzar?

---

## Fuentes

- Arquitectura ORION documentada por el equipo (flujo intent → capability card → validation → protocolo → hardware) — ya anclada y citada en `fred-op-0-bridge` de esta misma serie, consistente con la descripción proporcionada para este módulo.
- El schema exacto de campos, la taxonomía de "tres tipos de capability card", y el código real del validador de `orion-bridge-v2` **no pudieron verificarse contra ninguna fuente pública o previamente accesible durante la investigación de este módulo específico** — la construcción del schema en las secciones 3 y 4 es una deducción rigurosa desde el modelo de seguridad documentado, no una transcripción del dossier interno de AutoCard ni del código fuente real. Debe verificarse contra la documentación interna del equipo antes de asumir coincidencia exacta de nombres de campos o estructura.
- Dennis, J.B. y Van Horn, E.C., "Programming Semantics for Multiprogrammed Computations", *Communications of the ACM*, 1966 — uno de los trabajos fundacionales del concepto de capability-based security en sistemas operativos, mencionado en Conexiones.
- seL4 Microkernel, documentación del modelo de capabilities: https://sel4.systems/ — ejemplo moderno y formalmente verificado de un sistema de capabilities en producción.
