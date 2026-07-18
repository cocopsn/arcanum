---
module_id: cb000000-0000-4000-8000-00000000000c
spine: FrED
title: Ejercicios — Serial y tu primer Handler real
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-3-serial.md)
version: 1
---

# Serial y tu primer Handler real

Banco a_mano: defiendes el handler real desde la física del bit en el cable hasta la cadena de validación que protege a ORION de un sensor que miente. Cada ejercicio se ancla a una decisión concreta del módulo — el porqué, no la trivia.

## Por qué un start bit, si el baud rate ya fija la duración de cada bit
type: multiple_choice

En UART/8N1, ambos lados ya acordaron el baud rate, así que el receptor sabe exactamente cuánto dura cada bit. ¿Qué problema, distinto de ese, resuelve el **start bit**?

### Opciones
- El start bit lleva el primer bit de datos del byte, por eso 8N1 en realidad transmite 9 bits de información.
- [x] El baud rate dice cuánto DURA un bit, pero no CUÁNDO empieza un byte; la línea reposa en "alto" y el start bit es la transición alto→bajo que el receptor espera activamente, dándole el punto de referencia temporal desde el cual cronometra todos los bits siguientes.
- El start bit le anuncia al receptor qué baud rate usar para este byte en particular.
- Sin start bit no se podría calcular el bit de paridad del byte.

### Justificación
La sección 1.3 lo deduce directo: conocer la duración de un bit no basta si no sabes desde qué instante empezar a contar. La línea idle está en "alto"; forzarla a "bajo" por un periodo de bit es la transición que el receptor detecta esperándola (no midiendo a ciegas), y ese es el ancla temporal para muestrear cada bit subsecuente en su punto medio. Los distractores fallan: el start bit es framing, NO dato (8N1 son 8 bits de datos + framing, no 9); el baud rate es un acuerdo PREVIO y fijo, no algo que se señale por-byte; y "N" en 8N1 significa None — no hay paridad en absoluto, así que nada que calcular.

## Baud rate desalineado — qué pasa de verdad
type: multiple_choice

El firmware corre a `Serial.begin(9600)`, pero alguien copia un handler que abre el puerto a `baudrate=115200`. ¿Qué ocurre al ejecutarlo?

### Opciones
- El sistema operativo se niega a abrir el puerto y pyserial lanza una `SerialException` de inmediato.
- La conexión funciona pero corre ~12× más rápido, así que las lecturas llegan corruptas solo de forma intermitente.
- [x] El puerto se abre sin ningún error; cada byte se muestrea en los instantes equivocados y se decodifica como basura determinística que falla la regex y se reporta como "formato de línea inválido" — sin ninguna pista directa de que la causa raíz es el baud rate.
- El Arduino auto-negocia bajar a 9600 para igualar a la PC.

### Justificación
Secciones 1.2 y 6.1: abrir el puerto NO valida que ambos lados coincidan en baud rate (eso es interpretación lógica de bits, no algo que el SO pueda checar). Cada lado mide en los instantes que su propio baud rate le dicta, pero esos instantes no corresponden a los límites reales de bit del otro lado → basura consistente, no un error visible. Los distractores fallan: el puerto abre bien (no hay excepción); la basura es consistente, no intermitente ni "más rápida"; y UART básico no tiene auto-negociación — el acuerdo de velocidad es previo y estático, si no coincide nadie se entera automáticamente.

## Por qué el Arduino lee el DHT11 y la PC no puede hacerlo confiablemente
type: multiple_choice

El diseño pone al Arduino a leer el DHT11 directamente y deja a la PC solo consumir el resultado ya decodificado por serial. ¿Cuál es la razón ESTRUCTURAL de esto, no una mera preferencia?

### Opciones
- El Arduino está físicamente más cerca del sensor, así que el cable es más corto y la señal más limpia.
- [x] El protocolo one-wire del DHT11 codifica cada bit como la DURACIÓN de un pulso en microsegundos; un SO de propósito general puede interrumpir (preempt) el proceso lector en momentos impredecibles más largos que esa ventana de timing, así que solo un microcontrolador sin tal SO puede garantizar la medición.
- pyserial no sabe leer un solo cable de datos, solo puertos UART completos, así que la PC es técnicamente incapaz de hablarle a un dispositivo one-wire.
- El datasheet del DHT11 exige legalmente un microcontrolador para las lecturas.

### Justificación
Sección 2.2, la deducción central del módulo: el timing del DHT11 se mide en microsegundos y exige controlar exactamente cuándo se mide voltaje, sin interrupciones entre medición y medición. El Arduino, sin scheduler preemptivo ni procesos compitiendo por CPU, garantiza ese determinismo; una PC con SO de propósito general no puede — el SO puede robarte el CPU por más tiempo que la ventana del pulso, corrompiendo la lectura de forma impredecible. Por eso el Arduino hace el trabajo de timing crítico y reempaqueta el resultado a texto tolerante por UART. Los distractores fallan: no es cuestión de longitud de cable ni calidad de señal; no es una limitación de pyserial (la PC podría en principio, pero no de forma CONFIABLE — el problema es el SO, no la librería); y no hay ninguna exigencia legal — es una restricción de garantías de tiempo real.

## El checksum del DHT11 — validar la lectura cruda
type: code

Antes de que la librería te dé números legibles, el DHT11 transmite 40 bits = 5 bytes crudos: `[humedad_entera, humedad_decimal, temperatura_entera, temperatura_decimal, checksum]`. El quinto byte es el checksum que la librería usa internamente para decidir si la lectura es válida — si no cuadra, devuelve NaN (el `isnan()` que ves en el firmware, sección 2.1/6.3). Implementa el cálculo de ese checksum a partir de los cuatro bytes de datos, para poder compararlo contra el byte recibido.

### Especificación
El DHT11 define su byte de checksum como los **8 bits BAJOS de la suma de los cuatro bytes de datos**: `checksum = (a + b + c + d) mod 256`, equivalente a `(a + b + c + d) & 0xFF`. Cada byte entra en el rango 0..255 y el resultado también está en 0..255. El punto fino: la suma de cuatro bytes puede pasar de 255 (hasta 1020), y SOLO sobreviven los 8 bits bajos — por eso `255+255+255+255 = 1020` da 252, no 1020.

### Firma
```javascript
function dht11Checksum(a, b, c, d) {
  // tu código
}
```
```python
def dht11_checksum(a, b, c, d):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [35, 0, 24, 0], "expected": 59 },
  { "input": [0, 0, 0, 0], "expected": 0 },
  { "input": [100, 50, 30, 20], "expected": 200 },
  { "input": [128, 128, 0, 0], "expected": 0 },
  { "input": [200, 90, 24, 0], "expected": 58 },
  { "input": [255, 255, 255, 255], "expected": 252 }
]
```

### Solución
```javascript
function dht11Checksum(a, b, c, d) {
  return (a + b + c + d) & 0xFF;
}
```
```python
def dht11_checksum(a, b, c, d):
    return (a + b + c + d) & 0xFF
```

### Pistas
- La suma cruda de los cuatro bytes puede exceder 255; solo necesitas el byte bajo.
- `& 0xFF` (o `% 256`) se queda con los 8 bits bajos, que es exactamente lo que el sensor transmite.
- Verifica tu implementación con `255,255,255,255`: la suma 1020 debe colapsar a 252.

## Traza: qué devuelve execute() ante una línea bien formada pero sospechosa
type: trace

El handler recibe del Arduino la línea `TEMP:24.5,HUM:12.0` (sin errores de framing, se lee limpia y completa). Traza qué devuelve `execute()` y por qué, siguiendo la cadena de validación de la sección 4.2.

### Opciones
- `{"exito": True, "resultado": {temperatura_c: 24.5, humedad_pct: 12.0, ...}}` — la línea coincidió con la regex `PATRON_LINEA`, así que se acepta como lectura confiable.
- `{"exito": False, "error": "formato de línea inválido"}` — `12.0` no es una humedad válida, así que la regex no logra hacer match.
- [x] `{"exito": False, "error": "...fuera de rango físico esperado..."}` — la línea es no-vacía, no empieza con `ERROR:` y SÍ coincide con la regex, pero humedad 12.0 cae por debajo del mínimo físico de 20% del DHT11, así que la verificación de rango la rechaza.
- Lanza una `ValueError` porque 12.0 está fuera de rango.

### Justificación
La cadena de la sección 4.2 son capas DISTINTAS, no redundantes: (1) no-vacía → (2) no empieza con `ERROR:` → (3) coincide con la regex de formato → (4) dentro del rango físico `0 ≤ temp ≤ 50` y `20 ≤ hum ≤ 90`. `TEMP:24.5,HUM:12.0` pasa las tres primeras — la regex `TEMP:([\-\d.]+),HUM:([\-\d.]+)` sí matchea `24.5` y `12.0`, porque son sintácticamente válidos — pero muere en la capa 4: `20 <= 12.0` es falso, así que devuelve el error de rango físico. Los distractores fallan: no es éxito (12% de humedad es físicamente implausible para este sensor, justo lo que la capa de rango existe para atrapar); el FORMATO es válido, lo que falla es el RANGO (confundir ambas capas es el error clásico que la sección 4.2 previene); y el handler NUNCA lanza excepciones por condiciones de negocio — solo captura `SerialException` de la desconexión, todo lo demás vuelve como dict de resultado.

## Por qué timeout=3 es explícito y no opcional
type: multiple_choice

En `connect()`, el handler abre el puerto con `serial.Serial(..., timeout=3)` en vez de dejar el default (sin timeout). ¿Cuál es la razón, y qué NO garantiza ese timeout?

### Opciones
- Fija cada cuánto envía datos el Arduino, forzando una lectura nueva cada 3 segundos.
- Sin él, pyserial lanzaría una excepción en cada lectura que llegue vacía.
- [x] Sin timeout, un `readline()` bloqueante esperaría INDEFINIDAMENTE si el Arduino dejara de enviar (desconexión, firmware colgado), congelando el programa Python sin recuperación; el timeout convierte "sin datos" en una condición explícita y manejable — aunque NO garantiza que la línea devuelta esté completa (un timeout puede devolver una línea parcial).
- Garantiza que `readline()` devuelva siempre una línea completa dentro de 3 segundos.

### Justificación
Sección 4.1: la lectura bloqueante sin timeout se cuelga para siempre si el otro lado enmudece — el timeout permite detectar la ausencia de datos como un caso explícito en vez de quedarte bloqueado. Los distractores fallan: el timeout es un límite de ESPERA de lectura, no un intervalo de envío (eso lo controla `INTERVALO_LECTURA_MS` en el firmware); un read vacío NO lanza excepción, simplemente bloquea (por eso hace falta el timeout); y crucialmente NO garantiza completitud — si el timeout se agota antes de llegar un `\n`, `readline()` devuelve lo que haya, potencialmente una línea PARCIAL (sección 6.4). Precisamente por eso el handler valida el formato completo con regex estricta antes de confiar en los valores: el timeout te protege del bloqueo, no de una línea a medio formar.
