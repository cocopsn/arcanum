---
module_id: fred-s1-datos-industriales
spine: FrED
title: "Fundamentos de datos industriales"
subtitle: "Del sensor físico a la decisión"
source_canonical: "Industry 4.0; MQTT/OPC-UA/Modbus docs; Node-RED; MIT OCW"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Fundamentos de datos industriales

> **Pregunta raíz.** Un sensor de temperatura en un extrusor de FrED Factory produce un voltaje analógico, 50 veces por segundo. Un dashboard en la nube necesita mostrar esa temperatura, y un sistema de control necesita decidir, en milisegundos, si apagar el calentador. Entre el voltaje físico y la decisión digital hay una cadena de traducciones — y **la arquitectura de esa cadena determina qué es posible construir encima**: qué tan rápido puedes reaccionar, qué tan bien escalas a 50 máquinas en vez de una, y qué tan seguro es el sistema contra quien quiera manipularlo. Este módulo no es sobre protocolos como trivia — es sobre por qué cada eslabón de esa cadena existe para resolver un problema físico o de ingeniería específico que el eslabón anterior no podía resolver solo.

## Prólogo — de dónde nace esto

Piensa en cómo llega una carta física de un remitente a un destinatario. El remitente no camina personalmente hasta la casa del destinatario — deposita la carta en un buzón, un sistema postal la recoge, la clasifica, la transporta, y el destinatario la recibe cuando revisa su propio buzón. Ni el remitente sabe (ni le importa) la ruta exacta que tomó la carta, ni el destinatario sabe (ni le importa) cuándo exactamente el remitente la escribió — el sistema postal **desacopla** a ambos en tiempo y en conocimiento mutuo.

Esa es, casi literalmente, la arquitectura que vas a deducir en este módulo, aplicada a datos: un sensor (el remitente) no necesita saber quién va a consumir su dato ni cuándo; un sistema de control o un dashboard (el destinatario) no necesita saber exactamente cuándo el sensor generó el dato, solo que puede "revisar su buzón" cuando lo necesite. El **broker** de mensajería es el sistema postal. Y así como el sistema postal físico tuvo que resolver problemas concretos (¿qué pasa si la carta se pierde? ¿cómo garantizas que llegue en orden? ¿qué formato de dirección usas para que cualquier cartero la entienda?), la mensajería industrial tuvo que resolver exactamente los mismos problemas — solo que a escala de milisegundos y miles de mensajes por segundo, no de días y una carta.

Antes de llegar a esa arquitectura, hay que empezar todavía más atrás: en el punto donde lo físico se convierte en digital por primera vez.

---

## 1. El PLC — el puente entre lo físico y lo digital, deducido desde la necesidad

### 1.1 El problema que resuelve

Un sensor de temperatura no produce "un número" — produce una señal física continua: un voltaje analógico que varía suavemente con la temperatura real, o una resistencia que cambia (como un termopar o una RTD). Un motor no se controla "poniéndole un número de velocidad" — se controla variando un voltaje o una corriente real que alimenta sus bobinas. El mundo físico opera en **señales continuas y analógicas**; el mundo del software opera en **números discretos**. Necesitas algo que viva exactamente en la frontera entre ambos: que lea señales analógicas y las convierta en números que un programa pueda procesar, y que tome decisiones de esos números y las convierta de vuelta en señales físicas que actúen sobre motores, válvulas, calentadores.

Ese "algo" es el **PLC (Programmable Logic Controller)**. No es una computadora de propósito general con Linux y un browser — es un dispositivo diseñado específicamente para este puente, con tres características que se derivan directamente del entorno donde vive:

**Entradas/salidas analógicas y digitales dedicadas**: el PLC tiene canales físicos de entrada que convierten voltaje/corriente analógica en un número digital (un ADC — Analog to Digital Converter — integrado), y canales de salida que hacen lo inverso (DAC, o simplemente relés/transistores para señales on/off). Esto no es una "característica" opcional — es la razón de existir del dispositivo: sin esto, no hay forma de que un programa toque el mundo físico.

**Determinismo en tiempo real (real-time)**: un PLC ejecuta su lógica de control en un **ciclo de escaneo (scan cycle)** predecible y acotado — lee todas las entradas, ejecuta el programa de control, escribe todas las salidas, repite, típicamente en milisegundos, con **garantía de que el ciclo nunca tarda más de X tiempo**. Esto es fundamentalmente distinto de una computadora de propósito general corriendo un sistema operativo con multitarea, donde un proceso puede ser interrumpido de forma impredecible por el scheduler del SO. Si un calentador se está sobrecalentando, necesitas la garantía matemática de que el PLC va a leer esa temperatura y reaccionar dentro de una ventana de tiempo acotada — no "probablemente rápido", sino **garantizado** rápido. Esta es la misma distinción entre "peor caso garantizado" y "caso promedio" que ya viste en análisis de algoritmos — aquí aplicada a control físico, donde el peor caso no es una abstracción matemática, es "el motor se quema" o "el material se derrite fuera de tolerancia".

**Robustez industrial**: un PLC está diseñado para operar en un ambiente con vibración, ruido eléctrico (interferencia electromagnética de motores cercanos), rangos de temperatura amplios, y sin necesidad de reinicio frecuente — condiciones que una laptop de oficina no tolera bien ni por diseño ni por garantía del fabricante.

### 1.2 Qué produce el PLC: el primer punto donde nace el "dato industrial"

El PLC, en su ciclo de escaneo, mantiene en su memoria interna un conjunto de valores — temperatura actual, posición de un actuador, estado on/off de un sensor de límite — que se actualizan constantemente. Este conjunto de valores es el primer punto en toda la cadena donde el mundo físico existe como **datos digitales estructurados**. Todo lo que sigue en este módulo trata de cómo sacar esos valores del PLC y llevarlos a donde se necesitan — sistemas de monitoreo, bases de datos, dashboards, algoritmos de control de más alto nivel — sin comprometer el determinismo del ciclo de control mismo.

---

## 2. La serie de tiempo industrial — por qué es fundamentalmente distinta

### 2.1 Qué la hace distinta de un dato "convencional"

Un registro en una base de datos convencional (un pedido de e-commerce, un usuario registrado) típicamente se genera **una vez** y se lee muchas veces — el patrón de acceso es "escritura rara, lectura frecuente". Un dato industrial es exactamente lo opuesto en frecuencia de generación: un sensor produce un valor nuevo **constantemente** — 10, 50, 1000 veces por segundo, dependiendo del sensor y del proceso — generando lo que se llama una **serie de tiempo**: una secuencia de pares (timestamp, valor) donde el orden temporal y el espaciado entre mediciones **son parte del significado del dato**, no solo metadata incidental.

Esto genera tres consecuencias de diseño que hay que deducir, no memorizar:

**Volumen**: un solo sensor a 50 Hz genera 50 valores por segundo = 4.3 millones de valores por día. FrED Factory, con múltiples sensores por máquina y múltiples máquinas, genera volúmenes que una base de datos relacional convencional (optimizada para transacciones individuales complejas, no para escritura masiva secuencial) maneja mal si se usa ingenuamente — de ahí la existencia de bases de datos especializadas en series de tiempo (InfluxDB, TimescaleDB), optimizadas para escritura secuencial de alto volumen y consultas por rango temporal, aunque ese tema de almacenamiento específico está fuera del alcance de este módulo (que se enfoca en el *transporte* del dato, no su *almacenamiento final*).

**El timestamp no es opcional, es estructural**: en un dato convencional, "cuándo se creó el registro" suele ser metadata secundaria. En una serie de tiempo industrial, el timestamp **es** el eje sobre el que todo el análisis se construye — sin saber exactamente cuándo se tomó cada medición, no puedes calcular una derivada (¿qué tan rápido está subiendo la temperatura?), no puedes correlacionar eventos entre sensores distintos (¿el pico de vibración ocurrió antes o después del pico de temperatura?), y no puedes alinear datos de distintas fuentes para análisis conjunto. Esto hace que la **sincronización temporal** entre dispositivos sea un problema de ingeniería real, no un detalle — lo retomamos en la sección de trampas.

**Contexto temporal como parte del significado**: un valor aislado de "temperatura = 210°C" es poco útil sin saber la tendencia (¿está subiendo, bajando, estable?) y el contexto de proceso (¿es la temperatura de extrusión esperada para este material, o es una anomalía?). Esto es diferente a, por ejemplo, un registro de "nombre de usuario = Armando" que es completo y autocontenido sin necesitar contexto temporal para tener sentido.

---

## 3. Los protocolos — deducidos desde el problema que cada uno resuelve

Ya tenemos datos digitales saliendo del PLC. La pregunta ahora es: ¿cómo los transportamos hacia donde se necesitan, de forma confiable y a la velocidad/escala requerida? Tres protocolos dominan el panorama industrial, y cada uno existe porque resuelve un problema distinto — no son "tres formas de hacer lo mismo", son respuestas a contextos diferentes.

### 3.1 Modbus — el veterano, y por qué sigue vivo

Modbus nació en 1979, diseñado originalmente para comunicación serial simple entre un dispositivo maestro (típicamente un PLC o una computadora de supervisión) y dispositivos esclavos (sensores, actuadores, otros PLCs). Su modelo es intencionalmente primitivo: el maestro **pregunta** ("¿cuál es el valor del registro 40001?") y el esclavo **responde** — un patrón estrictamente **request/response**, sin que el esclavo pueda iniciar comunicación por su cuenta.

**Por qué esta simplicidad tiene sentido para su contexto original**: en 1979, el hardware disponible era extremadamente limitado en memoria y capacidad de procesamiento. Un protocolo que exige que cada dispositivo mantenga solo un conjunto simple de "registros" numerados (bloques de memoria direccionables por número, sin tipo de dato explícito rico — todo son enteros de 16 bits o bits sueltos) es implementable con recursos mínimos. Esta simplicidad es exactamente lo que le ha dado longevidad: **hoy sigue vivo porque hay una cantidad enorme de hardware industrial ya instalado (legacy) que solo habla Modbus**, y reemplazar ese hardware físico es costoso — así que la razón de seguir usando Modbus casi nunca es "es la mejor opción técnica hoy", es "ya está ahí, funciona, y reemplazarlo cuesta más que integrarlo".

**Limitación estructural que hay que entender, no solo memorizar**: como Modbus no tiene un modelo de información rico (solo números en registros sin metadata semántica — el registro 40001 podría ser temperatura o podría ser velocidad, y el protocolo mismo no te dice cuál; esa información vive fuera del protocolo, en documentación del fabricante), integrar dispositivos de fabricantes distintos exige que un humano lea manuales y mapee manualmente "el registro X del dispositivo Y significa Z". No hay interoperabilidad semántica automática — y esa carencia es exactamente el problema que el siguiente protocolo fue diseñado para resolver.

### 3.2 OPC-UA — el estándar industrial moderno, deducido desde el problema de interoperabilidad

**El problema que Modbus no resuelve**: en una fábrica moderna con equipo de decenas de fabricantes distintos (PLCs de Siemens, sensores de otra marca, un robot de otra más), necesitas que un sistema de supervisión entienda **qué significa** cada dato, no solo su valor numérico crudo — sin depender de que un ingeniero mapee manualmente cada registro de cada dispositivo. OPC-UA (OPC Unified Architecture) resuelve esto con un **modelo de información** explícito: en vez de "el registro 40001 es un número", cada dato en OPC-UA tiene una descripción estructurada de qué es — su tipo, sus unidades, su relación jerárquica con otros datos (por ejemplo, "esta temperatura pertenece a este calentador, que pertenece a esta zona de la extrusora"), y esa estructura es parte del protocolo mismo, no de documentación externa. Esto es lo que hace que un sistema de supervisión genérico pueda **descubrir automáticamente** qué datos ofrece un dispositivo nuevo, sin que un humano tenga que leer un manual y programar un mapeo manual — la interoperabilidad semántica, no solo la interoperabilidad de bits.

**Por qué esto se volvió el estándar de facto en Industria 4.0**: el movimiento de manufactura inteligente depende críticamente de que sistemas de análisis, dashboards, y algoritmos de optimización de más alto nivel puedan conectarse a **cualquier** máquina de **cualquier** fabricante sin integración custom por cada combinación — exactamente lo que un modelo de información estandarizado habilita. OPC-UA también agrega, sobre el modelo request/response clásico de OPC (heredado de OPC Classic, basado en tecnología Windows específica), soporte para **publish/subscribe** además de request/response, y es agnóstico de plataforma (no atado a Windows como su predecesor) — ambos cambios directamente motivados por las limitaciones que la práctica industrial expuso en la generación anterior del protocolo.

**El costo de esta riqueza**: el modelo de información de OPC-UA es considerablemente más complejo de implementar que Modbus — más overhead de procesamiento, más complejidad de configuración inicial. Ese costo es exactamente el trade-off: pagas complejidad de implementación a cambio de interoperabilidad y riqueza semántica automática.

### 3.3 MQTT — ligero, publish/subscribe, deducido desde el problema de IoT a escala

**El problema distinto que MQTT resuelve**: OPC-UA y Modbus están diseñados fundamentalmente para el contexto de **una planta**, con conexiones relativamente estables entre dispositivos que están físicamente cerca. MQTT nace de un problema distinto: ¿cómo conectas **miles o millones de dispositivos dispersos geográficamente** (sensores IoT, dispositivos con conectividad intermitente, ancho de banda limitado o costoso) hacia un sistema central, de forma que agregar un dispositivo nuevo no requiera que cada dispositivo conozca a cada consumidor de sus datos?

**La arquitectura publish/subscribe, deducida desde esa necesidad**: en vez del modelo request/response (donde el consumidor debe preguntar activamente, y debe saber exactamente a quién preguntarle), MQTT introduce un intermediario — el **broker** — y dos roles desacoplados:

- **Publisher (productor)**: publica mensajes a un **topic** (un canal con nombre, ej. `fred/extrusor1/temperatura`), sin saber ni importarle quién (si es que alguien) está escuchando ese topic.
- **Subscriber (consumidor)**: se suscribe a uno o más topics de interés, y recibe automáticamente cualquier mensaje publicado a esos topics, sin saber ni importarle quién los publicó.
- **Broker**: el intermediario que recibe todos los mensajes publicados y los reenvía a todos los suscriptores relevantes de cada topic.

Esta es exactamente la analogía del sistema postal del prólogo, formalizada: el publisher deposita la carta en el buzón (publica al topic) sin saber quién la va a leer; el broker (sistema postal) la enruta; el subscriber (destinatario) la recibe revisando su buzón (suscripción al topic) sin saber ni cuándo ni por quién fue escrita.

**Por qué el desacoplamiento importa arquitectónicamente, no solo como conveniencia**: si agregas un sensor nuevo a la fábrica, solo necesita saber la dirección del broker y el nombre del topic al que va a publicar — **no necesita saber nada sobre qué sistemas van a consumir ese dato**, ni cuántos son, ni si existen todavía. Simétricamente, si agregas un dashboard nuevo que quiere consumir esa temperatura, solo se suscribe al topic — **no necesita saber nada sobre el sensor físico específico que la produce**. Esto significa que puedes agregar publishers y subscribers **independientemente**, sin tocar código de los demás componentes — una propiedad arquitectónica llamada **desacoplamiento** que es exactamente lo que permite que un sistema de IoT industrial escale de 1 sensor a 10,000 sin que la complejidad de integración crezca cuadráticamente (que es lo que pasaría si cada publisher tuviera que conocer y hablar directamente con cada subscriber — el mismo problema estructural, en esencia, que resolvía el broker de mensajes en cualquier sistema distribuido).

**Por qué es "ligero"**: MQTT fue diseñado explícitamente para funcionar sobre conexiones de bajo ancho de banda y alta latencia (el caso de uso original de IBM en 1999 era monitoreo de oleoductos vía satélite) — el overhead del protocolo por mensaje es mínimo (cabecera de apenas 2 bytes en el caso más simple), comparado con protocolos más verbosos. Esto lo hace apropiado para dispositivos embebidos con recursos limitados (microcontroladores baratos, conexiones celulares con datos limitados) — exactamente el perfil de un sensor IoT disperso, no de un PLC industrial robusto con conexión Ethernet estable.

**Código real — publisher/subscriber mínimo con paho-mqtt**:

```python
# publisher_temperatura.py
# Simula un sensor de temperatura en un extrusor de FrED, publicando
# lecturas periodicas a un broker MQTT.
import paho.mqtt.client as mqtt
import time
import json
import random

BROKER = "localhost"   # en produccion: la IP/hostname del broker MQTT
PUERTO = 1883
TOPIC = "fred/extrusor1/temperatura"

cliente = mqtt.Client(client_id="sensor-temp-extrusor1")
cliente.connect(BROKER, PUERTO, keepalive=60)

try:
    while True:
        lectura = {
            "timestamp": time.time(),       # el eje que da sentido a la serie
            "valor_c": round(200 + random.uniform(-2, 2), 2),
            "sensor_id": "TC-01",
        }
        # QoS 1: al menos una entrega garantizada (ver seccion 4.2)
        cliente.publish(TOPIC, json.dumps(lectura), qos=1)
        print(f"publicado: {lectura}")
        time.sleep(0.1)   # 10 Hz -- razonable para temperatura de extrusion
except KeyboardInterrupt:
    cliente.disconnect()
```

```python
# subscriber_dashboard.py
# Simula un consumidor (ej. el backend de un dashboard) escuchando
# el mismo topic, SIN conocer nada sobre el publisher especifico.
import paho.mqtt.client as mqtt
import json

BROKER = "localhost"
PUERTO = 1883
TOPIC = "fred/extrusor1/temperatura"

def al_conectar(cliente, userdata, flags, rc):
    print(f"conectado al broker, codigo={rc}")
    cliente.subscribe(TOPIC, qos=1)

def al_recibir_mensaje(cliente, userdata, mensaje):
    lectura = json.loads(mensaje.payload.decode())
    print(f"recibido en topic {mensaje.topic}: {lectura}")
    # aqui iria la logica real: guardar en base de datos de series
    # de tiempo, actualizar un dashboard en tiempo real, disparar
    # una alerta si valor_c excede un umbral, etc.

cliente = mqtt.Client(client_id="dashboard-backend")
cliente.on_connect = al_conectar
cliente.on_message = al_recibir_mensaje
cliente.connect(BROKER, PUERTO, keepalive=60)
cliente.loop_forever()
```

Nota que **ninguno de los dos scripts conoce la existencia del otro** — ambos solo conocen al broker y al nombre del topic. Puedes correr tres subscribers distintos simultáneamente (el dashboard, un sistema de alertas, un logger a base de datos) sin tocar una sola línea del publisher, y puedes agregar un segundo sensor publicando a `fred/extrusor2/temperatura` sin tocar los subscribers existentes.

**Un flujo equivalente en Node-RED** (la herramienta visual de flujo de datos ampliamente usada en el espacio de Industria 4.0 para prototipar y conectar estos sistemas sin escribir todo el código a mano) se representa como un grafo de nodos conectados; su representación interna es JSON:

```json
[
    {
        "id": "nodo-mqtt-in",
        "type": "mqtt in",
        "topic": "fred/extrusor1/temperatura",
        "qos": "1",
        "broker": "config-broker-fred"
    },
    {
        "id": "nodo-parse-json",
        "type": "json",
        "name": "parsear lectura"
    },
    {
        "id": "nodo-umbral",
        "type": "switch",
        "name": "temperatura > 215C?",
        "property": "payload.valor_c",
        "rules": [{"t": "gt", "v": "215", "vt": "num"}]
    },
    {
        "id": "nodo-alerta",
        "type": "mqtt out",
        "topic": "fred/extrusor1/alertas",
        "broker": "config-broker-fred"
    },
    {
        "id": "config-broker-fred",
        "type": "mqtt-broker",
        "broker": "localhost",
        "port": "1883"
    }
]
```

Este flujo — recibir del topic de temperatura, parsear, comparar contra un umbral, y si se excede, publicar a un topic de alertas — es exactamente el mismo patrón publish/subscribe que el código Python, solo expresado visualmente. Node-RED es popular en este espacio precisamente porque permite a ingenieros de proceso (no necesariamente programadores full-time) construir y modificar estos flujos de forma visual e iterativa — relevante para el contexto de un laboratorio como FrED donde la velocidad de iteración importa más que la elegancia de arquitectura de software pura.

---

## 4. La arquitectura productor/broker/consumidor — por qué desacopla el sistema, formalizado

Ya construimos la intuición con la analogía postal y el código. Formalicemos por qué este patrón —no solo en MQTT, es un patrón general de sistemas distribuidos, también presente en Kafka, RabbitMQ, y otros sistemas de mensajería— es arquitectónicamente superior a la alternativa ingenua de "cada productor le habla directamente a cada consumidor" para el problema industrial.

**Sin broker (acoplamiento directo)**: si tienes P productores y C consumidores, y cada productor necesita saber la dirección de red de cada consumidor interesado en sus datos, tienes hasta P×C conexiones directas que gestionar. Agregar un consumidor nuevo exige modificar (o al menos reconfigurar) potencialmente **todos** los P productores para que sepan de su existencia. Esto es exactamente el mismo problema estructural de complejidad cuadrática que ya viste en otros contextos de este curso — cualquier sistema donde cada componente necesita conocer directamente a todos los demás componentes con los que interactúa escala mal.

**Con broker**: cada productor solo necesita conocer al broker (una sola conexión conocida). Cada consumidor solo necesita conocer al broker. Agregar un consumidor nuevo es una operación **local** a ese consumidor — se suscribe al topic relevante, y el broker se encarga de enrutarle los mensajes futuros, sin que ningún productor existente se entere ni necesite cambiar nada. Esto convierte el problema de integración de O(P×C) conexiones a gestionar en O(P+C) — cada componente gestiona exactamente una relación (con el broker), no una relación por cada contraparte potencial.

**Esto es lo que habilita edge computing**: si el procesamiento de "¿esta temperatura excede el umbral de seguridad?" puede vivir como un subscriber más — corriendo físicamente cerca de la máquina, en un dispositivo de borde (edge device) en vez de en un servidor central en la nube — puedes tomar decisiones de control local con baja latencia (sin esperar un viaje de ida y vuelta a un servidor remoto), mientras que ese mismo dato, publicado al mismo topic, también fluye hacia sistemas de análisis en la nube para almacenamiento histórico y modelos más pesados. **El broker permite que el mismo dato tenga múltiples consumidores con necesidades de latencia radicalmente distintas, sin que el productor necesite saber nada sobre esa diversidad de consumidores** — el sensor publica una vez; el edge device reacciona en milisegundos; la nube procesa en minutos u horas; ninguno de los tres necesita coordinarse explícitamente con los otros dos.

---

## 5. Trampas y edge cases explícitos

### 5.1 Elegir el protocolo equivocado para el contexto

**Trampa**: usar MQTT para control en tiempo real de un actuador de seguridad crítica. MQTT, al pasar por un broker intermediario (una capa de red y software adicional entre productor y consumidor) y no estar diseñado para garantías de tiempo real determinista, introduce latencia variable — inapropiado para un lazo de control donde necesitas la garantía de "reacciona en X milisegundos, siempre", que es exactamente la garantía que el PLC (sección 1) ofrece de forma nativa dentro de su propio ciclo de escaneo. La regla práctica: **control de seguridad crítica en tiempo real vive dentro del PLC o en comunicación directa entre PLCs (frecuentemente vía protocolos de campo deterministas), no cruzando un broker de mensajería de propósito general.** MQTT, OPC-UA, y arquitecturas basadas en broker son apropiados para **monitoreo, análisis, y coordinación de más alto nivel** — no para el lazo de control físico más interno y crítico en tiempo.

**Trampa inversa**: usar Modbus para integrar 50 dispositivos heterogéneos de fabricantes distintos en un sistema de supervisión moderno, cuando OPC-UA te ahorraría el trabajo manual de mapeo semántico de cada registro — ahí Modbus es la opción técnicamente inferior, justificable solo si ya tienes hardware legacy que literalmente no habla otra cosa.

### 5.2 QoS en MQTT — la pérdida de mensajes es una decisión de diseño, no un accidente

MQTT define tres niveles de **QoS (Quality of Service)**, y elegir el nivel equivocado para tu caso de uso es una trampa común:

- **QoS 0 ("at most once")**: el mensaje se envía una vez, sin confirmación ni reintento. Puede perderse si hay un problema de red momentáneo. Apropiado cuando perder un dato ocasional es aceptable (ej. una lectura de temperatura a 10 Hz — si pierdes una de 4.3 millones de lecturas diarias, la siguiente llega en 100ms y el impacto es insignificante).
- **QoS 1 ("at least once")**: el broker confirma la recepción, y el publisher reintenta si no recibe confirmación — garantiza que el mensaje llega, **pero puede llegar duplicado** si la confirmación se pierde y el publisher reintenta un mensaje que en realidad sí había llegado. Apropiado cuando perder el dato es inaceptable pero un duplicado ocasional es manejable (el consumidor puede deduplicar si es necesario, ej. usando el timestamp como identificador único).
- **QoS 2 ("exactly once")**: garantiza entrega exacta, sin pérdida ni duplicación, mediante un intercambio de confirmación de cuatro pasos — al costo de mayor latencia y overhead de red por mensaje.

**La trampa concreta**: usar QoS 0 para un mensaje de alerta crítica (ej. "temperatura excedió el límite de seguridad") es un error de diseño — si ese mensaje específico se pierde por una fluctuación de red momentánea, nadie se entera de la condición peligrosa. Usar QoS 2 para cada una de las 4.3 millones de lecturas diarias de temperatura rutinaria es sobre-ingeniería costosa en latencia y ancho de banda para un caso donde perder una lectura ocasional no tiene consecuencia real. **La elección de QoS debe ser explícita y justificada por el costo real de perder o duplicar ese mensaje específico** — no un default que se aplica sin pensar a todo el sistema por igual.

### 5.3 Sincronización temporal — por qué importa más de lo que parece

Si dos sensores en máquinas distintas de FrED Factory reportan sus propios timestamps (generados por sus relojes internos locales), y esos relojes no están sincronizados entre sí (deriva de reloj — *clock drift* — es inevitable en hardware barato sin corrección activa), un análisis que intenta correlacionar eventos entre ambos sensores ("¿la vibración del motor A precedió al pico de temperatura del extrusor B?") puede llegar a conclusiones **incorrectas** simplemente por el desfase de reloj, no por una relación causal real. La solución estándar en sistemas distribuidos es usar un protocolo de sincronización de tiempo (NTP — Network Time Protocol, el más común; PTP — Precision Time Protocol, para sincronización de precisión submilisegundo cuando se necesita) para que todos los dispositivos que generan timestamps compartan una referencia de tiempo común dentro de una tolerancia conocida. **Ignorar este detalle no rompe el sistema de forma visible — produce análisis sutilmente incorrectos que pueden pasar desapercibidos durante mucho tiempo**, exactamente el tipo de bug silencioso y peligroso que ya viste con el ejemplo de olvidar actualizar alturas en un AVL: el sistema sigue "funcionando" y dando resultados, solo que incorrectos de una forma que no dispara ningún error visible.

---

## 6. Trade-offs explícitos: cloud vs. edge, y los tres protocolos comparados

**Cloud vs. Edge — la decisión de dónde vive el procesamiento**: procesar en la nube da acceso a recursos de cómputo prácticamente ilimitados (modelos de machine learning pesados, almacenamiento histórico masivo, dashboards accesibles desde cualquier lugar) pero paga el costo de latencia de red (ida y vuelta a un servidor remoto, potencialmente cientos de milisegundos) y depende de conectividad estable. Procesar en el edge (un dispositivo físicamente cerca de la máquina, potencialmente el mismo PLC o un dispositivo dedicado cercano) da latencia mínima y funciona incluso si la conexión a internet cae, pero está limitado en capacidad de cómputo y complejidad de los modelos que puede correr. **La arquitectura productor/broker/consumidor de la sección 4 es exactamente lo que permite no tener que elegir uno u otro de forma exclusiva** — el mismo dato fluye a ambos destinos simultáneamente, cada uno procesando lo que le corresponde según su ventaja: el edge reacciona rápido a lo crítico, la nube analiza en profundidad lo que no es urgente.

| Criterio | Modbus | OPC-UA | MQTT |
|---|---|---|---|
| Patrón de comunicación | Request/response | Request/response + pub/sub | Pub/sub |
| Modelo de información | Ninguno (registros numéricos crudos) | Rico, jerárquico, autodescriptivo | Ninguno nativo (payload arbitrario, típicamente JSON) |
| Overhead por mensaje | Muy bajo | Alto | Muy bajo |
| Interoperabilidad entre fabricantes | Baja (mapeo manual) | Alta (estándar semántico) | Depende del formato de payload acordado externamente |
| Caso de uso típico | Integración de hardware legacy en planta | Supervisión industrial multi-fabricante | IoT disperso, alto volumen, recursos limitados |
| Determinismo en tiempo real | No garantizado a nivel protocolo | No garantizado a nivel protocolo | No garantizado a nivel protocolo |

**Nota importante que se desprende de la última fila**: ninguno de los tres protocolos de esta sección reemplaza al PLC (sección 1) para control en tiempo real determinista — todos viven en la capa de **comunicación y supervisión** por encima del control físico inmediato, no dentro de él. Confundir esto es exactamente la trampa de la sección 5.1.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Seguridad en IoT industrial — por qué estos sistemas son vectores de ataque, y por qué pocos en un laboratorio lo ven venir.** Toda la arquitectura de este módulo tiene una propiedad que rara vez se discute junto con su elegancia técnica: **el broker es un punto único de confianza y, frecuentemente, un punto único de falla o de compromiso**. Si un atacante logra publicar mensajes falsos al topic `fred/extrusor1/temperatura`, cualquier subscriber que confíe ciegamente en ese dato (un sistema de control que reacciona a lecturas de temperatura falsas, un dashboard que muestra información fabricada a un operador humano) puede ser engañado para tomar decisiones incorrectas — desde algo relativamente benigno (un dashboard mintiendo) hasta algo físicamente peligroso (un sistema de control apagando un proceso innecesariamente, o peor, **no apagándolo cuando debería** porque el atacante inyectó lecturas falsas de "todo normal" mientras la condición real es peligrosa). Este es exactamente el tipo de superficie de ataque que ya reconoces de Nahual: un sistema diseñado para facilitar flujo de información, sin controles de autenticación/autorización robustos en cada punto, se convierte en un vector de manipulación. En la práctica de campo, muchas instalaciones MQTT industriales han sido desplegadas históricamente **sin autenticación de cliente, sin TLS (la conexión sin cifrar), y sin control de acceso por topic** — configuraciones que técnicamente "funcionan" en un ambiente de laboratorio cerrado, pero que en cualquier ambiente con exposición a red externa son una vulnerabilidad grave y bien documentada en el espacio de seguridad de sistemas de control industrial (ICS/SCADA security). La razón de que "pocos en el lab lo ven" es exactamente la misma razón por la que las vulnerabilidades de seguridad en general persisten: la arquitectura *funciona correctamente* para el caso de uso legítimo sin que la ausencia de controles de seguridad sea visible en el comportamiento normal — el sistema no falla de forma obvia hasta que alguien lo ataca deliberadamente.

**Sistemas ciberfísicos (Cyber-Physical Systems, CPS).** Todo lo que este módulo describe — la cadena PLC → protocolo → broker → consumidor — es la instanciación concreta de lo que la literatura académica llama un sistema ciberfísico: un sistema donde componentes computacionales y físicos están tan íntimamente integrados que no se pueden analizar por separado sin perder información crítica del comportamiento del sistema completo. La disciplina de CPS estudia formalmente las garantías (temporales, de seguridad, de correctitud) que tienes que poder ofrecer cuando el "output" de tu software no es solo un número en una pantalla, sino una acción física con consecuencias reales — el mismo principio que motivó el determinismo del PLC en la sección 1, generalizado como campo de estudio completo con sus propios modelos formales de verificación.

**El gemelo digital (digital twin) como consumidor de estos datos.** Un gemelo digital es un modelo de software (frecuentemente una simulación física, no solo una base de datos) que se mantiene sincronizado en tiempo cercano al real con el estado de una máquina o proceso físico, alimentándose exactamente de la misma cadena de datos que este módulo describe — es, en esencia, un subscriber más, pero uno que además de mostrar el dato, lo usa para **actualizar y validar un modelo predictivo** del comportamiento físico del sistema. Esto permite simular "qué pasaría si" sin arriesgar la máquina física real, y detectar desviaciones entre lo que el modelo predice y lo que el sensor real reporta — una desviación significativa puede ser la primera señal de una falla incipiente, antes de que sea observable directamente. Este es exactamente el tipo de sistema de más alto nivel que la arquitectura desacoplada de este módulo existe para habilitar: el gemelo digital no necesita integración especial con cada sensor físico — solo necesita suscribirse a los topics relevantes, exactamente como cualquier otro consumidor.

---

## Síntesis — el mapa mental

1. El **PLC** es el puente físico-digital, con tres propiedades derivadas de su entorno: E/S analógica/digital dedicada, determinismo en tiempo real de ciclo de escaneo acotado, y robustez industrial — nada de esto es opcional, es consecuencia directa de vivir en la frontera entre voltajes reales y decisiones de control con consecuencias físicas.
2. Los datos que salen del PLC son **series de tiempo industriales**: volumen alto por diseño (frecuencia de muestreo), timestamp estructural (no metadata secundaria), y contexto temporal como parte del significado — fundamentalmente distintas de un registro convencional de baja frecuencia y alta relectura.
3. **Modbus** resuelve el problema original de comunicación simple maestro/esclavo con recursos mínimos — sigue vivo por inercia de hardware legacy, no por ser la mejor opción hoy; carece de modelo de información semántico.
4. **OPC-UA** resuelve el problema de interoperabilidad semántica entre fabricantes distintos con un modelo de información rico y autodescriptivo — el estándar de facto para supervisión industrial moderna, al costo de mayor complejidad de implementación.
5. **MQTT** resuelve el problema de escalar a miles de dispositivos dispersos con recursos limitados, usando el patrón **publish/subscribe** con un **broker** intermediario — el desacoplamiento resultante convierte un problema de integración O(P×C) en uno O(P+C), y es exactamente lo que habilita edge computing: el mismo dato alimenta simultáneamente decisiones locales de baja latencia y análisis remoto de alta profundidad, sin coordinación explícita entre ambos consumidores.
6. Ninguno de estos tres protocolos reemplaza al determinismo del PLC para control de seguridad crítica en tiempo real — todos viven en la capa de comunicación/supervisión por encima del lazo de control físico más interno.
7. Los niveles de **QoS de MQTT** (0/1/2) son una decisión explícita de ingeniería sobre el costo real de perder o duplicar cada tipo específico de mensaje, no un default universal.
8. La **sincronización temporal** entre dispositivos (NTP/PTP) es lo que hace válida cualquier correlación entre series de tiempo de fuentes distintas — ignorarla produce análisis sutilmente incorrectos sin ningún error visible que lo delate.
9. La misma arquitectura que da elegancia y escalabilidad (desacoplamiento vía broker) es, sin controles de seguridad explícitos, una superficie de ataque real en sistemas de control industrial — la conveniencia arquitectónica y la vulnerabilidad de seguridad nacen exactamente del mismo mecanismo de desacoplamiento.

---

## Preguntas que deberías poder responder

1. Explica, desde el mecanismo físico (no la definición de manual), por qué un PLC necesita garantías de tiempo real determinista y una laptop de oficina corriendo el mismo algoritmo de control, en principio, no las ofrece de forma nativa.
2. ¿Por qué el timestamp de una lectura de sensor es "estructural" y no "metadata secundaria"? Da un ejemplo concreto de un análisis que se vuelve imposible o incorrecto sin timestamps precisos.
3. Deduce, sin ver el texto, por qué Modbus no ofrece interoperabilidad semántica automática entre fabricantes distintos, partiendo únicamente de que sus registros son números sin tipo ni contexto.
4. Explica la diferencia arquitectónica entre "cada productor conoce a cada consumidor" (O(P×C) conexiones) y la arquitectura con broker (O(P+C)) — ¿qué operación concreta se vuelve local en vez de global al agregar un consumidor nuevo?
5. Da un escenario de FrED Factory donde usarías QoS 0 y otro donde usarías QoS 2, justificando cada elección por el costo real de pérdida/duplicación en ese caso específico.
6. ¿Por qué MQTT es inapropiado para el lazo de control de seguridad más interno de un actuador crítico, aunque técnicamente puedas enviar el comando por ese canal? ¿Dónde debería vivir ese control en su lugar?
7. Explica cómo la misma propiedad de desacoplamiento que hace elegante la arquitectura pub/sub (nadie necesita conocer a nadie más, solo al broker) es también la fuente de su vulnerabilidad de seguridad si no hay autenticación — ¿qué tendría que verificar un subscriber para no ser engañado por un mensaje falso publicado por un atacante?
8. Describe cómo un gemelo digital, como consumidor de esta arquitectura, ilustra la ventaja del desacoplamiento — ¿qué tendría que cambiar en el sensor físico o en el broker para que el gemelo digital empezara a recibir sus datos? (Pista: la respuesta correcta es "nada").

---

## Fuentes

- OPC Foundation, especificación y documentación de OPC-UA: https://opcfoundation.org/about/opc-technologies/opc-ua/
- OASIS / MQTT.org, especificación del protocolo MQTT (incluye definición formal de los niveles de QoS): https://mqtt.org/
- Eclipse Foundation, documentación de la librería paho-mqtt (Python): https://eclipse.dev/paho/
- Modbus Organization, especificación del protocolo Modbus: https://modbus.org/
- Node-RED, documentación oficial: https://nodered.org/docs/
- MIT OpenCourseWare, materiales de sistemas de manufactura y control (referencia general de contexto de manufactura inteligente): https://ocw.mit.edu/
