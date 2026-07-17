---
module_id: fred-s3-pipelines
spine: FrED
title: "Pipelines de datos industriales"
subtitle: "El stack real que lleva un sensor a un dashboard"
source_canonical: "Mosquitto; InfluxDB/TimescaleDB; Grafana; Docker"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 42
---

# Pipelines de datos industriales

> **Pregunta raíz.** Ya sabes (del módulo `fred-s1-datos-industriales`) por qué existe MQTT y el patrón publish/subscribe, y (del módulo `fred-s2-ml-anomalias`) qué hacer con los datos una vez que los tienes en un DataFrame. Pero entre "un sensor publica a un topic" y "tengo un DataFrame limpio para entrenar un modelo" hay un sistema completo que hay que **construir y operar**: algo tiene que recibir esos mensajes, guardarlos de forma que se puedan consultar por rango de tiempo eficientemente, mostrarlos en un dashboard en vivo, y todo esto tiene que poder desplegarse de forma reproducible en cualquier máquina del laboratorio, no solo en la tuya. **¿Cuál es el stack mínimo real que hace esto, y por qué cada pieza específica —no cualquier alternativa genérica— es la elección correcta para el problema que resuelve?** Este módulo es el puente operativo entre la teoría de los dos módulos anteriores y algo que puedes literalmente levantar en tu laptop esta noche.

## Prólogo — de dónde nace esto

Piensa en una línea de ensamble física: cada estación de trabajo recibe una pieza semi-terminada, hace su transformación específica, y la pasa a la siguiente estación — nadie en la línea necesita saber cómo funciona toda la fábrica, solo su estación. Un pipeline de datos industrial es exactamente esa línea de ensamble, aplicada a información en vez de materia física: el sensor "fabrica" la materia prima (una lectura), el broker la recibe y la distribuye (la banda transportadora que mueve piezas entre estaciones sin que ninguna estación necesite conocer a las demás), la base de datos de series de tiempo la almacena de forma que se pueda recuperar eficientemente después (el almacén de inventario, organizado específicamente para el tipo de pieza que maneja), y el dashboard la presenta de forma legible para un humano (el punto de control de calidad visual al final de la línea).

Cada una de estas estaciones existe porque resuelve un problema específico que las demás no resuelven — no es una colección arbitraria de herramientas de moda, es una cadena donde cada eslabón está ahí por una razón de ingeniería concreta. Vamos a deducir cada una, y al final vas a tener el stack completo corriendo localmente vía Docker Compose — el entregable real de este módulo no es solo entender la arquitectura, es **montarla con tus propias manos**.

---

## 1. El broker (Mosquitto) — por qué desacopla, ya construido, ahora operado

Ya dedujiste en `fred-s1-datos-industriales` por qué el patrón publish/subscribe con un broker intermediario convierte un problema de integración O(productores × consumidores) en uno O(productores + consumidores). Mosquitto es, específicamente, la implementación de referencia open-source más ampliamente usada del protocolo MQTT — ligera, escrita en C, diseñada para correr con overhead mínimo incluso en hardware modesto (exactamente el tipo de dispositivo que se encuentra en el borde de una red industrial, no un servidor de centro de datos).

**Lo que Mosquitto específicamente aporta sobre "el concepto de broker" en abstracto**: persistencia opcional de sesiones (un cliente que se desconecta temporalmente y se reconecta puede recibir los mensajes que se perdió, si se configuró con QoS y sesión persistente — retomado en la sección de trampas), soporte para autenticación por usuario/contraseña y TLS (relevante directamente para la sección de seguridad de Conexiones), y un modelo de configuración simple basado en archivos de texto plano que se presta bien a ser versionado y desplegado de forma reproducible — exactamente lo que necesitas para un laboratorio donde múltiples personas necesitan replicar el mismo entorno.

```python
# publisher_sensor.py -- identico en espiritu al del modulo fred-s1,
# aqui como la primera pieza REAL del stack que vamos a levantar.
import paho.mqtt.client as mqtt
import time
import json
import random

cliente = mqtt.Client(client_id="sensor-extrusor1")
cliente.connect("localhost", 1883, keepalive=60)

try:
    while True:
        lectura = {
            "timestamp": time.time(),
            "temperatura_c": round(205 + random.uniform(-3, 3), 2),
            "torque_nm": round(40 + random.uniform(-2, 2), 2),
        }
        cliente.publish("fred/extrusor1/telemetria", json.dumps(lectura), qos=1)
        time.sleep(1)
except KeyboardInterrupt:
    cliente.disconnect()
```

---

## 2. Por qué una base de datos de SERIES DE TIEMPO, y no Postgres normal

### 2.1 El patrón de acceso que rompe a una base de datos relacional convencional

Ya estableciste en `fred-s1-datos-industriales` que un dato industrial tiene un patrón fundamentalmente distinto: **escritura constante y masiva** (append-heavy — cada sensor escribe muchas veces por segundo, y ese dato, una vez escrito, prácticamente nunca se actualiza) y **consultas dominadas por rango temporal** ("dame todos los valores de temperatura entre las 2pm y las 3pm de ayer", no "dame el registro con ID específico X"). Una base de datos relacional convencional como Postgres está optimizada, por diseño, para un patrón de acceso distinto: transacciones que pueden leer Y escribir Y actualizar registros individuales con garantías fuertes de consistencia (ACID completo), con índices generales (B-trees, del módulo `itc-c4-arboles`) que sirven bien para "encuéntrame el registro con esta clave primaria específica", pero no están estructuralmente optimizados para "dame, eficientemente, millones de filas dentro de esta ventana de tiempo, ya ordenadas cronológicamente, del último año de datos".

**Por qué esto se rompe concretamente a escala**: si insertas millones de lecturas de sensores por día en una tabla Postgres convencional, con un índice B-tree genérico sobre timestamp, el índice mismo crece a un tamaño considerable, y cada inserción individual paga el costo de mantener ese índice balanceado (recuerda del módulo de árboles: cada inserción en un árbol balanceado cuesta O(log n), y con n creciendo hacia cientos de millones de filas, ese costo por inserción, aunque logarítmico, se acumula de forma que empieza a competir seriamente con la capacidad de escritura sostenida que un flujo constante de sensores exige). Además, Postgres genérico no tiene, de fábrica, ningún mecanismo automático de **retención** (borrar datos viejos automáticamente después de cierto tiempo) ni de **downsampling** (agregar datos antiguos a una resolución más baja, en vez de guardar cada lectura individual para siempre) — ambas cosas que necesitas casi inevitablemente en un sistema de telemetría de larga duración, porque guardar cada lectura a resolución completa por años, indefinidamente, no es sostenible en espacio de almacenamiento.

### 2.2 Qué hace InfluxDB/TimescaleDB específicamente distintas

**InfluxDB** es una base de datos diseñada desde cero específicamente para series de tiempo — su modelo de datos nativo es "measurement + tags + fields + timestamp" (donde tags son metadata indexada usada para filtrar, como "sensor_id" o "ubicación", y fields son los valores numéricos reales, como temperatura o torque), con un motor de almacenamiento optimizado para escritura secuencial de alto volumen y compresión eficiente de series de tiempo (los valores de un sensor real cambian suavemente entre lecturas consecutivas, lo cual se presta a compresión mucho más agresiva que datos genéricos sin esa estructura temporal). Incluye retención y downsampling como características de primera clase, no como algo que tienes que construir tú mismo encima.

**TimescaleDB** toma un camino distinto y complementario: es una **extensión sobre Postgres** (no una base de datos completamente nueva) que introduce el concepto de **hypertable** — una tabla que, por debajo, se particiona automáticamente en "chunks" más pequeños organizados por rango de tiempo, de forma que las consultas por rango temporal solo necesitan tocar los chunks relevantes, no la tabla completa. La ventaja de este enfoque: **conservas todo el ecosistema y las garantías de Postgres** (SQL completo, joins, transacciones ACID, la vasta cantidad de herramientas y conocimiento que ya existe alrededor de Postgres) mientras ganas el rendimiento de series de tiempo donde importa. Esta es una decisión de trade-off explícita: si tu equipo ya tiene experiencia y tooling construido alrededor de Postgres, o necesitas hacer joins complejos entre datos de series de tiempo y datos relacionales convencionales (por ejemplo, unir lecturas de sensores con una tabla de "órdenes de producción" o "operadores en turno"), TimescaleDB es frecuentemente la elección más pragmática. Si empiezas desde cero sin ese lastre de ecosistema previo y quieres la experiencia más pura y especializada para telemetría, InfluxDB es la opción diseñada exactamente para eso.

```sql
-- Ejemplo de query de rango temporal, fiel a la sintaxis de TimescaleDB
-- (SQL estandar de Postgres, con las funciones de time_bucket que
-- TimescaleDB agrega especificamente para series de tiempo).
SELECT
    time_bucket('1 minute', timestamp) AS minuto,
    AVG(temperatura_c) AS temp_promedio,
    MAX(temperatura_c) AS temp_maxima
FROM telemetria_extrusor
WHERE timestamp >= NOW() - INTERVAL '1 hour'
  AND sensor_id = 'extrusor1'
GROUP BY minuto
ORDER BY minuto;
```

```
# Ejemplo de query equivalente en Flux (el lenguaje de consulta de InfluxDB):
from(bucket: "fred_factory")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "telemetria" and r.sensor_id == "extrusor1")
  |> filter(fn: (r) => r._field == "temperatura_c")
  |> aggregateWindow(every: 1m, fn: mean)
```

Nota cómo ambas queries expresan exactamente la misma idea — "agrega por ventanas de tiempo de 1 minuto, filtrado por rango y por sensor" — pero con un vocabulario y una sintaxis completamente distintos, reflejando las dos filosofías de diseño distintas (SQL extendido vs. un lenguaje de consulta funcional diseñado específicamente para series de tiempo).

---

## 3. Grafana — por qué existe una capa de visualización separada, y no la construyes tú mismo

### 3.1 El problema que resuelve

Podrías, en principio, escribir tu propio código (una app web con Flask/FastAPI y una librería de gráficas) que consulte tu base de datos de series de tiempo y dibuje gráficas. La pregunta es: ¿vale la pena construir eso desde cero, cuando el problema de "consultar una fuente de datos y dibujar paneles configurables, con actualización en vivo, alertas configurables, y control de acceso" ya está resuelto de forma madura y ampliamente probada por una herramienta específica para exactamente ese problema?

Grafana resuelve, de forma genérica y configurable (sin que tengas que escribir código de frontend para cada nuevo gráfico que necesites), el problema de: conectarse a múltiples fuentes de datos (incluyendo, de forma nativa, tanto InfluxDB como TimescaleDB/Postgres — el mismo Grafana sirve para ambas elecciones de la sección 2), construir dashboards con paneles de gráficas de series de tiempo, tablas, gauges, mapas de calor, configurar actualización automática en un intervalo definido (para monitoreo "en vivo"), y definir alertas (notificaciones cuando una métrica cruza un umbral — la pieza que conecta directamente con el sistema de detección de anomalías del módulo `fred-s2-ml-anomalias`: el score de anomalía de un modelo puede, él mismo, publicarse de vuelta al pipeline y visualizarse/alertarse en Grafana exactamente igual que cualquier otra métrica de sensor).

**Por qué esto no es "reinventar la rueda innecesariamente" sino la decisión de ingeniería correcta**: el mismo principio de "simplicidad sobre sofisticación" que estableciste en el módulo de ML aplica aquí en la dirección opuesta — no se trata de evitar herramientas sofisticadas, se trata de no gastar tiempo de ingeniería reconstruyendo algo que una herramienta madura y ampliamente adoptada ya resuelve mejor de lo que tú lo resolverías en el tiempo disponible de un proyecto de laboratorio. El tiempo de ingeniería que ahorras usando Grafana en vez de construir tu propio sistema de dashboards lo inviertes donde sí importa: la lógica específica de tu proceso físico, tus modelos de ML, tu arquitectura de handlers — el trabajo que nadie más puede hacer por ti porque es específico de FrED Factory.

---

## 4. Edge computing — deducido desde tres restricciones físicas reales

Ya se mencionó de pasada en `fred-s1-datos-industriales`; aquí lo deducimos con rigor completo, porque es central para decidir **dónde** viven las piezas de este pipeline.

### 4.1 Latencia — cuando la física de la señal importa más que el poder de cómputo

Si el procesamiento de una decisión crítica (por ejemplo, "¿esta vibración indica que hay que detener el proceso ahora mismo?") depende de enviar el dato a un servidor en la nube, esperar el procesamiento, y recibir la respuesta de vuelta, el tiempo total incluye **dos viajes de red completos** más el tiempo de procesamiento remoto — potencialmente cientos de milisegundos, incluso con buena conectividad, y mucho peor con conectividad inestable. Para decisiones donde la ventana de reacción segura se mide en milisegundos (control físico crítico, como ya estableciste que vive en el PLC, no cruzando un broker), esta latencia de ida y vuelta es simplemente inaceptable — no es un problema de "optimizar el código", es una limitación física de la velocidad de la luz y la infraestructura de red intermedia. **Procesar cerca del sensor (edge) elimina el viaje de red del camino crítico**, dejando solo el tiempo de cómputo local, que puede ser órdenes de magnitud menor.

### 4.2 Ancho de banda — por qué no puedes (ni deberías) enviar todo a la nube

Un sensor de vibración de alta frecuencia, o una cámara de inspección visual, puede generar un volumen de datos crudos que, multiplicado por docenas de sensores en una planta completa, satura fácilmente la conexión a internet disponible si intentas enviarlo todo, sin procesar, hacia un servidor central. El procesamiento en el edge permite **reducir** el volumen de datos que efectivamente necesita viajar por la red: en vez de enviar cada lectura cruda, procesas localmente y solo envías **agregados** (promedios por minuto, eventos de anomalía detectados) o **resúmenes** hacia el sistema central, reservando el envío de datos crudos completos solo para los casos específicos donde de verdad se necesitan (por ejemplo, cuando se detecta una anomalía y quieres capturar el contexto crudo completo alrededor de ese evento para análisis posterior detallado).

### 4.3 Resiliencia — qué pasa cuando la conexión a internet simplemente se cae

Un sistema que depende completamente de que la nube esté disponible para funcionar (incluso para operaciones básicas de monitoreo local) se vuelve frágil frente a cualquier interrupción de conectividad — y en un entorno industrial real, la conectividad a internet **no** es una garantía absoluta (cortes de proveedor, mantenimiento de red, problemas de infraestructura del edificio). Un sistema con capacidad de procesamiento y almacenamiento local en el edge puede seguir operando, monitoreando, y tomando decisiones locales durante una interrupción de conectividad, sincronizando con el sistema central cuando la conexión se restaura — en vez de quedar completamente ciego durante la interrupción.

**La consecuencia arquitectónica de estas tres restricciones**: el stack de este módulo no vive necesariamente todo en un solo lugar — puedes desplegar Mosquitto y una instancia local de la base de datos de series de tiempo **físicamente cerca** de las máquinas de FrED Factory (en el edge), con Grafana también corriendo localmente para monitoreo inmediato del laboratorio, mientras opcionalmente rep replicas o agregados de esos datos se sincronizan hacia un sistema central en la nube para análisis histórico más profundo o acceso remoto — exactamente el mismo patrón de "el mismo dato alimenta múltiples consumidores con necesidades de latencia radicalmente distintas" que ya estableciste en el módulo de arquitectura de datos industriales.

---

## 5. Docker — por qué contenerizar servicios industriales

### 5.1 El problema de reproducibilidad que Docker resuelve

Si instalas Mosquitto, InfluxDB, y Grafana directamente sobre el sistema operativo de una máquina específica del laboratorio, terminas con un entorno que depende de la versión exacta del sistema operativo, las versiones exactas de cada paquete instalado, y cualquier configuración manual que hiciste durante la instalación — "funciona en mi máquina" es exactamente el problema que esto genera, porque replicar ese mismo entorno en otra máquina del laboratorio (o en la laptop de otro miembro del equipo, o en un servidor de producción) exige repetir manualmente todos esos pasos, con alto riesgo de que algún detalle se haga distinto y el comportamiento termine siendo sutilmente diferente.

**Docker resuelve esto empaquetando cada servicio, junto con su sistema de archivos, sus dependencias exactas, y su configuración, en una imagen inmutable** que se ejecuta de forma idéntica sin importar en qué máquina host corra (siempre que esa máquina tenga Docker instalado) — el mismo principio de "reproducibilidad garantizada por aislamiento de dependencias" que probablemente ya conoces de entornos virtuales de Python (`venv`), pero aplicado a nivel de sistema operativo completo, no solo de paquetes de un lenguaje específico, y crucialmente, aplicado a **servicios completos** (un broker MQTT, una base de datos, un servidor de dashboards) que de otra forma requerirían instalación de sistema completa.

### 5.2 Docker Compose — orquestar múltiples servicios que se necesitan entre sí

El stack de este módulo no es un solo servicio, son **varios** servicios que necesitan comunicarse entre sí (Grafana necesita conectarse a la base de datos; los publishers necesitan conectarse a Mosquitto). Docker Compose declara, en un solo archivo, **todos** los servicios del stack, su configuración, y la red que los conecta — permitiendo levantar el stack completo con un solo comando, de forma idéntica en cualquier máquina.

```yaml
# docker-compose.yml -- el stack minimo de este modulo:
# Mosquitto (broker) + InfluxDB (series de tiempo) + Grafana (dashboards)

version: "3.8"

services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: fred-mosquitto
    ports:
      - "1883:1883"     # puerto MQTT estandar
      - "9001:9001"     # puerto MQTT sobre websockets, si se necesita
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
    restart: unless-stopped

  influxdb:
    image: influxdb:2.7
    container_name: fred-influxdb
    ports:
      - "8086:8086"
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=${INFLUXDB_ADMIN_PASSWORD}
      - DOCKER_INFLUXDB_INIT_ORG=fred_factory
      - DOCKER_INFLUXDB_INIT_BUCKET=telemetria
    volumes:
      - influxdb_data:/var/lib/influxdb2
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: fred-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - influxdb
    restart: unless-stopped

volumes:
  mosquitto_data:
  influxdb_data:
  grafana_data:
```

```bash
# Levantar el stack completo:
# (asumiendo un archivo .env con INFLUXDB_ADMIN_PASSWORD y
# GRAFANA_ADMIN_PASSWORD -- NUNCA hardcodeados en el compose file,
# el mismo principio de "secretos en env-var, no en config versionada"
# que ya viste en el modulo del ORION Bridge)
docker compose up -d

# Verificar que los tres servicios esten corriendo:
docker compose ps

# Ver logs de un servicio especifico si algo falla:
docker compose logs mosquitto
```

**Este es el entregable operativo del módulo**: con este archivo y el `.env` correspondiente, tienes el stack completo de broker + base de datos de series de tiempo + dashboard corriendo localmente en minutos, listo para conectar el publisher de la sección 1 y empezar a ver datos fluir de extremo a extremo.

---

## 6. Edge cases y trampas explícitas

### 6.1 Pérdida de datos si el consumidor cae — buffering y QoS

Si tu servicio que suscribe a Mosquitto y escribe hacia InfluxDB se cae (crash, reinicio, mantenimiento), **¿qué pasa con los mensajes publicados durante ese tiempo?** Con QoS 0 (ya visto en `fred-s1-datos-industriales`), esos mensajes simplemente se pierden — nadie los recibe. Con QoS 1 o 2, y una **sesión persistente** configurada en el cliente MQTT (un parámetro de conexión que le dice al broker "recuerda qué mensajes le debes a este cliente específico mientras está desconectado, y entrégaselos cuando regrese"), Mosquitto puede retener esos mensajes hasta que el consumidor se reconecte — pero esto tiene un límite práctico: Mosquitto no tiene almacenamiento infinito, y si el consumidor está caído por mucho tiempo mientras los publishers siguen produciendo a alta frecuencia, el broker mismo puede acumular una cola creciente de mensajes pendientes, con el riesgo de consumir memoria/disco del propio broker. **La mitigación de producción real**: monitorear la salud del servicio consumidor activamente (el mismo principio de observabilidad que querrías para cualquier servicio crítico), y diseñar explícitamente cuánto tiempo de desconexión es "tolerable" antes de que la pérdida de buffering se vuelva un problema real — no asumir que QoS 1 es una solución mágica sin límites.

### 6.2 La explosión de cardinalidad — el error de diseño más común en series de tiempo

**Cardinalidad**, en el contexto de bases de datos de series de tiempo, se refiere al número de combinaciones únicas de tags (metadata indexada) que existen en tu dataset. Cada combinación única de tags crea, internamente, una **serie** separada que el motor de la base de datos indexa y mantiene por separado. Si diseñas tus tags incluyendo valores que tienen **alta cardinalidad natural** — por ejemplo, usar el timestamp mismo como tag (en vez de como el eje temporal nativo, que es lo que realmente es), o un ID de sesión único generado por request, o cualquier valor que prácticamente nunca se repite — terminas creando, efectivamente, una serie nueva por cada punto de dato individual, en vez de agrupar datos relacionados en un número manejable de series. Esto degrada drásticamente el rendimiento del motor de almacenamiento (que está optimizado para un número razonable de series con muchos puntos cada una, no para un número explosivo de series con pocos puntos cada una) y puede, en casos severos, hacer que la base de datos consuma memoria de forma desproporcionada solo para mantener el índice de todas esas series únicas.

**La regla práctica**: usa tags para dimensiones que tienen un número **acotado y relativamente pequeño** de valores posibles (`sensor_id`, `ubicación`, `tipo_de_maquina` — decenas o cientos de valores distintos, no millones), y usa **fields** (los valores numéricos medidos, no indexados de la misma forma) para cualquier cosa de alta cardinalidad o esencialmente continua. Confundir estas dos categorías —poner un valor de alta cardinalidad como tag, pensando que "quiero poder filtrar por esto"— es la trampa de diseño más común y más costosa al modelar datos en InfluxDB específicamente, y vale la pena internalizarla antes de diseñar el esquema de datos de un sistema real, no después de que la explosión de cardinalidad ya está degradando el sistema en producción.

### 6.3 Por qué NO Postgres normal para millones de puntos por segundo — la consecuencia cuantitativa

Ya se estableció el argumento estructural en la sección 2.1; aquí la consecuencia práctica explícita: si FrED Factory escalara a, digamos, cientos de sensores publicando a 50-100 Hz cada uno, el volumen agregado puede fácilmente superar decenas de miles de escrituras por segundo. Un Postgres genérico, sin las optimizaciones específicas de particionamiento temporal de TimescaleDB (hypertables, sección 2.2), empieza a degradar su rendimiento de escritura conforme la tabla crece — cada inserción individual sigue pagando el costo de mantener índices generales sobre una tabla cada vez más grande, sin el beneficio de que las consultas típicas (por rango de tiempo reciente) puedan aprovechar que los chunks más recientes son mucho más pequeños que la tabla histórica completa. Esto no significa que Postgres "no sirva" — significa que **Postgres sin la extensión de particionamiento temporal específica** paga un costo que crece de forma menos favorable con el volumen, exactamente el tipo de comparación de trade-off cuantitativo que vale la pena tener presente al decidir la base de datos correcta para la escala real de tu sistema, no solo para un prototipo de laboratorio con unos cuantos sensores.

---

## 7. Trade-offs explícitos

**Edge vs. cloud**: ya derivado en la sección 4 — procesa en el edge lo que necesita baja latencia garantizada o debe seguir funcionando sin conectividad; procesa en la nube lo que necesita recursos de cómputo o almacenamiento que el edge no puede proveer razonablemente (modelos de ML pesados, retención histórica de largo plazo, acceso remoto desde fuera del laboratorio).

**InfluxDB vs. TimescaleDB**: InfluxDB si empiezas desde cero y quieres la experiencia más especializada para telemetría pura, sin necesidad de joins complejos con datos relacionales convencionales. TimescaleDB si ya tienes (o vas a necesitar) el ecosistema completo de Postgres — SQL estándar, joins con tablas de metadata de producción, herramientas de BI que ya hablan SQL nativamente — y estás dispuesto a aceptar la complejidad adicional de gestionar hypertables sobre Postgres a cambio de esa compatibilidad.

**La complejidad del stack vs. lo que el problema realmente necesita**: montar Mosquitto + InfluxDB + Grafana vía Docker Compose es, en sí mismo, una inversión de complejidad de infraestructura — para un prototipo muy pequeño con un solo sensor y necesidades de monitoreo mínimas, podrías, en principio, simplemente escribir a un archivo CSV y graficarlo con matplotlib cuando lo necesites, sin ningún broker ni base de datos especializada. **La justificación de este stack completo aparece cuando el número de sensores, la frecuencia de datos, o la necesidad de monitoreo en vivo y compartido entre varias personas crece más allá de lo que un enfoque artesanal puede sostener razonablemente** — exactamente el mismo principio de "simplicidad sobre sofisticación, hasta que el problema real exige más" que ya estableciste en el módulo de ML: no adoptes complejidad de infraestructura porque es lo que "se usa en la industria", adóptala cuando el problema específico que tienes enfrente genuinamente la necesita.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Un broker MQTT sin autenticación es un agujero — el ángulo Nahual, ahora con el stack real en tus manos.** El `docker-compose.yml` de la sección 5.2 tal como está escrito, sin configuración adicional, levanta Mosquitto **sin autenticación ni TLS** — el puerto 1883 queda abierto a cualquiera que pueda alcanzarlo en la red. Esto es aceptable únicamente para desarrollo local en una máquina que nadie más puede alcanzar; es exactamente la vulnerabilidad de ICS/SCADA que ya identificaste en el módulo `fred-s1-datos-industriales` si este mismo compose file se desplegara tal cual en un entorno con cualquier exposición de red real. La configuración de producción mínima exige, como mínimo: un archivo de configuración de Mosquitto (`mosquitto.conf`) que exija autenticación por usuario/contraseña (`password_file`) o certificados TLS de cliente, y idealmente TLS para cifrar el tráfico completo, no solo autenticar la conexión inicial. La razón de mencionarlo aquí, con el stack ya corriendo en tus manos, es que la vulnerabilidad no es abstracta — es literalmente el archivo que acabas de escribir, en su forma más simple y menos segura, y reconocer esa brecha es exactamente el tipo de hábito de revisión que Nahual entrena.

**El gemelo digital como consumidor de este pipeline exacto.** El gemelo digital mencionado en `fred-s1-datos-industriales` no necesita ninguna integración especial con este stack — es, literalmente, otro suscriptor de Mosquitto (o un consumidor de InfluxDB vía su API de consultas), exactamente como Grafana lo es. Esto es la prueba concreta, con infraestructura real en vez de solo teoría, de la propiedad de desacoplamiento que hace elegante toda esta arquitectura: agregar el gemelo digital como consumidor nuevo no requiere tocar ni Mosquitto, ni InfluxDB, ni ningún publisher existente.

**Cómo el módulo de ML (`fred-s2-ml-anomalias`) se conecta aguas abajo de este pipeline.** El pipeline de detección de anomalías de ese módulo necesita, como input, exactamente los datos que este stack produce y almacena — en la práctica, el flujo completo de producción sería: los sensores publican a Mosquitto (sección 1) → un servicio consumidor escribe esos datos a InfluxDB/TimescaleDB (secciones 2, con el cuidado de cardinalidad de la sección 6.2) → un proceso periódico (o un consumidor en tiempo real) lee ventanas recientes de esa base de datos, las pasa por el pipeline de `IsolationForest` del módulo anterior, y **publica de vuelta** el resultado (score de anomalía, o una alerta binaria) a un topic MQTT nuevo (por ejemplo, `fred/extrusor1/alertas`) — que a su vez puede alimentar tanto un panel de alertas en Grafana como, potencialmente, un sistema de control que reaccione a esa alerta. Esto cierra el círculo completo: el mismo stack que este módulo construye es, literalmente, la infraestructura de producción sobre la que corre el modelo de ML del módulo anterior — no dos sistemas separados, sino una sola cadena continua desde el sensor físico hasta la decisión, exactamente como prometía la pregunta raíz del primer módulo de este eje.

---

## Síntesis — el mapa mental

1. **Mosquitto** (broker MQTT) desacopla productores de consumidores exactamente como se dedujo en `fred-s1-datos-industriales` — aquí, la pieza operativa real que efectivamente levantas y configuras.
2. **InfluxDB/TimescaleDB** existen porque el patrón de acceso de datos industriales (escritura masiva append-heavy, consultas por rango temporal) es estructuralmente distinto al patrón que una base de datos relacional convencional optimiza — InfluxDB como diseño nativo especializado, TimescaleDB como extensión de Postgres que conserva su ecosistema SQL completo.
3. **Grafana** resuelve, de forma madura y configurable sin código custom, el problema de visualización/dashboards/alertas — invertir tiempo de ingeniería reconstruyendo esto no se justifica cuando el problema genérico ya está resuelto.
4. **Edge computing** se deduce de tres restricciones físicas reales: latencia (el viaje de red no cabe en la ventana de reacción segura), ancho de banda (no todo cabe ni debe viajar a la nube), y resiliencia (el sistema debe seguir operando sin conectividad).
5. **Docker/Docker Compose** resuelve reproducibilidad — el mismo stack corre idéntico en cualquier máquina del laboratorio, eliminando "funciona en mi máquina" como fuente de fricción de equipo.
6. **Pérdida de datos con consumidor caído** se mitiga con QoS + sesión persistente, pero con límites prácticos de buffering que hay que monitorear activamente, no asumir resueltos.
7. **Explosión de cardinalidad** es el error de diseño más común y costoso en series de tiempo — tags deben tener cardinalidad acotada; valores de alta cardinalidad van en fields, no en tags.
8. Este stack completo es, literalmente, la infraestructura de producción sobre la que corre el pipeline de ML del módulo anterior — sensor → Mosquitto → base de datos → modelo → alerta de vuelta al mismo broker → dashboard, un solo circuito continuo.

---

## Preguntas que deberías poder responder

1. Explica, desde el patrón de acceso a datos (no de memoria, sino de lo que la aplicación real necesita hacer), por qué una base de datos relacional convencional se degrada con el volumen y patrón de escritura típico de telemetría industrial, mientras una base de datos de series de tiempo no.
2. ¿Cuándo elegirías TimescaleDB sobre InfluxDB para un proyecto nuevo de FrED Factory, y qué característica específica de tu caso de uso justificaría esa elección sobre la alternativa?
3. Deriva, desde las tres restricciones físicas (latencia, ancho de banda, resiliencia), un escenario concreto de FrED Factory donde procesarías en el edge, y otro donde procesarías en la nube — justifica cada uno con la restricción específica que lo motiva.
4. ¿Por qué el `docker-compose.yml` de este módulo, tal cual está escrito, sería inaceptable para un despliegue con cualquier exposición de red real? ¿Qué configuración mínima adicional necesitarías agregar?
5. Explica la diferencia entre un "tag" y un "field" en el modelo de datos de InfluxDB, y por qué usar un valor de alta cardinalidad (como un timestamp único o un ID de sesión) como tag es un error de diseño costoso — ¿qué le pasa internamente al motor de almacenamiento cuando cometes este error?
6. Diseña, en palabras, el flujo completo de datos desde un sensor físico hasta una alerta de anomalía visible en un dashboard, nombrando explícitamente en qué punto del flujo interviene cada pieza del stack de este módulo (Mosquitto, la base de datos, el modelo de ML del módulo anterior, Grafana).
7. ¿Por qué QoS 1 con sesión persistente no es una solución "mágica" e ilimitada contra la pérdida de datos si el consumidor cae por mucho tiempo? ¿Qué recurso finito del broker se ve afectado?
8. ¿Por qué contenerizar con Docker resuelve un problema distinto al que resuelve, por ejemplo, un entorno virtual de Python (`venv`) — en qué nivel de la pila de dependencias opera cada uno, y por qué necesitas ambos para un stack como el de este módulo (Python para tus scripts de publisher/consumidor, Docker para los servicios de infraestructura)?

---

## Fuentes

- Eclipse Mosquitto, documentación oficial: https://mosquitto.org/documentation/
- InfluxDB, documentación oficial (modelo de datos, Flux, retención y downsampling): https://docs.influxdata.com/
- TimescaleDB, documentación oficial (hypertables, particionamiento temporal sobre Postgres): https://docs.timescale.com/
- Grafana, documentación oficial: https://grafana.com/docs/grafana/latest/
- Docker, documentación oficial de Docker Compose: https://docs.docker.com/compose/
- Eclipse Foundation, documentación de la librería paho-mqtt (Python): https://eclipse.dev/paho/
