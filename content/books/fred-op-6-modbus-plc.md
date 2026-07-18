---
module_id: fred-op-6-modbus-plc
spine: FrED
path: Operativo
title: "Modbus y el PLC Siemens S7-1200"
subtitle: "El lenguaje del piso de planta"
source_canonical: "Manual Siemens S7-1200 System Manual (04/2012, A5E02486680-06); Modbus; snap7 (orion-bridge handler plc)"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Modbus y el PLC Siemens S7-1200

> **Pregunta raíz.** Una línea de extrusión de FrED no habla Python, no tiene una API REST, no entiende JSON. Es motores, sensores de límite, calentadores, y relés — física conectada por cables a terminales de entrada/salida. **¿Cómo hace un software escrito en una computadora convencional para controlar, de forma confiable y determinista, algo que existe en ese mundo completamente distinto?** La respuesta tiene dos partes que hay que deducir por separado: primero, necesitas un dispositivo — el PLC — diseñado desde su concepción para vivir exactamente en esa frontera. Segundo, necesitas un protocolo — Modbus, entre otros — que le permita a un sistema externo (tu handler del Bridge) hablar con ese PLC sin ambigüedad. Este módulo construye ambos desde el mecanismo, anclado directamente al manual real del S7-1200 que tienes en tu carpeta.

## Prólogo — de dónde nace esto

Ya dedujiste, en el módulo de arquitectura general del Bridge, por qué existe un PLC como "el puente entre lo físico y lo digital" — determinismo de ciclo de escaneo, entradas/salidas dedicadas, robustez industrial. Este módulo profundiza esa deducción con el detalle exacto de **cómo** un PLC real, el Siemens S7-1200, organiza su memoria y expone su comportamiento, y luego construye, desde primer principio, el protocolo que permite a tu handler hablar con él: Modbus. Es el mismo patrón de handler que ya construiste dos veces en esta ruta — primero con el Arduino/DHT11 por serial simple, ahora con un PLC industrial real por un protocolo de red estandarizado — y vas a ver que, a pesar de la diferencia de escala y de complejidad del dispositivo, el principio de fondo (traducir un protocolo específico hacia el contrato común de `DeviceHandler`) es exactamente el mismo.

---

## 1. Por qué un PLC, y no una Raspberry Pi, para mover una prensa

### 1.1 El ciclo de escaneo — determinismo, verificado directamente en el manual

El manual del S7-1200 describe explícitamente el mecanismo central que ya anticipaste en el módulo de arquitectura general: el CPU opera con una **imagen de proceso (process image)** — una instantánea de las entradas y salidas físicas que se actualiza de forma sincronizada con el ciclo de escaneo, no de forma arbitraria en cualquier momento. El manual lo describe así: *"the CPU reads the physical inputs just prior to the execution of the user program and stores the input values in the process image input area. This ensures that these values remain consistent throughout the execution of the user instructions"* — y de forma simétrica, el programa de usuario escribe sobre la imagen de salida, no directamente sobre las salidas físicas, y es **al final** del ciclo que el CPU copia esa imagen hacia las salidas reales.

**Por qué esto es exactamente el determinismo que dedujiste conceptualmente, ahora con el mecanismo concreto**: esta indirección (leer una instantánea al inicio, escribir sobre una imagen interna durante la ejecución, volcar hacia las salidas físicas al final) es lo que **garantiza consistencia lógica durante todo el ciclo** — el manual lo dice explícitamente: *"this process provides consistent logic through the execution of the user instructions for a given cycle and prevents the flickering of physical output points that might change state multiple times"*. Sin esta indirección, si el programa leyera y escribiera directamente sobre pines físicos en cualquier momento arbitrario durante su ejecución, una entrada podría cambiar a mitad de la evaluación de la lógica, produciendo un comportamiento lógicamente inconsistente dentro de un mismo ciclo — exactamente el tipo de no-determinismo que un sistema operativo de propósito general, con su scheduler preemptivo, no puede evitar de forma nativa (el mismo argumento que ya construiste para el DHT11 en el módulo anterior, aquí aplicado a la escala de un ciclo de control completo, no solo a un protocolo de sensor puntual).

### 1.2 Acceso inmediato (`:P`) — la excepción que confirma la regla

El manual documenta una excepción deliberada a este mecanismo: puedes anexar `:P` a una dirección (`I0.3:P`, `Q1.7:P`) para acceder **directamente** al punto físico, saltándote la imagen de proceso — *"an immediate read accesses the current state of the physical input and does not update the process image input area"*. Nota la asimetría que el manual documenta explícitamente: los accesos `I_:P` son **de solo lectura** (escribir a una entrada física está prohibido, porque las entradas reciben su valor del campo, no del programa), mientras que los accesos `Q_:P` son **de solo escritura** (leer una salida física está prohibido, porque las salidas son controladas por el programa, no por el campo). Esta es una restricción de diseño con una razón física exacta: no tendría sentido físico ni lógico que el programa "leyera" una salida cuyo valor él mismo controla, ni que "escribiera" sobre una entrada cuyo valor viene determinado por un sensor real.

### 1.3 Los tres modos de operación — otra forma de determinismo, ahora sobre el ciclo de vida completo

El manual describe tres modos: **STOP** (el programa no ejecuta, se puede descargar un proyecto nuevo), **STARTUP** (los OBs de arranque se ejecutan una vez, sin procesar eventos de interrupción), y **RUN** (los OBs de ciclo de programa se ejecutan repetidamente, con eventos de interrupción procesables en cualquier punto). Esta separación explícita de modos —con transiciones controladas y estados de LED físicos que indican cuál está activo— es, de nuevo, la misma disciplina de determinismo aplicada al ciclo de vida completo del dispositivo, no solo a un ciclo de escaneo individual: en ningún momento hay ambigüedad sobre si el PLC está "ejecutando lógica de control real" o no, algo que un proceso genérico de software en una PC, sin esta separación formal de modos reforzada por hardware, no ofrece de la misma forma verificable.

### 1.4 Por qué no una Raspberry Pi — la respuesta completa, ahora con evidencia concreta

Ya tienes la respuesta conceptual del módulo de arquitectura general (E/S dedicada, determinismo, robustez industrial). Ahora puedes verla confirmada en las especificaciones reales: el manual muestra, en su tabla comparativa de modelos de CPU, que incluso el modelo más básico (CPU 1211C) ya trae **entradas/salidas digitales y analógicas integradas de fábrica** (6 entradas/4 salidas digitales, 2 entradas analógicas), contadores de alta velocidad de hasta 100 kHz integrados, y memoria retentiva dedicada — todo esto como parte del diseño base del dispositivo, no como periféricos que hay que ensamblar y configurar por separado como harías con una Raspberry Pi genérica. La diferencia no es solo "una es más robusta que la otra" en abstracto — es que el S7-1200 fue diseñado, desde el primer transistor, específicamente para este trabajo, con el ciclo de escaneo determinista de la sección 1.1 como su principio organizador central, mientras que una Raspberry Pi corre un sistema operativo Linux de propósito general, con todas las fuentes de no-determinismo que eso implica (scheduler preemptivo, interrupciones de sistema, sin ninguna garantía nativa de ciclo de escaneo).

---

## 2. El modelo de memoria del S7-1200 — direccionamiento, verificado tabla por tabla

### 2.1 Las áreas de memoria — Tabla 4-8 del manual

El manual (sección 4.2, Tabla 4-8) declara explícitamente las áreas de memoria del CPU:

| Área | Descripción | Forzable | Retentiva |
|---|---|---|---|
| **I** (Process image input) | Copiada de entradas físicas al inicio del ciclo de escaneo | No | No |
| **I_:P** (entrada física) | Lectura inmediata del punto físico | Sí | No |
| **Q** (Process image output) | Copiada a salidas físicas al inicio del ciclo | No | No |
| **Q_:P** (salida física) | Escritura inmediata al punto físico | Sí | No |
| **M** (Bit memory) | Memoria de control y datos | No | Sí (opcional) |
| **L** (Temp memory) | Datos temporales locales al bloque | No | No |
| **DB** (Data block) | Memoria de datos y parámetros para FBs | No | Sí (opcional) |

Nota, deducido directamente de esta tabla, algo que ya reconoces del módulo de estructuras lineales: **I, Q, y M no son retentivas por defecto** — su valor se pierde en un ciclo de energía o reinicio de memoria (salvo M, que puede configurarse como retentiva opcionalmente). **DB sí puede ser retentiva** — esto tiene una consecuencia de diseño directa para cualquier dato que necesite sobrevivir a un reinicio (por ejemplo, un contador de piezas producidas, o el último setpoint válido de un proceso): debe vivir en un Data Block, no en memoria M sin configurar retentividad explícitamente.

### 2.2 La sintaxis de direccionamiento — deducida y verificada

El manual especifica la estructura exacta de una dirección absoluta: **identificador de área** + **tamaño del dato** (`B`=Byte, `W`=Word, `D`=DWord) + **dirección inicial**. Para acceder a un bit individual, se omite el mnemónico de tamaño y se usa la notación `área.byte.bit` — por ejemplo `I0.3` (entrada, byte 0, bit 3), `Q1.7` (salida, byte 1, bit 7), `M3.4` (memoria, byte 3, bit 4).

Para acceder a bytes, words, o double words completos, el manual da la sintaxis exacta (Tablas 4-9, 4-11): `I[tamaño][dirección_byte]` — por ejemplo `IB4` (byte de entrada 4), `IW5` (word de entrada empezando en el byte 5), `ID12` (double word de entrada empezando en el byte 12); simétricamente `QB5`, `QW10`, `QD40` para salidas.

**La deducción que conecta esto con lo que ya sabes**: esta es, literalmente, la misma aritmética de direccionamiento por bytes que dedujiste para arrays en el módulo de estructuras lineales — un `Word` en la dirección 5 no es "el quinto elemento de una lista de words", es el word que empieza físicamente en el byte 5, así que `IW4` e `IW5` se **solapan** en el byte 5 (el segundo byte de `IW4` es el primer byte de `IW5`) — una trampa de direccionamiento real si no entiendes que estás direccionando bytes físicos, no "slots" de word discretos y no solapados.

### 2.3 Tipos de dato — verificados directamente del manual, con sus rangos exactos

El manual (Tablas 4-16, 4-17, 4-18) especifica los tipos de dato fundamentales:

| Tipo | Tamaño (bits) | Rango | Ejemplo de dirección |
|---|---|---|---|
| Bool | 1 | FALSE/TRUE, 0/1 | I1.0, Q0.1, M50.7 |
| Byte | 8 | 0 a 255 (sin signo) | IB2, MB10 |
| Word | 16 | 0 a 65535 (sin signo) | MW10, DB1.DBW2 |
| DWord | 32 | 0 a 4,294,967,295 | MD10, DB1.DBD8 |
| Int | 16 | -32,768 a 32,767 | MW2, DB1.DBW2 |
| DInt | 32 | -2,147,483,648 a 2,147,483,647 | MD6, DB1.DBD8 |
| **Real** | 32 | ±1.175495e-38 a ±3.402823e+38, precisión de 6 dígitos significativos (IEEE 754 de precisión simple) | MD100, DB1.DBD8 |
| LReal | 64 | precisión de 15 dígitos significativos (IEEE 754 de precisión doble) | DB_name.var_name |

**La distinción crítica para tu handler, deducida directamente de esta tabla**: nota que `Word` (16 bits, sin signo) y `Int` (16 bits, con signo) **ocupan exactamente el mismo espacio físico de memoria y usan la misma dirección** — `MW10` puede interpretarse como un `Word` (0-65535) o como un `Int` (-32768 a 32767) dependiendo únicamente de cómo el programa que lo lee decide interpretar esos mismos 16 bits. **Esta es exactamente la trampa de "leer el tipo de dato equivocado"** que vas a ver formalizada en la sección 5.1 — el PLC no te protege de interpretar mal un valor; la corrección depende enteramente de que tu handler sepa, de antemano (típicamente del programa de control que declaró ese DB o dirección específica), qué tipo de dato real vive ahí.

---

## 3. Modbus — deducido desde el problema de comunicación remota, y verificado contra el manual

### 3.1 El modelo maestro-esclavo, y por qué es la forma más simple de resolver "quién habla primero"

Ya tienes, del módulo de fundamentos FrED de datos industriales, el contexto general de Modbus como "el veterano". Aquí lo deducimos con precisión desde el mecanismo, verificado contra la sección 12.5 del manual real.

El manual lo confirma explícitamente: *"Modbus RTU uses a master/slave network where all communications are initiated by a single Master device and slaves can only respond to a master's request"*. Este es el mismo patrón request-response que ya reconociste como estructuralmente limitado en el módulo de Transport — pero aquí, para el caso específico de "leer/escribir un registro de un PLC", esa limitación **no es un problema real**: no necesitas que el PLC "empuje" datos espontáneamente por Modbus (para eso, si lo necesitaras, usarías el Reactive Observer del Bridge sobre datos que sí lees vía polling Modbus periódico) — necesitas, de forma simple y predecible, "pedir el valor del registro N" o "escribe este valor en el registro N", y el modelo maestro-esclavo resuelve exactamente eso sin ninguna complejidad adicional.

### 3.2 Los códigos de función — el vocabulario completo de Modbus, verificado tabla por tabla

El manual (Tablas 12-45, 12-46) da la lista completa y exacta de códigos de función soportados:

**Lectura**:
- `01`: leer bits de salida (1 a 2000 bits por petición)
- `02`: leer bits de entrada (1 a 2000 bits por petición)
- `03`: leer holding registers (1 a 125 words por petición)
- `04`: leer input words (1 a 125 words por petición)

**Escritura**:
- `05`: escribir un bit de salida (1 bit por petición)
- `06`: escribir un holding register (1 word por petición)
- `15`: escribir uno o más bits de salida (2 a 1968 bits por petición)
- `16`: escribir uno o más holding registers (2 a 123 words por petición)

**Por qué existen exactamente estos códigos, deducido de la estructura de datos que cada uno maneja**: nota que hay una distinción entre **bits** (funciones 01/02/05/15, para señales discretas on/off — coils y entradas discretas) y **words** (funciones 03/04/06/16, para valores numéricos de 16 bits — registros), y dentro de cada categoría, una distinción entre **salida/escritura** (bits/registros que el maestro puede modificar) e **entrada/solo-lectura** (valores que solo el dispositivo esclavo puede generar, típicamente desde sensores físicos). Esta cuádruple distinción (bit vs. word × lectura/escritura vs. solo-lectura) es exactamente el vocabulario mínimo necesario para cubrir los dos tipos fundamentales de dato industrial (señales discretas y valores numéricos) con el control de acceso correcto para cada uno — ni más vocabulario del necesario, ni menos.

### 3.3 Direcciones Modbus — el rango numérico verificado, y por qué importa para tu handler

El manual (Tabla 12-51, específica para la instrucción MB_CLIENT del S7-1200) da la correspondencia exacta entre función y rango de dirección:

| MB_MODE | Función Modbus | Operación | Rango de MB_DATA_ADDR |
|---|---|---|---|
| 0 | 01 | Leer bits de salida | 1 a 9999 |
| 0 | 02 | Leer bits de entrada | 10001 a 19999 |
| 0 | 03 | Leer holding registers | 40001 a 49999 (o 400001 a 465535) |
| 0 | 04 | Leer input words | 30001 a 39999 |
| 1 | 06 | Escribir un holding register | 40001 a 49999 |
| 1 | 16 | Escribir múltiples holding registers | 40001 a 49999 |

**Esto confirma directamente, con la fuente real, la convención clásica de Modbus que probablemente ya habías visto mencionada de forma genérica**: los rangos `4xxxx` son holding registers (lectura/escritura), `3xxxx` son input registers (solo lectura), `1xxxx` son entradas discretas (solo lectura), y `0xxxx`/sin prefijo son coils de salida (lectura/escritura). Esta convención de "el primer dígito indica la categoría de dato" es una convención histórica de la industria, no parte del protocolo de bytes en sí (a nivel de bytes en el cable, todas las direcciones son simplemente offsets de 16 bits) — pero es exactamente cómo la documentación de dispositivos reales, incluyendo este manual de Siemens, comunica las direcciones válidas, así que tu handler necesita reconocer esta convención al leer la documentación de cualquier dispositivo Modbus que integres.

### 3.4 RTU vs. TCP — el mismo protocolo lógico, dos capas de transporte distintas

El manual distingue claramente: **Modbus RTU** usa conexión serial (RS232 o RS485) para transferencia de datos — el mismo tipo de comunicación serial que ya dedujiste completamente en el módulo anterior con el Arduino, con la diferencia de que aquí el "framing" no es UART simple con `\n` como delimitador, sino un framing binario específico de Modbus con verificación CRC. **Modbus TCP** usa el conector PROFINET del CPU para comunicación TCP/IP — *"No additional communication hardware module is required"*, aprovechando la misma infraestructura de red Ethernet que cualquier otro tráfico IP.

**El trade-off, deducido de la diferencia de capa de transporte**: RTU es apropiado cuando ya tienes cableado serial punto a punto o una red RS485 multipunto establecida (común en instalaciones industriales más antiguas, exactamente la razón de longevidad de Modbus que ya reconociste en el módulo de fundamentos FrED), y no requiere infraestructura de red IP. TCP aprovecha la infraestructura Ethernet ya presente en instalaciones modernas, permite múltiples conexiones simultáneas (el manual nota que *"Multiple client-server connections may exist"*, hasta el máximo soportado por el modelo específico de CPU), y es generalmente más simple de integrar en sistemas ya conectados a una red — exactamente el escenario en el que vive un dispositivo `type = "plc"` del ORION Bridge, donde snap7 (para el protocolo S7 nativo) o pymodbus (para Modbus TCP) se conectarían vía la misma red del laboratorio que ya usa el resto del stack.

### 3.5 MB_COMM_LOAD — configuración de baud rate en el lado del PLC, verificada

Para Modbus RTU, el manual especifica que la instrucción `MB_COMM_LOAD` configura el puerto serial con parámetros explícitos: `BAUD` (con valores válidos exactos: 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 76800, 115200 — *"all other values are invalid"*), `PARITY` (0=ninguna, 1=impar, 2=par), y `RESP_TO` (timeout de respuesta en milisegundos). **Esta es la confirmación directa, desde la fuente oficial, de la misma trampa de baud rate desalineado que ya dedujiste en el módulo anterior con UART/Arduino** — si tu handler de Modbus RTU (vía pymodbus) se configura con un baud rate distinto al que `MB_COMM_LOAD` configuró en el lado del PLC, obtienes exactamente el mismo tipo de fallo silencioso: sin error de conexión, solo datos incorrectamente decodificados.

---

## 4. El handler — la parte a mano y la parte delegable

### 4.1 Qué parte de este trabajo es tuya, y cuál es de la librería

Ya tienes, del módulo de dispatcher, el contrato `DeviceHandler` completo. La parte **a mano** — la que este módulo existe para que domines — es entender el protocolo y el modelo de memoria lo suficientemente bien como para: elegir la dirección Modbus correcta, interpretar el tipo de dato correctamente (sección 2.3, la trampa de Word vs. Int vs. Real), y diagnosticar un fallo de comunicación sabiendo exactamente en qué capa buscar (baud rate, dirección, tipo de dato, o el cableado físico mismo). La parte **delegable** es la integración específica de la librería (`snap7` o `pymodbus`) — la mecánica de abrir un socket TCP hacia la IP del PLC y traducir llamadas Python hacia los bytes exactos del protocolo ya está resuelta por esas librerías maduras; no necesitas reimplementar el framing de Modbus tú mismo.

### 4.2 pymodbus — leyendo/escribiendo un holding register, código real

```python
# handler_plc_modbus.py
# Implementa el contrato DeviceHandler (fred-op-2-dispatcher) para
# un PLC via Modbus TCP, usando pymodbus. Fiel a los rangos y
# codigos de funcion verificados contra el manual del S7-1200,
# seccion 12.5.

from pymodbus.client import ModbusTcpClient

class PLCModbusHandler:
    """
    Handler para un PLC accesible via Modbus TCP.
    Cumple el mismo contrato de DeviceHandler que ArduinoSerialHandler
    (fred-op-3-serial) y cualquier otro handler del Bridge.
    """

    def __init__(self):
        self._cliente = None
        self._conectado = False

    def connect(self, config: dict) -> None:
        ip = config.get("ip")
        puerto = config.get("puerto", 502)   # 502 es el puerto TCP
                                               # estandar de Modbus,
                                               # confirmado como default
                                               # en MB_CLIENT (IP_PORT)
        self._cliente = ModbusTcpClient(host=ip, port=puerto, timeout=3)
        if not self._cliente.connect():
            raise ConnectionError(f"no se pudo conectar al PLC en {ip}:{puerto}")
        self._conectado = True

    def execute(self, comando: dict) -> dict:
        accion = comando.get("accion")

        if accion == "leer_holding_register":
            direccion = comando["parametros"]["direccion"]   # offset 0-based
                                                                # para pymodbus,
                                                                # NO la direccion
                                                                # Modbus 4xxxx
                                                                # (ver seccion 5)
            tipo_dato = comando["parametros"].get("tipo", "int16")
            return self._leer_registro(direccion, tipo_dato)

        elif accion == "escribir_holding_register":
            direccion = comando["parametros"]["direccion"]
            valor = comando["parametros"]["valor"]
            return self._escribir_registro(direccion, valor)

        return {"exito": False, "error": f"accion '{accion}' no soportada"}

    def _leer_registro(self, direccion: int, tipo_dato: str) -> dict:
        if not self._conectado:
            return {"exito": False, "error": "PLC no conectado"}

        # Funcion Modbus 03: Read Holding Registers (Tabla 12-45 del manual)
        respuesta = self._cliente.read_holding_registers(direccion, count=2 if tipo_dato == "real32" else 1)
        if respuesta.isError():
            return {"exito": False, "error": f"error Modbus leyendo registro {direccion}: {respuesta}"}

        registros = respuesta.registers

        if tipo_dato == "uint16":
            valor = registros[0]
        elif tipo_dato == "int16":
            # Interpretacion con signo -- Word vs Int del manual,
            # seccion 2.3: MISMOS bits, interpretacion distinta.
            valor = registros[0] if registros[0] < 32768 else registros[0] - 65536
        elif tipo_dato == "real32":
            # Un Real de 32 bits ocupa DOS registros Modbus de 16 bits
            # cada uno -- confirmado en el manual: "32-bit double word
            # data types like DWORD, DInt, and Real represent two
            # Modbus word addresses". El ORDEN de esos dos words es
            # exactamente la trampa de byte/word order de la seccion 5.2.
            import struct
            crudo = struct.pack(">HH", registros[0], registros[1])
            valor = struct.unpack(">f", crudo)[0]
        else:
            return {"exito": False, "error": f"tipo de dato no soportado: '{tipo_dato}'"}

        return {"exito": True, "resultado": {"direccion": direccion, "valor": valor, "tipo": tipo_dato}}

    def _escribir_registro(self, direccion: int, valor) -> dict:
        if not self._conectado:
            return {"exito": False, "error": "PLC no conectado"}

        # Funcion Modbus 06: Write Single Holding Register (Tabla 12-46)
        respuesta = self._cliente.write_register(direccion, int(valor))
        if respuesta.isError():
            return {"exito": False, "error": f"error Modbus escribiendo registro {direccion}: {respuesta}"}
        return {"exito": True, "resultado": {"direccion": direccion, "valor_escrito": valor}}

    def get_status(self) -> dict:
        return {"tipo": "plc_modbus", "conectado": self._conectado}

    def disconnect(self) -> None:
        if self._cliente is not None:
            self._cliente.close()
        self._conectado = False


if __name__ == "__main__":
    handler = PLCModbusHandler()
    handler.connect({"ip": "192.168.0.10", "puerto": 502})

    resultado = handler.execute({
        "accion": "leer_holding_register",
        "parametros": {"direccion": 0, "tipo": "real32"},
    })
    print(resultado)

    handler.disconnect()
```

### 4.3 snap7 — el protocolo S7 nativo, alternativa a Modbus para el mismo PLC

El README de orion-bridge-v2 declara que el handler `plc` del Bridge usa específicamente **snap7**, no Modbus — vale la pena entender por qué esa es una elección distinta, no equivalente. `snap7` implementa el protocolo **S7comm**, el protocolo de comunicación **nativo y propietario** de Siemens (el mismo que usa STEP 7/TIA Portal para programar y monitorear el PLC), en vez del protocolo abierto Modbus. La ventaja de snap7 sobre Modbus para un S7-1200 específicamente: puedes leer/escribir **directamente por nombre simbólico de Data Block** (`DB1.DBD8`, exactamente la notación que viste en la sección 2.2 del manual), sin necesitar que el programa del PLC exponga explícitamente esos valores a través de las instrucciones `MB_SERVER`/`MB_COMM_LOAD` de Modbus — una capa de configuración menos en el lado del PLC.

```python
# Patron ilustrativo de lectura via snap7 -- la libreria que el
# handler 'plc' de orion-bridge-v2 usa segun el README. El API de
# snap7 es publica y estable; el detalle de COMO el handler
# especifico del Bridge la envuelve no fue verificable directamente
# (ver nota en Fuentes).

import snap7
from snap7.util import get_real, get_int

cliente = snap7.client.Client()
cliente.connect("192.168.0.10", 0, 1)   # IP, rack, slot -- rack=0,
                                          # slot=1 es el default tipico
                                          # de un S7-1200 standalone

# Leer DB1, offset de byte 8, 4 bytes -- un Real de 32 bits,
# exactamente la notacion DB1.DBD8 de la seccion 2.2 del manual.
datos_crudos = cliente.db_read(db_number=1, start=8, size=4)
temperatura = get_real(datos_crudos, 0)
print(f"Temperatura leida de DB1.DBD8: {temperatura}")

cliente.disconnect()
```

---

## 5. Edge cases y trampas explícitas

### 5.1 Leer el tipo de dato equivocado — Int vs. Word vs. Real, la trampa central de este módulo

Ya lo estableciste en la sección 2.3: `Word` e `Int` ocupan exactamente los mismos 16 bits físicos en la misma dirección — no hay ninguna diferencia a nivel de bytes en el cable o en la memoria del PLC entre ambos. Si tu handler lee el registro esperando un `Int` con signo pero el programa del PLC en realidad lo declaró como `Word` sin signo, un valor como `50000` (válido como `Word`, fuera de rango como `Int` de 16 bits que solo llega a 32767) se interpretaría incorrectamente como un número negativo (`50000 - 65536 = -15536`) — un error silencioso, sin ninguna excepción, que produce un valor sintácticamente válido pero semánticamente incorrecto. **La única defensa real**: tu handler necesita conocer, de la documentación del programa específico del PLC (no de una suposición genérica), exactamente qué tipo de dato vive en cada dirección — información que, para un PLC real integrado a producción, viene de quien programó la lógica de control en TIA Portal, no de algo que puedas inferir del protocolo de comunicación por sí solo.

### 5.2 Byte order — la trampa clásica, confirmada directamente en el manual

Aquí está una de las trampas más consistentemente citadas en integración industrial, y el manual la confirma explícitamente sin que tengas que buscarla en otra fuente: *"32-bit double word data types like DWORD, DInt, and Real represent **two** Modbus word addresses"*. Un valor de 32 bits (como el `Real` que leíste en el código de la sección 4.2) no cabe en un solo registro Modbus de 16 bits — ocupa **dos** registros consecutivos, y **el orden en que esos dos registros de 16 bits se combinan para formar el valor de 32 bits no está garantizado universalmente por el protocolo Modbus mismo** — es una convención específica de cada fabricante/dispositivo (a veces llamada "word order" o coloquialmente "big-endian word / little-endian word", independiente del byte-order dentro de cada word individual, que también puede variar).

**Por qué esto es exactamente la trampa que el código de la sección 4.2 previene explícitamente**: si asumes el orden equivocado (`registros[1], registros[0]` en vez de `registros[0], registros[1]`, o el orden de bytes dentro de cada word invertido), obtienes un número que parece sintácticamente válido —es un float perfectamente formado en términos de bits— pero que representa un valor completamente distinto y sin relación con la temperatura real que el PLC está reportando. **La única forma confiable de saber el orden correcto es la documentación específica del dispositivo o del programa del PLC** — no hay un default universal seguro que puedas asumir sin verificar, y esta es exactamente la razón de que el código de la sección 4.2 use `struct.pack`/`unpack` explícitamente con el formato `>HH`/`>f` (big-endian, la convención más común pero **no universal**) en vez de confiar en un default implícito de la librería sin verificarlo contra el dispositivo real.

### 5.3 Timeouts en Modbus RTU

El manual confirma que `MB_COMM_LOAD` tiene un parámetro `RESP_TO` explícito — *"time in milliseconds allowed by MB_MASTER for the slave to respond. If the slave does not respond in this time period, MB_MASTER will retry the request or terminate the request with an error"*. Esto es, del lado del PLC actuando como maestro, exactamente el mismo mecanismo de timeout que ya dedujiste como necesario en el módulo de Arduino/serial — sin él, una petición sin respuesta bloquearía indefinidamente. Del lado de tu handler de Python (actuando como maestro hacia otro dispositivo, o verificando la salud de la comunicación con el PLC), la misma disciplina aplica: el `timeout=3` en el código de la sección 4.2 no es un valor arbitrario — es la misma necesidad estructural, aplicada en la dirección de tu handler hacia el PLC.

### 5.4 Escribir a un registro de solo lectura

El manual distingue claramente qué funciones son de lectura (01-04) y cuáles de escritura (05, 06, 15, 16) — y dentro de las categorías de dato, distingue **input registers** (función 04, rango 30001-39999, explícitamente de solo lectura, típicamente valores provenientes directamente de sensores) de **holding registers** (función 03/06/16, rango 40001-49999, lectura y escritura). Intentar usar la función 06 (escribir holding register) sobre una dirección que en realidad corresponde a un input register no tiene sentido según el protocolo mismo — el dispositivo esclavo debería rechazar la petición con un código de excepción Modbus, no ejecutar silenciosamente algo incorrecto. **La trampa real de ingeniería aquí no es que el protocolo lo permita silenciosamente** (no lo permite, a diferencia de la trampa de tipo de dato de la sección 5.1) **sino confundir, en el diseño de tu capability card** (del módulo anterior de esta ruta), qué direcciones son de solo lectura y exponer una acción de escritura hacia una dirección que el PLC real va a rechazar — un error de diseño de card, no de protocolo, pero con el mismo tipo de consecuencia de frustración operativa que ya identificaste en la sección de trampas de capability cards.

### 5.5 Seguridad de un PLC en red — Modbus sin autenticación es un agujero real

Aquí está la conexión más directa con tu ángulo Nahual de todo este módulo. **Modbus, como protocolo, no tiene ningún mecanismo nativo de autenticación ni cifrado** — cualquier dispositivo que pueda alcanzar la IP y puerto del PLC en la red puede, en principio, enviar comandos de escritura (función 06 o 16) sin ninguna verificación de identidad, exactamente como si tuviera acceso físico directo al panel de control. Esto no es una vulnerabilidad teórica: es una limitación de diseño documentada y ampliamente conocida en seguridad de sistemas de control industrial (ICS/SCADA), consistente con lo que ya identificaste en el módulo de fundamentos FrED sobre por qué un broker MQTT sin autenticación es un agujero — aquí el riesgo es todavía más directo, porque Modbus no solo transporta telemetría, transporta **comandos de escritura directos** sobre un PLC que controla maquinaria física real, sin ninguna de las capas de validación que ya construiste (capability cards, intent → validation → protocolo → hardware) si algo se conecta directamente al PLC **saltándose** el Bridge por completo. La mitigación de producción real para esto vive, típicamente, a nivel de **red** (segmentación de red industrial, VLANs dedicadas, firewalls que restringen qué IPs pueden alcanzar el puerto 502 del PLC) más que a nivel de protocolo, precisamente porque el protocolo mismo no ofrece ningún mecanismo de defensa nativo — la misma lección de "el broker/protocolo no te protege por sí solo, la arquitectura de red y de acceso alrededor de él sí" que ya reconoces del contexto del side quest de Schneider Electric.

---

## 6. Trade-offs explícitos

**Modbus RTU vs. TCP**: ya derivado en la sección 3.4 — RTU para instalaciones seriales existentes sin infraestructura IP, TCP para aprovechar Ethernet ya presente y permitir múltiples conexiones simultáneas. Para un laboratorio como FrED, con infraestructura de red moderna ya presente (el mismo stack de `fred-s3-pipelines`), TCP es casi siempre la elección práctica por defecto salvo que el dispositivo específico solo ofrezca conectividad serial.

**snap7 vs. pymodbus**: snap7 accede directamente por dirección simbólica de Data Block del programa del PLC (más natural si tienes control sobre cómo se programó el PLC en TIA Portal), pymodbus habla el protocolo abierto Modbus (más portable entre fabricantes distintos, útil si necesitas que el mismo handler genérico hable con dispositivos Modbus de múltiples marcas, no solo Siemens). El README del Bridge confirma que el handler `plc` oficial usa snap7 específicamente para el S7-1200 — una elección consistente con optimizar para el dispositivo específico del laboratorio en vez de por portabilidad genérica multi-fabricante.

**Leer directo (snap7/Modbus) vs. vía OPC-UA**: ya construiste, en el módulo de fundamentos FrED (`fred-s1-datos-industriales`), por qué OPC-UA existe específicamente para resolver el problema de interoperabilidad semántica entre fabricantes distintos, a costa de mayor complejidad de implementación. Leer directamente vía snap7/Modbus (como este módulo hace) es más simple y directo cuando sabes exactamente qué dispositivo estás integrando (como es el caso del handler `plc` específico para el S7-1200 de FrED) — pero sacrifica la interoperabilidad automática que OPC-UA ofrecería si el laboratorio necesitara integrar, sin trabajo adicional, PLCs de múltiples fabricantes distintos bajo un modelo de información común. La elección del Bridge de usar snap7 directo para este dispositivo específico es exactamente la aplicación práctica de "no pagues la complejidad de OPC-UA si no necesitas la interoperabilidad multi-fabricante que resuelve" — el mismo principio de simplicidad-sobre-sofisticación que ya has visto aplicado repetidamente en esta serie.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado y verificado arriba.)*

**OPC-UA vs. Modbus vs. el handler del Bridge — el cierre con fundamentos FrED.** Ya construiste, en `fred-s1-datos-industriales`, la deducción completa de por qué existen tres protocolos industriales distintos (Modbus, OPC-UA, MQTT), cada uno resolviendo un problema diferente. Este módulo te da ahora el caso concreto y verificado: el S7-1200 de FrED Factory, integrado al Bridge, usa snap7 (el protocolo S7 nativo, ni siquiera Modbus) precisamente porque el equipo ya sabe exactamente qué dispositivo está integrando y no necesita pagar el costo de un modelo de información genérico multi-fabricante. Si mañana FrED integrara un PLC de otro fabricante junto al S7-1200 y necesitara que un sistema de supervisión de más alto nivel hablara con ambos de forma uniforme sin escribir un handler específico para cada protocolo nativo distinto, ahí es exactamente donde la inversión en OPC-UA empezaría a justificarse — la decisión de arquitectura siempre vuelve al mismo criterio: ¿el problema real que tienes enfrente necesita la interoperabilidad que la complejidad adicional compra, o no?

**Seguridad industrial — el side quest de Schneider, y por qué esto no es abstracto.** Tu participación en el side quest de Schneider Electric (computer vision y cobots) te pone directamente en contacto con el mismo tipo de red industrial que este módulo describe — donde PLCs, sensores, y actuadores comparten infraestructura de red con protocolos que, como ya viste en la sección 5.5, no tienen seguridad nativa. La disciplina de segmentación de red y control de acceso que mencionaste ahí como mitigación no es una idea abstracta de seguridad de redes genérica — es, específicamente, la defensa contra que alguien con acceso a la misma red que un cobot o una línea de producción pueda enviar comandos Modbus directos sin pasar por ninguna de las capas de validación que el resto de esta ruta operativa ha construido cuidadosamente. Reconocer esto te da un argumento concreto y técnico, no solo una intuición general, la próxima vez que evalúes la postura de seguridad de una instalación industrial real.

**Por qué el determinismo del PLC importa todavía más cuando un LLM está en el loop.** Cierra el círculo con la pregunta raíz del módulo de arquitectura general del Bridge: un LLM es probabilístico, así que la validación tiene que vivir en un componente determinista. El PLC, con el ciclo de escaneo determinista que verificaste directamente en el manual (secciones 1.1-1.3), es exactamente ese componente determinista en el extremo físico de la cadena — el punto donde, sin importar qué proponga un LLM aguas arriba, la ejecución real sobre el hardware sigue una lógica de ciclo de escaneo predecible y verificable, no una interpretación probabilística de instrucciones. Esto es, literalmente, la razón física y verificada por la que el control de seguridad más crítico vive dentro del PLC (como ya estableciste en el módulo de arquitectura general) — no es una preferencia de diseño abstracta, es una consecuencia directa de que el PLC es, por construcción documentada, el único componente de toda la cadena que ofrece garantías de determinismo verificables a nivel de ciclo de ejecución.

---

## Síntesis — el mapa mental

1. El **ciclo de escaneo con imagen de proceso** (verificado en el manual: lectura de entradas → ejecución de lógica sobre la imagen → escritura de salidas, todo sincronizado) es el mecanismo exacto que garantiza el determinismo que motivó la existencia del PLC — no una promesa abstracta, un comportamiento documentado y verificable.
2. Las **áreas de memoria** (I, Q, M, DB, L) y su direccionamiento (`área.byte.bit` para bits, `área+tamaño+dirección` para bytes/words/dwords) son aritmética de posición sobre bytes físicos — la misma lógica de direccionamiento de arrays que ya conocías, aplicada a la memoria de un PLC real.
3. **Word e Int ocupan los mismos bits en la misma dirección** — la interpretación del tipo de dato depende enteramente de lo que el programa del PLC declaró, no de nada verificable desde el protocolo de comunicación por sí solo. Esta es la trampa central del módulo.
4. **Modbus** resuelve la comunicación remota con un modelo maestro-esclavo simple y un vocabulario mínimo de códigos de función (01-04 lectura, 05/06/15/16 escritura), verificado directamente contra las tablas del manual del S7-1200, incluyendo los rangos de dirección exactos (30001-39999 input registers, 40001-49999 holding registers) que el CPU real soporta.
5. **RTU vs. TCP** son la misma lógica de protocolo sobre dos capas de transporte físico distintas — la elección depende de la infraestructura ya disponible, no de una superioridad técnica universal de una sobre otra.
6. **snap7** (el protocolo S7 nativo que el handler `plc` del Bridge usa realmente) accede directamente por dirección simbólica de Data Block, evitando la capa de configuración adicional de exponer valores explícitamente vía las instrucciones Modbus del programa del PLC.
7. Un valor de 32 bits (Real, DInt) ocupa **dos** registros Modbus consecutivos — confirmado directamente en el manual — y el orden de esos dos registros es una convención específica del dispositivo, no garantizada universalmente por el protocolo, la fuente exacta de la trampa clásica de byte/word order.
8. **Modbus no tiene autenticación nativa** — cualquier dispositivo en la misma red puede, en principio, escribir directamente sobre el PLC sin pasar por ninguna capa de validación del Bridge, si logra alcanzarlo directamente. La mitigación real vive en segmentación de red, no en el protocolo mismo.

---

## Preguntas que deberías poder responder

*(Las primeras tres son, deliberadamente, del tipo defensa de diseño de un revisor ORION.)*

1. Explica, citando el mecanismo exacto de imagen de proceso del manual, por qué el ciclo de escaneo del S7-1200 garantiza consistencia lógica durante la ejecución del programa de una forma que un proceso genérico corriendo sobre un sistema operativo de propósito general no puede garantizar de forma nativa.
2. Describe, paso a paso, cómo leerías correctamente un valor `Real` de 32 bits desde un holding register Modbus — ¿qué dos cosas específicas necesitas verificar (más allá de simplemente "leer el registro") antes de confiar en el valor obtenido?
3. ¿Qué hace inseguro específicamente a un PLC accesible por Modbus TCP en una red sin segmentación? Conecta tu respuesta con el mismo argumento de "el broker/protocolo no te protege por sí solo" que ya viste para MQTT sin autenticación.
4. Explica la diferencia entre `Word` e `Int` en el modelo de datos del S7-1200 — ¿por qué el PLC mismo no puede "saber" ni prevenir que tu handler interprete un registro con el tipo equivocado?
5. ¿Por qué los accesos `I_:P` son de solo lectura y los accesos `Q_:P` son de solo escritura? Explica la razón física exacta, no solo la regla.
6. Deriva, desde la tabla de rangos de dirección Modbus del manual (30001-39999 vs. 40001-49999), qué error concreto obtendrías si tu handler intentara escribir (función 06) sobre una dirección en el rango de input registers.
7. ¿Por qué el handler `plc` del ORION Bridge usa snap7 en vez de Modbus para el S7-1200 específicamente, dado que el PLC soporta ambos protocolos? ¿Qué trade-off exacto se está haciendo?
8. Explica por qué el determinismo del PLC, verificado en este módulo con el mecanismo del ciclo de escaneo, es exactamente la pieza física que hace posible que un LLM probabilístico pueda estar "en el loop" de un sistema de control sin comprometer la seguridad — conecta tu respuesta con el flujo completo intent → capability card → validation → protocolo → hardware del módulo de arquitectura general del Bridge.

---

## Fuentes

- **Siemens, S7-1200 Programmable Controller System Manual, 04/2012, A5E02486680-06** — el PDF proporcionado directamente por el usuario (`/mnt/user-data/uploads/manual_s71200_plc.pdf`, 864 páginas). Todas las tablas, rangos de dirección, códigos de función Modbus, parámetros de instrucciones (MB_CLIENT, MB_COMM_LOAD), y el mecanismo de imagen de proceso citados en este módulo fueron extraídos y verificados directamente de este documento — secciones 1.1 (comparación de modelos de CPU), 4.1 (ejecución del programa de usuario e imagen de proceso), 4.2 (áreas de memoria y direccionamiento), 4.4 (tipos de dato), y 12.5 (comunicación Modbus completa, subsecciones 12.5.1 a 12.5.3).
- `pymodbus`, documentación oficial de la librería Python para Modbus: https://pymodbus.readthedocs.io/
- `python-snap7`, documentación oficial de la librería Python para el protocolo S7 de Siemens: https://python-snap7.readthedocs.io/
- El detalle exacto de cómo el handler `plc` de `github.com/Starman26/orion-bridge-v2` envuelve snap7 internamente **no pudo verificarse línea por línea** contra el código fuente del repositorio — consistente con la limitación ya declarada en los módulos anteriores de esta serie (navegación del árbol de archivos no accesible). El README del repositorio sí confirma explícitamente que el handler `plc` usa snap7 para el Siemens S7-1200.
