---
module_id: cb000000-0000-4000-8000-000000000009
spine: FrED
title: Ejercicios — OP-0 · Arquitectura del ORION Bridge
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-0-bridge.md)
version: 1
---

# OP-0 · Arquitectura del ORION Bridge

Banco a_mano: defiende cada decisión de arquitectura del Bridge desde primeros principios. Cada pregunta se ancla a lo que el libro realmente argumenta — el porqué de una decisión, qué se rompe si la cambias, cómo se implementa una pieza — no a trivia.

## Por qué la validación no puede vivir dentro del LLM
type: multiple_choice

Un revisor del equipo ORION te pregunta por qué no basta con instruir al propio LLM, dentro de su prompt, a que "verifique que su propuesta esté dentro de rangos seguros antes de responder". ¿Cuál es el argumento ESTRUCTURAL — no solo empírico — por el que esa auto-validación no ofrece ninguna garantía real, aunque funcione la mayoría de las veces en pruebas?

### Opciones
- Porque los LLM no pueden leer su propia salida dentro de la misma llamada, así que auto-verificarse es técnicamente imposible.
- Porque con un modelo más grande y temperatura 0 la auto-validación sí sería suficiente; el problema es solo de calidad del modelo, no de estructura.
- [x] Porque el veredicto de validez lo emitiría el mismo proceso generativo probabilístico que produjo la propuesta: la falla del que propone y la del que valida quedan CORRELACIONADAS — la misma confusión o sesgo que generó una alucinación puede generar también una "auto-validación" que la acepte. La garantía real exige que el veredicto venga de un sistema estructuralmente distinto y determinístico, para que ambas fallas sean INDEPENDIENTES.
- Porque una segunda llamada al LLM, dedicada solo a validar, resolvería el problema al separar la propuesta y la validación en dos pasos.

### Justificación
El libro (§1.1–§1.2, §2.3) distingue el error de razonamiento (corregible con mejor prompting) de la alucinación estructural, cuya probabilidad es no nula y NO reducible a cero por más contexto. Pedirle al mismo sistema probabilístico que juzgue su propia salida no separa las fuentes de error: ambos veredictos viven en el mismo proceso generativo, con el mismo contexto y las mismas limitaciones, así que pueden fallar juntos (correlación). Un modelo más grande o temperatura 0 solo baja la probabilidad — nunca la lleva a cero ni rompe la correlación. Una segunda llamada al LLM sigue siendo generación probabilística que puede compartir el mismo sesgo, así que tampoco garantiza independencia. La única garantía es un validador determinístico y auditable FUERA del LLM, análogo a un interlock industrial: el mecanismo de verificación tiene que ser externo al sistema que puede fallar. Lo de "no puede leer su salida" es falso y no es el punto.

## Las dos funciones de la capability card
type: multiple_choice

El libro llama a la capability card "la pieza conceptual más importante" y advierte que confundir sus dos funciones es un error de diseño de seguridad, no solo una imprecisión conceptual. ¿Cuál es la distinción correcta entre lo que la capability card hace y lo que la validación hace?

### Opciones
- La capability card ES la garantía de seguridad: al declarar los rangos exactos y las acciones posibles, impide estructuralmente que el LLM proponga algo fuera de rango.
- [x] La capability card solo REDUCE LA PROBABILIDAD de que el LLM proponga algo inválido, al darle como contexto el "menú" correcto de acciones y rangos; la GARANTÍA real es la validación determinística posterior, que verifica que lo efectivamente propuesto cae dentro del envelope declarado. Tratar "darle un buen prompt con las capacidades correctas" como seguridad suficiente es exactamente el error.
- La capability card y la validación son redundantes: ambas comprueban rangos, así que se puede omitir una sin perder garantías.
- La capability card valida después de la propuesta y la validación va antes; el orden de ejecución es lo único que las distingue.

### Justificación
§2.2 separa explícitamente la Función 1 (guiar al LLM hacia propuestas más probablemente válidas — una mejora de calidad de la propuesta) de la Función 2 (NO es la garantía). La card es contexto entregado AL LLM antes de que proponga; declarar un rango no lo hace cumplir. Por §1.1 la probabilidad de alucinación nunca llega a cero, así que confiar en la card sola deja el sistema sin garantía. La validación (§2.3) es la que verifica de forma determinística lo que el LLM efectivamente propuso: no es redundante con la card, tiene un rol distinto (garantía vs. guía). El orden importa, pero no es "lo único" que las distingue — son mecanismos de naturaleza distinta: contexto probabilístico frente a verificación determinística.

## Traza: un intent que pasa la card pero debe rechazarse
type: trace

Traza el caso que un revisor te pediría diseñar. El operador pide "mueve el eje 2 a 47°". La capability card del dispositivo declara `move_joint` como acción permitida y el rango del eje 2 como `[-118, 120]`, así que 47° cae dentro. Pero en ese instante el brazo ya está ejecutando otra trayectoria. ¿Qué debe pasar, y qué información necesita la validación que la card, por sí sola, no garantiza capturar?

### Opciones
- La acción se ejecuta: pasó la capability card (acción permitida, ángulo en rango), y eso es justo lo que la card existe para garantizar.
- La acción se rechaza en la propia capability card, porque la card siempre refleja en tiempo real si el dispositivo está ocupado.
- [x] La acción se rechaza en la etapa de validación: además de la acción y el rango, la validación consulta el ESTADO ACTUAL del dispositivo en el momento de ejecutar (vía `get_status`) — información viva que la declaración de acciones-y-rangos no garantiza reflejar. El brazo está a mitad de otra operación, así que la acción no es permisible AHORA.
- La acción se rechaza porque 47° en realidad queda fuera de rango si el eje ya se movió; el rango declarado deja de ser válido durante un movimiento.

### Justificación
§2.3 lista tres comprobaciones de la validación: acción permitida, parámetros en rango, y "¿el estado actual del dispositivo permite esta acción AHORA?" (no a mitad de otra operación, no en error). La card guía al LLM y declara el envelope, pero es el contexto que el LLM vio al proponer; el estado vivo puede haber cambiado, y confiar en que la propuesta lo refleja es precisamente lo que §1 prohíbe. Por eso la garantía de "ahora no" vive en la validación consultando `get_status`, no en la card. La primera opción es el error de §2.2 (creer que pasar la card basta). La card no es un oráculo de ocupación que el LLM re-consulta en tiempo real. Y el rango `[-118, 120]` no deja de ser válido por estar en movimiento: 47° sigue en rango — lo que falla es el estado, no el parámetro.

## Por qué handlers modulares y no un monolito
type: multiple_choice

ORION implementa cada tipo de dispositivo (xArm físico, MuJoCo, ABB, PLC S7, shell) como un handler independiente detrás de una interfaz común, en vez de una sola pieza que "sepa hablar con todos". Defiende esa decisión: ¿cuál es la razón central por la que se prefiere la modularidad, y qué la vuelve el punto de contribución de menor fricción para alguien que se integra al proyecto?

### Opciones
- [x] En un monolito que conoce todos los dispositivos, un cambio para soportar uno nuevo (p. ej. otro PLC) puede introducir un bug que afecte el manejo del xArm, sin relación funcional — el riesgo queda ACOPLADO. Con handlers aislados tras una interfaz común, la validación y el dispatch hablan con cualquiera por esa interfaz sin conocer sus internos, así que escribir un handler nuevo tiene blast radius acotado: mientras cumpla la interfaz, no puede romper los demás.
- Se prefiere sobre todo por rendimiento en tiempo de ejecución: varios handlers pequeños corren en paralelo mejor que un módulo grande.
- Se prefiere porque un monolito no podría, técnicamente, manejar protocolos tan distintos como snap7 y un socket TCP crudo dentro del mismo programa.
- Es más segura porque cada handler re-implementa su propia capa de validación, de modo que un fallo del validador central no lo afecta.

### Justificación
§3.1 deduce la modularidad del problema de acoplamiento (el mismo que el broker resolvía entre productores y consumidores en el módulo de datos industriales): el monolito acopla el riesgo de cambios entre dispositivos sin relación funcional. La interfaz común (`connect` / `get_capability_card` / `execute` / `get_status`) permite que validación y dispatch hablen con cualquier handler sin conocer sus internos; por eso un handler nuevo es una contribución aislada de bajo blast radius (§3, cierre). No es por velocidad (irrelevante al argumento) ni por imposibilidad técnica (un monolito SÍ podría hablar ambos protocolos, solo que con el riesgo acoplado). Y los handlers NO re-implementan la validación: la validación es central y compartida (§2.3) — que cada handler tuviera la suya sería precisamente perder la garantía única.

## anon key en vez de service_role — el mecanismo
type: multiple_choice

El Bridge exige `SUPABASE_ANON_KEY`, explícitamente NO `service_role`, aunque ambas viven en el mismo tipo de archivo de entorno y ambas podrían filtrarse. Si un atacante obtuviera la credencial del proceso del Bridge, ¿qué diferencia CONCRETA de mecanismo hace que la anon key acote el daño y la service_role lo vuelva catastrófico?

### Opciones
- La anon key no permite ninguna lectura ni escritura por sí sola, así que filtrarla es inofensivo; la service_role sí permite operaciones, por eso es peligrosa.
- La service_role está cifrada en reposo y la anon no, así que una service_role filtrada es más fácil de revertir; es una diferencia de almacenamiento, no de permisos.
- [x] Toda operación con anon key sigue sujeta a las políticas de Row Level Security: el atacante hereda solo lo que RLS concede a un cliente anónimo, así que el compromiso queda ACOTADO. La service_role está diseñada para SALTARSE RLS — la misma filtración daría acceso irrestricto a toda la base de datos, de cualquier laboratorio y usuario. La credencial que vive en un proceso que podría comprometerse debe estar diseñada para que el peor caso sea acotado, no catastrófico.
- No hay diferencia real de mecanismo: ambas respetan RLS por igual, y usar anon es solo una convención de estilo del equipo.

### Justificación
§4.3 es explícito: la anon key está pensada para clientes no confiables porque toda operación autenticada con ella sigue sujeta a RLS — identifica "cliente anónimo/público" pero no otorga acceso; ese permiso lo deciden las políticas por tabla. La service_role está diseñada para saltarse RLS (confianza total, solo código de servidor). Por eso un mismo compromiso es acotado con anon (privilegio mínimo: heredas lo que RLS concede) y catastrófico con service_role (acceso total al sistema). No es cierto que la anon no permita nada — permite lo que RLS autorice; no es una diferencia de cifrado ni de almacenamiento; y no es mera convención, sino una diferencia en el mecanismo de autorización. Es el mismo principio que ya se vive en Arcanum (anon + RLS), aquí con consecuencia física en lugar de solo datos.

## Destila la validación en una función pura
type: code

Destila la capa de validación (§2.3) a su forma más pura: una función determinística que decide si un movimiento propuesto es admisible. Es exactamente el tipo de verificación que, por diseño, vive FUERA del LLM — dado el mismo input, siempre el mismo veredicto, sin ninguna componente probabilística.

### Especificación
`validarMovimiento(accionesPermitidas, rango, accion, angulo)` devuelve `true` SOLO si se cumplen ambas condiciones: (1) `accion` está en la lista `accionesPermitidas` (la lista blanca de la card), Y (2) `angulo` cae dentro de `rango = [min, max]`, inclusive en ambos extremos. Si la acción no está permitida, devuelve `false` sin siquiera mirar el ángulo (corto-circuito). En cualquier otro caso, `false`.

### Firma
```javascript
function validarMovimiento(accionesPermitidas, rango, accion, angulo) {
  // tu código
}
```
```python
def validar_movimiento(acciones_permitidas, rango, accion, angulo):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [["move_joint", "home"], [-118, 120], "move_joint", 47], "expected": true },
  { "input": [["move_joint", "home"], [-118, 120], "move_joint", 200], "expected": false },
  { "input": [["move_joint", "home"], [-118, 120], "fly", 47], "expected": false },
  { "input": [["move_joint"], [-118, 120], "move_joint", -118], "expected": true },
  { "input": [["move_joint"], [-118, 120], "move_joint", 120], "expected": true },
  { "input": [["move_joint"], [-118, 120], "move_joint", -119], "expected": false },
  { "input": [[], [-118, 120], "move_joint", 47], "expected": false }
]
```

### Solución
```javascript
function validarMovimiento(accionesPermitidas, rango, accion, angulo) {
  if (!accionesPermitidas.includes(accion)) return false;
  return angulo >= rango[0] && angulo <= rango[1];
}
```
```python
def validar_movimiento(acciones_permitidas, rango, accion, angulo):
    if accion not in acciones_permitidas:
        return False
    return rango[0] <= angulo <= rango[1]
```

### Pistas
- Descarta primero por acción (lista blanca), luego por rango: el orden es un corto-circuito — una acción no permitida devuelve `false` sin mirar el ángulo.
- El rango es inclusivo en ambos extremos: el límite exacto (-118 y 120) es válido; uno más allá (-119) no.
- Una lista de acciones vacía no permite nada: cualquier movimiento cae a `false`.
