---
module_id: fred-op-2-dispatcher
spine: FrED
path: Operativo
title: "El Dispatcher y los Handlers"
subtitle: "Cómo un bridge controla cualquier dispositivo sin reescribir su corazón"
source_canonical: "github.com/Starman26/orion-bridge-v2 (dispatcher.py, handlers/)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# El Dispatcher y los Handlers

> **Pregunta raíz.** Hoy el Bridge controla un brazo xArm. Mañana necesita controlar un PLC Siemens. Pasado mañana, un dispositivo que todavía no existe en ningún catálogo — quizás el Arduino que tú mismo vas a conectar en el siguiente módulo. **¿Cómo diseñas un sistema donde agregar soporte para un dispositivo nuevo no exige tocar, ni arriesgar, ni siquiera entender el código que ya controla los dispositivos existentes?** La respuesta es una separación de responsabilidades muy específica: algo que sabe **a quién enrutar** un comando, sin saber **cómo** ese destinatario específico habla — y algo más, completamente aislado, que sabe hablar exactamente un protocolo, sin saber ni que existen los demás. Esa separación es el Dispatcher y los Handlers, y es, literalmente, el punto exacto del código donde tú puedes escribir la próxima pieza del corazón de ORION sin que el equipo tenga que confiar ciegamente en que no vas a romper nada más.

## Prólogo — de dónde nace esto

Piensa en la recepción de un hospital grande. La recepcionista no sabe cirugía, no sabe pediatría, no sabe radiología — su trabajo es escuchar el síntoma o la necesidad de quien llega, y **enrutarlo al departamento correcto**. No necesita entender cómo funciona una resonancia magnética para saber que "necesito una resonancia" va al departamento de radiología. Cada departamento, a su vez, tiene sus propios especialistas que sí entienden su dominio a profundidad — pero **ninguno de ellos necesita saber cómo funcionan los demás departamentos** para hacer bien su trabajo.

Esa es exactamente la arquitectura que vas a deducir en este módulo. El **Dispatcher** es la recepción: recibe un comando ya validado (que llegó por la capa de transport que ya construiste en el módulo anterior) y lo enruta, basándose únicamente en **qué tipo de dispositivo** es el destinatario — sin saber ni necesitar saber cómo ese dispositivo específico ejecuta comandos. Los **Handlers** son los especialistas de cada departamento: cada uno sabe hablar exactamente un protocolo (el SDK de UFACTORY para un xArm, snap7 para un PLC Siemens, un socket TCP crudo con RAPID para un controlador ABB), y ninguno necesita saber que los demás existen. Esta separación no es elegancia arquitectónica gratuita — es la única forma de que el sistema pueda crecer, dispositivo por dispositivo, sin que cada adición nueva sea una apuesta sobre la estabilidad de todo lo que ya funcionaba.

---

## 1. Por qué el dispatcher no debe saber CÓMO habla un dispositivo

### 1.1 La alternativa que hay que descartar primero: el switch monolítico

Imagina la forma más directa (e ingenua) de resolver "recibí un comando para el dispositivo X, ejecútalo": un bloque gigante de código con un `if/elif` (o `switch`) por cada tipo de dispositivo soportado, cada rama conteniendo directamente la lógica completa de cómo hablar con ese dispositivo específico — la conexión IP al xArm, el manejo de sockets TCP para ABB, las llamadas a snap7 para el PLC, todo entrelazado en una sola función o módulo central.

**Por qué esto se degrada mal con el tiempo, deducido y no solo intuido**: cada vez que agregas soporte para un dispositivo nuevo, tienes que **modificar** ese bloque central — agregar una rama nueva al mismo `if/elif` que ya contiene la lógica de todos los dispositivos existentes. Esto significa que **cualquier error al escribir la lógica del dispositivo nuevo vive en el mismo archivo, en la misma función, que la lógica de los dispositivos que ya funcionan en producción** — un error de sintaxis, una importación mal puesta, una excepción no capturada en tu código nuevo puede, dependiendo de cómo esté estructurado el bloque, afectar la capacidad del sistema de seguir despachando comandos hacia dispositivos que no tienen absolutamente nada que ver con tu cambio. Además, el bloque central crece sin límite conforme se agregan dispositivos — se vuelve progresivamente más difícil de leer, de testear de forma aislada, y de razonar sobre su comportamiento completo, porque entender "qué hace el sistema con un comando para el xArm" exige leer y entender un archivo que también contiene la lógica completa de ABB, PLC, y shell, entrelazada.

### 1.2 La separación, deducida directamente de ese problema

Si el problema es que **conocimiento específico de protocolo mezclado con lógica de enrutamiento** crea acoplamiento innecesario entre dispositivos sin relación funcional, la solución es separar ambas responsabilidades en piezas de código completamente distintas:

**El Dispatcher solo necesita saber una cosa**: dado un comando con un campo que identifica el tipo de dispositivo destino (el `type` declarado en `connections.toml`, como viste en el módulo de arquitectura general — `xarm`, `abb`, `plc`, `shell`), **a cuál handler específico entregárselo**. No necesita saber que el SDK de UFACTORY existe, ni qué es snap7, ni cómo se abre un socket TCP crudo — esa información vive exclusivamente dentro de cada handler.

**Cada Handler solo necesita saber una cosa, distinta**: cómo traducir un comando ya validado (en un formato abstracto y común, el mismo que salió de la capa de validación descrita en el módulo de arquitectura general del Bridge) hacia la secuencia exacta de llamadas/bytes que su protocolo específico entiende, y cómo reportar de vuelta el resultado en ese mismo formato común. No necesita saber que el dispatcher existe como pieza central, ni que hay otros handlers — solo necesita cumplir el contrato de interfaz que el dispatcher espera poder invocar sobre **cualquier** handler, sin distinción.

**La consecuencia directa, ya adelantada en el módulo de arquitectura general**: agregar un handler nuevo es, estructuralmente, agregar un archivo nuevo que implementa una interfaz conocida, y registrar ese archivo nuevo en un punto de registro central (sección 3) — **sin tocar ni el dispatcher ni ningún handler existente**. El blast radius de un error en tu handler nuevo queda acotado a ese handler específico; el resto del sistema sigue funcionando exactamente igual, porque nunca dependió de los detalles internos de tu implementación, solo del contrato de interfaz que cumples.

---

## 2. El contrato — la interfaz común que todo handler debe implementar

### 2.1 Qué necesita el dispatcher poder pedirle a CUALQUIER handler, sin distinción

Para que el dispatcher pueda tratar a todos los handlers de forma uniforme (sin importar si detrás hay un brazo robótico físico, una simulación, o un shell del sistema operativo), necesita que todos ellos respondan al mismo conjunto mínimo de operaciones — el mismo patrón de "interfaz común" que ya dedujiste en el módulo de arquitectura general del Bridge, aquí especificado con el detalle operativo que el dispatcher específicamente necesita:

```python
# Patron ilustrativo del contrato de interfaz que un handler debe
# cumplir para que el dispatcher pueda enrutarle comandos de forma
# generica -- deducido de la arquitectura documentada del Bridge
# (dispatcher enruta por 'type', cada handler traduce a protocolo
# especifico). NO es una transcripcion verificada linea por linea
# de dispatcher.py/handlers/ -- ver nota de honestidad en Fuentes.

from abc import ABC, abstractmethod

class DeviceHandler(ABC):
    """
    Contrato minimo que CUALQUIER handler debe cumplir. El dispatcher
    solo conoce esta interfaz -- nunca los detalles de una
    implementacion concreta especifica.
    """

    @abstractmethod
    def connect(self, config: dict) -> None:
        """
        Establece la conexion especifica del protocolo de este
        dispositivo (IP para xArm fisico, socket TCP para ABB,
        snap7 para PLC, nada especial para shell). El dispatcher
        llama esto UNA VEZ al inicializar el bridge, con la
        configuracion de ESTE dispositivo especifico tomada de
        connections.toml.
        """
        raise NotImplementedError

    @abstractmethod
    def execute(self, comando: dict) -> dict:
        """
        Recibe un comando YA VALIDADO (nunca una propuesta cruda
        sin pasar por la capa de validacion del modulo de
        arquitectura general) y lo ejecuta sobre el hardware real.
        Devuelve un resultado en formato COMUN, sin importar que
        protocolo especifico haya detras -- el dispatcher y
        cualquier consumidor aguas arriba solo entienden este
        formato de resultado, nunca el protocolo nativo del
        dispositivo.
        """
        raise NotImplementedError

    @abstractmethod
    def get_status(self) -> dict:
        """
        Estado actual del dispositivo -- usado tanto para la
        capability card (que acciones son posibles AHORA) como
        para la reconciliacion tras una reconexion de transport
        (ver el modulo anterior, seccion 4.4: que paso con un
        comando en vuelo).
        """
        raise NotImplementedError

    @abstractmethod
    def disconnect(self) -> None:
        """Cierra la conexion de forma ordenada."""
        raise NotImplementedError
```

**Por qué exactamente estas cuatro operaciones, ni una más ni una menos, deducido de las necesidades reales del sistema completo**: `connect`/`disconnect` existen porque cada protocolo tiene su propio ciclo de vida de conexión (abrir un socket TCP, inicializar una sesión de snap7, conectarse al SDK del xArm) que el dispatcher necesita poder iniciar y cerrar de forma genérica, sin conocer los detalles. `execute` es la operación central — el punto donde un comando abstracto se convierte en una acción real, y es exactamente donde cada handler aporta su conocimiento específico de protocolo. `get_status` existe porque, como ya estableciste en el módulo de transport, el sistema necesita poder **consultar el estado físico real** en cualquier momento — tanto para la validación previa a ejecutar (¿es seguro este comando dado el estado actual?) como para la reconciliación tras una interrupción de conexión.

### 2.2 El formato de entrada/salida como el "idioma común" — la analogía de la orden de trabajo

Piensa en una orden de trabajo estandarizada en un taller mecánico: no importa si el mecánico que la recibe es especialista en motores o en frenos — la orden de trabajo tiene un formato común (qué vehículo, qué se pidió, qué prioridad) que **cualquier** especialista sabe leer, aunque lo que hagan con esa información sea completamente distinto según su especialidad. El comando que el dispatcher entrega a un handler, y el resultado que el handler devuelve, cumplen exactamente ese papel: un formato común (probablemente un diccionario/JSON con campos como `accion`, `parametros`, y en la respuesta `exito`, `resultado`/`error`) que **todos** los handlers entienden en su entrada y producen en su salida, sin importar que la traducción interna hacia/desde ese formato común sea radicalmente distinta para cada uno — snap7 traduce hacia registros de un PLC S7, el SDK de UFACTORY traduce hacia comandos de movimiento articulares, y así sucesivamente.

---

## 3. Los handlers reales del repo, como instancias del mismo patrón

### 3.1 xArm con tres backends — mismo dispositivo lógico, tres handlers distintos

Ya lo viste en el módulo de arquitectura general, y vale la pena diseccionarlo aquí con el foco específico del dispatcher: el `type = "xarm"` puede mapear a **tres** handlers distintos (`physical`, `mujoco`, `gazebo`), cada uno implementando exactamente la misma interfaz de la sección 2.1, pero con implementaciones internas completamente distintas:

- **`physical`**: `connect()` abre una conexión real al SDK de UFACTORY sobre la IP declarada en `connections.toml`; `execute()` traduce el comando abstracto a llamadas reales del SDK que mueven el brazo físico.
- **`mujoco`**: `connect()` carga un modelo de simulación física (el `mjcf_path` que ya viste en el módulo de arquitectura general); `execute()` aplica el mismo comando abstracto, pero sobre el motor de física simulado, sin ningún hardware real involucrado.
- **`gazebo`**: `connect()` establece una conexión vía rosbridge hacia una instancia de Gazebo; `execute()` traduce hacia el protocolo específico que ese puente entiende.

**Por qué esto es exactamente la prueba de que el patrón funciona como se diseñó**: el dispatcher, al recibir un comando con `type = "xarm"`, no necesita saber (ni le importa) cuál de los tres handlers está configurado para ese dispositivo específico en este laboratorio — simplemente lo enruta al handler que fue registrado para ese dispositivo, y ese handler, sea cual sea, cumple el mismo contrato. **Esta es la razón exacta por la que puedes desarrollar contra `mujoco` y desplegar contra `physical` cambiando solo la configuración**, sin tocar ninguna línea de la lógica de negocio del dispatcher ni del resto del sistema — el mismo argumento que ya estableciste en el módulo de arquitectura general, aquí visto desde el ángulo específico de "por qué el dispatcher hace esto posible sin ningún esfuerzo adicional de su parte".

### 3.2 ABB por TCP, PLC por snap7 — protocolos radicalmente distintos, mismo contrato

Un handler para un controlador ABB implementa `execute()` traduciendo el comando abstracto hacia comandos **RAPID** (el lenguaje de programación nativo de los controladores ABB) enviados sobre un socket TCP crudo hacia el SocketServer del controlador — la mecánica interna de abrir un socket, formatear el string RAPID correcto, y parsear la respuesta es completamente específica de ese protocolo. Un handler para un PLC Siemens S7-1200 implementa `execute()` usando la librería `snap7` (que implementa el protocolo S7 de comunicación industrial de Siemens) para leer/escribir directamente sobre los registros/memoria del PLC. **Ninguno de estos dos handlers comparte absolutamente nada de código de protocolo con el otro, ni con los handlers de xArm** — y esa es precisamente la prueba de que la interfaz común (sección 2.1) está correctamente diseñada en el nivel de abstracción correcto: lo suficientemente genérica para cubrir dispositivos con mecanismos de comunicación completamente heterogéneos, sin forzar a ninguno a comprometer cómo habla su protocolo nativo específico.

### 3.3 Shell whitelisted — la lección de diseño más explícita sobre restricción de capacidad

Ya se estableció en el módulo de arquitectura general por qué el handler de shell necesita estar restringido a una whitelist explícita de comandos permitidos, no abierto a ejecutar cualquier string. Aquí, desde el ángulo específico del dispatcher/handler, vale la pena remarcar el mecanismo exacto: el handler de shell, en su `execute()`, **no** simplemente reenvía el comando recibido a `subprocess.run()` sin verificación — internamente, valida el comando propuesto contra su lista blanca **antes** de invocar el subproceso real, y rechaza (devolviendo un resultado de error en el formato común de la sección 2.2, no lanzando una ejecución) cualquier cosa que no esté explícitamente permitida.

```python
# Patron ilustrativo del handler de shell whitelisted -- deducido
# de la arquitectura documentada (subprocess, whitelisted), NO
# verificado linea por linea contra el codigo fuente real.

import subprocess

class ShellHandler(DeviceHandler):
    COMANDOS_PERMITIDOS = {
        "status_check": ["systemctl", "status", "fred-service"],
        "restart_service": ["systemctl", "restart", "fred-service"],
        # cada entrada es una lista de argumentos FIJA -- no se
        # interpola nada del comando recibido directamente hacia
        # el subprocess, precisamente para prevenir inyeccion de
        # shell si el intent del LLM contuviera algo malicioso.
    }

    def connect(self, config):
        pass   # no hay conexion persistente que establecer

    def execute(self, comando):
        accion = comando.get("accion")
        if accion not in self.COMANDOS_PERMITIDOS:
            return {"exito": False, "error": f"accion '{accion}' no esta en whitelist"}

        args = self.COMANDOS_PERMITIDOS[accion]
        resultado = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return {
            "exito": resultado.returncode == 0,
            "resultado": resultado.stdout,
            "error": resultado.stderr if resultado.returncode != 0 else None,
        }

    def get_status(self):
        return {"tipo": "shell", "conectado": True}

    def disconnect(self):
        pass
```

**La lección de diseño explícita**: nota que `COMANDOS_PERMITIDOS` mapea una `accion` (un identificador abstracto y seguro, parte del formato común de la sección 2.2) hacia una lista de argumentos **fija y predefinida** — el comando recibido del intent del LLM **nunca** se interpola directamente hacia el subprocess. Esto es, ni más ni menos, la misma disciplina de seguridad que un desarrollador backend aplicaría contra inyección SQL (nunca interpolar input de usuario directamente en una query — usar parámetros preparados) trasladada aquí a inyección de comandos de shell: la whitelist no es solo "una lista de strings permitidos que comparas" — es la garantía estructural de que **ningún** input externo llega a determinar directamente qué se ejecuta, solo determina **cuál** de un conjunto fijo y predefinido de acciones seguras se dispara.

---

## 4. Cómo escribir un handler nuevo — el núcleo práctico

### 4.1 Los pasos, deducidos del contrato ya establecido

Dado todo lo anterior, escribir un handler para un dispositivo nuevo (por ejemplo, el Arduino por serial que vas a construir en el siguiente módulo de esta ruta operativa) se reduce a un procedimiento bien definido, no a adivinar:

**Paso 1 — implementa la interfaz `DeviceHandler`**: escribe una clase nueva que implemente `connect()`, `execute()`, `get_status()`, `disconnect()`, con la lógica específica de cómo tu dispositivo se comunica (para un Arduino por serial, esto sería típicamente abrir un puerto serial con una librería como `pyserial`, enviar/leer bytes en el formato que tu firmware específico del Arduino espera).

**Paso 2 — define qué acciones son válidas para tu dispositivo, y con qué parámetros**: esto alimenta directamente la capability card (del módulo de arquitectura general) que tu handler expone — qué comandos son posibles, y dentro de qué rangos son seguros, dado lo que tu hardware físico realmente puede hacer sin dañarse.

**Paso 3 — regístralo en el punto de registro central del dispatcher**: el dispatcher necesita saber que el `type` (por ejemplo, `"arduino_serial"`) mapea hacia tu clase nueva. Este es, estructuralmente, el **único** punto donde tu código nuevo toca algo que el resto del sistema también toca — y es, deliberadamente, una modificación mínima y de bajo riesgo (agregar una entrada a un diccionario o registro, no modificar lógica compartida):

```python
# Patron ilustrativo del punto de registro -- deducido de la
# necesidad estructural de que el dispatcher sepa mapear 'type'
# hacia una clase de handler concreta.

REGISTRO_DE_HANDLERS = {
    "xarm": {
        "physical": XArmFisicoHandler,
        "mujoco": XArmMuJoCoHandler,
        "gazebo": XArmGazeboHandler,
    },
    "abb": ABBHandler,
    "plc": PLCSnap7Handler,
    "shell": ShellHandler,
    # tu contribucion nueva se agrega aqui, sin tocar ninguna
    # de las lineas anteriores:
    "arduino_serial": ArduinoSerialHandler,
}


def obtener_handler(type_dispositivo, handler_variant=None):
    entrada = REGISTRO_DE_HANDLERS.get(type_dispositivo)
    if entrada is None:
        raise ValueError(f"tipo de dispositivo desconocido: '{type_dispositivo}'")
    if isinstance(entrada, dict):
        # dispositivos con multiples backends, como xarm (seccion 3.1)
        clase = entrada.get(handler_variant or "physical")
    else:
        clase = entrada
    return clase()
```

**Paso 4 — prueba contra el contrato, no contra el sistema completo**: precisamente porque tu handler implementa una interfaz aislada, puedes escribir pruebas unitarias que instancien tu handler directamente, llamen `connect()`, `execute()` con comandos de prueba, y verifiquen que el formato de resultado cumple el contrato — sin necesitar levantar el dispatcher completo, la capa de transport, ni ningún otro handler. Esto es exactamente el beneficio de bajo riesgo de contribución que la modularidad promete: puedes validar tu trabajo de forma aislada antes de que toque el sistema integrado completo.

### 4.2 Qué NO tienes que tocar — y por qué eso es la garantía real de bajo riesgo

Escribiendo un handler nuevo siguiendo estos cuatro pasos, **nunca** tocas: la lógica de la capa de transport (módulo anterior), la lógica de validación de capability cards (módulo de arquitectura general), ni el código interno de ningún otro handler existente. El único punto de contacto con código compartido es la línea de registro del paso 3 — una modificación aditiva (agregar una entrada nueva), no una modificación de lógica existente. Esto es, en términos concretos y verificables, exactamente lo que hace que tu contribución sea revisable con confianza por el equipo ORION: el revisor no necesita re-auditar todo el sistema para confiar en tu cambio, solo necesita verificar que tu handler específico implementa correctamente el contrato y que tu entrada de registro es correcta — un scope de revisión acotado y manejable.

---

## 5. Edge cases y trampas explícitas

### 5.1 Un comando para un dispositivo desconectado

Si el dispatcher recibe un comando para un `type`/dispositivo específico cuyo handler nunca completó `connect()` exitosamente (o cuya conexión se cayó después, sin reconectar), `execute()` no debería intentar ejecutar sobre una conexión inexistente o muerta — el handler necesita, internamente, verificar su propio estado de conexión antes de intentar traducir y ejecutar el comando, devolviendo un resultado de error explícito en el formato común (no lanzando una excepción no capturada que podría propagarse de forma impredecible hacia el dispatcher). Esta responsabilidad vive **dentro** de cada handler específico, precisamente porque solo el handler sabe qué significa "estar conectado" para su protocolo particular.

### 5.2 Un handler que falla A MEDIA ejecución — el caso más peligroso de esta capa

Aquí está la trampa de mayor consecuencia física de todo el módulo. Considera un handler ejecutando un comando de movimiento de múltiples pasos (por ejemplo, mover tres ejes de un brazo robótico secuencialmente) y que, después de mover el primer eje exitosamente, encuentra un error al intentar mover el segundo (una pérdida de comunicación momentánea, un límite físico alcanzado inesperadamente). **El hardware queda en un estado intermedio, parcialmente ejecutado, y ni el handler ni el dispatcher tienen, por defecto, ninguna garantía automática de haber "deshecho" ese estado parcial** — a diferencia de una transacción de base de datos con rollback automático, no existe un mecanismo genérico de "deshacer un movimiento físico ya ejecutado" (el brazo ya se movió; no puedes simplemente "cancelar" ese movimiento de la misma forma que cancelas una escritura no confirmada en una base de datos).

**La mitigación, deducida de esta realidad física ineludible**: el `execute()` de un handler que ejecuta comandos de múltiples pasos necesita, como mínimo, **reportar con precisión hasta dónde llegó** en el resultado de error que devuelve (no solo "falló", sino "falló después de completar el paso 1 de 3, el eje X quedó en la posición Y") — exactamente la información que la reconciliación de estado (sección 2.1, `get_status()`, y el mecanismo de reconciliación tras reconexión del módulo de transport) necesita para que el sistema pueda razonar correctamente sobre qué hacer después, en vez de asumir ciegamente "el comando falló completamente" o "el comando se completó", ambos potencialmente falsos. Diseñar comandos multi-paso para que cada paso individual sea, en la medida de lo posible, **verificable independientemente** (puedes preguntar "¿en qué posición está el eje X ahora?" después de la falla, sin depender de que el handler haya llevado registro perfecto internamente) es la defensa más robusta contra este escenario — nuevamente, la misma disciplina de "verifica el estado físico real, no confíes en tu último estado asumido" que ya es un tema recurrente de esta ruta operativa completa.

### 5.3 Un `type` desconocido

Si el dispatcher recibe un comando con un `type` que no existe en el registro (sección 4.1) — ya sea por un error de configuración, un bug en la capa que generó el comando, o (más preocupante) una entrada de capability card corrupta o manipulada — la respuesta correcta es un rechazo explícito e inmediato (`ValueError`, o el equivalente de error en el formato común), **nunca** un intento silencioso de "adivinar" o usar algún handler por defecto. Un `type` desconocido tratado silenciosamente como "usa el handler que sea" es exactamente el tipo de comportamiento permisivo que la disciplina de validación estricta del módulo de arquitectura general existe para prevenir en cada capa del sistema, no solo en la validación inicial de la propuesta del LLM.

### 5.4 Simulación (mujoco) vs. físico — mismo comando, consecuencias radicalmente distintas

Vale la pena remarcar explícitamente, desde el ángulo de riesgo operativo: un comando que se ejecuta sin ningún problema contra el handler `mujoco` (sección 3.1) — porque la física simulada tolera, por ejemplo, una velocidad ligeramente fuera de lo recomendado sin ninguna consecuencia real — puede tener una consecuencia completamente distinta contra el handler `physical`, donde esa misma velocidad podría exceder un límite de seguridad real del motor físico. **Esto no es un defecto del patrón de handlers intercambiables — es una limitación inherente de cualquier simulación**, y la razón exacta de por qué la validación de capability card (que declara los rangos seguros específicos de **cada** handler, no un rango genérico compartido) tiene que reflejar los límites reales y específicos del handler `physical` con el mismo rigor que refleja los límites (potencialmente más permisivos) de la simulación — nunca asumas que "funcionó en mujoco" es evidencia suficiente de que es seguro contra el hardware físico real, exactamente el trade-off ya identificado en el módulo de arquitectura general (simulación para iteración rápida, validación final contra hardware físico antes de producción).

---

## 6. Trade-offs explícitos

**Dispatcher genérico vs. lógica específica**: la separación completa (dispatcher 100% genérico, toda la lógica específica aislada en handlers) es lo que este módulo defiende, pero tiene un costo real: cualquier comportamiento que necesites **compartir** entre múltiples handlers (por ejemplo, un mecanismo de logging uniforme, o una política de reintentos genérica) no puede vivir naturalmente en el dispatcher sin que el dispatcher empiece a "saber" cosas sobre cómo los handlers operan internamente — la solución típica es una clase base compartida (o funciones utilitarias) que los handlers pueden usar opcionalmente, sin que el dispatcher dependa de esa reutilización de ninguna forma. La modularidad completa no es gratis; exige disciplina para no filtrar conocimiento específico de vuelta hacia el componente genérico "por conveniencia".

**El patrón handler/plugin vs. un switch monolithic**: ya se argumentó extensamente en la sección 1 por qué el patrón de handlers gana en mantenibilidad y en aislamiento de riesgo conforme el número de dispositivos soportados crece. La contrapartida honesta: para un sistema con **exactamente un** tipo de dispositivo, y sin ninguna expectativa realista de agregar más, el overhead de definir una interfaz abstracta formal, un punto de registro, y la disciplina de mantener esa separación puede ser complejidad innecesaria comparada con simplemente escribir la lógica directamente. La justificación del patrón aparece, como en varios de los otros trade-offs de esta ruta, cuando el problema real (múltiples tipos de dispositivo heterogéneos, con expectativa de crecimiento) genuinamente lo amerita — que es, precisamente, la situación real de ORION Bridge.

**Simulación vs. físico para desarrollo seguro**: ya cubierto en profundidad en la sección 5.4 y en el módulo de arquitectura general — vale la pena remarcar aquí, desde el ángulo específico del patrón de handlers, que esta capacidad de intercambio **depende enteramente** de que ambos handlers (simulado y físico) implementen honestamente el mismo contrato con el mismo comportamiento observable desde afuera, aunque su implementación interna sea radicalmente distinta — si el handler de simulación se desvía sutilmente del contrato (por ejemplo, no reportando errores que el handler físico sí reportaría en condiciones equivalentes), la promesa de "desarrolla seguro contra simulación, despliega contra físico sin sorpresas" se rompe silenciosamente.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo documentado arriba.)*

**Este patrón ES el patrón Strategy / plugin architecture — dónde más lo vas a ver.** Lo que acabas de deducir desde cero para el Bridge tiene un nombre bien establecido en ingeniería de software general: el **patrón Strategy** (definir una familia de algoritmos/comportamientos intercambiables detrás de una interfaz común, permitiendo elegir cuál usar en tiempo de ejecución sin que el código que los usa necesite saber cuál específicamente está activo) combinado con una **arquitectura de plugins** (el mecanismo de registro que permite agregar implementaciones nuevas sin modificar el núcleo). Lo vas a encontrar, con la misma estructura conceptual exacta, en: los drivers de bases de datos (tu código de aplicación llama la misma API sin importar si detrás hay Postgres, MySQL, o SQLite — cada uno es, estructuralmente, un "handler" para un protocolo de base de datos distinto); los backends de un framework de machine learning (el mismo código de entrenamiento puede correr sobre CPU, GPU, o TPU, con cada backend implementando la misma interfaz de operaciones tensoriales); y los adaptadores de pago en cualquier sistema de e-commerce (procesar un pago con Stripe, PayPal, o una pasarela local, todos detrás de la misma interfaz de "procesar_pago"). Reconocer este patrón te permite transferir directamente todo lo que dedujiste aquí — incluyendo las trampas — a cualquiera de estos otros dominios sin tener que redescubrir el razonamiento desde cero.

**La misma separación que un router web + controllers.** Si has trabajado (o trabajas) con cualquier framework web con arquitectura MVC, el dispatcher del Bridge es, estructuralmente, idéntico al **router** de ese framework: recibe una petición, examina algún identificador (la URL/ruta, en vez del `type` de dispositivo), y la enruta hacia el **controller** correcto — sin que el router necesite saber qué hace cada controller internamente, exactamente como el dispatcher del Bridge no necesita saber cómo cada handler habla su protocolo. Los handlers de este módulo son, en esa analogía, los controllers: cada uno recibe la petición ya enrutada y contiene la lógica específica de qué hacer con ella. Esta es la misma separación de responsabilidades — enrutamiento genérico vs. ejecución específica — apareciendo en un dominio completamente distinto (web) con el mismo argumento de fondo: aislar el conocimiento específico para que el componente de enrutamiento pueda permanecer simple y estable mientras la lógica específica crece y cambia independientemente.

**Cómo AutoCard genera capability cards que el dispatcher/handlers consumen.** Tu propio proyecto AutoCard — generación autónoma de capability cards para la capa de enforcement de Orión Bridge — es, precisamente, el sistema que produce el **input** que hace posible que la capability card de cada handler (mencionada repetidamente en este módulo y en el de arquitectura general) exista y esté actualizada, sin que un humano tenga que escribirla manualmente para cada dispositivo. La conexión estructural es directa: AutoCard necesita, para generar una capability card correcta de un handler específico, entender (o poder inferir) qué acciones ese handler expone y con qué rangos seguros — información que, si sigues el patrón de este módulo consistentemente, cada handler ya declara de forma estructurada como parte de su implementación del contrato. Esto significa que tu trabajo en AutoCard y tu eventual contribución de un handler nuevo (el Arduino del siguiente módulo) no son dos piezas de trabajo separadas — son, literalmente, las dos mitades del mismo sistema: un handler bien diseñado, siguiendo el contrato de este módulo, es exactamente lo que hace posible que AutoCard pueda generar su capability card de forma confiable y automática.

---

## Síntesis — el mapa mental

1. Un switch/if-elif monolítico para enrutar comandos hacia dispositivos heterogéneos acopla el riesgo de cambios entre dispositivos sin relación funcional — el problema que la separación dispatcher/handlers resuelve directamente.
2. El **Dispatcher** solo necesita conocer un mapeo `type → handler`, nunca el protocolo específico de ningún dispositivo — su simplicidad y estabilidad dependen enteramente de que nunca absorba conocimiento específico de ningún handler individual.
3. Cada **Handler** implementa un contrato común (`connect`, `execute`, `get_status`, `disconnect`) sobre un formato de entrada/salida compartido — el "idioma común" que permite al dispatcher tratar a cualquier handler de forma uniforme, sin importar qué tan heterogéneo sea su protocolo interno real.
4. xArm con tres backends (physical/mujoco/gazebo) es la prueba viva de que el patrón funciona: mismo `type`, mismo contrato, implementaciones radicalmente distintas, intercambiables solo vía configuración.
5. El **shell whitelisted** ilustra la disciplina de seguridad más explícita del patrón: el input externo determina **cuál** acción predefinida se dispara, nunca **qué comando exacto** se ejecuta — la misma disciplina que previene inyección SQL, aplicada a inyección de shell.
6. Escribir un handler nuevo se reduce a cuatro pasos bien definidos (implementar el contrato, definir acciones válidas, registrar en el punto central, probar de forma aislada) — con exactamente un punto de contacto con código compartido (el registro), lo que acota el riesgo de revisión de cualquier contribución nueva.
7. Un handler que falla a media ejecución de un comando multi-paso deja al hardware en un estado intermedio sin rollback automático posible — la mitigación es reportar con precisión hasta dónde se llegó, y diseñar pasos verificables independientemente vía `get_status()`, no confiar en el último estado asumido.
8. Simulación y físico, aunque comparten contrato, pueden divergir en las consecuencias reales de un mismo comando — la validación de capability card debe reflejar los límites reales de **cada** handler específico, nunca un rango genérico compartido entre simulación y hardware real.

---

## Preguntas que deberías poder responder

*(Las primeras cuatro son, deliberadamente, del tipo defensa de diseño que un revisor del equipo ORION te haría.)*

1. Explica por qué el dispatcher no debe conocer ningún detalle del SDK de UFACTORY, snap7, o cualquier otro protocolo específico — ¿qué se rompería en términos de mantenibilidad si el dispatcher tuviera, aunque sea parcialmente, lógica específica de un dispositivo embebida en su código?
2. Si tuvieras que escribir un handler para un dispositivo nuevo (por ejemplo, un Arduino por serial), ¿qué cuatro métodos tendrías que implementar como mínimo, y qué necesitarías modificar del resto del sistema para que el dispatcher pudiera enrutarle comandos? Sé específico sobre qué NO tendrías que tocar.
3. ¿Por qué el handler de shell mapea una `accion` abstracta hacia una lista de argumentos fija y predefinida, en vez de interpolar directamente el comando recibido hacia `subprocess`? Conecta tu respuesta con un principio de seguridad que ya conozcas de otro dominio (por ejemplo, prevención de inyección SQL).
4. Describe, paso a paso, qué debería pasar si un handler falla después de completar el primer paso de un comando de movimiento de tres pasos — ¿qué información mínima necesita reportar, y por qué "simplemente reintentar el comando completo desde cero" podría ser peligroso sin esa información?
5. Explica por qué xArm con tres handlers distintos (physical/mujoco/gazebo) bajo el mismo `type` es una prueba de que el contrato de interfaz está en el nivel de abstracción correcto — ¿qué tendría que ser cierto sobre la interfaz para que esto funcione, y qué se rompería si no fuera cierto?
6. ¿Qué debería hacer el dispatcher si recibe un comando con un `type` que no existe en su registro? ¿Por qué "usar algún handler por defecto silenciosamente" sería una violación grave de la disciplina de validación estricta que ya viste en el módulo de arquitectura general del Bridge?
7. Explica por qué un comando que se ejecuta sin problema contra el handler `mujoco` no es evidencia suficiente de que es seguro ejecutarlo contra el handler `physical` del mismo dispositivo — ¿qué tendría que ser cierto sobre la capability card de cada handler para que esta brecha no se convierta en un riesgo real?
8. Conecta el patrón de este módulo con el patrón Strategy/plugin de ingeniería de software general — da un ejemplo, no mencionado en este texto, de otro sistema que probablemente uses o conozcas que aplique la misma separación de responsabilidades.

---

## Fuentes

- Repositorio oficial: github.com/Starman26/orion-bridge-v2 — la tabla de dispositivos soportados y sus handlers (xarm physical/mujoco/gazebo, abb vía TCP/RAPID, plc vía snap7, shell whitelisted vía subprocess) fue verificada directamente contra el README del repositorio en una consulta previa de este mismo trabajo de documentación.
- El contenido específico de `orion_bridge/dispatcher.py` y de los archivos individuales en `orion_bridge/handlers/` (la implementación exacta de la interfaz `DeviceHandler`, el mecanismo exacto de registro, y el formato exacto de comando/resultado) **no pudo verificarse línea por línea** — la navegación directa del árbol de archivos del repositorio no fue accesible durante la investigación de este módulo, y una búsqueda dedicada para recuperar el contenido del repositorio en esta sesión específica no devolvió resultados adicionales más allá de lo ya verificado en trabajo previo de esta misma serie. El razonamiento sobre el contrato de interfaz, el mecanismo de registro, y el patrón de handler de shell whitelisted se construyó deduciendo consecuencias necesarias de la arquitectura documentada por el equipo (dispositivos con múltiples backends bajo el mismo `type`, shell restringido explícitamente) — no como afirmación de haber inspeccionado ese código específico.
- Gamma, Helm, Johnson, Vlissides (Gang of Four), *Design Patterns: Elements of Reusable Object-Oriented Software*, 1994 — referencia estándar del patrón Strategy mencionado en Conexiones.
