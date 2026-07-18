---
module_id: cb000000-0000-4000-8000-00000000000b
spine: FrED
title: Ejercicios — El Dispatcher y los Handlers
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-2-dispatcher.md)
version: 1
---

# El Dispatcher y los Handlers — banco a_mano

Banco de defensa de diseño (a_mano): cada ejercicio te pide DEFENDER una decisión del patrón dispatcher/handlers desde primeros principios, anclado a lo que el libro realmente argumenta — no a trivia. El ejercicio de código destila el corazón del enrutamiento (`type → handler`) como función pura.

## Por qué el Dispatcher no debe saber CÓMO habla un dispositivo
type: multiple_choice

El Dispatcher enruta cada comando hacia un handler basándose ÚNICAMENTE en el `type` del dispositivo destino (`xarm`, `abb`, `plc`, `shell`), y deliberadamente NO contiene la lógica de cómo hablar con ninguno de ellos (ni el SDK de UFACTORY, ni snap7, ni el socket TCP con RAPID). ¿Cuál es la consecuencia concreta de mantenibilidad que se pierde si el Dispatcher absorbiera, aunque fuera parcialmente, la lógica específica de un dispositivo?

### Opciones
- El Dispatcher se volvería más lento porque tendría que evaluar más ramas condicionales antes de enrutar cada comando.
- [x] Agregar o modificar el soporte de un dispositivo obligaría a tocar el mismo código que ya enruta a todos los demás, de modo que un error en la lógica del dispositivo nuevo podría afectar el despacho hacia dispositivos que no tienen ninguna relación con el cambio.
- Los handlers dejarían de poder implementar el contrato común y cada uno tendría que reimplementar el enrutamiento por su cuenta.
- El Dispatcher solo podría enrutar hacia dispositivos físicos, nunca hacia sus variantes simuladas.

### Justificación
Es exactamente el argumento contra el switch monolítico (sección 1): cuando la lógica de enrutamiento y el conocimiento específico de protocolo viven en el mismo bloque, cada dispositivo nuevo se agrega MODIFICANDO ese bloque compartido, y un error en tu código nuevo comparte archivo y función con la lógica de dispositivos que ya corren en producción — el blast radius deja de estar acotado. La separación dispatcher/handlers existe precisamente para contener ese radio de daño dentro del handler específico. La velocidad no es el argumento (evaluar ramas es trivial); el contrato común lo implementan los handlers sin importar dónde viva la lógica de enrutamiento; y la intercambiabilidad simulado/físico es una consecuencia del patrón, no algo que este acoplamiento haga desaparecer.

## El contrato mínimo — por qué `get_status()` no es opcional
type: multiple_choice

Todo handler, sin importar su protocolo, implementa el mismo contrato mínimo de cuatro operaciones: `connect`, `execute`, `get_status`, `disconnect`. Un revisor te pregunta por qué `get_status()` es parte del contrato OBLIGATORIO y no un extra que cada handler decida exponer o no. ¿Cuál es la defensa correcta, anclada al diseño del Bridge?

### Opciones
- [x] Porque el sistema necesita poder consultar el estado físico real del dispositivo en cualquier momento — tanto para validar si un comando es seguro dado el estado actual, como para la reconciliación tras una interrupción de conexión.
- Porque sin `get_status()` el Dispatcher no sabría a cuál handler enrutar un comando entrante.
- Porque `get_status()` es la operación que traduce el comando abstracto al protocolo nativo del dispositivo.
- Porque cada handler usa `get_status()` para descubrir a los demás handlers registrados y coordinarse con ellos.

### Justificación
La sección 2.1 deduce las cuatro operaciones de necesidades reales: `connect`/`disconnect` por el ciclo de vida de conexión propio de cada protocolo, `execute` como el punto donde el comando abstracto se vuelve acción real, y `get_status` porque el sistema debe poder leer el estado físico real en cualquier momento — para la validación previa (¿es seguro ESTE comando dado el estado actual?) y para la reconciliación tras una reconexión (el mecanismo del módulo de transport). El enrutamiento es por `type`, no por estado (distractor 2); traducir al protocolo nativo es trabajo de `execute` (distractor 3); y ningún handler conoce a los demás — esa ignorancia mutua es central al patrón (distractor 4).

## Resolver el handler destino desde el registro
type: code

El corazón del Dispatcher es un mapeo `type → handler`: dado el `type` de un comando ya validado, decide a cuál handler entregárselo, sin saber nada del protocolo interno de ninguno. Los dispositivos de un solo backend (`abb`, `plc`, `shell`) mapean directo a un handler; los de múltiples backends (`xarm`, sección 3.1) mapean a un sub-mapa `variante → handler` (`physical`/`mujoco`/`gazebo`), con `physical` como default. Implementa esa resolución como función PURA: en vez de instanciar una clase, devuelve el IDENTIFICADOR (nombre) del handler, o un centinela de error explícito ante un `type`/variante desconocido (sección 5.3: rechazo explícito, nunca adivinar un default silencioso).

### Especificación
`resolveHandler(registry, deviceType, variant)`:
- Si `deviceType` NO es una llave de `registry` → devuelve `"UNKNOWN_DEVICE"`.
- Sea `entry = registry[deviceType]`.
- Si `entry` es un string (handler directo, un solo backend) → devuélvelo tal cual, IGNORANDO `variant`.
- Si `entry` es un objeto/diccionario (múltiples backends) → sea `key = variant` si se proporcionó uno, si no `"physical"`; si `key` NO es llave de `entry` → devuelve `"UNKNOWN_VARIANT"`; si sí lo es → devuelve `entry[key]`.

### Firma
```javascript
function resolveHandler(registry, deviceType, variant) {
  // tu código
}
```
```python
def resolve_handler(registry, device_type, variant=None):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "abb", null], "expected": "ABBHandler" },
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "xarm", "gazebo"], "expected": "XArmGazeboHandler" },
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "xarm", null], "expected": "XArmFisicoHandler" },
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "shell", "mujoco"], "expected": "ShellHandler" },
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "arduino_serial", null], "expected": "UNKNOWN_DEVICE" },
  { "input": [{ "xarm": { "physical": "XArmFisicoHandler", "mujoco": "XArmMuJoCoHandler", "gazebo": "XArmGazeboHandler" }, "abb": "ABBHandler", "plc": "PLCSnap7Handler", "shell": "ShellHandler" }, "xarm", "webots"], "expected": "UNKNOWN_VARIANT" },
  { "input": [{}, "xarm", null], "expected": "UNKNOWN_DEVICE" }
]
```

### Solución
```javascript
function resolveHandler(registry, deviceType, variant) {
  if (!Object.prototype.hasOwnProperty.call(registry, deviceType)) return "UNKNOWN_DEVICE";
  const entry = registry[deviceType];
  if (typeof entry === "string") return entry;
  const key = variant || "physical";
  if (!Object.prototype.hasOwnProperty.call(entry, key)) return "UNKNOWN_VARIANT";
  return entry[key];
}
```
```python
def resolve_handler(registry, device_type, variant=None):
    if device_type not in registry:
        return "UNKNOWN_DEVICE"
    entry = registry[device_type]
    if isinstance(entry, str):
        return entry
    key = variant or "physical"
    if key not in entry:
        return "UNKNOWN_VARIANT"
    return entry[key]
```

### Pistas
- Primero descarta el `type` desconocido; luego distingue string (handler directo) de objeto (múltiples backends).
- El default `physical` sale de `variant || "physical"` (JS) / `variant or "physical"` (Python): `null`/`None` cae al default.
- Un handler directo (string) ignora por completo la variante recibida — el `type` ya lo determina.

## El handler de shell whitelisted — por qué NO se interpola el comando recibido
type: multiple_choice

El handler de shell no reenvía a `subprocess.run(...)` el string que le llega; mapea una `accion` abstracta (p.ej. `"restart_service"`) hacia una lista de argumentos FIJA y predefinida (`["systemctl", "restart", "fred-service"]`), y rechaza cualquier `accion` que no esté en su whitelist. ¿Qué garantía estructural provee exactamente esta decisión de diseño?

### Opciones
- Que los comandos de shell se ejecuten más rápido, al evitar el parseo del string recibido.
- Que el handler de shell pueda ejecutar cualquier comando, siempre que el intent del LLM lo declare seguro.
- [x] Que ningún input externo llegue a determinar directamente QUÉ se ejecuta — solo determina CUÁL de un conjunto fijo y predefinido de acciones seguras se dispara, la misma disciplina estructural que previene la inyección SQL al no interpolar input de usuario dentro de la query.
- Que el Dispatcher pueda reutilizar esa whitelist para validar también los comandos de los handlers de xArm y PLC.

### Justificación
Sección 3.3: la whitelist no es solo "una lista de strings permitidos que comparas" — es la garantía estructural de que el input externo elige CUÁL acción predefinida se dispara, nunca QUÉ comando exacto se ejecuta, porque los argumentos reales jamás se interpolan desde el comando recibido. Es exactamente la disciplina contra inyección SQL (parámetros preparados en vez de concatenar input) trasladada a inyección de shell. La velocidad no es el punto (distractor 1); confiar en que el LLM "declare seguro" un comando es justo lo que este diseño se niega a hacer (distractor 2); y la whitelist es interna al handler de shell — el Dispatcher no conoce los detalles internos de ningún handler (distractor 4).

## Un handler que falla A MEDIA ejecución
type: trace

Un handler recibe un comando de movimiento de tres pasos: mover el eje X, luego el eje Y, luego el eje Z. Completa el paso 1 (el eje X queda en su nueva posición), pero al intentar el paso 2 pierde comunicación con el brazo. A diferencia de una transacción de base de datos, no existe un rollback automático que "deshaga" un movimiento físico ya ejecutado. ¿Qué debe hacer el `execute()` del handler en el resultado de error que devuelve, para que el sistema pueda razonar correctamente sobre qué sigue?

### Opciones
- Devolver simplemente `{ exito: false }` y dejar que el Dispatcher reintente el comando completo de tres pasos desde cero.
- [x] Reportar con precisión hasta dónde llegó — que completó el paso 1 y en qué posición quedó el eje X — para que la reconciliación de estado (vía `get_status()`) pueda decidir qué hacer sin asumir ciegamente que el comando falló por entero o se completó por entero.
- Deshacer automáticamente el movimiento del eje X, regresándolo a su posición inicial, antes de reportar el error.
- Lanzar una excepción no capturada para que se propague hacia el Dispatcher y detenga todo el sistema de inmediato.

### Justificación
Es la trampa de mayor consecuencia física del módulo (sección 5.2). El hardware queda en un estado intermedio y NO hay mecanismo genérico de rollback de un movimiento físico ya ejecutado. Por eso la mitigación es reportar con precisión hasta dónde se llegó, dándole a la reconciliación (`get_status()`, sección 2.1) la información para decidir sin asumir "falló completo" ni "se completó completo" (ambos potencialmente falsos). Reintentar el comando completo desde cero sobre un brazo que ya movió un eje es peligroso precisamente porque el estado real es desconocido. "Deshacer automáticamente" el movimiento es justo lo que el libro dice que NO existe como garantía genérica. Y propagar una excepción no capturada es lo que la sección 5.1 advierte evitar: el handler debe devolver un error explícito en el formato común, no dejar que una excepción se propague de forma impredecible hacia el Dispatcher.

## Simulación (`mujoco`) vs. físico (`physical`) — mismo comando, distinto riesgo
type: multiple_choice

Desarrollas contra el handler `mujoco` y un comando de velocidad se ejecuta sin ningún problema en la simulación. Un revisor del equipo ORION te pregunta por qué eso NO basta como evidencia de que el mismo comando sea seguro contra el handler `physical` del mismo xArm — y qué debe ser cierto sobre las capability cards para que esa brecha no se vuelva un riesgo real. ¿Cuál es la respuesta correcta?

### Opciones
- Porque `physical` implementa un contrato distinto al de `mujoco`, así que el comando ni siquiera es compatible entre ambos.
- Porque el handler `mujoco` no implementa `get_status()`, de modo que sus resultados nunca son confiables.
- [x] Porque la física simulada puede tolerar una velocidad que en el motor físico real excedería un límite de seguridad; por eso la capability card de CADA handler debe declarar los rangos seguros reales y específicos de ese handler, nunca un rango genérico compartido entre simulación y hardware.
- Porque el Dispatcher enruta los comandos de simulación por un camino de código separado que se salta la validación de capability card.

### Justificación
Sección 5.4: que un comando funcione en `mujoco` no prueba que sea seguro en `physical`, porque la simulación es inherentemente limitada — puede no reflejar un límite físico real del motor. No es un defecto del patrón de handlers intercambiables; es una limitación de cualquier simulación. La defensa es que la capability card refleje los límites reales y específicos de CADA handler (los de `physical` con el mismo rigor que los de la simulación), nunca un rango genérico compartido. Los distractores contradicen el diseño: los tres backends de xarm implementan EL MISMO contrato (sección 3.1) — esa es justo la razón por la que son intercambiables por configuración; ambos implementan `get_status()`; y el Dispatcher enruta por `type` sin un camino separado que evada la validación.
