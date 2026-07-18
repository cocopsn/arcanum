---
module_id: cb000000-0000-4000-8000-00000000000d
spine: FrED
title: Ejercicios — Capability Cards · el contrato de seguridad
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro fred-op-4-capability-cards.md)
version: 1
---

# Capability Cards — defensa de la frontera de confianza

Banco a_mano: defiendes, desde primer principio, por qué la capability card es una restricción verificable y no una instrucción de buena fe. Cada ejercicio se ancla a lo que ESTE módulo argumenta.

## Instrucción en el prompt vs. restricción verificable
type: multiple_choice

Un ingeniero propone reforzar la seguridad del brazo repitiendo tres veces en el prompt del sistema, en mayúsculas y con ejemplos, la regla "NUNCA muevas el eje más allá de 90 grados", y argumenta que con un prompt suficientemente enfático el límite queda garantizado. ¿Por qué, según el módulo, esto sigue sin ser una garantía de seguridad?

### Opciones
- Porque el LLM podría no leer el prompt del sistema completo si es demasiado largo, así que hay que acortarlo.
- [x] Porque un límite escrito en el prompt es una INSTRUCCIÓN que el modelo procesa estadísticamente, no una RESTRICCIÓN verificada mecánicamente: un proceso generativo probabilístico tiene siempre probabilidad no nula de producir un valor fuera del rango, sin importar qué tan bien redactada esté la instrucción.
- Porque el prompt debería estar en inglés y no en español para que el modelo lo respete con fiabilidad.
- Porque falta bajar la temperatura del modelo a cero, lo que lo vuelve completamente determinista y elimina el riesgo.

### Justificación
El módulo (§1.1, §1.3) nombra el error de categoría central: una instrucción en el prompt tiene la misma naturaleza estadística que cualquier otro texto que el modelo procesa, y "más probable" no es "matemáticamente restringido a un rango". La alucinación estructural no es un fallo de "no entender" la instrucción — es una propiedad inherente del mecanismo generativo que ninguna cantidad de buen prompting reduce a cero. Las opciones incorrectas tratan el problema como un bug de longitud, idioma o configuración (algo arreglable con un mejor prompt), cuando el punto es que NINGUNA instrucción, por definición, ofrece la garantía: la restricción tiene que ser declarativa y verificada por un componente determinista independiente del LLM. (Bajar la temperatura reduce la variabilidad, pero no lleva la probabilidad de violación a exactamente 0.)

## El modelo de amenaza no requiere un LLM adversarial
type: multiple_choice

Un revisor argumenta: "Nuestro LLM es de confianza, corre en nuestra propia infraestructura y nadie lo está atacando; por lo tanto la capability card es una capa de paranoia innecesaria". ¿Cuál es la refutación que da el módulo?

### Opciones
- Tiene razón: la capability card solo se justifica para defenderse de un atacante externo deliberado, así que con un LLM de confianza se puede omitir.
- [x] El modelo de amenaza no asume un LLM adversarial: la card existe primero por el caso benigno-pero-inevitable — un sistema que genera la respuesta estadísticamente plausible (no la verificadamente correcta) propone, con frecuencia baja pero no nula, algo fuera de rango sin "querer" hacerlo; y esa misma defensa cubre incidentalmente el caso adversarial.
- La card solo importa si el hardware es caro; para un brazo de bajo costo el riesgo no amerita la maquinaria de validación.
- Con un LLM de confianza, la card reemplaza al validador determinista y este se vuelve redundante.

### Justificación
§1.2 es explícito: el modelo de amenaza NO asume malicia; se defiende de algo más básico e inevitable — el comportamiento esperado de cualquier proceso generativo probabilístico operando al límite de su distribución de confianza. Diseñar la defensa para el caso benigno la hace automáticamente efectiva contra el adversarial, porque ambos se manifiestan de la misma forma observable: una propuesta que no coincide con lo permitido. La primera opción invierte exactamente la tesis del módulo. La tercera introduce un criterio (costo del hardware) que el módulo nunca usa. La cuarta confunde la card (la declaración de hechos) con el validador (el mecanismo determinista que la hace cumplir): la card no reemplaza al validador, lo alimenta.

## Qué ES la capability card en el marco de capability-based security
type: multiple_choice

El módulo enmarca la card como una aplicación de "capability-based security" y la contrasta con las listas de control de acceso (ACL). En ese marco, ¿qué es exactamente la card, y por qué es pertinente la comparación `anon_key` vs. `service_role`?

### Opciones
- La card es una tabla central que el Bridge consulta en cada comando para decidir quién tiene permiso, igual que una ACL clásica.
- [x] La card ES la credencial misma: una declaración específica y acotada de exactamente qué acciones, con qué parámetros y en qué rangos puede este dispositivo — privilegio mínimo a nivel de esquema. Como `anon_key` (llave específica, acotada por políticas) frente a `service_role` (llave maestra que salta todo), la card nunca es un permiso genérico "controla este dispositivo", sino la credencial acotada del lado de `anon_key`.
- La card es el equivalente de `service_role`: otorga acceso irrestricto al hardware para darle al agente la máxima flexibilidad operativa.
- La card y la ACL son mecanismos idénticos; el módulo solo les cambia el nombre por motivos de estilo.

### Justificación
§2 explica que en capabilities "el permiso mismo es un objeto/token que posees, y poseerlo ES la prueba de autorización", sin consultar una tabla central en el momento de actuar. La card es esa credencial específica y acotada: privilegio mínimo aplicado al esquema de datos — declara solo lo que ESE dispositivo, en su estado actual, puede hacer con seguridad, nunca "todo lo que técnicamente el hardware podría hacer con un comando arbitrario". El módulo usa exactamente el contraste `anon_key` (acotada) vs. `service_role` (llave maestra peligrosa) como el mismo problema de diseño, y la card está del lado acotado. La opción de la ACL describe el otro paradigma (tabla central) que el módulo distingue de las capabilities; equiparar la card con `service_role` es justo lo opuesto al privilegio mínimo que la card encarna.

## Una card demasiado permisiva, con el validador funcionando perfectamente
type: multiple_choice

AutoCard genera automáticamente una card cuyo envelope para un eje es `[-360, 360]`, pero el rango físicamente seguro de ese eje es `[-120, 120]`. El validador determinista funciona sin bugs y aprueba "correctamente", según su propia lógica, un comando de 300 grados. ¿Cómo caracteriza el módulo esta situación?

### Opciones
- No es un problema: si el validador aprobó el comando siguiendo su lógica sin error, el sistema es seguro por construcción.
- [x] Es un agujero de seguridad disfrazado de mecanismo de seguridad: el validador hace cumplir a la perfección una regla incorrecta, porque la card MISMA le mintió sobre qué es seguro — exactamente como una política RLS mal configurada que permite más acceso del que debería. La corrección recae en quien GENERA la card (AutoCard), no en el validador que la consume.
- Es un problema de utilidad y no de seguridad: la card es demasiado estricta y frustra al agente al rechazar comandos legítimos.
- Es un bug del validador por no haber consultado el datasheet físico del fabricante antes de aprobar.

### Justificación
§5.2 lo dice literalmente: una card cuyo envelope es más amplio que los límites seguros reales "es, literalmente, un agujero de seguridad disfrazado de mecanismo de seguridad" — el mecanismo de enforcement funciona, pero está haciendo cumplir una regla incorrecta, análogo a una política RLS de Supabase mal configurada. "La responsabilidad de que la card sea correcta no vive en el validador — vive en quien (o lo que, en el caso de AutoCard) genera la card." La primera opción comete el error exacto que el módulo desarma: confundir "el validador funcionó" con "el sistema es seguro". La tercera describe el problema OPUESTO (demasiado restrictiva = utilidad, no seguridad). La cuarta descarga la responsabilidad en el validador, cuando el módulo la ubica de forma explícita en el generador: el validador solo compara números contra los rangos que la card declara, correctos o no.

## Traza del validador: acción válida, parámetros válidos, estado inseguro
type: trace

Trazas `validar_comando` (§4). Para `move_joint`, la card declara `requiere_estado: { "no_ejecutando_otro_comando": true, "sin_error_activo": true }`. El comando propuesto es `{"accion": "move_joint", "parametros": {"joint_id": 2, "angulo_grados": 45, "velocidad_grados_seg": 20}}` — joint permitido, ángulo dentro de `[-118, 120]`, velocidad dentro de `[1, 90]`. El estado actual reportado por `get_status()` del handler es `{"ejecutando": true, "error_activo": false}`. ¿Qué devuelve el validador?

### Opciones
- `{valido: true}` — la acción está en el vocabulario y todos los parámetros caen dentro de su envelope, así que los tres filtros pasan.
- [x] `{valido: false}` — la acción y los parámetros son válidos, pero el Filtro 3 (restricción de estado) la rechaza: `no_ejecutando_otro_comando` exige `ejecutando=false` y el dispositivo reporta `ejecutando=true`. Una acción puede estar en la lista blanca Y dentro del envelope y aun así ser insegura AHORA.
- `{valido: false}` — el ángulo 45 cae fuera del envelope `[-118, 120]`, así que el Filtro 2 lo rechaza.
- `{valido: false}` — la acción `move_joint` no está en la lista blanca de la card, así que el Filtro 1 la rechaza de inmediato.

### Justificación
§3.1 (tercera categoría) y §4 (Filtro 3) establecen que algunas acciones son inseguras no por sus parámetros sino por el MOMENTO en que se proponen — mover un eje mientras el dispositivo todavía ejecuta un comando anterior. Trazando: Filtro 1 pasa (`move_joint` sí está en `acciones_permitidas`); Filtro 2 pasa (joint_id 2 permitido, 45 ∈ [-118, 120], 20 ∈ [1, 90]); Filtro 3 falla porque `requiere_estado.no_ejecutando_otro_comando` es `true` y `estado_actual.ejecutando` es `true` → rechaza con la razón "el dispositivo ya está ejecutando otro comando". La primera opción ignora la tercera categoría por completo. La tercera es falsa: 45 sí está dentro del rango. La cuarta es falsa: `move_joint` sí está listada. Lo que se defiende: validez léxica (está en el vocabulario) más validez numérica (dentro del envelope) NO implica seguridad temporal.

## El validador determinista, fail-closed
type: code

Implementa el núcleo del validador determinista del módulo (§4): dado un `comando` propuesto por el LLM y la `card` del dispositivo, decide si el comando es válido — SIN ejecutar nada, solo comparando. Debe ser fail-closed: cualquier acción que no esté en la lista blanca de la card se rechaza; cualquier parámetro que la card declara y que falte, o cuyo valor caiga fuera de su envelope `[min, max]` (inclusivo), también se rechaza. (Card simplificada a un envelope fijo por parámetro — el `angulo_grados [-118, 120]` es el rango del joint 2 de §3.2 — para aislar el corazón del chequeo: lista blanca + envelope + presencia.)

### Especificación
validateCommand(comando, card):
- `comando` = `{ "accion": string, "parametros": { nombre: number } }` — lo que el LLM propuso.
- `card` = `{ nombreAccion: { nombreParam: [min, max] } }` — cada acción mapea al conjunto de sus parámetros; cada parámetro, a su envelope `[min, max]`; una acción sin parámetros mapea a `{}`.
- FILTRO 1: si `comando.accion` NO es una clave de `card` → devuelve `false` (lista blanca cerrada: lo no listado se rechaza por default).
- FILTRO 2: para CADA parámetro que la card declara para esa acción: si no está presente en `comando.parametros` → `false`; si su valor no cumple `min <= valor <= max` → `false`.
- Si todo pasa → `true`. (Parámetros extra en el comando que la card no declara: se ignoran, igual que en el validador de §4.)

### Firma
```javascript
function validateCommand(comando, card) {
  // tu código
}
```
```python
def validate_command(comando, card):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [{"accion": "move_joint", "parametros": {"angulo_grados": 90, "velocidad_grados_seg": 30}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": true },
  { "input": [{"accion": "move_joint", "parametros": {"angulo_grados": 200, "velocidad_grados_seg": 30}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": false },
  { "input": [{"accion": "calibrate", "parametros": {}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": false },
  { "input": [{"accion": "move_joint", "parametros": {"angulo_grados": 90}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": false },
  { "input": [{"accion": "move_joint", "parametros": {"angulo_grados": 120, "velocidad_grados_seg": 90}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": true },
  { "input": [{"accion": "stop", "parametros": {}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": true },
  { "input": [{"accion": "move_joint", "parametros": {"angulo_grados": -119, "velocidad_grados_seg": 30}}, {"move_joint": {"angulo_grados": [-118, 120], "velocidad_grados_seg": [1, 90]}, "home": {}, "stop": {}}], "expected": false }
]
```

### Solución
```javascript
function validateCommand(comando, card) {
  const accion = comando.accion;
  if (!(accion in card)) return false;
  const spec = card[accion];
  const parametros = comando.parametros || {};
  for (const nombre in spec) {
    const minimo = spec[nombre][0];
    const maximo = spec[nombre][1];
    if (!(nombre in parametros)) return false;
    const valor = parametros[nombre];
    if (!(minimo <= valor && valor <= maximo)) return false;
  }
  return true;
}
```
```python
def validate_command(comando, card):
    accion = comando["accion"]
    if accion not in card:
        return False
    spec = card[accion]
    parametros = comando.get("parametros", {})
    for nombre, envelope in spec.items():
        minimo, maximo = envelope[0], envelope[1]
        if nombre not in parametros:
            return False
        valor = parametros[nombre]
        if not (minimo <= valor <= maximo):
            return False
    return True
```

### Pistas
- El orden es fail-closed: primero rechaza si la acción no está en la card (Filtro 1), y solo entonces recorre los parámetros que la card DECLARA (no los que el comando trae).
- El envelope es inclusivo: `min <= valor <= max`. El caso frontera (120 con envelope hasta 120) debe pasar; 120.001 o -119 no.
- Un parámetro declarado por la card que falte en el comando es un rechazo, no un "se asume ok". Una acción sin parámetros (spec `{}`) no entra al lazo y pasa el Filtro 2 por vacío.
