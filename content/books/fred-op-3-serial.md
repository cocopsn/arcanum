---
module_id: fred-op-3-serial
spine: FrED
path: Operativo
title: "Serial y tu primer Handler real"
subtitle: "Del bit en el cable al sensor que ORION puede comandar"
source_canonical: "pyserial; Arduino/DHT11 datasheet; orion-bridge-v2 handler pattern"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Serial y tu primer Handler real

> **Pregunta raíz.** Tienes una PC y un Arduino, conectados por un cable USB. ¿Qué significa, **de verdad, a nivel de electrones moviéndose en un alambre**, que uno le "hable" al otro? Y una vez que entiendes ese mecanismo físico hasta el fondo, ¿cómo lo envuelves en una pieza de software que cumple exactamente el contrato de handler que dedujiste en el módulo anterior, de forma que ORION pueda tratar tu Arduino con un sensor DHT11 exactamente igual que trata un xArm o un PLC — como un dispositivo más detrás de la misma interfaz uniforme? Este módulo no es teoría que vas a "aplicar después" — es el entregable real: al final, tienes el firmware corriendo en el Arduino y el handler de Python listo para reemplazar el placeholder de ORION, con tu nombre en el primer nodo del patrón que vas a escalar.

## Prólogo — de dónde nace esto

Todo lo que hace una computadora, en su nivel más básico, es manipular voltajes altos y bajos en cables — "1" y "0" no son abstracciones matemáticas puras, son **decisiones sobre qué voltaje representa qué símbolo**. Cuando dos dispositivos "hablan" por un cable, lo que realmente ocurre es que uno de ellos cambia el voltaje de una línea a lo largo del tiempo, y el otro **mide** ese voltaje en momentos específicos, interpretando lo que mide como una secuencia de bits. La pregunta que parece trivial pero no lo es: **¿cómo sabe el que escucha exactamente EN QUÉ MOMENTOS debe medir?** Si mide en el momento equivocado, lee basura — el voltaje pudo haber cambiado ya hacia el siguiente bit, o todavía no haber terminado de asentarse en el bit actual.

Ese problema — coordinar el "cuándo medir" entre dos dispositivos que no comparten un reloj físico común — es exactamente el problema que resuelve el protocolo serial (UART) que vas a construir en este módulo, desde el bit individual hasta el firmware completo del Arduino, hasta el handler de Python que ORION va a invocar. Vas a construir esto en el mismo orden en que la información realmente fluye: primero el mecanismo físico de un bit en un cable, luego cómo se agrupan los bits en bytes con un protocolo de sincronización, luego cómo el Arduino lee un sensor con timing crítico propio (el DHT11), y finalmente cómo todo esto se envuelve en el contrato de `DeviceHandler` exacto que ya dedujiste en el módulo anterior — cerrando el círculo completo desde la física hasta la arquitectura de software.

---

## 1. UART/Serial — el mecanismo físico, deducido desde el problema de sincronización

### 1.1 El problema: dos relojes que no se conocen entre sí

Imagina que quieres transmitir el byte `01001101` a través de un solo cable, cambiando el voltaje entre "alto" (representa 1) y "bajo" (representa 0) en una secuencia temporal. El receptor, del otro lado del cable, necesita muestrear ese voltaje en instantes específicos para reconstruir cada bit correctamente. **Si el transmisor y el receptor no están de acuerdo en cuánto dura cada bit en el tiempo, el receptor no sabe cuándo medir** — podría medir dos veces dentro del mismo bit (leyendo el mismo bit dos veces por error) o saltarse un bit completo (midiendo demasiado tarde y perdiendo la transición).

### 1.2 Baud rate — el acuerdo explícito de velocidad que resuelve el problema

La solución, deducida directamente de ese problema: **ambos lados acuerdan, de antemano, exactamente cuántos bits por segundo se van a transmitir** — el **baud rate** (por ejemplo, 9600 o 115200 baudios). Con ese acuerdo, el receptor sabe que cada bit dura exactamente `1/baud_rate` segundos, y puede programar su propio reloj interno para muestrear en el punto medio de cada intervalo de bit esperado — el punto temporal más seguro, lejos de las transiciones de voltaje donde la señal todavía podría estar "asentándose" eléctricamente.

**Analogía**: piensa en dos personas acordando, antes de empezar a hablar por una línea con mala calidad de audio, "vamos a hablar a exactamente una palabra por segundo, ni más rápido ni más lento" — con ese acuerdo explícito, el que escucha sabe cuándo "esperar" la siguiente palabra, incluso si la línea es ruidosa, porque no depende de detectar pausas naturales del habla (que podrían confundirse con ruido) sino de un ritmo acordado de antemano.

**La trampa exacta que esto genera, y que vas a ver en la sección de trampas con más detalle**: si un lado está configurado a 9600 baudios y el otro a 115200, **ninguno de los dos comete un error de programación visible** — cada uno simplemente mide en los instantes que su propio baud rate configurado le dice que debe medir, pero esos instantes no corresponden a los límites reales de los bits que el otro lado está transmitiendo a una velocidad distinta. El resultado es **basura determinística**: cada byte recibido se decodifica incorrectamente, de forma consistente pero sin sentido, y no hay ningún mensaje de error explícito a ese nivel — el protocolo simplemente no tiene forma de saber que la interpretación está mal, porque desde su perspectiva, siguió el proceso correctamente con la configuración que se le dio.

### 1.3 Start bit, stop bit, y por qué el receptor necesita saber DÓNDE empieza cada byte

El baud rate resuelve "cuánto dura un bit", pero queda un problema relacionado: si la línea está en reposo (sin transmitir nada) y de repente empieza un byte nuevo, **¿cómo sabe el receptor exactamente en qué instante empieza el primer bit de ese byte?** — sin ese punto de referencia, aunque conozca la duración de cada bit, no sabría desde dónde empezar a contar.

**Start bit**: la línea, en reposo, se mantiene en un nivel de voltaje fijo (convencionalmente "alto", representando lógicamente una condición de "idle"). Para señalar el inicio de un byte nuevo, el transmisor fuerza la línea a "bajo" durante exactamente un periodo de bit — esta transición de alto a bajo es lo que el receptor detecta activamente (no midiendo en intervalos fijos todo el tiempo, sino **esperando** esta transición específica), y es exactamente el punto de referencia temporal que necesitaba: "el start bit comenzó aquí, así que el primer bit de datos real empieza medio periodo de bit después, y cada bit subsecuente cada periodo completo de bit después de eso".

**Stop bit(s)**: después de transmitir los bits de datos (típicamente 8, formando un byte), la línea regresa explícitamente al estado de reposo ("alto") durante uno o más periodos de bit — esto le da al receptor una confirmación de que el byte terminó correctamente, y una pequeña ventana de margen antes de que el siguiente start bit pueda comenzar.

**La configuración común "8N1"** (que verás en casi cualquier configuración de puerto serial, incluyendo la que vas a usar en este módulo) significa: 8 bits de datos, sin bit de paridad (N = None, un mecanismo opcional de detección de errores que no vamos a necesitar aquí), 1 stop bit. Junto con el baud rate, esto especifica **completamente** el protocolo de framing a nivel de bit — ambos lados necesitan coincidir en baud rate **y** en esta configuración de framing para interpretarse correctamente.

### 1.4 Por qué el USB serial emula todo esto, aunque USB no sea "serial" a nivel físico

El puerto que vas a abrir en tu PC (`/dev/ttyUSB0`, `COM3`, etc.) casi nunca es un puerto UART físico directo en el sentido histórico — es, típicamente, un **adaptador USB-a-serial** (frecuentemente integrado en la propia placa Arduino, mediante un chip dedicado como el CH340 o el chip USB nativo de placas más modernas) que **emula** el comportamiento de un puerto UART clásico sobre el protocolo USB, que a nivel físico es completamente distinto (USB tiene su propio protocolo de framing, direccionamiento, y velocidades). La razón de esta emulación: el software (tanto en el sistema operativo como en librerías como `pyserial`) puede seguir usando exactamente el mismo modelo mental y la misma API que usarías para un UART físico directo — abrir un "puerto", configurar baud rate, leer y escribir bytes — sin que tu código de aplicación necesite saber ni preocuparse por los detalles internos de cómo USB transporta esos datos por debajo. Esto es, una vez más, el mismo principio de abstracción en capas que ya reconoces de otros contextos: cada capa oculta la complejidad de la capa inferior, exponiendo una interfaz estable y más simple hacia arriba.

---

## 2. DHT11 — un sensor con su propio protocolo, y por qué el Arduino lo lee, no la PC

### 2.1 El protocolo de un solo cable (one-wire), y su exigencia de timing

El DHT11 es un sensor de temperatura y humedad que se comunica por un **solo cable de datos** (además de alimentación y tierra) usando un protocolo propietario de temporización estricta, no UART: el microcontrolador que lo lee debe enviar una señal de "inicio" manteniendo la línea en un nivel específico durante un tiempo mínimo preciso (típicamente unos 18 milisegundos según el datasheet), luego liberar la línea y esperar la respuesta del sensor, que a su vez transmite 40 bits de datos (humedad entera, humedad decimal, temperatura entera, temperatura decimal, y un byte de checksum) codificando cada bit como la **duración** de un pulso de voltaje — un pulso corto representa un 0, un pulso más largo representa un 1, con las duraciones exactas especificadas en microsegundos en el datasheet del fabricante.

### 2.2 Por qué esto exige que sea el Arduino, y no la PC, quien lea el sensor directamente

Aquí está la deducción central de esta sección, y es la razón arquitectónica de todo el módulo: **el timing exigido por el protocolo del DHT11 se mide en microsegundos, y requiere que el programa que está leyendo el pin controle exactamente cuándo mide voltaje, sin ninguna interrupción del sistema operativo entre medición y medición**.

Un microcontrolador como el Arduino, corriendo su firmware sin un sistema operativo de propósito general encima (no hay un scheduler multitarea preemptivo interrumpiéndote en momentos impredecibles, no hay otros procesos compitiendo por CPU), puede garantizar que una función que mide duraciones de pulso en microsegundos efectivamente se ejecute con esa precisión temporal, de forma consistente y confiable.

Una PC corriendo un sistema operativo de propósito general (Windows, Linux, macOS), en cambio, **no puede** dar esa misma garantía: el sistema operativo puede, en cualquier momento, interrumpir tu proceso para atender otra tarea (otro proceso, una interrupción de hardware, el propio scheduler decidiendo que es momento de darle tiempo de CPU a otra cosa), y esa interrupción puede durar más que la ventana de tiempo en la que necesitas medir un pulso del DHT11 con precisión de microsegundos — perdiendo la medición o corrompiéndola, de forma impredecible y difícil de depurar, porque el problema no está en tu lógica, está en que el sistema operativo mismo no ofrece la garantía de tiempo real que este protocolo específico exige.

**La consecuencia de diseño, ya adelantada en el título de esta sección**: el Arduino lee el DHT11 directamente con su firmware, haciendo el trabajo de timing crítico donde sí hay garantías de determinismo temporal, y luego **reempaqueta** el resultado (ya decodificado a números legibles: temperatura y humedad) en un formato mucho más tolerante — texto plano por UART, a un baud rate mucho más lento y menos exigente que el protocolo nativo del DHT11 — que la PC sí puede leer sin ninguna garantía de tiempo real especial, porque para ese momento ya no hay ningún timing crítico de microsegundos que preservar, solo bytes de un mensaje ya formado esperando ser leídos cuando el sistema operativo le dé la vuelta a tu proceso.

---

## 3. El firmware del Arduino — código real que corre

```cpp
// firmware_dht11.ino
// Lee un sensor DHT11 y emite temperatura/humedad por serial en un
// formato de linea simple, parseable desde Python. Usa la libreria
// DHT sensor library de Adafruit (dependencia estandar del ecosistema
// Arduino para este sensor, que ya maneja internamente el timing
// critico de microsegundos del protocolo one-wire descrito arriba).

#include <DHT.h>

#define PIN_DHT 2
#define TIPO_DHT DHT11

DHT dht(PIN_DHT, TIPO_DHT);

// El DHT11 tiene un limite de muestreo de aproximadamente 1 Hz --
// leerlo mas rapido que esto produce lecturas no confiables o
// repetidas, segun el datasheet del fabricante. Este intervalo
// respeta ese limite con margen.
const unsigned long INTERVALO_LECTURA_MS = 2000;
unsigned long ultima_lectura = 0;

void setup() {
  Serial.begin(9600);   // baud rate: DEBE coincidir exactamente
                         // con lo que el handler de Python configure
  dht.begin();
}

void loop() {
  unsigned long ahora = millis();

  if (ahora - ultima_lectura >= INTERVALO_LECTURA_MS) {
    ultima_lectura = ahora;

    float humedad = dht.readHumidity();
    float temperatura = dht.readTemperature();  // grados Celsius

    // isnan() detecta si la libreria NO pudo obtener una lectura
    // valida (checksum fallido, timing perturbado, sensor
    // desconectado) -- el sensor "miente" (devuelve NaN) en vez de
    // fallar ruidosamente, y HAY que verificar esto explicitamente
    // antes de confiar en el dato (ver seccion 6.3).
    if (isnan(humedad) || isnan(temperatura)) {
      Serial.println("ERROR:LECTURA_INVALIDA");
      return;
    }

    // Formato de linea simple y parseable: campo:valor,campo:valor
    Serial.print("TEMP:");
    Serial.print(temperatura);
    Serial.print(",HUM:");
    Serial.println(humedad);
  }
}
```

**Por qué el formato de salida es texto plano simple, no binario compacto**: a este baud rate (9600) y con lecturas cada 2 segundos, el volumen de datos es trivialmente pequeño — no hay ninguna presión real de rendimiento que justifique la complejidad adicional de un formato binario empaquetado. Texto plano legible tiene una ventaja de ingeniería real y concreta: puedes depurar la comunicación **directamente**, abriendo el Monitor Serial del IDE de Arduino (o cualquier terminal serial genérico) y viendo exactamente qué se está transmitiendo, sin necesitar ningún código adicional de decodificación para verificar que el firmware está funcionando correctamente — una ventaja de simplicidad que vale mucho más que el ahorro marginal de bytes que un formato binario te daría a este volumen de datos.

---

## 4. El handler de Python — pyserial, y el contrato del módulo anterior

### 4.1 Abrir el puerto — el primer contacto, y su primera trampa

```python
import serial

puerto = serial.Serial(
    port="/dev/ttyUSB0",    # o "COM3" en Windows -- ver seccion 6.2
    baudrate=9600,           # DEBE coincidir EXACTAMENTE con el firmware
    timeout=3,                # segundos maximos de espera por una linea
)
```

**Por qué `timeout` es explícito y no opcional aquí**: sin un timeout, una llamada de lectura bloqueante (`puerto.readline()`) esperaría **indefinidamente** si el Arduino dejara de enviar datos (por ejemplo, si se desconectó físicamente, o si el firmware se colgó) — congelando tu programa Python sin ningún mecanismo de recuperación. Con un timeout explícito, la llamada de lectura regresa después de ese tiempo máximo, aunque no haya recibido una línea completa, permitiéndote detectar y manejar la ausencia de datos como una condición explícita, en vez de quedarte bloqueado esperando algo que quizás nunca llegue.

### 4.2 El handler completo, cumpliendo el contrato `DeviceHandler` del módulo anterior

```python
# handler_dht11_serial.py
# Implementa el contrato DeviceHandler deducido en fred-op-2-dispatcher,
# para el dispositivo real: Arduino + DHT11 sobre UART/USB serial.

import serial
import time
import re

class ArduinoSerialHandler:
    """
    Handler real para el Arduino con sensor DHT11.
    Cumple el mismo contrato de DeviceHandler (connect, execute,
    get_status, disconnect) que cualquier otro handler del Bridge --
    el dispatcher lo trata exactamente igual que a un handler de
    xArm o de PLC, sin ninguna distincion especial.
    """

    PATRON_LINEA = re.compile(r"TEMP:([\-\d.]+),HUM:([\-\d.]+)")

    def __init__(self):
        self._puerto = None
        self._ultima_lectura = None
        self._conectado = False

    def connect(self, config: dict) -> None:
        puerto_dispositivo = config.get("puerto", "/dev/ttyUSB0")
        baudrate = config.get("baudrate", 9600)
        try:
            self._puerto = serial.Serial(
                port=puerto_dispositivo,
                baudrate=baudrate,
                timeout=3,
            )
            # Muchas placas Arduino se RESETEAN automaticamente al
            # abrir una conexion serial nueva (una caracteristica del
            # circuito de auto-reset via DTR de la mayoria de las
            # placas). El firmware tarda un momento en reiniciar y
            # llegar a su primer Serial.println util -- sin esta
            # espera, las primeras lecturas del handler probablemente
            # fallarian o vendrian vacias, no por un bug del handler
            # sino por este comportamiento fisico del hardware.
            time.sleep(2)
            self._conectado = True
        except serial.SerialException as error:
            self._conectado = False
            raise ConnectionError(f"No se pudo abrir el puerto serial: {error}")

    def execute(self, comando: dict) -> dict:
        accion = comando.get("accion")
        if accion != "leer_sensor":
            return {"exito": False, "error": f"accion '{accion}' no soportada"}

        if not self._conectado or self._puerto is None:
            return {"exito": False, "error": "dispositivo no conectado"}

        try:
            linea = self._puerto.readline().decode("utf-8", errors="replace").strip()
        except serial.SerialException as error:
            # El Arduino se desconecto FISICAMENTE a media lectura --
            # este es exactamente el caso de la seccion 6.5.
            self._conectado = False
            return {"exito": False, "error": f"perdida de conexion serial: {error}"}

        if not linea:
            # timeout sin datos: no es necesariamente un error grave,
            # pero SI es informacion que el llamador necesita, no
            # algo que se deba ocultar silenciosamente.
            return {"exito": False, "error": "timeout: sin datos del Arduino"}

        if linea.startswith("ERROR:"):
            # El firmware mismo reporto una lectura invalida del
            # sensor (isnan en el .ino) -- propagamos esto de forma
            # explicita, NO lo tratamos como exito con datos basura.
            return {"exito": False, "error": f"sensor reporto error: {linea}"}

        coincidencia = self.PATRON_LINEA.match(linea)
        if not coincidencia:
            # Linea recibida pero con formato inesperado -- podria
            # ser una linea PARCIAL (ver seccion 6.4) capturada en
            # medio de una transmision, o ruido en el cable.
            return {"exito": False, "error": f"formato de linea invalido: '{linea}'"}

        temperatura = float(coincidencia.group(1))
        humedad = float(coincidencia.group(2))

        # Validacion de RANGO fisico -- el DHT11 tiene rangos
        # operativos conocidos segun su datasheet (aprox. 0-50 C,
        # 20-90% HR). Un valor fuera de estos rangos, aunque el
        # checksum interno del sensor haya pasado, es sospechoso y
        # NO deberia tratarse ciegamente como un dato confiable
        # (ver seccion 6.3 y Conexiones sobre por que esto importa
        # mas alla de este sensor especifico).
        if not (0 <= temperatura <= 50) or not (20 <= humedad <= 90):
            return {
                "exito": False,
                "error": f"lectura fuera de rango fisico esperado: temp={temperatura}, hum={humedad}",
            }

        self._ultima_lectura = {"temperatura_c": temperatura, "humedad_pct": humedad,
                                  "timestamp": time.time()}
        return {"exito": True, "resultado": self._ultima_lectura}

    def get_status(self) -> dict:
        return {
            "tipo": "arduino_dht11",
            "conectado": self._conectado,
            "ultima_lectura": self._ultima_lectura,
        }

    def disconnect(self) -> None:
        if self._puerto is not None and self._puerto.is_open:
            self._puerto.close()
        self._conectado = False


if __name__ == "__main__":
    handler = ArduinoSerialHandler()
    handler.connect({"puerto": "/dev/ttyUSB0", "baudrate": 9600})

    try:
        for _ in range(5):
            resultado = handler.execute({"accion": "leer_sensor"})
            print(resultado)
            time.sleep(2)   # respeta el limite de ~1Hz del DHT11 (seccion 5)
    finally:
        handler.disconnect()
```

**Nota la cadena completa de validación antes de aceptar un dato como confiable**: línea no vacía → no empieza con `ERROR:` (el firmware ya lo marcó como inválido) → coincide con el formato esperado (protege contra líneas parciales o ruido) → está dentro del rango físico plausible del sensor (protege contra un dato sintácticamente válido pero físicamente imposible). Ninguna de estas verificaciones es redundante — cada una protege contra un modo de falla distinto, y **omitir cualquiera de ellas deja una vía por la que un dato incorrecto podría colarse como si fuera confiable**.

---

## 5. Timing del DHT11 — el límite de ~1Hz, y por qué respetarlo en ambas capas

Ya se mencionó en el firmware (`INTERVALO_LECTURA_MS = 2000`), pero vale la pena remarcar el razonamiento completo: el datasheet del DHT11 especifica que no debe muestrearse más frecuentemente que aproximadamente una vez por segundo — leerlo más rápido produce lecturas no confiables (el sensor internamente no ha tenido tiempo de estabilizar una nueva medición física real desde la lectura anterior). **Esta restricción debe respetarse en la capa que efectivamente controla el timing del muestreo — el firmware del Arduino** (que decide cuándo iniciar una nueva conversación con el sensor), no en la capa de Python, que solo lee lo que el Arduino ya decidió enviar. Si el handler de Python intentara "forzar" lecturas más frecuentes llamando `execute()` en un loop apretado, no lograría muestreos más frecuentes del sensor real — simplemente recibiría, repetidamente, la línea de la última lectura ya disponible en el buffer serial (o un timeout si el buffer está vacío), sin ningún beneficio real y con el riesgo de leer datos ya "viejos" sin darse cuenta si no verifica el timestamp de la lectura.

---

## 6. Edge cases y trampas explícitas

### 6.1 Baud rate desalineado — basura silenciosa, no un error visible

Ya se dedujo el mecanismo en la sección 1.2: si el firmware está configurado a 9600 pero el handler de Python abre el puerto a un baud rate distinto (por ejemplo, 115200, un valor común que alguien podría copiar de otro proyecto sin darse cuenta), **no habrá ningún error de conexión** — el puerto se abre exitosamente a nivel de sistema operativo, porque la apertura del puerto no verifica que ambos lados coincidan en baud rate (eso es una configuración lógica de interpretación de bits, no algo que el sistema operativo pueda validar por ti). Lo que vas a ver son bytes decodificados incorrectamente — caracteres sin sentido, que fallarán la expresión regular `PATRON_LINEA` de la sección 4.2 y se reportarán como "formato de línea inválido", **pero sin ninguna pista directa de que la causa raíz es un desajuste de baud rate específicamente**, a menos que ya sepas buscar exactamente esto. Es una de las primeras cosas a verificar si tu handler nunca logra parsear ninguna línea correctamente desde el primer intento.

### 6.2 El puerto ocupado o cambiante — `/dev/ttyUSB0` vs. `COM3`, y por qué no es estable

El identificador del puerto serial que el sistema operativo asigna a tu Arduino **no es necesariamente estable** entre reconexiones: en Linux, si tienes múltiples dispositivos USB-serial conectados, el orden en que el sistema operativo los enumera (`/dev/ttyUSB0`, `/dev/ttyUSB1`, etc.) puede depender del orden en que se conectaron físicamente, y desconectar/reconectar un dispositivo puede hacer que reaparezca con un número distinto. En Windows, el número de puerto COM asignado puede variar de forma similar. **La mitigación de producción real** (más allá de simplemente "prueba varios puertos hasta encontrar el correcto", que no escala ni es confiable): identificar el dispositivo por su **identificador único de hardware** (vendor ID / product ID del chip USB-serial, o un número de serie si el dispositivo lo expone), listando los puertos disponibles con `serial.tools.list_ports` y filtrando por esos identificadores en vez de asumir un nombre de puerto fijo hardcodeado — exactamente el tipo de robustez que separa un prototipo de laboratorio de un handler que puede sobrevivir a que alguien desconecte y reconecte el cable, o a que el laboratorio tenga varios dispositivos USB-serial simultáneos.

### 6.3 El DHT11 devolviendo NaN / checksum fallido — un sensor miente a veces

Ya lo viste explícitamente en el firmware (`isnan()`) y en el handler (la verificación de rango físico) — vale la pena remarcar el principio general detrás de ambas defensas: **un sensor físico no siempre da una lectura válida**, por razones que van desde interferencia eléctrica momentánea hasta timing perturbado por alguna otra tarea del microcontrolador, hasta degradación real del sensor con el tiempo. Tratar cada lectura recibida como automáticamente confiable, sin verificación, es exactamente el tipo de suposición optimista que se rompe silenciosamente en producción — el sistema "funciona" en tus pruebas iniciales (donde el sensor probablemente da lecturas limpias la mayoría del tiempo), y falla de forma sutil y difícil de diagnosticar meses después, cuando una lectura corrupta ocasional se cuela sin ninguna verificación y termina alimentando una decisión aguas arriba basada en un dato que nunca fue real.

### 6.4 Líneas parciales/incompletas en el buffer — el buffer como buzón que puede tener cartas a medio escribir

**Analogía**: piensa en el buffer serial como un buzón que recibe un flujo continuo de texto, sin ninguna garantía de que lo que hay ahí en el momento en que revisas sea exactamente "una carta completa" — podrías estar mirando el buzón exactamente en el instante en que alguien está a medio meter una carta, viendo solo la mitad de las palabras. `readline()` de pyserial maneja la mayor parte de esta complejidad por ti (bloquea, dentro del timeout configurado, hasta encontrar un carácter de fin de línea `\n`, que es exactamente lo que `Serial.println()` en el firmware envía al final de cada mensaje) — pero **si el timeout se agota antes de que llegue un `\n` completo**, `readline()` devuelve lo que sea que haya recibido hasta ese momento, potencialmente una línea parcial, sin ningún indicador explícito de "esto está incompleto" distinto de simplemente "esto no coincide con el formato esperado". Esta es exactamente la razón por la que el handler de la sección 4.2 valida el formato completo con una expresión regular estricta **antes** de confiar en los valores extraídos — una línea parcial simplemente fallará esa validación y se reportará como error, en vez de ser parseada parcialmente de forma incorrecta y silenciosa.

### 6.5 El Arduino desconectándose a media lectura

Si el cable USB se desconecta físicamente (o el Arduino pierde alimentación) exactamente durante una llamada a `readline()`, pyserial típicamente lanza una `serial.SerialException` — el handler de la sección 4.2 la captura explícitamente, marca `self._conectado = False`, y devuelve un resultado de error claro, en vez de dejar que la excepción se propague sin control hacia el dispatcher (que, como ya viste en el módulo anterior, espera que cada handler maneje sus propios errores de conexión internamente, devolviendo el formato común de resultado, no lanzando excepciones no capturadas). Nota que, tras esto, el handler queda en un estado donde `get_status()` reportará honestamente `conectado: False` — información que el sistema aguas arriba (el dispatcher, o cualquier lógica de reconexión) necesita para decidir correctamente si debe intentar reconectar antes del siguiente comando, en vez de seguir intentando `execute()` ciegamente contra una conexión que ya se sabe muerta.

---

## 7. Trade-offs explícitos

**Leer el sensor en el Arduino vs. intentar en la PC**: ya se estableció con rigor completo en la sección 2.2 — no es realmente una elección de preferencia, es una restricción impuesta por la falta de garantías de tiempo real de un sistema operativo de propósito general. La única forma práctica de leer un DHT11 (o cualquier sensor con protocolo de timing crítico similar) desde una PC directamente sería usando hardware especializado de tiempo real adicional (una interfaz USB con capacidades de timing determinista dedicadas) — una complejidad completamente innecesaria cuando ya tienes un microcontrolador barato, el Arduino, diseñado exactamente para este tipo de tarea.

**Polling vs. streaming del dato**: el firmware de este módulo transmite proactivamente cada 2 segundos (un patrón más cercano a "streaming" — el Arduino empuja datos sin que la PC los solicite explícitamente cada vez), mientras que el handler de Python simplemente lee lo que ya está disponible en el buffer cuando se le pide (`execute()` con `accion: "leer_sensor"`, un patrón más cercano a "polling" desde la perspectiva del dispatcher que invoca al handler). Esta combinación es deliberada: el Arduino, con su timing confiable, decide **cuándo** es válido tomar una nueva lectura del sensor físico (respetando el límite de ~1Hz); el handler de Python, sin esa restricción de timing crítico, simplemente consume lo que ya está disponible cuando el sistema más amplio (el dispatcher, en respuesta a un intent) lo solicita — separando limpiamente "quién controla el timing físico real" de "quién controla cuándo se necesita el dato en el flujo más amplio del sistema".

**Robustez de parsing — expresión regular estricta vs. parsing más permisivo**: el patrón `PATRON_LINEA` de la sección 4.2 es deliberadamente estricto (exige el formato exacto `TEMP:...,HUM:...`) en vez de intentar extraer números de cualquier forma que aparezcan en la línea con un parsing más laxo. La razón: un parsing permisivo podría "recuperar" exitosamente números de una línea corrupta o parcial (sección 6.4) que en realidad no representa una lectura válida — dándote una falsa sensación de éxito con datos que en realidad son basura parcial. Un parsing estricto que falla explícitamente ante cualquier desviación del formato esperado es más "frágil" en apariencia, pero es exactamente la propiedad correcta cuando el costo de aceptar silenciosamente un dato corrupto (alimentar una decisión con una temperatura falsa) es mucho mayor que el costo de descartar una lectura válida ocasional por un parsing demasiado estricto — el mismo tipo de decisión de trade-off entre falsos positivos y falsos negativos que ya viste en el módulo de detección de anomalías, aquí aplicado a validación de formato de datos en vez de a un modelo estadístico.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Este es el mismo patrón de handler del módulo anterior, cerrando el arco completo.** Todo lo que dedujiste en `fred-op-2-dispatcher` sobre el contrato `DeviceHandler` — `connect`, `execute`, `get_status`, `disconnect`, el formato común de entrada/salida, la disciplina de nunca dejar que una excepción no capturada se propague hacia el dispatcher — no era teoría abstracta esperando una aplicación futura. Es, literalmente, exactamente lo que `ArduinoSerialHandler` implementa en este módulo, palabra por palabra del mismo contrato. El punto de registro (`REGISTRO_DE_HANDLERS["arduino_serial"] = ArduinoSerialHandler`) que viste como patrón ilustrativo en el módulo anterior es, ahora, una línea de código real que puedes escribir para integrar este handler específico al sistema completo del Bridge — cerrando el círculo desde el principio arquitectónico abstracto hasta el hardware físico real que tú mismo cableaste.

**Serial en toda la electrónica embebida — no es un caso especial del DHT11.** El patrón completo de este módulo (protocolo de timing crítico manejado por un microcontrolador dedicado, reempaquetado hacia un formato simple sobre UART para consumo por un sistema de propósito general) es exactamente cómo la inmensa mayoría de sensores y periféricos embebidos se integran a sistemas más grandes en la práctica de electrónica real — no solo el DHT11. GPS modules, sensores de gas, controladores de motor con retroalimentación de encoder, módulos de radiofrecuencia — todos típicamente exponen su complejidad de protocolo nativo (que puede ser one-wire como el DHT11, I2C, SPI, o algo completamente propietario) a través de un microcontrolador intermedio que "traduce" hacia UART simple, exactamente por la misma razón de garantías de timing que dedujiste en la sección 2.2. Reconocer este patrón te da, esencialmente, una plantilla mental transferible para integrar prácticamente cualquier sensor nuevo que te encuentres en FrED Factory.

**Por qué la validación del dato del sensor conecta con la confiabilidad del sistema completo — un sensor que miente y un LLM que actúa sobre esa mentira.** Aquí está la conexión de mayor consecuencia de todo este módulo, tejiendo de vuelta hacia la arquitectura completa del Bridge que ya conoces: si tu handler **no** valida rigurosamente el dato del sensor (secciones 4.2 y 6.3) antes de reportarlo como parte del estado del dispositivo, y ese estado alimenta, aguas arriba, una capability card o una decisión de un agente LLM (el flujo completo intent → capability card → validation → protocolo → hardware del módulo de arquitectura general del Bridge), entonces **una lectura corrupta del DHT11 puede convertirse, sin ninguna intervención maliciosa, en la premisa falsa sobre la que un LLM basa una decisión de control real**. Esto es el mismo problema estructural de "garbage in, garbage out" que has visto en otros contextos (el modelo de ML del módulo `fred-s2-ml-anomalias` es tan bueno como los datos que recibe), pero aquí con una consecuencia física directa: un LLM que decide "la temperatura está en rango normal, no hagas nada" basado en una lectura de sensor que en realidad era ruido eléctrico mal interpretado como un número válido, es exactamente el tipo de falla en cascada que toda la arquitectura de validación del Bridge (que ya estudiaste) existe para prevenir — y tu handler, en el punto más bajo de esa cadena, es la primera y más importante línea de defensa contra que un dato físicamente imposible llegue siquiera a entrar al sistema.

**El ángulo de seguridad: un handler mal escrito es un punto de fallo físico, no solo un bug de software.** Conecta esto directamente con lo que ya reconoces de Nahual: un handler que no valida su input (ya sea un comando entrante mal validado, como viste con el shell whitelisted del módulo anterior, o un dato de sensor saliente sin validar, como este módulo) es una superficie de fragilidad real en un sistema que toca el mundo físico — no un problema abstracto de "buenas prácticas de programación". La disciplina completa de este módulo (validar formato, validar rango físico, manejar desconexiones explícitamente, nunca dejar que una excepción se propague sin control) no es rigor académico gratuito — es exactamente el tipo de ingeniería defensiva que separa un prototipo de laboratorio de un componente en el que el equipo ORION puede confiar cuando ese componente eventualmente controla algo con consecuencias reales.

---

## Síntesis — el mapa mental

1. **UART/serial** resuelve el problema de sincronizar dos relojes que no se conocen entre sí mediante un acuerdo explícito de baud rate (duración de cada bit) más start/stop bits (marcadores de dónde empieza y termina cada byte) — sin este acuerdo explícito, ambos lados "funcionan" internamente pero producen basura silenciosa, no un error visible.
2. **USB serial emula UART clásico** a través de un chip adaptador, permitiendo que el software use el mismo modelo mental simple sin preocuparse por la complejidad real del protocolo USB subyacente.
3. El **DHT11** exige timing de microsegundos que solo un microcontrolador sin sistema operativo de propósito general (el Arduino) puede garantizar de forma confiable — esta es la razón estructural, no una preferencia, de por qué el Arduino lee el sensor y la PC solo consume el resultado ya procesado.
4. El **firmware** respeta el límite de ~1Hz del sensor y valida `isnan()` antes de transmitir — la primera línea de defensa contra un sensor que "miente" ocasionalmente.
5. El **handler de Python** implementa exactamente el contrato `DeviceHandler` del módulo anterior (`connect`, `execute`, `get_status`, `disconnect`), con una cadena de validación de múltiples capas (línea no vacía → no marcada como error por el firmware → coincide con el formato esperado → dentro del rango físico plausible) antes de aceptar cualquier lectura como confiable.
6. Las trampas de esta capa —baud rate desalineado, puertos inestables, líneas parciales, desconexión a media lectura— comparten un patrón común: **fallan silenciosamente o de forma poco informativa si no se manejan explícitamente**, exactamente el tipo de fragilidad que separa un prototipo frágil de un componente de producción confiable.
7. Este handler es, literalmente, la primera instancia real del patrón abstracto del módulo anterior — el mismo contrato, ahora cableado a hardware físico verdadero, listo para registrarse en el dispatcher exactamente como cualquier otro handler del sistema.
8. La validación rigurosa del dato del sensor no es perfeccionismo — es la defensa concreta contra que una lectura corrupta se convierta, sin malicia de por medio, en la premisa falsa sobre la que un agente LLM aguas arriba basa una decisión física real.

---

## Preguntas que deberías poder responder

*(Las primeras tres son, deliberadamente, del tipo defensa de diseño — ante un revisor y ante ti mismo, porque este código va a producción real.)*

1. Explica, desde el mecanismo físico de voltajes en el tiempo, por qué el Arduino debe leer el DHT11 directamente y la PC no puede hacerlo de forma confiable — ¿qué garantía específica tiene el firmware sin sistema operativo que un proceso de Python corriendo sobre Linux/Windows no tiene?
2. Describe, paso a paso, cómo verificarías que el dato reportado por tu handler es real y no ruido — nombra cada capa de validación que tu implementación aplica, y qué modo de falla específico previene cada una.
3. Si el Arduino se desconecta físicamente exactamente durante una llamada a `readline()`, describe exactamente qué hace tu handler, paso a paso, desde la excepción capturada hasta el estado final que `get_status()` reportaría — ¿por qué esto es distinto (y mejor) que dejar que la excepción se propague sin control?
4. Explica por qué un baud rate desalineado entre el firmware y el handler de Python no produce un error de conexión, sino datos incorrectos silenciosos — ¿en qué capa del proceso de comunicación se podría, en principio, detectar este desajuste, y por qué el protocolo UART básico no lo hace automáticamente?
5. ¿Por qué el identificador de puerto (`/dev/ttyUSB0`, `COM3`) no es una forma confiable de identificar tu dispositivo específico a largo plazo, y qué alternativa más robusta existe?
6. Explica la cadena completa de por qué un DHT11 con una lectura corrupta no detectada podría, en el peor caso, convertirse en la premisa de una decisión incorrecta de un agente LLM operando sobre el Bridge — traza el camino completo desde el sensor físico hasta la decisión.
7. ¿Por qué el firmware transmite proactivamente cada 2 segundos, en vez de esperar a que la PC "pida" explícitamente una lectura nueva cada vez? ¿Qué problema tendría la alternativa, dado el límite de timing del sensor?
8. Diseña, en palabras, cómo extenderías este handler para soportar múltiples sensores DHT11 conectados al mismo Arduino en pines distintos — ¿qué cambiaría en el firmware, en el formato de línea, y en el parsing del handler?

---

## Fuentes

- pyserial, documentación oficial: https://pyserial.readthedocs.io/
- Aosong (fabricante), datasheet del sensor DHT11 (protocolo de comunicación de un solo cable, timing, rangos operativos): ampliamente distribuido por proveedores de componentes electrónicos y por la documentación de la librería Adafruit DHT sensor library.
- Adafruit, librería DHT sensor library para Arduino (usada en el firmware de este módulo): https://github.com/adafruit/DHT-sensor-library
- Arduino, documentación oficial de la clase `Serial`: https://docs.arduino.cc/language-reference/en/functions/communication/serial/
- El contrato de interfaz `DeviceHandler` implementado en este módulo corresponde al patrón deducido en `fred-op-2-dispatcher` de esta misma serie, a su vez anclado a la arquitectura documentada de github.com/Starman26/orion-bridge-v2.
