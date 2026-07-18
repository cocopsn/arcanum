---
module_id: cb000000-0000-4000-8000-00000000000e
spine: FrED
title: Ejercicios — El Reactive Observer
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-5-reactive-observer.md)
version: 1
---

# OP-5 · El Reactive Observer

Banco a_mano: defiende, desde primeros principios, por qué el sistema reacciona al mundo físico sin que se lo pidan — el flujo inverso hardware → evento → agente. Cada ejercicio está anclado a lo que ESTE libro deduce (push vs. polling, el patrón Observer, detección de flanco, histéresis, la frontera de seguridad). El ejercicio de código es el corazón mecánico del observador: escríbelo y ejecútalo aquí.

## Por qué request-response puro no basta
type: multiple_choice

El Reactive Observer existe para el flujo inverso hardware → evento → agente. Supón que insistes en usar SOLO request-response (el agente pregunta explícitamente "¿cuál es la temperatura ahora?") y aun así quieres detectar una condición peligrosa con una latencia parecida a la que da el push reactivo. ¿Qué se ve forzado a hacer el agente, y por qué esa alternativa es estrictamente peor?

### Opciones
- El agente puede BAJAR la frecuencia de consulta para ahorrar recursos y, aun así, detecta la condición más rápido que con push.
- [x] Tiene que preguntar constantemente, a una frecuencia muy alta, para no perderse un evento entre dos consultas — y aun así arrastra un retraso inherente de hasta un intervalo completo, además de desperdiciar recursos en consultas que la mayoría de las veces no encuentran nada.
- Nada: request-response tiene la misma latencia que push porque ambos viajan por la misma conexión WebSocket persistente.
- Basta con mover la evaluación del umbral a un servidor central en la nube para igualar la latencia del push.

### Justificación
Es la deducción de las secciones 1.1 y 1.2: el mundo físico genera eventos por su cuenta, sin esperar turnos, así que con request-response puro la única forma de no perderse un evento entre dos preguntas es preguntar con una frecuencia lo bastante alta — lo que arrastra retraso inherente igual al intervalo entre preguntas Y desperdicio constante de recursos, exactamente el problema de polling ya diagnosticado en el módulo de Transport. Bajar la frecuencia empeora la latencia (justo al revés). "Misma latencia por la misma WebSocket" confunde el TRANSPORTE con el PATRÓN de interacción: en request-response el agente debe INICIAR cada lectura, así que la latencia la fija cada cuánto pregunta, no el canal — el push invierte eso (el Bridge empuja sin que nadie pregunte). Y mover la evaluación a la nube reintroduce la latencia de red que la sección 1.3 justo busca evitar.

## Por qué el Bridge es el lugar natural para observar
type: multiple_choice

¿Por qué la evaluación de si una condición de telemetría es anómala debe ocurrir DENTRO del Bridge, y no en un servidor central de ORION en la nube?

### Opciones
- Porque un servidor central no tiene CPU suficiente para hacer una comparación contra un umbral.
- Porque WebSocket solo funciona en el Bridge y no en un servidor central.
- [x] Porque el Bridge está físicamente pegado al hardware: evaluar localmente da latencia mínima y evita que la telemetría cruda tenga que viajar por la red antes de que algo relevante se detecte — la aplicación directa del mismo argumento de edge computing ya establecido en fundamentos FrED.
- Porque solo el Bridge puede registrar observadores; un servidor central no soporta el patrón Observer.

### Justificación
Sección 1.3: el Bridge recibe la telemetría directamente de los handlers, con la latencia mínima que solo la proximidad física permite; si la detección tuviera que esperar a que los datos crudos cruzaran hasta un servidor central antes de evaluarse, se reintroduciría exactamente el problema de latencia de red que el edge computing existe para resolver, además del volumen de datos que viajaría inútilmente. Las otras fallan por razones distintas: una comparación contra umbral es trivial en CPU (no es cuestión de cómputo); WebSocket funciona igual en cualquier extremo; y un servidor central perfectamente podría registrar observadores — el patrón Observer no es lo que ata la evaluación al Bridge, es el argumento de latencia y ancho de banda.

## Detección de flanco: de telemetría continua a eventos discretos
type: code

Implementa el corazón del observador de la sección 3.1: la detección de FLANCO. Recibes una secuencia de lecturas (por ejemplo, temperaturas muestreadas en el tiempo) y un umbral. El observador arranca en estado NORMAL y solo debe emitir un evento en el instante exacto en que la condición CAMBIA de normal a anómala — nunca en cada lectura mientras la condición se mantiene por encima del umbral. Devuelve los índices de las lecturas donde se emite un evento, en orden.

### Especificación
- Estado inicial: normal (no anómalo), tal como `_ultimo_estado_anomalo = False` en el código del libro.
- Una lectura es anómala si y solo si `lectura > umbral` (comparación ESTRICTA: una lectura IGUAL al umbral NO es anómala).
- Recorre las lecturas en orden. En cada índice `i`: calcula `anomaloAhora`; si `anomaloAhora` es verdadero Y el estado anterior era normal, emite (registra `i`); luego actualiza el estado anterior con `anomaloAhora`.
- Devuelve el arreglo de índices emitidos, en orden. Un arreglo de lecturas vacío devuelve `[]`.

### Firma
```javascript
function deteccionFlanco(lecturas, umbral) {
  // tu código
}
```
```python
def deteccion_flanco(lecturas, umbral):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[], 215], "expected": [] },
  { "input": [[100, 150, 200], 215], "expected": [] },
  { "input": [[200, 220, 221, 222], 215], "expected": [1] },
  { "input": [[216, 217], 215], "expected": [0] },
  { "input": [[215, 216, 215], 215], "expected": [1] },
  { "input": [[214, 216, 214, 216, 214, 216], 215], "expected": [1, 3, 5] }
]
```

### Solución
```javascript
function deteccionFlanco(lecturas, umbral) {
  const eventos = [];
  let anomaloAntes = false;
  for (let i = 0; i < lecturas.length; i++) {
    const anomaloAhora = lecturas[i] > umbral;
    if (anomaloAhora && !anomaloAntes) eventos.push(i);
    anomaloAntes = anomaloAhora;
  }
  return eventos;
}
```
```python
def deteccion_flanco(lecturas, umbral):
    eventos = []
    anomalo_antes = False
    for i in range(len(lecturas)):
        anomalo_ahora = lecturas[i] > umbral
        if anomalo_ahora and not anomalo_antes:
            eventos.append(i)
        anomalo_antes = anomalo_ahora
    return eventos
```

### Pistas
- El estado anterior arranca en "normal": por eso una PRIMERA lectura ya anómala sí cuenta como flanco (caso `[216, 217]` → `[0]`).
- La comparación es estricta (`>`): una lectura igual al umbral no dispara nada (caso `[215, 216, 215]` → `[1]`, no `[0, 1, 2]`).
- Guarda solo un bit de estado entre iteraciones (¿estaba anómalo antes?) y compáralo con el ahora. No necesitas mirar más de una lectura hacia atrás.
- Fíjate en el caso oscilante `[214, 216, 214, 216, ...]` → `[1, 3, 5]`: la detección de flanco por sí sola SÍ vuelve a disparar en cada recruce. Esa es exactamente la limitación que la sección 4.1 resuelve con histéresis, no con más flanco.

## Tormenta de eventos: por qué el flanco no basta
type: multiple_choice

Un sensor de vibración ruidoso oscila rápidamente alrededor de tu único umbral de anomalía (por ejemplo, `214.8, 215.3, 214.9, 215.1, ...`). Ya emites solo en el cambio de estado (detección de flanco / debouncing, como en el código de la sección 3.1). ¿Por qué esto NO detiene la tormenta de eventos, y qué la resuelve de forma estructural?

### Opciones
- La detección de flanco ya la resuelve: una vez que solo emites en el cambio de estado, la tormenta no puede ocurrir.
- El throttling elimina la causa raíz: al limitar la frecuencia máxima de eventos, la oscilación del sensor deja de existir.
- [x] Con detección de flanco pura, cada recruce del único umbral sigue siendo un flanco normal→anómalo nuevo, así que cada oscilación sigue disparando; la histéresis (un umbral ALTO para entrar y uno más BAJO para salir, con una zona muerta entre ambos) elimina los recruces por ruido de forma estructural.
- Solo un modelo estadístico (IsolationForest) puede detener la tormenta; ningún esquema de umbrales fijos sirve.

### Justificación
La sección 4.1 lo dice explícitamente: la detección de flanco por sí sola no resuelve la oscilación rápida alrededor de un único umbral, porque si el valor cruza de un lado a otro repetidamente, cada cruce individual sigue siendo un flanco nuevo — el ejercicio de código lo demuestra: `[214, 216, 214, 216, 214, 216]` produce `[1, 3, 5]`, tres eventos. La histéresis usa DOS umbrales y crea una zona muerta donde el estado no cambia ante pequeñas oscilaciones, eliminando estructuralmente los recruces. El throttling es una salvaguarda complementaria (un límite duro a la frecuencia de salida), pero NO elimina la causa raíz: la oscilación subyacente sigue ahí, solo se recorta cuántas notificaciones salen. Y la afirmación de que solo un IsolationForest sirve es falsa: el libro presenta el modelo estadístico como una FUENTE alternativa del umbral, no como un requisito — un umbral fijo con histéresis resuelve la oscilación sin ML.

## El Reactive Observer no es la última línea de defensa
type: multiple_choice

Una condición de seguridad física genuinamente crítica en tiempo real (debe detenerse en milisegundos GARANTIZADOS). ¿Por qué el Reactive Observer es el mecanismo equivocado para confiarle la ÚLTIMA línea de defensa, aunque técnicamente pueda notificar al agente en fracciones de segundo?

### Opciones
- Porque el Reactive Observer es más lento que el polling, así que nunca llega a tiempo.
- Porque el LLM del agente no es capaz de entender qué es una condición de seguridad.
- [x] Porque reduce pero NO elimina la latencia (intervalo de monitoreo + empuje por el transport + procesamiento del agente), y ninguno de esos tiempos está garantizado en tiempo real duro; la última línea de defensa debe vivir en el PLC / lazo de control más interno, no depender de que un evento viaje hasta un agente LLM y este decida a tiempo.
- Porque las conexiones WebSocket son poco confiables y siempre se caen justo durante una emergencia.

### Justificación
Sección 4.2: el Reactive Observer es una capa de INTELIGENCIA y CONTEXTO sobre el flujo de eventos, no un interlock de seguridad. Reduce drásticamente el retraso frente a polling, pero quedan tiempos acumulados (el intervalo del observador, el viaje por el transport, el procesamiento del agente) que no están acotados en tiempo real duro; por eso el control de seguridad crítico vive dentro del PLC o del ciclo de control más interno del hardware. Confundir estas dos capas —creer que el Observer puede sustituir un interlock físico— es un error de categoría. Las otras fallan: el Observer es MÁS rápido que el polling, no más lento; la capacidad del LLM no es el punto (aunque razonara perfecto, la latencia sigue sin estar garantizada); y aunque una caída de conexión es un riesgo real (sección 4.3), "siempre se caen durante una emergencia" es falso — la razón de fondo es la latencia no garantizada, no la fiabilidad del canal.

## Evento crítico con la conexión al agente caída
type: trace

Un evento anómalo crítico se dispara EXACTAMENTE en el momento en que la conexión de transport hacia el agente está caída. Traza, paso a paso, qué debería hacer el Bridge — y por qué "esperar a que la conexión se restablezca antes de hacer cualquier otra cosa" es una respuesta insuficiente para el caso más crítico.

### Opciones
- Descartar el evento en silencio, ya que el agente puede volver a consultar el estado más tarde de todos modos.
- Reintentar el envío en un lazo cerrado y no hacer NADA más hasta que el envío tenga éxito.
- [x] Encolar el evento localmente (con un límite razonable de tamaño y/o retención) y entregarlo al reconectar, apoyado en la reconciliación para que el agente pregunte "¿qué eventos me perdí?"; y, para el caso más crítico, disparar de inmediato una acción de seguridad LOCAL (por ejemplo, un stop de emergencia por el handler) sin esperar al agente, porque la falta de conectividad hacia el agente nunca debe ser la única razón por la que una condición peligrosa no se atiende.
- Cambiar a polling periódico hasta que la conexión regrese.

### Justificación
Sección 4.3: es la aplicación, en la dirección de salida, de la misma disciplina del módulo de Transport. El evento no puede perderse, así que el Bridge lo mantiene en una cola local acotada y lo entrega al reconectar, combinado con reconciliación (el agente consulta explícitamente qué ocurrió mientras estaba desconectado). Pero para la máxima criticidad eso no basta: si la única acción posible fuera esperar la reconexión, una condición peligrosa quedaría desatendida durante todo el tiempo (no acotado) que tarde la conexión en volver — por eso el Bridge dispara además una acción de seguridad local inmediata, INDEPENDIENTE de si logra notificar al agente. Las otras fallan: descartar en silencio es justo la pérdida que el buffering existe para evitar; reintentar en lazo cerrado sin hacer nada más bloquea tanto la acción de seguridad local como el propio loop de monitoreo; y cambiar a polling no ayuda (el canal está caído también para preguntar) y abandona la salvaguarda local.
