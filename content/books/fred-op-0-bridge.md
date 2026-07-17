---
module_id: fred-op-0-bridge
spine: FrED
path: Operativo
title: "La arquitectura del ORION Bridge"
subtitle: "Cómo dejas que un LLM mueva un robot sin que una alucinación rompa algo"
source_canonical: "github.com/Starman26/orion-bridge-v2; ORION platform docs (equipo)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# La arquitectura del ORION Bridge

> **Pregunta raíz.** Un LLM es un sistema probabilístico — genera la respuesta más plausible dado su contexto, no la respuesta *garantizadamente correcta*. Eso es aceptable, incluso deseable, cuando la salida es texto que un humano va a leer y filtrar con su propio juicio. Es completamente inaceptable cuando la salida es un comando que mueve físicamente un brazo robótico de 6 ejes o activa una salida de un PLC conectado a maquinaria real. **¿Cómo diseñas un sistema donde un LLM puede proponer acciones sobre hardware industrial, sin que una alucinación — inevitable, tarde o temprano, en cualquier sistema probabilístico — se traduzca en equipo roto o una persona lastimada?** Cada decisión de arquitectura del ORION Bridge es la respuesta a esa pregunta, y este módulo existe para que la entiendas al nivel de quien podría extenderla, no solo usarla.

## Prólogo — de dónde nace esto

Piensa en un guardia de seguridad en la entrada de una planta industrial que recibe instrucciones por radio de un supervisor que no está físicamente presente. El supervisor dice "abre la puerta 3, deja pasar al camión de las 2pm". El guardia no abre la puerta automáticamente al escuchar la orden — primero **verifica**: ¿esta persona tiene autorización para dar esta orden? ¿La puerta 3 es una puerta que existe y que este guardia puede abrir? ¿La orden tiene sentido dado el protocolo de seguridad vigente (¿de verdad hay un camión programado a las 2pm)? Solo después de esa verificación, el guardia traduce la orden en una acción física concreta y verificada — nunca ejecuta la orden cruda tal cual llegó por radio.

El ORION Bridge es exactamente ese guardia, formalizado en software. El LLM es el "supervisor por radio": propone intenciones en lenguaje natural o en una representación estructurada derivada de lenguaje natural, con toda la falibilidad que eso implica. El Bridge nunca ejecuta esa propuesta directamente sobre el hardware — la intercepta, la valida contra reglas explícitas que no dependen de la buena voluntad ni de la corrección del LLM, y solo entonces la traduce en una acción física concreta, a través del protocolo específico que ese dispositivo entiende. Cada pieza de esta arquitectura — por qué existe una capa intermedia, por qué es modular por tipo de dispositivo, por qué la autenticación tiene dos capas separadas, por qué el shell está restringido a una lista blanca — se deriva de tomar en serio, hasta las últimas consecuencias, la idea de que **nunca puedes confiar en que el LLM mismo se autorregule correctamente**. La validación tiene que vivir afuera de él, en un sistema que no alucina.

---

## 1. Por qué el LLM nunca toca el hardware directo — el requisito que genera toda la arquitectura

### 1.1 La naturaleza del problema: dos categorías de error completamente distintas

Un LLM puede fallar de dos formas cualitativamente distintas, y hay que distinguirlas con precisión porque exigen mitigaciones distintas:

**Error de razonamiento dentro del dominio correcto**: el LLM entiende correctamente qué se le pidió, pero se equivoca en los detalles — por ejemplo, calcula mal una trayectoria de movimiento, o elige un parámetro de velocidad subóptimo. Esto es corregible con mejor prompting, mejor contexto, o revisión humana — es, en esencia, el mismo tipo de error que cometería un ingeniero humano cansado, y las mitigaciones son similares (revisión, límites de seguridad conservadores).

**Alucinación estructural**: el LLM genera una acción que **no tiene ninguna relación válida** con lo que se le pidió o con lo que el sistema físico permite — invoca un comando que no existe, propone mover un eje fuera de su rango físico, o construye una secuencia de acciones que combina capacidades de formas que nunca deberían combinarse. Esta categoría es la que importa para el diseño del Bridge, porque **no es corregible con mejor prompting** — es una propiedad estructural de cómo funcionan los modelos generativos: siempre existe una probabilidad no nula de que la siguiente palabra/token generado se desvíe hacia algo sintácticamente plausible pero semánticamente inválido, sin importar qué tan bien diseñado esté el prompt. Puedes reducir la probabilidad con mejor ingeniería de contexto, pero **no puedes llevarla a cero** — y "no cero" es exactamente lo que hace inaceptable confiar en el LLM como única línea de defensa cuando la consecuencia de un error es física e irreversible (un brazo robótico que colisiona con algo, un PLC que activa un actuador en el momento equivocado).

### 1.2 La consecuencia de diseño: la validación tiene que vivir en un sistema que NO alucina

Si aceptas 1.1, la conclusión es inevitable: necesitas una capa de verificación que sea **determinística** — que dado el mismo input, siempre produzca el mismo veredicto de válido/inválido, sin ninguna component probabilística — y que viva **fuera** del LLM, en código convencional que puedes auditar, testear, y razonar sobre su comportamiento exhaustivamente (exactamente el tipo de garantía de peor caso que ya viste como principio general en módulos anteriores de este curso — aquí aplicado no a un algoritmo abstracto, sino a la frontera entre software y el mundo físico). Esa capa es el **Bridge**, y su función central, no negociable, es: **el LLM propone, el Bridge decide si esa propuesta se ejecuta, y el LLM nunca tiene un canal directo hacia el hardware que evite esa decisión.**

Esta es la razón de que la arquitectura documentada por el equipo describa un flujo de varias etapas explícitas — **intent → capability card → validation → protocolo → hardware** — en vez de un camino directo LLM→dispositivo. Cada etapa de ese flujo existe para eliminar, en ese punto específico, una clase distinta de error que la etapa anterior no puede prevenir por sí sola. Vamos a diseccionar cada una.

---

## 2. El flujo completo — deducido etapa por etapa

### 2.1 Intent — lo que el LLM produce, y por qué no es todavía una acción

La primera etapa es la salida del LLM: una **intención** — una representación (probablemente estructurada, del tipo function-calling/tool-use que ya conoces de trabajar con modelos como Claude) de "lo que se quiere lograr", derivada del lenguaje natural del operador humano. Nota la elección de palabra deliberada: **intent**, no **command**. Un intent es una propuesta; un command, en este sistema, es algo que solo existe después de haber sido validado. Esta distinción de vocabulario no es cosmética — encarna la regla central de la sección 1.2: nada que salga directamente del LLM tiene, todavía, autorización de ejecutarse.

### 2.2 Capability card — el contrato explícito de qué es posible, ANTES de que el LLM proponga nada

Aquí está la pieza conceptual más importante de la arquitectura, y la que más vale la pena deducir con cuidado. Antes de que el LLM pueda proponer una acción sobre un dispositivo, el sistema necesita saber **qué acciones son posibles y válidas para ESE dispositivo específico, en ESE momento** — sus límites físicos (rangos de movimiento de cada eje, velocidades máximas seguras), su estado actual (¿está en modo manual o automático? ¿ya está ejecutando otra acción?), y qué parámetros son obligatorios para cada tipo de acción.

Una **capability card** es exactamente esa declaración explícita, servida al LLM como contexto **antes** de que genere su propuesta — funciona como una credencial que dice, con precisión verificable, "esto es lo que puedes pedir, con estos parámetros, dentro de estos rangos" — análogo a cómo una credencial de acceso físico no solo identifica a alguien, sino que declara exactamente qué puertas puede abrir, no una autorización genérica de "puede entrar a donde quiera". Esto cumple dos funciones simultáneas, y hay que distinguirlas:

**Función 1 — guía al LLM hacia propuestas más probablemente válidas**: al darle al modelo el "menú" exacto de acciones posibles con sus rangos válidos, reduces la probabilidad de que alucine algo completamente fuera de contexto — esto mejora la tasa de propuestas correctas en primera instancia, exactamente como un menú de restaurante bien diseñado reduce la probabilidad de que un cliente pida algo que la cocina no puede preparar.

**Función 2 — NO es la garantía de seguridad en sí misma**: darle al LLM el contexto correcto reduce la *probabilidad* de alucinación, pero por la sección 1.1, nunca la elimina. La capability card, sola, es una mejora de calidad de propuesta — **la garantía real de seguridad vive en la siguiente etapa**, la validación, que verifica de forma determinística que lo que el LLM efectivamente propuso (sin importar qué tan bien o mal se haya comportado) cae dentro del envelope declarado por la card. Confundir estas dos funciones — pensar que "darle un buen prompt con las capacidades correctas" es suficiente seguridad — es exactamente el error de diseño que la arquitectura completa existe para prevenir.

### 2.3 Validation — la capa que no puede vivir en el LLM, y por qué

Esta es la etapa que hace cumplir, de forma mecánica y auditable, el contrato que la capability card declaró. Recibe la propuesta concreta que el LLM generó (ya no una intención abstracta, sino algo con parámetros específicos: "mueve el eje 3 a 47 grados a velocidad X") y verifica, con código convencional determinístico:

- ¿Esta acción está dentro del conjunto de acciones que la capability card de este dispositivo específico declaró como posibles?
- ¿Los parámetros (ángulo, velocidad, posición) están dentro de los rangos físicos seguros declarados?
- ¿El estado actual del dispositivo permite esta acción ahora (por ejemplo, no está en medio de otra operación, no está en un estado de error, no requiere una secuencia previa que no se cumplió)?

**Por qué esta validación no puede vivir en el LLM, argumentado con rigor y no solo por intuición**: si le pides al LLM mismo que "se auto-valide" (por ejemplo, con una instrucción en el prompt del tipo "verifica que tu propuesta esté dentro de rangos seguros antes de responder"), estás pidiéndole al mismo sistema probabilístico que genera potencialmente la propuesta errónea que también genere, de forma igualmente probabilística, el veredicto de si esa propuesta es errónea. **No hay ninguna garantía de que la misma fuente de incertidumbre no produzca, en el mismo paso generativo o en uno inmediatamente posterior, tanto la alucinación como una "auto-validación" que la acepte como correcta** — de hecho, es plausible que la misma confusión o sesgo que produjo la propuesta errónea contamine también el juicio de auto-validación, precisamente porque ambos viven en el mismo proceso generativo con el mismo contexto y las mismas limitaciones. La única forma de tener una garantía real es que el veredicto de validez lo emita un sistema **estructuralmente distinto** — código convencional, con reglas fijas, sin ningún componente de generación de lenguaje involucrado en la decisión — de forma que la falla del LLM y la falla del validador sean **independientes**, no correlacionadas. Esto es, en esencia, el mismo principio de "necesitas un mecanismo de verificación externo al sistema que puede fallar" que aparece en disciplinas de ingeniería de seguridad crítica mucho más allá del software (por ejemplo, sistemas de enclavamiento — *interlock* — en maquinaria industrial, que existen precisamente porque no puedes confiar en que el operador humano nunca cometa un error, sin importar qué tan bien entrenado esté).

### 2.4 Protocolo — la traducción específica al lenguaje de cada dispositivo

Una vez que una acción está validada, todavía no puede ejecutarse directamente — cada tipo de hardware "habla" un protocolo de comunicación distinto y específico: un xArm físico se controla vía el SDK de UFACTORY sobre la red IP local; un controlador ABB acepta comandos RAPID sobre un socket TCP hacia su SocketServer; un PLC Siemens S7 se controla vía el protocolo S7 usando la librería snap7; un comando de shell es, literalmente, un subproceso del sistema operativo. Esta etapa es la traducción de "acción validada, en formato abstracto y común" a "la secuencia exacta de bytes/llamadas que ese dispositivo específico entiende" — y es exactamente el punto donde entra el **modelo de handlers**, el corazón extensible del Bridge.

### 2.5 Hardware — el punto final, y por qué todo lo anterior existe para llegar aquí con seguridad

El hardware ejecuta la acción tal cual el protocolo se la entregó. Para cuando la señal llega aquí, ya pasó por: generación de intención (con contexto de capacidades reales), validación determinística contra rangos y estado, y traducción a protocolo específico verificado. **Ningún paso de esta cadena confía ciegamente en el paso anterior** — cada uno asume que el anterior pudo haber fallado, y solo el hardware, al final, ejecuta algo que ya pasó por todos los filtros. Esa es la propiedad arquitectónica central: **defensa en profundidad**, no un único punto de confianza.

---

## 3. El modelo de handlers — por qué modular, y dónde Armando podría contribuir

### 3.1 El problema que la modularidad resuelve

Cada tipo de dispositivo soportado por ORION Bridge tiene un mecanismo de comunicación radicalmente distinto: el xArm físico usa el SDK de UFACTORY sobre IP; la simulación MuJoCo del mismo xArm usa una API de simulación física completamente distinta (sin red, sin robot real, un motor de física corriendo localmente); Gazebo se controla vía rosbridge (un puente hacia el ecosistema ROS); un controlador ABB acepta RAPID sobre un socket TCP crudo; un PLC Siemens habla el protocolo S7 vía la librería snap7; y un comando de shell es simplemente un subproceso del sistema operativo, con una lista blanca de comandos permitidos.

**Si el Bridge tuviera una sola pieza de código monolítica que "supiera hablar con todos los dispositivos"**, cada vez que agregas soporte para un tipo de hardware nuevo tendrías que modificar ese código central — con el riesgo real de que un cambio para soportar, digamos, un nuevo tipo de PLC, introduzca un bug que afecte accidentalmente el manejo del xArm, que no tiene ninguna relación funcional con PLCs. Esto es exactamente el mismo problema de acoplamiento que ya viste en el módulo de arquitectura de datos industriales (sección de por qué el broker desacopla productores de consumidores) — aquí aplicado a "tipos de dispositivo" en vez de "productores/consumidores de mensajes".

**La solución, deducida de ese problema**: cada tipo de dispositivo se implementa como un **handler independiente**, que cumple una **interfaz común** (el mismo conjunto de operaciones que el resto del sistema espera poder invocar, sin importar qué hardware específico hay detrás) pero cuya implementación interna es completamente distinta y aislada de los demás handlers. El código que valida acciones (sección 2.3) y el código que despacha protocolo (sección 2.4) hablan con **cualquier** handler a través de esa interfaz común — no necesitan saber si están hablando con un xArm físico o con una simulación MuJoCo, solo necesitan saber que ese handler implementa las operaciones esperadas.

```python
# Patron ilustrativo de la interfaz que un handler deberia exponer,
# deducido de la arquitectura documentada (NO es codigo verificado
# linea por linea del repo -- es el contrato estructural que la
# arquitectura de handlers modular exige para funcionar como se describe).

class DeviceHandler:
    """
    Interfaz comun que cualquier handler de dispositivo debe implementar,
    sin importar el protocolo fisico real detras de el.
    """

    def connect(self, config: dict) -> None:
        """Establece la conexion especifica del protocolo (IP, socket TCP,
        snap7, subprocess, lo que corresponda a este tipo de dispositivo)."""
        raise NotImplementedError

    def get_capability_card(self) -> dict:
        """Devuelve la declaracion explicita de que acciones son posibles
        ahora mismo para ESTE dispositivo, con sus rangos validos --
        la pieza que el LLM recibe como contexto (seccion 2.2)."""
        raise NotImplementedError

    def execute(self, comando_validado: dict) -> dict:
        """Recibe SOLO comandos que ya pasaron la capa de validacion
        (seccion 2.3) -- este metodo nunca deberia recibir una
        propuesta cruda del LLM sin validar."""
        raise NotImplementedError

    def get_status(self) -> dict:
        """Estado actual del dispositivo, necesario para que la
        validacion sepa si una accion es permisible AHORA (ej. no
        esta en medio de otra operacion, no esta en estado de error)."""
        raise NotImplementedError


class XArmFisicoHandler(DeviceHandler):
    """
    Handler para el xArm fisico via UFACTORY SDK sobre IP -- uno de
    los handlers documentados en el repo real.
    """
    def connect(self, config):
        # aqui viviria la conexion real via el SDK de UFACTORY,
        # usando config["ip"] segun el connections.toml (seccion 4)
        ...

    def get_capability_card(self):
        return {
            "device_type": "xarm",
            "handler": "physical",
            "acciones_permitidas": ["move_joint", "move_linear", "home"],
            "rangos_ejes_grados": {"joint_1": [-360, 360], "joint_2": [-118, 120]},
            # rangos reales dependen del modelo especifico de xArm
        }

    def execute(self, comando_validado):
        ...

    def get_status(self):
        ...
```

**Por qué este es exactamente el punto donde Armando podría contribuir al corazón del proyecto**: escribir un handler nuevo (por ejemplo, para un tipo de dispositivo que ORION todavía no soporta) es una contribución **aislada y de bajo riesgo** para el resto del sistema — implementas la interfaz común, y mientras tu implementación sea correcta, el resto de la arquitectura (validación, dispatch de protocolo, autenticación) sigue funcionando exactamente igual para todos los demás handlers, sin que tu código nuevo pueda romperlos accidentalmente. Esto es, en la práctica, la diferencia entre "contribuir un plugin aislado que el equipo puede revisar con confianza porque su blast radius está acotado" y "modificar el núcleo compartido del sistema, donde cualquier error tiene blast radius sobre todo lo demás" — la primera es una vía de entrada mucho más natural y de menor fricción para alguien que se está integrando al proyecto, precisamente porque la modularidad ya hizo el trabajo de acotar el riesgo de antemano.

### 3.2 Simulación (MuJoCo/Gazebo) como handlers de PRIMERA CLASE, no como un afterthought

Nota, en la tabla de dispositivos soportados del repo real, que el xArm tiene **tres** handlers distintos — `physical`, `mujoco`, `gazebo` — todos implementando la misma interfaz común. Esto no es casualidad de diseño: significa que puedes desarrollar y probar toda la lógica de intent → capability card → validation contra una simulación física (MuJoCo) o un entorno robótico simulado más completo (Gazebo, vía rosbridge), **sin tocar ni arriesgar el hardware físico real**, y luego cambiar únicamente la configuración (qué handler usar, en el `connections.toml`) para apuntar al xArm físico real, sin cambiar ninguna otra pieza de la arquitectura. Esto es exactamente la clase de trade-off que vale la pena tener explícito (retomado en la sección 6): simulación para iteración rápida y segura durante desarrollo, hardware físico para la validación final antes de producción.

---

## 4. Seguridad como primer principio — las dos capas de autenticación

### 4.1 Por qué DOS identidades distintas, y no una sola

El repo real declara explícitamente dos capas de autenticación separadas:

1. **Identidad de bridge**: `ORION_BRIDGE_ID` + `ORION_BRIDGE_TOKEN`, provisionados una sola vez y almacenados en variables de entorno (nunca en el archivo de configuración). Esta identidad es necesaria para que el proceso del Bridge mismo pueda conectarse al servidor central de ORION — es la identidad de la **máquina/proceso**, no de una persona.
2. **Identidad de usuario**: mediante `orion login`, que envía un código OTP (one-time password) al correo del usuario y almacena un JWT resultante en `~/.orion/credentials.json`. Esta identidad es necesaria específicamente para `orion repl` — el modo interactivo donde un humano (o, en el contexto de este módulo, un agente actuando en nombre de un humano autorizado) puede efectivamente enviar comandos.

**Por qué separar estas dos identidades, deducido desde el principio de privilegio mínimo**: la identidad de bridge autoriza *que el proceso exista y pueda hablar con el servidor* — es una credencial de infraestructura, análoga a la clave de una máquina física que vive en un rack. La identidad de usuario autoriza *que una persona específica pueda emitir comandos a través de ese bridge* — es una credencial de acción. Si fueran la **misma** credencial, cualquiera que comprometiera el token del bridge (por ejemplo, filtrado de un archivo `.env` mal protegido, o de un log que accidentalmente lo capturó) tendría automáticamente **también** la capacidad de emitir comandos como si fuera un usuario autorizado — colapsando dos superficies de riesgo completamente distintas en una sola. Separándolas, un compromiso del token de bridge (grave, pero limitado a "el proceso puede seguir conectado al servidor") no te da automáticamente la capacidad de controlar el hardware — necesitarías **además** comprometer una sesión de usuario autenticada por OTP, un mecanismo completamente distinto (acceso al correo electrónico del usuario, no solo al filesystem donde vive el `.env`). Esta es la aplicación directa y concreta del **principio de privilegio mínimo**: cada credencial autoriza exactamente lo que necesita autorizar, ni un ápice más, de forma que comprometer una no implica automáticamente comprometer la otra.

```bash
# Flujo real de autenticacion, fiel al README del repo:

# 1. Identidad de bridge -- se establece via variables de entorno,
#    tipicamente en un archivo .env que NUNCA se versiona en git
#    (deberia estar en .gitignore, exactamente como el token de un
#    servicio cualquiera nunca deberia vivir en el repositorio):
export ORION_BRIDGE_ID="hostname-mezzanine"
export ORION_BRIDGE_TOKEN="el-token-secreto-provisionado-por-el-owner"
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_ANON_KEY="tu-anon-key-NO-service-role"

# 2. Identidad de usuario -- login interactivo, separado del paso anterior:
orion login     # envia OTP al correo, guarda JWT en ~/.orion/credentials.json

# 3. Ahora, y SOLO ahora, el modo interactivo esta disponible:
orion repl      # requiere login previo

# El menu basico y el arranque del bridge SI funcionan sin login de usuario:
orion            # menu interactivo
orion --start    # arranca el bridge sin REPL, sin necesitar login de usuario
```

### 4.2 Por qué el token NUNCA vive en el archivo de configuración

El `connections.toml` declara, por perfil, un campo `token_env` — **el nombre de la variable de entorno donde vive el token real**, no el token mismo. Esto es una separación deliberada entre **qué se versiona/comparte** (el archivo de configuración, que puede vivir en un repositorio, ser compartido entre miembros del equipo, o incluirse en documentación) y **qué es secreto** (el valor real del token, que vive únicamente en el entorno de ejecución de cada máquina específica). Si el token viviera directamente en el TOML, cualquier persona con acceso de lectura al archivo de configuración (que, por su naturaleza de "declarar qué hardware existe y cómo alcanzarlo", es información que razonablemente se comparte entre el equipo del laboratorio) tendría automáticamente acceso a la credencial de autenticación — colapsando, de nuevo, dos categorías de información que deberían tener niveles de acceso completamente distintos: "qué hardware existe" (información operativa, compartible) vs. "la credencial secreta que autentica contra el servidor" (información sensible, estrictamente no compartible).

### 4.3 Anon key, NO service_role — el modelo de amenaza explícito

El README declara explícitamente: `SUPABASE_ANON_KEY` — **no** `service_role`. Esta distinción, si vienes del mundo de Supabase (como Armando, que ya la vive en Arcanum), tiene un modelo de amenaza preciso detrás:

Una **anon key** de Supabase está diseñada para ser usada en clientes **no confiables** — el supuesto de diseño es que esta clave puede filtrarse (aparecer en código de cliente, en una app móvil descompilada, en el bundle de JavaScript de una web) sin que eso, por sí solo, comprometa la seguridad de los datos, **porque toda operación autenticada con anon key sigue estando sujeta a las políticas de Row Level Security (RLS)** definidas en la base de datos — la anon key identifica "esta petición viene de un cliente anónimo/público", pero no le da automáticamente permiso de leer o escribir cualquier cosa; ese permiso lo siguen decidiendo las políticas RLS específicas de cada tabla.

Una **service_role key**, en contraste, está diseñada explícitamente para **saltarse** las políticas RLS — es la credencial de "confío completamente en este proceso, dale acceso total sin restricciones de política" — apropiada únicamente para código de servidor completamente confiable, que nunca se expone a un cliente ni se filtra accidentalmente.

**El modelo de amenaza concreto de por qué el Bridge usa anon key**: si un token de bridge se filtrara (sección 4.2 ya reconoce que es un riesgo real que hay que mitigar en profundidad, no solo prevenir), y esa credencial estuviera acompañada de una `service_role key` en el mismo proceso, un atacante con ese acceso filtrado tendría **acceso irrestricto a toda la base de datos del sistema completo** — no solo a lo que el Bridge específico necesita para operar, sino a cualquier tabla, de cualquier laboratorio, de cualquier usuario. Con `anon key` en su lugar, un compromiso del mismo tipo queda acotado por las políticas RLS específicas que el equipo de ORION definió — el atacante hereda exactamente los permisos que el diseño de políticas le concede a un cliente anónimo, no acceso total al sistema. Esta es, de nuevo, la aplicación exacta del principio de privilegio mínimo: **la credencial que vive en un proceso que podría, en el peor caso, ser comprometido, debe estar diseñada desde el origen para que ese peor caso sea acotado, no catastrófico.**

### 4.4 El shell whitelisted — el ejemplo más explícito de capability restringida

El handler de tipo `shell` (subprocess, según la tabla del repo) es, de todos los handlers, el que tiene la superficie de riesgo potencialmente más amplia — un shell sin restricciones puede, en principio, ejecutar **cualquier** comando del sistema operativo, incluyendo cosas que no tienen nada que ver con controlar un dispositivo de laboratorio (borrar archivos, iniciar conexiones de red arbitrarias, instalar software). La documentación es explícita en que este handler está **whitelisted** — restringido a un conjunto predefinido y acotado de comandos permitidos, no un shell abierto donde cualquier string generado por el LLM se ejecuta tal cual.

**Por qué esto es el ejemplo más puro del principio de "capability card restringida"**: para cualquier otro handler (xArm, ABB, PLC), la restricción de qué es posible viene naturalmente acotada por el protocolo mismo — un xArm solo entiende comandos de movimiento de sus ejes, no puede "ejecutar código arbitrario" porque su interfaz de control no lo permite estructuralmente. Un shell del sistema operativo, en cambio, **es** de propósito general por diseño — no hay ninguna restricción estructural natural que limite qué puede hacer, así que la restricción tiene que imponerse **explícitamente**, vía whitelist, exactamente como el resto de la arquitectura impone restricciones explícitas sobre lo que de otro modo sería un espacio de acciones sin límite natural. Es la prueba, por caso extremo, de que el principio de "nunca confíes en que el llamador se autolimite" aplica incluso (especialmente) cuando el mecanismo subyacente es tan flexible como un shell de sistema operativo.

---

## 5. La configuración real — `connections.toml` como declaración explícita de qué existe

El archivo vive en `~/.orion/connections.toml` y declara, por **perfil** (representando típicamente un laboratorio o entorno físico distinto), qué dispositivos existen y cómo alcanzarlos:

```toml
# Que perfil usar cuando no se especifica --connection explicitamente
[default]
profile = "mezzanine"

# Un perfil por laboratorio/entorno
[connections.mezzanine]
server    = "wss://your-server.example.com/ws/robot"
lab_id    = "mezzanine"
bridge_id = "hostname-mezzanine"       # unico por proceso de bridge
token_env = "ORION_TOKEN_MEZZANINE"    # el token REAL vive en esta env-var,
                                         # nunca aqui en el TOML

[[connections.mezzanine.devices]]
type = "xarm"
id   = "xarm-lab1"
ip   = "192.168.1.185"

[[connections.mezzanine.devices]]
type = "shell"
id   = "shell-local"

# Un segundo perfil, ej. desarrollo local con simulacion
[connections.dev]
server    = "ws://localhost:8000/ws/robot"
lab_id    = "dev"
bridge_id = "localhost-dev"
token_env = "ORION_TOKEN_DEV"

[[connections.dev.devices]]
type      = "xarm"
id        = "xarm6-mujoco"
handler   = "mujoco"          # mismo tipo de dispositivo, handler distinto
viewer    = true
mjcf_path = "sim/models/xarm6/scene_xarm6.xml"
```

**Lo que este archivo hace explícito, y por qué esa explicitud es una decisión de seguridad, no solo de conveniencia**: cualquier persona con acceso de lectura a este archivo puede ver exactamente qué hardware existe, en qué laboratorio, y cómo se alcanza — pero **no puede, con esta información sola, autenticarse ni ejecutar nada**, porque el token real vive fuera del archivo (sección 4.2). Esto permite que el archivo de configuración se comparta libremente dentro del equipo (para que cualquiera pueda entender qué dispositivos están disponibles en cada perfil) sin que compartirlo implique compartir acceso real. Nota también cómo el mismo `type = "xarm"` puede tener distintos valores de `handler` (por defecto, `physical`; explícitamente `mujoco` en el segundo perfil) — la separación entre "qué tipo de dispositivo es, conceptualmente" y "qué handler concreto lo implementa" es exactamente el mecanismo que permite intercambiar simulación por hardware físico solo cambiando configuración, como se estableció en la sección 3.2.

---

## 6. Trade-offs explícitos

**Modularidad vs. simplicidad**: cada handler nuevo agrega una superficie de código independiente que hay que mantener, testear, y potencialmente tiene sus propias dependencias externas (mujoco, roslibpy, python-snap7 — nota cómo el repo real usa extras de instalación opcionales precisamente para no forzar a todos los usuarios a instalar dependencias de dispositivos que no tienen). La alternativa monolítica sería más simple de entender de un vistazo, pero, como se estableció en la sección 3.1, acopla el riesgo de cambios entre dispositivos sin relación funcional. La decisión de ORION de favorecer modularidad es una apuesta consciente de que el costo de mantenimiento distribuido es preferible al riesgo de acoplamiento — una apuesta razonable específicamente porque el dominio (hardware industrial heterogéneo) tiene handlers que genuinamente no comparten casi nada de su lógica interna de protocolo.

**Validación estricta vs. flexibilidad**: una capability card muy restrictiva (rangos estrechos, pocas acciones permitidas) es más segura pero limita qué tan útil y expresivo puede ser el sistema para el operador humano — si el LLM solo puede proponer un conjunto muy acotado de acciones, muchas tareas legítimas se vuelven imposibles de expresar. Una capability card muy permisiva amplía lo que el sistema puede hacer, pero acerca los rangos "válidos" a los límites físicos reales del hardware, reduciendo el margen de seguridad si la validación tiene algún error de implementación. **No hay una respuesta universalmente correcta** — es, de nuevo (como en el módulo de ML aplicado a control de calidad), una decisión que depende del costo real de cada tipo de error en el contexto específico: qué tan caro/peligroso es un falso positivo (rechazar una acción legítima) contra un falso negativo (permitir una acción que resulta ser peligrosa).

**Simulación (MuJoCo/Gazebo) vs. hardware físico para desarrollo**: desarrollar y probar contra simulación es más rápido, más seguro (ningún riesgo de dañar equipo real durante iteración), y permite correr pruebas automatizadas de forma reproducible sin depender de disponibilidad física del hardware — pero una simulación, por definición, es un modelo aproximado, y puede no capturar comportamientos físicos reales (fricción real, latencia real de red hacia el dispositivo físico, comportamiento de bordes de sensores reales con ruido genuino) que solo se manifiestan contra el hardware físico. La arquitectura de handlers intercambiables (sección 3.2) existe exactamente para permitir un flujo de trabajo de "desarrolla e itera contra simulación, valida finalmente contra hardware físico antes de considerar algo listo para producción" — sin que ese cambio de simulación a físico requiera reescribir ninguna lógica de negocio, solo cambiar qué handler está configurado.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo documentado arriba.)*

**El mismo principio que Armando ya vive en Arcanum, aplicado a un dominio con consecuencias físicas.** El patrón anon key + RLS de Supabase que Arcanum usa para su propio backend es, estructuralmente, el mismo principio de privilegio mínimo que la sección 4.3 describe para el Bridge — la diferencia central es la **consecuencia de un fallo**: si una política RLS mal configurada en Arcanum se filtra, el peor caso es exposición de datos de aprendizaje personal, serio pero recuperable. Si una validación mal configurada en el Bridge permite un comando fuera de rango a un brazo robótico real, el peor caso es daño físico irreversible a equipo o, en el peor escenario, a una persona. Esto no cambia el principio de diseño (privilegio mínimo, defensa en profundidad, nunca confiar en un solo punto de verificación) — cambia radicalmente **cuánto margen de error es tolerable**, y por lo tanto cuánta validación redundante y explícita se justifica invertir en cada capa. Reconocer que ya conoces este principio de un contexto de menor consecuencia es exactamente lo que te permite razonar con confianza sobre por qué el Bridge lo aplica con más rigor todavía.

**Sistemas ciberfísicos y el "airgap conceptual" LLM↔hardware.** El diseño completo del Bridge es una instancia concreta del principio general de sistemas ciberfísicos (ya introducido en el módulo `fred-s1-datos-industriales`): cuando software y mundo físico están acoplados, las garantías de correctitud del software tienen que ser mucho más estrictas que en software puramente digital, porque un error no se manifiesta como una excepción capturable o un dato incorrecto en una base de datos — se manifiesta como una consecuencia física, potencialmente irreversible. El "airgap conceptual" entre el LLM y el hardware (la garantía de que ningún camino de ejecución conecta directamente la salida del LLM con una acción sobre el dispositivo, sin pasar por validación determinística) es la instancia específica de ese principio general aplicada aquí — y es exactamente el tipo de garantía arquitectónica que un revisor senior del equipo ORION va a examinar con más escrutinio que cualquier otra parte del sistema, precisamente porque es la única línea de defensa entre "el LLM se equivocó" y "algo físico se rompió".

**El ángulo Nahual: un Bridge mal asegurado es un vector de ataque físico, no solo de datos.** Todo lo que ya reconoces de seguridad de sistemas (superficies de ataque, principio de privilegio mínimo, por qué la autenticación en capas limita el blast radius de un compromiso) aplica aquí con una escalada de consecuencia real: un atacante que logra comprometer las credenciales del Bridge, o que encuentra una forma de inyectar un intent malicioso que la validación no captura correctamente, no solo compromete datos — puede, en el peor escenario, **controlar maquinaria física real**. Esto convierte al Bridge en un vector de ataque de una categoría que rara vez se discute en la formación convencional de ciberseguridad orientada a web/datos: la seguridad de sistemas ciberfísicos industriales (ICS/SCADA security, ya mencionada en el módulo anterior de este mismo eje FrED) trata exactamente este tipo de superficie — donde el objetivo del atacante no es exfiltrar información, sino causar daño físico o interrumpir un proceso industrial crítico. La razón concreta de por qué el equipo ORION invirtió en dos capas de autenticación separadas, tokens fuera de configuración versionada, anon key en vez de service_role, y un shell explícitamente whitelisted, es precisamente que alguien en el diseño del sistema **ya pensó como atacante** sobre cada uno de estos puntos — exactamente el ejercicio mental que tu entrenamiento en Nahual te prepara para hacer de forma sistemática, no solo intuitiva.

---

## Síntesis — el mapa mental

1. La pregunta raíz — cómo permitir que un sistema probabilístico controle hardware real sin que sus fallas inevitables (alucinaciones estructurales, no solo errores de razonamiento corregibles) causen daño — obliga a que **ninguna validación de seguridad viva dentro del LLM mismo**; tiene que vivir en un sistema determinístico, estructuralmente independiente, para que la falla del LLM y la falla del validador no estén correlacionadas.
2. El flujo **intent → capability card → validation → protocolo → hardware** es defensa en profundidad: cada etapa asume que la anterior pudo haber fallado. La capability card mejora la *probabilidad* de que el LLM proponga algo válido; la validación es la *garantía* real, determinística, de que solo se ejecuta lo que cae dentro del envelope declarado.
3. El **modelo de handlers** modulariza la implementación de cada tipo de dispositivo detrás de una interfaz común — desacoplando el riesgo de que un cambio en un handler afecte a los demás, y creando el punto de contribución de menor fricción y menor blast radius para alguien integrándose al proyecto: escribir un handler nuevo, no modificar el núcleo compartido.
4. **Dos capas de autenticación separadas** (identidad de bridge vs. identidad de usuario) acotan el blast radius de cualquier compromiso individual — comprometer una no implica automáticamente comprometer la otra, aplicando privilegio mínimo a nivel de arquitectura de credenciales.
5. El **token nunca vive en configuración versionable**, solo en variables de entorno — separando "qué hardware existe" (compartible) de "la credencial que autentica" (estrictamente secreta).
6. **Anon key, no service_role**, acota el peor caso de un compromiso del Bridge a lo que las políticas RLS conceden a un cliente anónimo, no a acceso irrestricto al sistema completo.
7. El **shell whitelisted** es el ejemplo más puro de por qué la restricción explícita de capacidades es necesaria incluso (especialmente) cuando el mecanismo subyacente es de propósito general sin límite natural.
8. Los **handlers de simulación** (MuJoCo, Gazebo) como ciudadanos de primera clase, intercambiables solo vía configuración con el handler físico, habilitan un flujo de desarrollo seguro y rápido que se valida finalmente contra hardware real — sin reescribir lógica de negocio al cambiar de uno a otro.

---

## Preguntas que deberías poder responder

*(Las primeras cuatro son, deliberadamente, del tipo que un revisor del equipo ORION te haría en una revisión de diseño — defiende tu razonamiento, no solo recites la arquitectura.)*

1. Explica por qué la validación de una propuesta del LLM no puede vivir dentro del prompt o de una instrucción de auto-verificación al propio LLM — ¿qué propiedad estructural de los sistemas probabilísticos hace que esto no ofrezca ninguna garantía real, incluso si "funciona" la mayoría de las veces en pruebas?
2. ¿Por qué existen dos capas de autenticación separadas (bridge vs. usuario) en vez de una sola credencial que autorice todo? Argumenta con un escenario concreto de compromiso parcial (solo una de las dos credenciales filtrada) y qué puede o no puede hacer un atacante en cada caso.
3. Si tuvieras que escribir un handler nuevo para un dispositivo que ORION Bridge no soporta todavía, ¿qué métodos de la interfaz común tendrías que implementar, y por qué el resto del sistema (validación, dispatch de protocolo) no necesita saber nada sobre los detalles internos de tu implementación?
4. ¿Qué podría hacer un atacante con una `service_role key` filtrada que no podría hacer con una `anon key` filtrada, dado que ambas viven en el mismo tipo de archivo de entorno? Sé específico sobre el mecanismo (RLS) que hace la diferencia.
5. Explica, con tus propias palabras, la diferencia entre "la capability card reduce la probabilidad de alucinación" y "la validación garantiza que no se ejecute una alucinación" — ¿por qué confundir estas dos funciones es un error de diseño de seguridad, no solo una imprecisión conceptual?
6. ¿Por qué el shell (subprocess) necesita una whitelist explícita mientras que el handler de xArm no necesita una restricción equivalente igual de explícita? ¿Qué diferencia estructural entre ambos protocolos explica esto?
7. Diseña, en palabras, un escenario de ataque donde un intent generado por el LLM pase la capability card (porque pide una acción que suena razonable) pero debería ser rechazado en la etapa de validación por el estado actual del dispositivo — ¿qué información necesita la validación que la capability card, por sí sola, no captura?
8. ¿Por qué desarrollar contra el handler `mujoco` en vez del handler `physical` durante la fase de iteración temprana de un proyecto nuevo sobre el Bridge es una decisión de ingeniería razonable, y qué tendrías que verificar antes de confiar en que tu código funciona igual de bien contra el hardware físico real?

---

## Fuentes

- Repositorio oficial: github.com/Starman26/orion-bridge-v2 — README verificado directamente (estructura de `connections.toml`, tabla de dispositivos/handlers soportados, variables de entorno de autenticación, comandos CLI de `orion login`/`orion repl`/`orion --start`). Este módulo cita el README real donde fue posible verificarlo directamente.
- El flujo de arquitectura **intent → capability card → validation → protocolo → hardware**, y el detalle interno de la lógica de validación, corresponden a la arquitectura documentada por el equipo ORION tal como se describió a este autor — no pudieron verificarse línea por línea contra el código fuente interno del repo (la navegación directa del árbol de archivos del repositorio no fue accesible durante la investigación de este módulo). El razonamiento sobre esas etapas se construyó deduciendo consecuencias necesarias del requisito de seguridad de la sección 1, consistentes con lo documentado por el equipo — no como afirmación de haber inspeccionado ese código específico.
- Documentación de Supabase sobre Row Level Security y la distinción entre `anon` key y `service_role` key: https://supabase.com/docs/guides/database/postgres/row-level-security
