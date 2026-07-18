---
module_id: cb000000-0000-4000-8000-000000000010
spine: FrED
title: Ejercicios — Modbus y el PLC S7-1200
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-6-modbus-plc.md)
version: 1
---

# Modbus y el PLC Siemens S7-1200

Banco de defensa a mano: no basta con "leer un registro". Estos ejercicios exigen justificar POR QUÉ el PLC es determinista donde una PC no lo es, CÓMO se direcciona su memoria, y QUÉ se rompe si interpretas mal un registro o le hablas a la dirección equivocada. Todo anclado al mecanismo real del manual del S7-1200.

## El ciclo de escaneo con imagen de proceso — por qué esa indirección es el determinismo

type: multiple_choice

El manual describe que el CPU copia las entradas físicas hacia una imagen de proceso JUSTO ANTES de ejecutar el programa de usuario, el programa opera sobre esa imagen interna, y las salidas físicas se actualizan desde la imagen de salida solo AL FINAL del ciclo. Un revisor te pregunta: ¿por qué esta indirección — en vez de leer y escribir los pines físicos directamente en cualquier momento durante la ejecución — es exactamente lo que garantiza consistencia lógica dentro de un ciclo?

### Opciones

- Porque leer los pines físicos es lento, y la imagen de proceso es una caché que acelera el acceso a las E/S.
- [x] Porque congela una instantánea coherente de las entradas durante todo el ciclo: si el programa leyera pines físicos en instantes arbitrarios, una entrada podría cambiar a mitad de la evaluación de la lógica y producir un resultado inconsistente dentro del mismo ciclo; además, escribir a la imagen y volcarla al final evita que una salida parpadee al cambiar de estado varias veces en un ciclo.
- Porque la imagen de proceso protege los valores para que el scheduler del sistema operativo no pueda alterarlos.
- Porque el PLC no tiene forma de acceder directamente a los puntos físicos y la imagen es un intermediario obligatorio.

### Justificación

El manual justifica la indirección por CONSISTENCIA, no por velocidad: los valores leídos permanecen coherentes durante toda la ejecución del programa y se evita el parpadeo de salidas que cambiarían de estado varias veces. La opción de la "caché" invierte la causa (el punto no es latencia). La del scheduler es falsa: el S7-1200 no corre un sistema operativo de propósito general con scheduler preemptivo — precisamente esa AUSENCIA es su ventaja de determinismo. Y la del "intermediario obligatorio" contradice al propio manual: el acceso inmediato `:P` (por ejemplo `I0.3:P`, `Q1.7:P`) permite justamente saltarse la imagen y tocar el punto físico directamente, así que la indirección es una disciplina deliberada, no una limitación de acceso.

## Direccionamiento por bytes — el solapamiento de IW4 e IW5

type: trace

En el S7-1200 una dirección de word como `IW4` significa "el word que empieza físicamente en el byte 4" — no "el cuarto word de una lista de words discretos". Es la misma aritmética de posición sobre bytes que ya usabas con arrays. Traza el direccionamiento: ¿qué relación tienen `IW4` e `IW5` en la memoria física?

### Opciones

- No se solapan: `IW4` es el word número 4 e `IW5` es el word número 5, en ranuras discretas e independientes.
- [x] Se solapan en el byte 5: `IW4` ocupa los bytes 4 y 5, e `IW5` ocupa los bytes 5 y 6, de modo que el segundo byte de `IW4` es el primer byte de `IW5`.
- Se solapan por completo: `IW4` e `IW5` son dos nombres para los mismos 16 bits.
- `IW5` no es una dirección válida, porque un word solo puede empezar en un byte de dirección par.

### Justificación

Como la dirección es un offset de byte y un word ocupa 2 bytes, `IW4` abarca los bytes 4-5 e `IW5` abarca los bytes 5-6: comparten exactamente el byte 5. No son ranuras independientes (esa es la intuición falsa de "lista de words") ni son los mismos 16 bits (solo comparten uno de sus dos bytes). Y sí es válido que un word empiece en un byte impar: el propio manual usa `IW5` (word que empieza en el byte 5) como ejemplo. Entender esto es lo que evita la trampa real de direccionar dos words que se pisan sin darte cuenta.

## Leer el tipo equivocado — decodificar un registro de 16 bits como Int con signo

type: code

El PLC entrega un registro Modbus como un entero de 16 bits SIN signo (un `Word`: 0 a 65535). Pero el programa del PLC pudo haber declarado esa misma dirección como `Int` (16 bits CON signo: -32768 a 32767) — los MISMOS 16 bits, otra interpretación. Implementa la reinterpretación exacta que hace el handler de la sección 4.2: lee el valor crudo del registro como un `Int` de complemento a dos.

### Especificación

`decodificarInt16(crudo)`: `crudo` es un entero con `0 <= crudo <= 65535` (el valor sin signo del registro). Si `crudo < 32768`, el valor con signo es `crudo`. Si `crudo >= 32768`, el valor con signo es `crudo - 65536`. Es literalmente `registros[0] if registros[0] < 32768 else registros[0] - 65536` del código real del handler.

### Firma

```javascript
function decodificarInt16(crudo) {
  // tu código
}
```
```python
def decodificar_int16(crudo):
    # tu código
    pass
```

### Casos

```json
[
  { "input": [0], "expected": 0 },
  { "input": [1], "expected": 1 },
  { "input": [32767], "expected": 32767 },
  { "input": [32768], "expected": -32768 },
  { "input": [65535], "expected": -1 },
  { "input": [50000], "expected": -15536 }
]
```

### Solución

```javascript
function decodificarInt16(crudo) {
  return crudo < 32768 ? crudo : crudo - 65536;
}
```
```python
def decodificar_int16(crudo):
    return crudo if crudo < 32768 else crudo - 65536
```

### Pistas

- El umbral es 32768 = 2 elevado a 15: por debajo, el bit más significativo (de signo) vale 0 y el número es el mismo; a partir de ahí ese bit vale 1 y restas 2 elevado a 16 = 65536.
- El caso `50000` es el ejemplo central del módulo: es un `Word` perfectamente válido, pero leído como `Int` se convierte en `-15536` sin lanzar ningún error — un valor sintácticamente válido y semánticamente incorrecto. Por eso "leer el tipo equivocado" es la trampa que ningún error de protocolo te va a avisar.

## Un valor de 32 bits ocupa dos registros — la trampa del word order

type: multiple_choice

Lees un `Real` (float de 32 bits) desde un holding register. El manual confirma que un tipo de 32 bits (DWORD, DInt, Real) ocupa DOS direcciones de word Modbus consecutivas. Tu handler combina `registros[0]` y `registros[1]` asumiendo un orden big-endian de word (`>HH`), pero obtienes un float bien formado y absurdo (sin relación con la temperatura real). ¿Cuál es la causa más probable y la defensa correcta?

### Opciones

- El valor se corrompió en el cable; hay que reintentar la lectura hasta que salga un float razonable.
- [x] El dispositivo combina los dos registros en el orden OPUESTO al que asumiste. Modbus no garantiza universalmente el orden en que los dos words de 16 bits forman el valor de 32 bits — es una convención específica del fabricante/dispositivo. La única defensa confiable es verificar el orden contra la documentación del dispositivo o del programa del PLC; no existe un default seguro que puedas asumir a ciegas.
- Un `Real` de 32 bits cabe en un solo registro de 16 bits; el segundo registro es basura que debes ignorar.
- Es un problema de baud rate; hay que realinear `MB_COMM_LOAD` en el lado del PLC.

### Justificación

El síntoma — un float perfectamente formado pero absurdo — es exactamente el de asumir el word order equivocado: los bits son válidos, pero representan otro número. Reintentar no sirve porque el resultado es determinista, no una corrupción transitoria del enlace. La opción del "cabe en un registro" contradice al manual, que dice explícitamente que un tipo de 32 bits ocupa DOS words. Y el baud rate es la trampa de la comunicación serial RTU (silencio o datos mal decodificados por desalineación de `MB_COMM_LOAD`), un problema de capa de transporte distinto al de cómo se ensamblan dos registros ya recibidos. Por eso el código real usa `struct` con formato explícito (`>HH` / `>f`, big-endian: la convención más común pero NO universal) en vez de confiar en un default implícito de la librería.

## Escribir con función 06 a una dirección de input register

type: multiple_choice

Tu capability card expone una acción de ESCRITURA que apunta a la dirección Modbus `30002`. Tu handler ejecuta esa escritura con la función 06 (escribir un holding register). Según los rangos del manual (30001-39999 = input registers de solo lectura, típicamente valores de sensores; 40001-49999 = holding registers de lectura/escritura), ¿qué ocurre y cuál es la verdadera naturaleza del error?

### Opciones

- El PLC ejecuta la escritura en silencio sobre un valor de sensor y lo corrompe sin ningún error, igual que la trampa de leer el tipo de dato equivocado.
- [x] El esclavo RECHAZA la petición con un código de excepción Modbus, porque 30001-39999 son input registers de solo lectura y la función 06 es para holding registers. El protocolo sí se defiende aquí; el error real es de diseño de la capability card — exponer una acción de escritura hacia una dirección de solo lectura — no una permisividad del protocolo.
- La escritura funciona, porque a nivel de bytes todas las direcciones son simplemente offsets de 16 bits equivalentes y no hay noción de solo-lectura.
- La librería convierte automáticamente la escritura fallida en una lectura y te devuelve el valor actual del registro.

### Justificación

A diferencia de la trampa de tipo de dato (que falla en SILENCIO, sin excepción), aquí el protocolo mismo distingue funciones de lectura (01-04) de las de escritura (05, 06, 15, 16) y rangos de solo-lectura (input registers, 30001-39999) de los de lectura/escritura (holding registers, 40001-49999): el esclavo debe devolver un código de excepción, no ejecutar algo incorrecto. Que "a nivel de bytes toda dirección sea un offset de 16 bits" describe cómo se TRANSMITE la dirección en el cable, no elimina el control de acceso que el dispositivo aplica por función. Y la librería no inventa una lectura de reemplazo. La lección de ingeniería: la equivocación vive en el diseño de la card (marcar como escribible algo que es de solo lectura), no en el protocolo.

## Seguridad de un PLC Modbus en una red plana

type: multiple_choice

Un revisor ORION te pregunta: ¿qué hace inseguro, específicamente, a un PLC accesible por Modbus TCP en una red plana sin segmentación, y dónde vive la mitigación real? Conecta tu respuesta con el mismo argumento de "el protocolo no te protege por sí solo" que ya viste para un broker MQTT sin autenticación.

### Opciones

- Modbus cifra los comandos pero con una llave débil; la mitigación es rotar esa llave con frecuencia.
- [x] Modbus no tiene ningún mecanismo nativo de autenticación ni cifrado: cualquier dispositivo que alcance la IP y el puerto 502 del PLC puede enviar comandos de escritura (función 06/16) directamente sobre maquinaria física, sin verificación de identidad. La mitigación real vive a nivel de RED — segmentación, VLANs dedicadas, firewalls que restringen qué IPs llegan al puerto 502 — no en el protocolo.
- El riesgo es acotado porque Modbus solo transporta telemetría de solo lectura: un atacante en la red podría espiar valores, pero nunca escribir.
- Ninguno: el PLC valida internamente cada comando contra la capability card del Bridge, así que una red plana no añade riesgo.

### Justificación

Modbus no ofrece autenticación ni cifrado nativos, de modo que alcanzar la IP y el puerto 502 basta para emitir escrituras: el problema no es una llave débil (no hay cifrado que romper). Es más grave que MQTT sin autenticación porque Modbus no transporta solo telemetría, transporta COMANDOS DE ESCRITURA sobre un PLC que mueve hardware real — así que "solo se puede espiar" es falso. Y el PLC no impone la capability card: esa validación vive en el Bridge, y un atacante conectado directamente al PLC se la SALTA por completo. Por eso la defensa efectiva es de arquitectura de red (aislar quién puede alcanzar el puerto 502), la misma lección de que el protocolo por sí solo no te protege.
