---
module_id: cb000000-0000-4000-8000-00000000000a
spine: FrED
title: Ejercicios — Transport · la conexión viva del Bridge
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-1-transport.md)
version: 1
---

# Transport · la conexión viva del Bridge

Banco a_mano: defiende, desde primer principio, por qué el Bridge necesita una línea abierta (no cartas) y qué ingeniería mantiene esa línea viva sobre hardware real. Cada ejercicio está anclado a una sección del libro.

## Codificar un frame con prefijo de longitud
type: code

Tras el handshake, la comunicación del Bridge ocurre en **frames** (sección 2.2): una cabecera compacta que incluye, entre otras cosas, la **longitud del payload**, seguida del contenido real del mensaje — a diferencia de HTTP, donde cada mensaje paga cabeceras extensas. Implementa la codificación de esa forma para una carga de texto ASCII: un frame representado como un arreglo de números cuyo PRIMER elemento es la longitud del payload (número de caracteres), seguido del código ASCII de cada carácter, en orden. Un payload vacío sigue produciendo un frame: longitud 0 y ningún byte de contenido.

### Especificación
`encodeFrame(payload)`: devuelve un arreglo. El elemento 0 es `payload.length` (cantidad de caracteres). Luego, por cada carácter en orden, su código ASCII (`charCodeAt` / `ord`). El payload es siempre ASCII, así que un carácter = un código. `""` → `[0]`.

### Firma
```javascript
function encodeFrame(payload) {
  // tu código
}
```
```python
def encode_frame(payload):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [""], "expected": [0] },
  { "input": ["A"], "expected": [1, 65] },
  { "input": ["AB"], "expected": [2, 65, 66] },
  { "input": ["ping"], "expected": [4, 112, 105, 110, 103] },
  { "input": ["0"], "expected": [1, 48] }
]
```

### Solución
```javascript
function encodeFrame(payload) {
  const frame = [payload.length];
  for (let i = 0; i < payload.length; i++) {
    frame.push(payload.charCodeAt(i));
  }
  return frame;
}
```
```python
def encode_frame(payload):
    frame = [len(payload)]
    for ch in payload:
        frame.append(ord(ch))
    return frame
```

### Pistas
- La cabecera es un solo número (la longitud); va PRIMERO, antes de recorrer el contenido.
- El payload vacío nunca entra al lazo, pero el frame no es un arreglo vacío: la longitud (`0`) siempre está.
- Cuidado con `"0"`: es un carácter de contenido (longitud 1, código 48), no el caso vacío.

## Por qué SSE no basta y WebSocket sí
type: multiple_choice

Entre las alternativas a HTTP request/response, SSE (Server-Sent Events) es la que más se acerca: mantiene una conexión HTTP abierta y deja que el **servidor empuje eventos hacia el cliente** en cualquier momento, sin que el cliente vuelva a pedir nada. Aun así, el libro descarta SSE para la capa de transport del Bridge. ¿Cuál es la razón exacta?

### Opciones
- SSE tiene mayor overhead por mensaje que un frame de WebSocket, y la telemetría de alta frecuencia lo volvería inviable.
- [x] SSE es unidireccional: resuelve el empuje servidor→cliente, pero el cliente no tiene, dentro del mismo canal, forma de enviar datos de vuelta — y el Bridge necesita **ambas** direcciones activas simultáneamente sobre una sola conexión (comandos bajando, telemetría subiendo, sin coordinación previa).
- SSE no puede atravesar proxies ni firewalls corporativos, mientras que WebSocket sí, por empezar como HTTP.
- SSE no soporta cifrado TLS, así que expondría los comandos en texto plano.

### Justificación
La sección 1.2 dice que SSE "resuelve elegantemente el problema de servidor empuja hacia cliente… **Pero SSE es unidireccional** — el cliente no tiene, dentro del mismo canal, una forma de enviar datos de vuelta hacia el servidor". Para el Bridge hacen falta las dos direcciones a la vez sobre la misma conexión, así que SSE resuelve solo la mitad — de ahí WebSocket full-duplex (sección 1.3). El argumento de overhead-por-mensaje SÍ está en el libro, pero como la razón por la que un frame ligero le gana a una petición HTTP completa (sección 2.2), no como la razón por la que SSE falla; el fallo de SSE es estructural (una sola dirección), no de rendimiento. SSE es HTTP puro: atraviesa los mismos proxies/firewalls que cualquier tráfico HTTP (la opción 3 invierte el hecho — fue WebSocket el que tuvo que empezar como HTTP para atravesar esa infraestructura) y corre sobre HTTPS/TLS igual que cualquier conexión HTTP (la opción 4 es falsa).

## Por qué el handshake empieza como una petición HTTP
type: multiple_choice

Una conexión WebSocket empieza literalmente como una petición HTTP GET con las cabeceras `Upgrade: websocket` y `Connection: Upgrade`; si el servidor acepta, responde `101 Switching Protocols` y la misma conexión TCP deja de hablar HTTP para empezar a hablar el framing de WebSocket. El libro insiste en que empezar como HTTP es una decisión de diseño, no solo tradición histórica. ¿Cuál es esa razón?

### Opciones
- [x] Reutilizar el mecanismo de negociación de HTTP permite que la conexión atraviese la infraestructura de red que YA existe para HTTP/HTTPS — proxies, balanceadores, firewalls corporativos en los puertos 80/443 — sin exigir que esa infraestructura entienda un protocolo nuevo desde cero.
- HTTP es el único protocolo que garantiza entrega ordenada y sin pérdidas, y WebSocket hereda esa garantía por empezar como HTTP.
- El código `101 Switching Protocols` obliga al servidor a cifrar la conexión con TLS de forma automática.
- Empezar como HTTP permite que el token de autenticación viaje en las cabeceras del handshake, que es donde ORION lo coloca.

### Justificación
La sección 2.1 lo dice directo: "reutilizar el mecanismo de negociación de HTTP permite que una conexión WebSocket atraviese la misma infraestructura de red que ya existe para HTTP — proxies, balanceadores de carga, firewalls corporativos… en los puertos estándar (80/443) — sin exigir que esa infraestructura entienda un protocolo completamente nuevo desde cero". La entrega ordenada y sin pérdidas (opción 2) es una propiedad de la conexión TCP subyacente, no algo que confiera "empezar como HTTP"; el libro nunca la atribuye al handshake. `101` significa "cambio de protocolo", no fuerza TLS (opción 3): el cifrado viene del esquema `wss://` (secciones 2.1/3.1), una decisión ortogonal. Y la opción 4 invierte al libro: la sección 3.2 dice que ORION deliberadamente NO lleva el token en las cabeceras HTTP del handshake — el mensaje `bridge_auth` con el token es el PRIMER mensaje de aplicación sobre la conexión ya establecida, justo para mantener toda la lógica de seguridad en la misma capa que el resto del protocolo.

## Cómo el heartbeat detecta una desconexión silenciosa
type: multiple_choice

El libro deduce el heartbeat desde un problema concreto: una conexión TCP puede quedar en un estado donde, del lado de la aplicación, **parece** seguir abierta (el socket no reportó ningún error), pero la conectividad física subyacente ya se perdió (por ejemplo, un cable desconectado abruptamente, sin cierre ordenado). ¿Por qué un heartbeat — ping/pong periódico con una ventana de tiempo — detecta esa desconexión silenciosa más rápido que no tener ningún mecanismo adicional?

### Opciones
- Porque el heartbeat reenvía automáticamente el último comando no confirmado, forzando al servidor a responder y revelando si la conexión sigue viva.
- Porque el ping viaja por un canal TCP separado del de los datos, y ese canal detecta cortes que el canal de datos no ve.
- [x] Porque sin heartbeat ninguna de las dos partes se entera del corte hasta que intenta enviar datos reales y esa operación falla (potencialmente tras un timeout largo de TCP del sistema operativo); el heartbeat declara la conexión muerta ACTIVAMENTE cuando el pong no llega en su ventana, en vez de esperar pasivamente a ese fallo.
- Porque el heartbeat reduce a cero el intervalo de polling, eliminando el retraso inherente del polling descrito en la sección 1.

### Justificación
La sección 4.2: sin ningún mecanismo adicional "ninguna de las dos partes se enteraría de esta desconexión silenciosa hasta que intentara enviar datos y esa operación fallara (potencialmente después de un timeout largo de TCP…)". El heartbeat "declara la conexión muerta activamente" cuando el pong no llega en su ventana, "en vez de esperar pasivamente a que un intento de envío de datos reales falle" — acortando el tiempo de detección para disparar la reconexión antes. El heartbeat es una sonda de vida (ping/pong), no un reenvío de comandos: la opción 1 lo confunde con la maquinaria de reintento/deduplicación de las secciones 4.4/5.1. No hay un canal TCP separado (opción 2, inventada): ping y pong son frames de control sobre la MISMA conexión WebSocket (sección 2.2). Y no es polling (opción 4): el polling es el cliente preguntando repetidamente "¿hay algo nuevo?" para ENTREGAR datos (sección 1.2); el heartbeat solo comprueba que la línea siga viva — propósito distinto, y "reducir el intervalo de polling a cero" no tiene sentido.

## Por qué el backoff exponencial necesita jitter
type: multiple_choice

Cuando el servidor cae, muchos bridges de muchos laboratorios pueden detectar la desconexión casi al mismo tiempo y empezar a reconectar. El backoff exponencial ya hace que cada bridge espere 1, 2, 4, 8, 16… segundos entre reintentos (con un tope, p. ej. 60 s). ¿Qué problema específico resuelve AGREGAR jitter — una pequeña variación aleatoria a cada intervalo — que el backoff exponencial por sí solo no resuelve?

### Opciones
- Sin jitter, el intervalo de espera crecería sin límite y el bridge acabaría dejando de reintentar por completo.
- [x] Sin jitter, todos los bridges que fallaron a la vez por la misma causa esperan exactamente los mismos intervalos fijos y reintentan sincronizados, en el mismo instante — recreando la misma tormenta de sobrecarga sincronizada que el backoff intentaba evitar; el jitter DESINCRONIZA los reintentos.
- El jitter cifra el instante de cada reintento para que un atacante no pueda predecir cuándo el bridge se reconecta.
- El jitter garantiza que el primer reintento ocurra de inmediato (0 s), acelerando la recuperación en una caída breve.

### Justificación
La sección 4.3 define el jitter como "una pequeña variación aleatoria agregada a cada intervalo, para evitar que múltiples bridges que fallaron simultáneamente por la misma causa terminen todos reintentando en el mismo instante exacto, sincronizados, lo cual recrearía el mismo problema de sobrecarga sincronizada que el backoff intenta evitar". El backoff solo, por sí mismo, espacia en el tiempo los reintentos de UN cliente; pero si todos usan el mismo esquema fijo de duplicación y fallaron en el mismo instante, siguen en lockstep y golpean al servidor juntos en cada despertar sincronizado. El tope superior — no el jitter — es lo que acota el intervalo (la opción 1 confunde ambos, y el lazo nunca deja de reintentar). El jitter es un mecanismo de desincronización de carga, no de cifrado (opción 3: la confidencialidad/anti-manipulación es tarea de TLS, sección Conexiones), y es una perturbación aleatoria pequeña del intervalo ya calculado, no una regla que fuerce un primer reintento instantáneo (opción 4).

## Un comando en vuelo cuando la conexión cae
type: trace

Traza el escenario más peligroso del libro (caso 2 de la sección 4.4): el servidor envió un comando de movimiento, el Bridge lo recibió y el hardware empezó (o terminó) de ejecutarlo, y la conexión se cayó ANTES de que la confirmación volviera al servidor. El brazo puede completar físicamente un movimiento ya en curso aunque la conexión al servidor se haya perdido. Tras reconectar, ¿qué debe hacer el sistema, según el libro, para decidir con seguridad si reenviar el comando sin arriesgar una ejecución física duplicada?

### Opciones
- El servidor reenvía el comando de inmediato tras reconectar; si el hardware ya lo ejecutó, ejecutarlo otra vez es inofensivo.
- El Bridge reanuda enviando telemetría como si nada hubiera pasado, y el servidor infiere el estado a partir del flujo de telemetría reciente.
- [x] Cada comando lleva un identificador único (para deduplicar reintentos) y el Bridge, tras reconectar, reporta el ESTADO FÍSICO REAL actual del hardware (p. ej. `get_status()`), permitiendo que el servidor RECONCILIE su vista con la realidad antes de decidir si reenviar — en vez de asumir ciegamente qué ocurrió durante la desconexión.
- El Bridge descarta cualquier comando recibido en los últimos segundos antes del corte y espera a que el operador lo reemita manualmente.

### Justificación
La sección 4.4 deduce la mitigación de los tres casos: cada comando necesita "un identificador único" (idempotencia/deduplicación — distinguir un comando nuevo de un reintento del mismo) Y el Bridge, tras reconectar, debe poder "reportar su estado actual real del hardware… permitiendo que el servidor reconcilie su vista del mundo con la realidad física antes de decidir si reenviar algún comando pendiente" — exactamente por lo que el flujo del Bridge incluye una consulta de estado del dispositivo (`get_status()`). El reenvío ciego (opción 1) es justo el peligro que el libro advierte: "reenviarlo ciegamente podría ejecutar el mismo movimiento dos veces", no inofensivo, porque el estado físico ya cambió. El libro rechaza explícitamente "reanudar como si nada hubiera pasado" (opción 2): hay que verificar la realidad física, no inferir a ciegas desde la telemetría reanudada. Y esperar una reemisión manual (opción 4) es inventado y contradice el marco de la sección 4.1: la pregunta de diseño es "¿qué hace el sistema AUTOMÁTICAMENTE cuando pasa, sin intervención humana?".
