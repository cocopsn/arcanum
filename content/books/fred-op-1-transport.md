---
module_id: fred-op-1-transport
spine: FrED
path: Operativo
title: "Transport — la conexión viva del Bridge"
subtitle: "Por qué controlar un robot exige una línea abierta, no cartas"
source_canonical: "github.com/Starman26/orion-bridge-v2 (orion_bridge/transport.py)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 42
---

# Transport — la conexión viva del Bridge

> **Pregunta raíz.** El servidor ORION necesita poder decirle al Bridge "mueve el eje 3 a 47 grados" **en el instante en que un operador o un agente lo decide** — no cuando el Bridge decida preguntar si hay algo pendiente. Y el Bridge necesita poder decirle al servidor "aquí está la telemetría en vivo, aquí está la confirmación de que el movimiento se ejecutó" **en el instante en que ocurre** — no en lotes periódicos. **¿Qué tipo de conexión de red permite que ambos lados empujen información hacia el otro, en cualquier momento, sin que ninguno tenga que "preguntar" primero?** Esa es exactamente la pregunta que fuerza la elección de WebSocket sobre cualquier alternativa basada en petición/respuesta — y toda la capa de transport del Bridge es la ingeniería necesaria para mantener esa conexión viva, autenticada, y segura durante horas o días de operación continua sobre hardware real.

## Prólogo — de dónde nace esto

Piensa en la diferencia entre mandar cartas y tener una llamada telefónica abierta. Con cartas (HTTP request/response clásico), cada parte solo puede "hablar" cuando decide escribir y enviar — y la otra parte solo se entera de algo cuando decide **revisar su buzón**. Si necesitas que la otra persona reaccione a algo en el instante en que ocurre, tendrías que hacerla revisar el buzón constantemente, cada segundo, "por si acaso" — ineficiente, y con un retraso inherente igual al intervalo entre revisiones. Con una llamada telefónica abierta (WebSocket), ambas partes pueden hablar en el momento exacto en que tienen algo que decir, y la otra escucha inmediatamente, sin tener que estar "revisando" nada — la línea simplemente está viva, todo el tiempo, hasta que alguien cuelga.

Para un chat, una llamada abierta es conveniente. Para un Bridge que controla un brazo robótico físico, no es conveniente — **es la única opción viable**. Si el servidor tuviera que esperar a que el Bridge "revise su buzón" para enterarse de un comando de emergencia, el retraso entre la decisión del operador y la ejecución física podría ser inaceptable. Este módulo deduce, desde ese requisito de tiempo real bidireccional, por qué WebSocket es la elección de la arquitectura documentada de ORION, y luego construye — con el mismo rigor de primer principio — todo lo que hace falta para que esa "llamada abierta" sobreviva en la práctica: autenticación, heartbeat, reconexión, y qué hacer con un comando que estaba en tránsito exactamente cuando la línea se cortó.

---

## 1. Por qué HTTP request/response no sirve — deducido, no asumido

### 1.1 El modelo HTTP clásico, y su asimetría fundamental

HTTP fue diseñado, en su forma original, alrededor de un patrón estrictamente asimétrico: el **cliente** inicia cada intercambio con una petición, y el **servidor** responde — el servidor **nunca** puede iniciar una comunicación hacia el cliente por su cuenta. Esto es perfecto para el caso de uso original de la web (un navegador pide una página, el servidor la entrega), pero impone una restricción estructural que se vuelve un problema real en cuanto necesitas que **el servidor** sea quien tenga que comunicar algo urgente hacia el cliente sin que el cliente lo haya pedido primero.

### 1.2 Las soluciones intermedias, y por qué cada una se queda corta

**Polling** (el cliente pregunta repetidamente "¿hay algo nuevo?" cada X segundos): tiene un retraso inherente igual al intervalo de polling — si preguntas cada 5 segundos, un comando urgente puede esperar hasta 5 segundos antes de ser siquiera descubierto, inaceptable para control de hardware en tiempo real. Además, cada pregunta, aunque la respuesta sea "no, nada nuevo", consume una conexión HTTP completa (con su propio overhead de conexión TCP y cabeceras) — un desperdicio constante de recursos de red y del servidor si escalas a muchos bridges preguntando constantemente.

**Long-polling** (el cliente pregunta, pero el servidor **retiene** la respuesta abierta hasta que efectivamente hay algo que reportar, o hasta un timeout): reduce el retraso de descubrimiento comparado con polling simple, pero sigue siendo fundamentalmente una petición HTTP por respuesta — en cuanto el servidor responde (con o sin datos), el cliente tiene que iniciar una **nueva** petición inmediatamente para seguir "escuchando", y durante ese breve reciclaje de conexión, cualquier evento nuevo del servidor puede perderse o retrasarse. Sigue sin resolver la asimetría fundamental: el servidor solo puede "hablar" en respuesta a una petición ya abierta, nunca de forma completamente espontánea con una conexión nueva que él mismo decida iniciar.

**Server-Sent Events (SSE)**: resuelve elegantemente el problema de "servidor empuja hacia cliente" — el servidor mantiene una conexión HTTP abierta y puede enviar eventos hacia el cliente en cualquier momento, sin que el cliente tenga que volver a pedir nada. **Pero SSE es unidireccional** — el cliente no tiene, dentro del mismo canal, una forma de enviar datos de vuelta hacia el servidor; necesitarías un canal HTTP separado para eso. Para el caso de uso del Bridge, donde necesitas **ambas** direcciones activas simultáneamente sobre la misma conexión (comandos bajando, telemetría subiendo, en cualquier momento, sin coordinación previa), SSE resuelve solo la mitad del problema.

### 1.3 WebSocket — full-duplex, deducido como la única solución completa

**WebSocket** resuelve el problema completo: es un protocolo que empieza como una petición HTTP normal (el **handshake**, ver sección 2), pero que luego **actualiza (upgrade)** esa conexión hacia un canal completamente distinto — una conexión TCP persistente donde **ambas partes pueden enviar mensajes en cualquier momento, de forma completamente independiente una de la otra**, sin la estructura de petición/respuesta de HTTP. Esto es exactamente lo que se llama **full-duplex**: ambos lados hablan y escuchan simultáneamente por el mismo canal, como una llamada telefónica real, a diferencia de un walkie-talkie (half-duplex, donde solo uno puede hablar a la vez) o de una carta (request/response, donde hablar exige esperar tu turno de iniciar).

**Por qué full-duplex es exactamente lo que el Bridge necesita, y no una conveniencia extra**: en cualquier instante de operación, el servidor puede necesitar enviar un comando nuevo (o una orden de emergencia de detener todo) **mientras** el Bridge está, simultáneamente, transmitiendo telemetría de la operación en curso — ambos flujos de información son genuinamente independientes en el tiempo, no se turnan. Un protocolo que forzara turnos (como HTTP request/response estrictamente alternado) introduciría una fricción artificial exactamente donde la seguridad exige la menor fricción posible: el momento de emitir una orden de detención de emergencia no debería tener que esperar a que termine de "ser tu turno" de hablar.

---

## 2. El mecanismo de WebSocket — el handshake y los frames, deducidos

### 2.1 El handshake: por qué empieza como HTTP y no como algo completamente nuevo

Una conexión WebSocket **empieza literalmente como una petición HTTP GET normal**, con dos cabeceras especiales: `Upgrade: websocket` y `Connection: Upgrade`, más una clave aleatoria (`Sec-WebSocket-Key`) que el servidor debe transformar de una forma criptográficamente verificable y devolver en su respuesta, como prueba de que efectivamente entiende y acepta el protocolo WebSocket (y no es, por ejemplo, un proxy HTTP genérico que simplemente reenvió la petición sin entenderla). Si el servidor acepta, responde con el código de estado HTTP `101 Switching Protocols` — y a partir de ese momento, **la misma conexión TCP subyacente deja de hablar HTTP y empieza a hablar el protocolo de framing de WebSocket**.

**Por qué empezar como HTTP tiene sentido de diseño, y no es solo tradición histórica**: reutilizar el mecanismo de negociación de HTTP permite que una conexión WebSocket **atraviese la misma infraestructura de red que ya existe para HTTP** — proxies, balanceadores de carga, firewalls corporativos que ya están configurados para permitir tráfico HTTP/HTTPS en los puertos estándar (80/443) — sin exigir que esa infraestructura entienda un protocolo completamente nuevo desde cero. Esto es exactamente por qué el server de ORION se declara en `connections.toml` con un esquema `wss://` (WebSocket Secure, el equivalente de WebSocket sobre TLS, análogo a cómo `https://` es HTTP sobre TLS) — aprovechando toda la infraestructura de certificados y cifrado que ya existe para HTTPS.

### 2.2 Frames — la unidad de mensaje después del handshake

Una vez completado el handshake, la comunicación ocurre en **frames** — unidades de mensaje con una cabecera compacta (indicando, entre otras cosas, si el frame contiene datos de texto o binarios, si es un frame de control como ping/pong/close, y la longitud del payload) seguida del contenido real del mensaje. A diferencia de HTTP, donde cada petición/respuesta es una transacción completa con sus propias cabeceras extensas, un frame de WebSocket tiene overhead mínimo — apropiado para enviar mensajes frecuentes y pequeños (exactamente el perfil de telemetría de sensores a alta frecuencia) sin pagar el costo de cabeceras HTTP completas en cada mensaje individual.

---

## 3. La capa de transport del Bridge — estableciendo y autenticando la conexión

### 3.1 Qué declara `connections.toml`, y por qué esa información específica

Ya viste, en el módulo anterior sobre la arquitectura del Bridge, la estructura de `connections.toml`. Aquí la revisamos específicamente desde el ángulo de qué necesita la capa de transport para hacer su trabajo:

```toml
[connections.mezzanine]
server    = "wss://your-server.example.com/ws/robot"
lab_id    = "mezzanine"
bridge_id = "hostname-mezzanine"
token_env = "ORION_TOKEN_MEZZANINE"
```

**Cada campo existe porque la capa de transport lo necesita para una función específica**: `server` es el endpoint WebSocket exacto hacia el cual iniciar el handshake de la sección 2.1 — nota el esquema `wss://`, no `ws://`, exigiendo TLS desde la configuración misma (retomado con más detalle en Conexiones). `lab_id` y `bridge_id` son la identidad que el transport declara al servidor durante o inmediatamente después del handshake, permitiendo que el servidor sepa **cuál** bridge específico se está conectando — necesario porque el servidor de ORION puede tener múltiples bridges de múltiples laboratorios conectados simultáneamente, y necesita distinguir de forma inequívoca de cuál viene cada mensaje. `token_env` es el nombre de la variable de entorno donde vive la credencial real — la capa de transport lee esta variable en tiempo de ejecución y la usa para autenticarse, nunca leyendo el valor del token directamente del archivo de configuración (exactamente la separación de seguridad ya establecida en el módulo anterior: `ORION_BRIDGE_ID` + `ORION_BRIDGE_TOKEN` viven en variables de entorno, nunca en el TOML).

### 3.2 El patrón de conexión y autenticación — código ilustrativo del mecanismo

```python
# Patron ilustrativo del ciclo de vida de conexion de la capa de
# transport, deducido de la arquitectura documentada del Bridge
# (identidad de bridge_id + token via env-var, conexion WSS declarada
# en connections.toml). NO es una transcripcion verificada linea por
# linea de orion_bridge/transport.py -- la navegacion directa del
# codigo fuente no fue accesible durante la investigacion de este
# modulo (ver nota en Fuentes). Es el patron estructural que la
# arquitectura documentada exige para funcionar como se describe.

import asyncio
import os
import json
import websockets

async def conectar_bridge(config):
    bridge_id = os.environ["ORION_BRIDGE_ID"]
    token = os.environ[config["token_env"]]

    # El handshake de WebSocket (seccion 2.1) ocurre dentro de
    # websockets.connect() -- la libreria maneja el upgrade HTTP
    # automaticamente. wss:// implica TLS, exigido por el esquema
    # mismo declarado en connections.toml.
    async with websockets.connect(config["server"]) as conexion:

        # Mensaje de autenticacion INICIAL, inmediatamente despues
        # de que el handshake de bajo nivel completa -- esta es la
        # identidad de BRIDGE (maquina/proceso), distinta de la
        # identidad de USUARIO por OTP que ya viste en el modulo
        # anterior, y que vive en una capa logica sobre esta conexion,
        # no en el transport mismo.
        mensaje_auth = {
            "type": "bridge_auth",
            "bridge_id": bridge_id,
            "lab_id": config["lab_id"],
            "token": token,
        }
        await conexion.send(json.dumps(mensaje_auth))

        respuesta = await conexion.recv()
        resultado = json.loads(respuesta)
        if resultado.get("status") != "authenticated":
            raise ConnectionError(f"Autenticacion de bridge rechazada: {resultado}")

        return conexion
```

**Por qué la autenticación ocurre como el PRIMER mensaje sobre la conexión ya establecida, y no como parte del handshake HTTP mismo**: técnicamente, podrías intentar pasar el token como parte de las cabeceras HTTP del handshake (algunos sistemas lo hacen). La arquitectura documentada de ORION, sin embargo, trata la autenticación como un mensaje explícito dentro del protocolo de aplicación sobre WebSocket, no como parte de las cabeceras HTTP de bajo nivel — esto tiene la ventaja de que el mecanismo de autenticación vive en la misma capa lógica que el resto de los mensajes del protocolo (intent, capability card, telemetría — todo lo que viste en el módulo de arquitectura del Bridge), facilitando razonar sobre todo el protocolo de aplicación de forma unificada, en vez de dividir la lógica de seguridad entre "lo que va en cabeceras HTTP" y "lo que va en mensajes de aplicación".

---

## 4. Reconexión — el problema duro de toda conexión persistente

### 4.1 Por qué una conexión persistente eventualmente se rompe, sin excepción

Ninguna conexión de red es perfectamente estable indefinidamente: interrupciones momentáneas de la red física, reinicio del servidor por mantenimiento, saturación temporal de la red del laboratorio, o simplemente el proceso del Bridge reiniciándose. **La pregunta de diseño no es "¿cómo evito que esto pase?" — es inevitable — sino "¿qué hace el sistema automáticamente cuando pasa, sin intervención humana?"**

### 4.2 Heartbeat/keepalive — deducido desde el problema de detectar una desconexión silenciosa

Aquí hay una sutileza que vale la pena deducir con cuidado: una conexión TCP puede quedar en un estado donde, del lado de la aplicación, **parece** seguir abierta (el socket no ha reportado ningún error), pero en realidad la conectividad física subyacente ya se perdió — por ejemplo, si un cable de red se desconecta abruptamente sin que ninguna de las dos partes haya cerrado la conexión de forma ordenada. Sin ningún mecanismo adicional, ninguna de las dos partes se enteraría de esta desconexión silenciosa hasta que intentara enviar datos y esa operación fallara (potencialmente después de un timeout largo de TCP a nivel de sistema operativo).

**La solución, deducida directamente de este problema**: un mecanismo de **heartbeat** — mensajes de "ping" enviados periódicamente (por ejemplo, cada N segundos) por uno o ambos lados, esperando un "pong" de respuesta dentro de una ventana de tiempo razonable. Si el pong no llega dentro de esa ventana, la conexión se declara **muerta** activamente, en vez de esperar pasivamente a que un intento de envío de datos reales falle — esto acorta drásticamente el tiempo de detección de una desconexión silenciosa, que es exactamente lo que necesitas para poder disparar la reconexión (sección 4.3) lo antes posible, minimizando cuánto tiempo el Bridge está efectivamente desconectado del servidor sin que nadie lo sepa todavía.

**Analogía**: el heartbeat es literalmente la pregunta "¿sigues ahí?" que haces periódicamente en una llamada telefónica cuando hay silencio prolongado — no porque sospeches activamente un problema cada vez, sino porque es la única forma de distinguir "la otra persona está pensando en silencio" de "la llamada se cortó y nadie se ha dado cuenta todavía".

### 4.3 Backoff exponencial — por qué reconectar agresivamente es contraproducente

Cuando se detecta una desconexión (por heartbeat fallido o por un error directo de la conexión), la respuesta obvia es "reconectar inmediatamente". Pero considera qué pasa si la razón de la desconexión es que **el servidor está caído o sobrecargado** — reconectar inmediatamente, y con la misma inmediatez repetidamente si cada intento falla, significa que **el mismo Bridge** (y potencialmente muchos bridges de muchos laboratorios simultáneamente, si la caída es del lado del servidor) bombardea al servidor con intentos de reconexión constantes, exactamente en el momento en que el servidor menos puede manejar carga adicional — un patrón que puede, en el peor caso, **impedir activamente que el servidor se recupere**, porque la carga de las reconexiones constantes compite con los recursos que el servidor necesitaría para volver a estar sano.

**La solución estándar, deducida de este problema**: **backoff exponencial** — el intervalo de espera entre reintentos de reconexión crece exponencialmente con cada fallo consecutivo (por ejemplo: espera 1 segundo antes del primer reintento, 2 segundos antes del segundo si el primero falló, 4 segundos, 8, 16... típicamente con un límite superior razonable, como no esperar más de, digamos, 60 segundos entre intentos, y frecuentemente con **jitter** — una pequeña variación aleatoria agregada a cada intervalo, para evitar que múltiples bridges que fallaron simultáneamente por la misma causa terminen todos reintentando en el mismo instante exacto, sincronizados, lo cual recrearía el mismo problema de sobrecarga sincronizada que el backoff intenta evitar).

```python
async def conectar_con_reconexion(config, max_espera=60):
    """
    Patron ilustrativo de reconexion con backoff exponencial + jitter.
    Deducido del problema de la seccion 4.3 -- no una transcripcion
    verificada de transport.py.
    """
    espera = 1
    while True:
        try:
            conexion = await conectar_bridge(config)
            espera = 1   # reconexion exitosa: resetear el backoff
            return conexion
        except (ConnectionError, OSError) as error:
            jitter = espera * 0.1 * (2 * __import__("random").random() - 1)
            tiempo_espera = min(espera + jitter, max_espera)
            print(f"Reconexion fallida ({error}); reintentando en {tiempo_espera:.1f}s")
            await asyncio.sleep(tiempo_espera)
            espera = min(espera * 2, max_espera)   # backoff exponencial
```

### 4.4 El problema real: qué pasa con un comando en vuelo cuando la conexión cae

Esta es la pregunta de mayor consecuencia práctica de todo el módulo, precisamente por lo que está en juego: **el Bridge controla hardware físico**. Considera el escenario exacto: el servidor envía un comando de movimiento; la conexión se cae **exactamente** en algún punto entre "el servidor envió el comando" y "el Bridge confirmó que se ejecutó completamente".

**Los tres momentos posibles de la caída, y por qué cada uno exige un razonamiento distinto**:

1. **La conexión cae antes de que el comando llegue al Bridge**: el comando simplemente nunca se ejecutó. Desde la perspectiva del servidor, esto es indistinguible de "el Bridge estaba desconectado y nunca recibió nada" — el servidor necesita, tras la reconexión, alguna forma de saber que ese comando específico nunca se confirmó como ejecutado, y decidir si reintentarlo (si sigue siendo seguro/relevante hacerlo) o descartarlo.

2. **La conexión cae DESPUÉS de que el comando llegó al Bridge, pero ANTES de que el hardware terminara de ejecutarlo (o antes de que la confirmación de vuelta llegara al servidor)**: este es el caso más peligroso. El brazo robótico puede seguir ejecutando el movimiento físicamente **incluso sin conexión al servidor** (el hardware no depende de la conexión WebSocket para completar un movimiento ya en curso — eso sería, de hecho, más peligroso todavía: un movimiento a medias que se detiene abruptamente por una caída de red). Cuando la conexión se restablece, el servidor no sabe, sin información adicional, si ese comando se ejecutó completamente, parcialmente, o nada — y **reenviarlo ciegamente podría ejecutar el mismo movimiento dos veces**, potencialmente peligroso si el estado físico ya cambió desde que se emitió originalmente.

3. **El comando se ejecutó y se confirmó completamente, pero la confirmación se perdió en tránsito hacia el servidor** exactamente cuando la conexión cayó: el hardware está en el estado correcto, pero el servidor, sin la confirmación, no lo sabe — el riesgo aquí es que el servidor, asumiendo que el comando falló, lo reenvíe, causando una ejecución duplicada de algo que ya había ocurrido.

**La mitigación estructural, deducida de estos tres casos**: cada comando necesita un **identificador único** (para poder distinguir "este es un comando nuevo" de "esto es un reintento del mismo comando anterior" — la misma necesidad de idempotencia que aparece en cualquier sistema distribuido con reintentos), y el Bridge, tras reconectar, necesita poder **reportar su estado actual real del hardware** (no solo "reanudar como si nada hubiera pasado"), permitiendo que el servidor **reconcilie** su vista del mundo con la realidad física antes de decidir si reenviar algún comando pendiente. Esto es exactamente la razón de que el flujo completo del Bridge (visto en el módulo anterior: intent → capability card → validation → protocolo → hardware) tenga que incluir, como parte de su diseño, un mecanismo de **consulta de estado actual del dispositivo** (`get_status()`, en el patrón de handler ya visto) — precisamente para que, tras cualquier interrupción de la capa de transport, el sistema pueda **verificar la realidad física antes de asumir cualquier cosa sobre comandos en vuelo**, en vez de operar ciegamente sobre el supuesto de que el último estado conocido sigue siendo válido.

---

## 5. Edge cases y trampas explícitas

### 5.1 Mensajes duplicados tras reconectar

Si el mecanismo de reconexión, combinado con reintento automático de mensajes no confirmados, no incluye deduplicación por identificador único de mensaje (sección 4.4), un mismo comando puede ejecutarse más de una vez tras una reconexión — silenciosamente, sin ningún error visible, hasta que alguien nota que el brazo robótico se movió dos veces cuando debería haberse movido una. La mitigación: cada mensaje de comando lleva un ID único, y el Bridge (o el handler específico) mantiene un registro de los últimos IDs procesados, descartando duplicados exactos antes de reejecutar cualquier acción física.

### 5.2 Timeouts — cuánto esperar antes de declarar algo "perdido"

Tanto el heartbeat (sección 4.2) como cualquier comando individual necesitan un timeout explícito — sin uno, el sistema puede quedar esperando indefinidamente una respuesta que nunca llegará (por ejemplo, si el servidor procesó el comando pero la respuesta de confirmación se perdió en la red). Elegir el valor de timeout correcto es, de nuevo, un trade-off explícito: demasiado corto, y declaras "perdido" algo que en realidad solo estaba tardando un poco más de lo usual (generando reintentos innecesarios); demasiado largo, y el sistema tarda más de lo necesario en reaccionar a un fallo real.

### 5.3 Dos bridges con el mismo `bridge_id`

Si, por error de configuración (copiar un `.env` de un bridge a otro sin cambiar `ORION_BRIDGE_ID`), dos procesos de Bridge distintos se conectan simultáneamente con la misma identidad de bridge, el servidor no tiene forma de distinguir de cuál de los dos viene cada mensaje de telemetría, ni hacia cuál de los dos debería dirigir un comando específico — el comportamiento resultante depende de cómo el servidor maneje esta ambigüedad (podría rechazar la segunda conexión, sobrescribir el estado de la primera, o mezclar mensajes de ambas de forma impredecible), pero en cualquier caso es un estado de configuración que **nunca** debería ocurrir en un despliegue correcto — cada `bridge_id` debe ser único, y la trampa concreta es no verificarlo explícitamente al aprovisionar un bridge nuevo copiando la configuración de uno existente sin actualizar este campo específico.

---

## 6. Trade-offs explícitos

**WebSocket vs. alternativas** — ya derivado en la sección 1, resumido: polling es simple pero introduce retraso inherente y desperdicio de recursos; long-polling reduce el retraso pero no lo elimina y mantiene la asimetría fundamental de HTTP; SSE resuelve el empuje servidor→cliente pero es unidireccional; WebSocket es la única opción que da full-duplex real con overhead mínimo por mensaje — la elección correcta cuando ambas direcciones necesitan poder iniciar comunicación espontáneamente, como es el caso aquí.

**Reconexión agresiva vs. backoff**: reconectar inmediatamente tras cada fallo minimiza el tiempo de indisponibilidad si el problema es momentáneo y aislado, pero puede agravar activamente una falla del lado del servidor si muchos clientes reintentan simultáneamente y sin control. Backoff exponencial con jitter sacrifica algo de velocidad de recuperación en el caso más favorable (una desconexión aislada y breve) a cambio de proteger al sistema completo contra el caso más costoso (una falla del servidor agravada por una tormenta de reconexiones sincronizadas) — una apuesta razonable dado que el segundo caso es mucho más caro de mitigar después de que ya ocurrió.

**At-least-once vs. at-most-once delivery, sobre hardware físico**: garantizar "al menos una vez" (reintentar hasta confirmar) arriesga ejecución duplicada de un comando físico si la deduplicación (sección 5.1) no está bien implementada — peligroso para acciones no idempotentes (mover un eje una segunda vez desde una posición ya movida no es lo mismo que no haberlo movido). Garantizar "a lo más una vez" (nunca reintentar automáticamente, para evitar duplicación) arriesga que un comando genuinamente perdido en tránsito nunca se ejecute, sin que nadie se entere hasta que la ausencia de la acción esperada se note por otros medios. **La resolución práctica, ya insinuada en la sección 4.4**: ninguno de los dos extremos es correcto por sí solo — necesitas at-least-once delivery **combinado con** deduplicación por ID único, que efectivamente te da la garantía más fuerte y útil de las dos: "se ejecuta exactamente una vez, incluso si el mensaje se reintenta" (exactly-once **a nivel de efecto**, aunque el transporte subyacente solo garantice at-least-once a nivel de entrega del mensaje).

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo documentado arriba.)*

**El mismo patrón en el health_stream — telemetría en vivo, no solo comandos.** El mismo mecanismo de conexión persistente que este módulo describe para comandos descendentes es, en la dirección opuesta, exactamente lo que sostiene un flujo de telemetría en vivo del Bridge hacia el servidor (mencionado en el contexto de arquitectura de ORION como parte del panorama general del sistema) — la misma conexión WebSocket, el mismo heartbeat, la misma lógica de reconexión con backoff, sirviendo ahora para que el estado físico del dispositivo (posición del brazo, temperatura, estado de error) fluya continuamente hacia cualquier sistema que lo esté observando, sin que ese sistema tenga que "preguntar" repetidamente. Es el mismo principio de full-duplex de la sección 1.3, simplemente enfatizando la dirección Bridge→servidor en vez de servidor→Bridge — ambas direcciones comparten exactamente la misma infraestructura de transport.

**WebSockets en general — el mismo patrón detrás de chat, trading, y colaboración en vivo.** El requisito que dedujiste en la sección 1 (ambas partes necesitan poder empujar información en cualquier momento, sin turnos forzados) no es exclusivo de robótica industrial — es exactamente el mismo requisito detrás de una aplicación de chat en vivo (cualquiera de los participantes puede escribir en cualquier momento), una plataforma de trading en tiempo real (los precios cambian y deben notificarse instantáneamente, sin que el cliente tenga que preguntar constantemente), o una herramienta de edición colaborativa en vivo (los cambios de cualquier colaborador deben reflejarse inmediatamente en las pantallas de los demás). Reconocer esto es útil prácticamente: cualquier patrón de diseño que aprendas resolviendo problemas de robustez de conexión aquí (heartbeat, backoff, deduplicación) es directamente transferible a cualquier sistema con estos mismos requisitos de tiempo real bidireccional, sin importar el dominio de aplicación específico.

**Por qué TLS importa especialmente cuando el otro lado mueve un robot.** El esquema `wss://` (WebSocket sobre TLS) en `connections.toml` no es un detalle de seguridad genérico intercambiable — es exigido específicamente porque, sin cifrado, cualquiera que pueda interceptar el tráfico de red entre el Bridge y el servidor podría, en principio, leer los comandos y la telemetría en texto plano, y (más grave todavía) potencialmente **inyectar** comandos falsos si además logra suplantar al servidor legítimo en una posición de intermediario en la red (un ataque de tipo man-in-the-middle). Esta es exactamente la misma preocupación de seguridad de sistemas ciberfísicos que ya reconociste en el módulo de arquitectura del Bridge — aquí aplicada específicamente a la capa de transporte: TLS no es solo "buena práctica genérica de web", es la garantía criptográfica de que el comando que el Bridge ejecuta sobre hardware real efectivamente vino del servidor legítimo y no fue alterado en tránsito, y que la telemetría que el servidor recibe efectivamente vino del Bridge legítimo, no de un impostor en la red inyectando datos falsos que podrían, por ejemplo, ocultar una condición peligrosa real mostrando lecturas fabricadas de "todo normal".

---

## Síntesis — el mapa mental

1. HTTP request/response impone una asimetría estructural (solo el cliente inicia) que polling, long-polling, y SSE mitigan parcialmente pero no resuelven completamente para el requisito específico del Bridge: **ambas** direcciones necesitan poder empujar información espontáneamente.
2. **WebSocket** resuelve esto siendo full-duplex — tras un handshake que empieza como HTTP (aprovechando infraestructura de red existente) y se actualiza (upgrade) a una conexión persistente de frames ligeros, ambas partes hablan y escuchan simultáneamente sin turnos forzados.
3. La capa de transport del Bridge establece esta conexión hacia el `server` declarado en `connections.toml`, autenticándose con la identidad de bridge (`bridge_id` + token leído de la variable de entorno declarada en `token_env`, nunca del archivo mismo) como el primer mensaje sobre la conexión ya establecida.
4. **Heartbeat/keepalive** detecta activamente desconexiones silenciosas (donde la conexión "parece" viva pero no lo está) mucho más rápido que esperar pasivamente a que un envío de datos reales falle.
5. **Backoff exponencial con jitter** en la reconexión evita que el mismo mecanismo diseñado para recuperar el sistema termine agravando una falla del servidor con una tormenta de reintentos sincronizados.
6. El problema de mayor consecuencia práctica — **qué pasa con un comando en vuelo cuando la conexión cae** — no tiene una solución puramente de red; exige identificadores únicos por comando (para deduplicación) y la capacidad del Bridge de reportar el **estado físico real** del hardware tras reconectar, permitiendo reconciliar la vista del servidor con la realidad, en vez de asumir ciegamente qué pasó durante la desconexión.
7. Ningún extremo puro de garantía de entrega (ni at-least-once puro, ni at-most-once puro) es correcto por sí solo sobre hardware físico — la combinación de reintento con deduplicación por ID es lo que da la garantía práctica que realmente necesitas: exactamente-una-vez a nivel de efecto físico.
8. TLS (`wss://`) en esta capa específica no es un genérico "buena práctica" — es la garantía criptográfica de que ni los comandos que mueven hardware real ni la telemetría que informa decisiones pueden ser interceptados o falsificados en tránsito.

---

## Preguntas que deberías poder responder

*(Las primeras tres son, deliberadamente, del tipo defensa de diseño que un revisor del equipo ORION haría.)*

1. Explica por qué HTTP request/response, incluso con long-polling, no satisface el requisito de que el servidor pueda empujar un comando de emergencia hacia el Bridge en el instante en que se decide, sin ningún retraso estructural — ¿qué tendría que cambiar en el modelo HTTP mismo para que sí lo satisficiera, y por qué eso es, en esencia, reinventar WebSocket?
2. Si tuvieras que diseñar el manejo de un comando de movimiento que estaba en tránsito exactamente cuando la conexión WebSocket cayó, ¿qué información mínima necesitarías que el Bridge reportara tras reconectar para poder decidir con seguridad si reenviar ese comando, ignorarlo, o hacer algo distinto?
3. ¿Por qué el token de autenticación de bridge vive en una variable de entorno (`token_env` apuntando a su nombre) y nunca directamente en `connections.toml`? Conecta tu respuesta con el modelo de amenaza específico de qué pasaría si el archivo de configuración se compartiera o versionara accidentalmente.
4. Explica, con tus propias palabras, por qué un heartbeat detecta una desconexión silenciosa más rápido que simplemente esperar a que un envío de datos reales falle — ¿qué estado de la conexión TCP hace posible que "parezca viva" sin estarlo?
5. Deriva por qué el backoff exponencial necesita, además, un componente de jitter aleatorio — ¿qué problema específico ocurre si múltiples bridges reintentan exactamente en los mismos intervalos fijos tras una falla compartida del servidor?
6. ¿Por qué garantizar "at-least-once delivery" sin deduplicación por ID único es peligroso específicamente quc el efecto de un mensaje es una acción física sobre hardware, y no, por ejemplo, escribir un registro en una base de datos (donde un duplicado exacto podría ser inofensivo o fácil de filtrar después)?
7. Explica por qué el esquema `wss://` en vez de `ws://` en `connections.toml` es una decisión de seguridad crítica específicamente para este dominio, y no solo una convención genérica de "usa HTTPS cuando puedas" — ¿qué ataque concreto se vuelve posible sin TLS aquí?
8. ¿Qué pasaría, en términos concretos de comportamiento del servidor, si dos procesos de Bridge se conectaran simultáneamente con el mismo `bridge_id`? ¿Por qué esta es una condición de configuración que debe prevenirse activamente, no solo tolerarse si ocurre?

---

## Fuentes

- Repositorio oficial: github.com/Starman26/orion-bridge-v2 — la estructura de `connections.toml` (servidor `wss://`, `bridge_id`, `token_env`) y el modelo de identidad de bridge por `ORION_BRIDGE_ID`/`ORION_BRIDGE_TOKEN` fueron verificados directamente contra el README del repositorio en una consulta previa de este mismo trabajo de documentación.
- El contenido específico de `orion_bridge/transport.py` (la implementación exacta de heartbeat, backoff, y manejo de reconexión) **no pudo verificarse línea por línea** — la navegación directa del árbol de archivos del repositorio no fue accesible durante la investigación de este módulo. El razonamiento sobre el mecanismo de transport en las secciones 3 y 4 se construyó deduciendo consecuencias necesarias de los requisitos documentados por el equipo (conexión persistente autenticada, identidad de bridge separada de identidad de usuario), consistentes con patrones estándar de la industria para clientes WebSocket resilientes — no como afirmación de haber inspeccionado ese código específico.
- MDN Web Docs, especificación y guía de WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
- RFC 6455, *The WebSocket Protocol* (IETF): https://datatracker.ietf.org/doc/html/rfc6455
- Documentación de la librería `websockets` de Python: https://websockets.readthedocs.io/
