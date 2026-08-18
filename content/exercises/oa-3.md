---
module_id: ce000000-0000-4000-8000-000000000004
spine: OA Amazon
title: Ejercicios — Two pointers + sliding window
kind: exercises
languages: [javascript, python]
generated_by: Claude (anclado al libro oa-3-two-pointers-sliding.md)
version: 1
---

# Two pointers y sliding window bajo el reloj del OA

Banco del nodo oa-3: entrena el reflejo específico del examen — destapar la palabra «contiguo/consecutivo» detrás de una historia de envíos o inventarios, elegir entre ventana fija, variable y extremos opuestos en segundos, y sobre todo OLER cuándo el problema PARECE sliding window pero la condición no es monótona (y qué hacer en ese caso exacto, que es lo que separa pasar el ejemplo de pasar el juez). Estos drills se validan LOCALMENTE contra casos unitarios; no son el examen — el juez real es el OA de Amazon. Cada ejercicio lleva meta de tiempo porque el OA es cronometrado: la meta es parte del drill.

## La racha de días que se esconde en la historia
type: multiple_choice
tiempo: 3

Un centro de distribución registra cuántos paquetes procesó cada día durante n días (n hasta 2·10^5; valores no negativos). Operaciones pregunta: ¿cuál fue la racha más larga de días CONSECUTIVOS en que el total acumulado de la racha se mantuvo dentro del presupuesto de horas-hombre B? ¿Qué palabra del enunciado decide el patrón, y cuál es el patrón?

### Opciones
- [x] «Consecutivos» (= contiguo) + «la racha más larga que cumple una restricción acumulativa»: ventana variable — expandes con el for, contraes con while mientras el acumulado exceda B, y los valores no negativos garantizan la monotonía que la plantilla necesita. La historia de negocio (paquetes, presupuesto, operaciones) es el disfraz; la palabra que dispara el reflejo es CONSECUTIVOS, y debe saltar antes de terminar de leer el enunciado.
- «Presupuesto»: todo problema con un tope de recurso es binary search sobre la respuesta — binarizas B y verificas cada candidato con una pasada.
- «Total acumulado»: prefix sums + hash map, la familia estándar de las sumas de subarreglos.
- «Racha más larga»: ordenar los días por paquetes procesados de menor a mayor y tomar el prefijo más largo cuya suma quepa en B.
### Justificación
Es la señal número uno del libro para el OA: las historias de Amazon disfrazan «subarreglo contiguo» de rachas de días, rangos de paquetes o bloques de horas, y la palabra clave real detrás de la historia siempre es contiguo/consecutivo — detectarla debe tomar segundos. Binarizar B no tiene sentido: B está DADO, no es lo que se busca, así que no hay espacio de respuestas que bisecar. Prefix sums + hash map es la familia de la suma EXACTA (donde los negativos rompen la ventana); aquí piden «la más larga con suma acotada» sobre no-negativos, que es exactamente la ventana variable directa. Y ordenar los días DESTRUYE la consecutividad: la racha vive en el calendario, no en un subconjunto reordenado — ese distractor responde otra pregunta.

## Bloque de exactamente K lecturas
type: multiple_choice
tiempo: 3

Panel de monitoreo de una banda transportadora: dado el número de escaneos por minuto de las últimas n lecturas (n hasta 10^6), reporta el máximo total de escaneos en cualquier bloque de exactamente K lecturas consecutivas (K dado, hasta 10^5). ¿Cuál es la jugada y por qué las otras truenan?

### Opciones
- [x] Ventana FIJA de tamaño K: calcula la suma del primer bloque una vez y desplázala una posición a la vez — resta la lectura que sale, suma la que entra — para un total O(n). «Bloque de exactamente K consecutivos» es la señal de la fija: el tamaño lo fija el enunciado, no una condición que se viola y se restaura.
- Ventana variable: expande mientras la suma crezca y contrae cuando deje de crecer, quedándote con el mejor tramo.
- Recalcular la suma de cada bloque desde cero: son K sumas por posición, O(n·K), y con estos límites eso pasa holgado cualquier límite de tiempo.
- La única forma O(n) es construir el arreglo de prefix sums; una ventana que desplaza no puede lograr O(n) porque cada desplazamiento toca K elementos.
### Justificación
El repaso de reflejo del libro lo da en una línea: ventana fija = desplaza un elemento a la vez, resta el que sale, suma el que entra — y su señal es «ventana de tamaño K» explícito. La variable no aplica: no hay condición de validez que contraer (el tamaño está FIJO), y «contraer cuando la suma deje de crecer» ni siquiera es la regla de la variable — es una invención que descarta bloques válidos. Recalcular desde cero es O(n·K) = 10^11 operaciones con estos límites: muerto contra cualquier presupuesto de OA, y es la pereza exacta que el desplazamiento elimina haciendo el mismo trabajo en O(n). Y el último distractor es falso en su premisa: el desplazamiento toca DOS elementos por paso (el que sale y el que entra), no K — prefix sums también resuelve, pero no es «la única forma» ni la ventana es incapaz de O(n).

## Tres productos y una tarjeta de regalo
type: multiple_choice
tiempo: 3

Una tarjeta de regalo tiene saldo S. El catálogo, YA ORDENADO por precio ascendente, tiene n = 5,000 productos. ¿Existen TRES productos distintos cuyos precios sumen exactamente S? ¿Qué patrón resuelve esto dentro del presupuesto de un OA?

### Opciones
- [x] Un bucle externo que FIJA el primer producto + two pointers de extremos opuestos sobre el resto: para cada i buscas en el tramo posterior un par que sume S − precio[i], avanzando izq si la suma queda corta y retrocediendo der si se pasa — O(n²) total (~2.5·10^7 con n = 5,000), y el orden ya dado te ahorra el sort. Es la composición que el libro nombra: tres que suman X = fija uno, aplica two pointers sobre el resto.
- Ventana deslizante de tamaño 3: los «tres productos» son una ventana contigua que deslizas por el catálogo completo.
- Triple bucle anidado probando todas las combinaciones de tres productos.
- Mover tres punteros a la vez desde posiciones equidistantes, acercándolos coordinadamente según la suma quede corta o pasada.
### Justificación
La señal del libro es literal: arreglo ordenado + «par/tripleta cuya suma…» → extremos opuestos, frecuentemente con un bucle externo que fija el primer elemento de la tripleta. La ventana de tamaño 3 confunde elegir tres productos LIBRES con un tramo CONTIGUO: nada obliga a que los tres sean vecinos en el catálogo, y la contigüidad es justo el requisito que aquí no existe. El triple bucle son n³ = 1.25·10^11 combinaciones — muerto por tiempo bajo cualquier límite, e ignora el orden gratis que el catálogo ya trae. Y los «tres punteros coordinados» no existen como técnica: el argumento de descarte seguro de extremos opuestos (si la suma queda corta, el menor ya agotó su mejor pareja) es un argumento de a DOS — por eso el patrón real reduce la tripleta a pares fijando uno.

## Presupuesto de K correcciones sobre la banda
type: multiple_choice
tiempo: 4

Control de calidad: la banda registró una secuencia de escaneos, cada uno «ok» o «fallo». Puedes CORREGIR (re-escanear) a lo más K fallos. ¿Cuál es la racha contigua más larga de puros «ok» que puedes lograr? Un compañero duda: «esto huele a la trampa del libro, la condición con frecuencias… ¿la ventana directa aquí es válida?»

### Opciones
- [x] Sí es válida: la validez de la ventana es UNA sola desigualdad sobre UN acumulador — «fallos dentro de la ventana ≤ K» — y expandir solo puede mantener o subir ese contador, así que «contrae con while mientras fallos > K» tiene un disparador bien definido. Es exactamente la forma monótona que la plantilla exige, con el presupuesto K como umbral fijo; la trampa del libro es para condiciones de VARIOS umbrales independientes, no para esta.
- No: igual que en «cada carácter aparece al menos K veces», hay que iterar una dimensión fija (número de valores distintos permitidos) y correr una ventana completa por cada valor.
- No: «corregir fallos» modifica el arreglo, y la ventana deslizante solo funciona sobre datos que no cambian durante el barrido.
- Sí, pero con ventana FIJA de tamaño K, desplazándola y contando fallos dentro de cada bloque.
### Justificación
El criterio que el libro deja para distinguir es preciso: la plantilla directa se rompe cuando la validez «no es una desigualdad simple sobre un acumulador» sino que depende de múltiples umbrales simultáneos, cada uno con el suyo. Aquí hay UN contador (fallos en la ventana) contra UN umbral (K): monotonía intacta, ventana directa. Aplicar el rodeo de fijar la dimensión donde no toca no da mal — da LENTO y quema minutos del examen implementando 26 pasadas donde bastaba una. Lo de «modificar el arreglo» es una confusión: no escribes nada — cuentas cuántos fallos CONTIENE la ventana y exiges que no pasen del presupuesto; la corrección es contable, no un write. Y la ventana fija confunde el ROL de K: es el presupuesto de correcciones, no el tamaño del bloque — el clásico misread de lectura apurada que el OA castiga con casos ocultos.

## Cada tipo al menos K veces — la plantilla que casi funciona
type: multiple_choice
tiempo: 4

Análisis de pedidos: encuentra el tramo contiguo más largo del historial en que CADA tipo de producto que aparezca en el tramo aparezca al menos K veces. Un compañero teclea la ventana variable estándar («contrae mientras la ventana sea inválida»), pasa el ejemplo del enunciado, y falla los casos ocultos. ¿Diagnóstico de raíz y salida?

### Opciones
- [x] La condición no es monótona: al expandir puede entrar un tipo nuevo que aún no llega a K (invalida la ventana) mientras los demás siguen cumpliendo — la validez depende de VARIOS umbrales independientes a la vez, así que «contrae mientras se viole» no tiene un disparador bien definido. La salida del libro: FIJA la dimensión pequeña y acotada — itera d = número de tipos distintos permitidos (de 1 al total de distintos) y corre ventana clásica para cada d fijo, donde contraer «mientras haya más de d distintos» SÍ vuelve a ser monótono.
- Es un off-by-one: midiendo la ventana con der − izq + 1 en vez de der − izq, los casos ocultos pasan.
- Faltó el hash map de conteo dentro de la ventana; agregándolo, la contracción estándar ya decide correctamente cuándo encoger.
- Hay que contraer con un solo if en vez de while, para no pasarse de contracción cuando entra un tipo nuevo.
### Justificación
Es la sección central del libro, y el síntoma es su firma: la plantilla mal aplicada no da error de sintaxis — «casi» funciona en el ejemplo pequeño y falla silenciosamente donde la falta de monotonía importa. Con umbrales por-tipo, ni expandir ni contraer mueve la validez en una sola dirección, y la lógica «contrae mientras se viole» pierde el piso; fijar d restaura la monotonía porque «más de d distintos» sí es una desigualdad simple, y el costo total sigue lineal por ser d acotado. El off-by-one es cosmético: no explica estructuralmente que el ejemplo pase y los ocultos no. El hash map de conteo es NECESARIO pero no suficiente — con los conteos a la vista sigues sin saber si contraer te acerca o te aleja de la validez; el defecto es de diseño, no de instrumentación. Y el if en vez de while es la trampa opuesta (contracción incompleta): ninguna de las dos variantes fabrica una monotonía que el problema no tiene.

## Los últimos 30 segundos antes del submit
type: multiple_choice
tiempo: 2

Quedan 18 minutos del OA. Tu solución de ventana deslizante pasa el ejemplo del enunciado al primer intento. Antes de enviar, ¿cuál es la verificación de mayor valor por segundo invertido?

### Opciones
- [x] Un contraejemplo mental de 2-3 elementos dirigido a la MONOTONÍA: ¿la validez de la ventana es una sola desigualdad sobre un acumulador, o al expandir puede entrar un elemento que introduce un umbral aún no cumplido y la vuelve inválida «por otro lado»? Si la condición no es monótona, la plantilla entera está mal aplicada y ningún ajuste de índices la salva — es la trampa que pasa el ejemplo y falla el juez, y 30 segundos de contraejemplo la detectan antes del submit.
- Volver a correr el ejemplo del enunciado dos veces más, para confirmar que el resultado es estable.
- Reescribir la solución con otro enfoque y comparar las dos salidas sobre el ejemplo antes de enviar.
- Revisar únicamente el off-by-one del tamaño (der − izq + 1): si ese detalle está bien, el resto del diseño es correcto.
### Justificación
El libro lo ordena casi literal: antes de comprometerte con la plantilla estándar, verifica explícitamente, con un contraejemplo mental de dos o tres elementos, si la condición realmente es monótona — porque «casi funciona en el ejemplo» no es «es correcto»: el ejemplo del enunciado puede pasar por casualidad justo cuando el diseño está mal. Repetir el mismo ejemplo no agrega información nueva: determinista entra, determinista sale. Reescribir un segundo enfoque quema los 18 minutos restantes, y si ambos parten del mismo diseño equivocado coinciden en el mismo error. Y el off-by-one es la trampa BARATA (cuesta un vistazo); la cara es la conceptual — aplicar ventana sin monotonía — que ningún vistazo al + 1 detecta: por eso el contraejemplo de monotonía es el mejor gasto de esos 30 segundos.

## Veintiséis pasadas no son un cuadrático
type: complexity
tiempo: 3

Para el problema de «cada carácter presente aparece al menos K veces» adoptas la salida del libro: iterar d = 1..26 (tipos distintos permitidos, alfabeto minúsculo) y correr una ventana deslizante completa para cada d fijo. Con n = 2·10^5, ¿cuál es el costo real y el veredicto para el OA?

### Opciones
- [x] O(26·n) = O(n) en la práctica: la dimensión fijada es el tamaño del ALFABETO, una constante acotada que no crece con n, y cada una de las 26 pasadas es lineal por el argumento amortizado de la ventana — izq nunca retrocede, así que por pasada cada índice entra una vez y sale a lo más una vez (≤ 2n movimientos de punteros). Total ~5·10^6 operaciones: holgado. La jugada entera depende de que la dimensión fijada sea pequeña y acotada; fijar una que creciera con n degeneraría el truco.
- O(n²): dos bucles anidados (d afuera, el barrido adentro) siempre multiplican sus rangos, y con 2·10^5 eso revienta el presupuesto.
- O(2^26): hay que probar cada subconjunto posible de caracteres permitidos dentro de la ventana.
- O(n log n): iterar d equivale a una búsqueda binaria sobre el número de caracteres distintos, que es logarítmica.
### Justificación
El libro cierra su sección con exactamente esta cuenta: 26 × O(n) = O(n) en la práctica, porque el alfabeto es constante — y la eficiencia de cada pasada descansa en que los punteros solo avanzan (el trabajo del while acumulado en toda una pasada está acotado por el avance total de izq, no por «n por cada der»). El O(n²) aplica la regla escolar de «anidado multiplica» sin mirar el rango del bucle externo: es 26, constante del alfabeto, no n. El O(2^26) confunde fijar el NÚMERO de distintos con fijar CUÁLES: por eso son 26 valores de d, no 2^26 subconjuntos — esa distinción es el corazón del truco. Y no hay búsqueda binaria posible sobre d: el mejor tramo puede aparecer con cualquier número de distintos (no hay monotonía en d que permita descartar mitades), así que se BARRE la dimensión completa — que es barato justamente porque es chica.

## El acumulador que resta al elemento equivocado
type: trace
tiempo: 4

Este código busca la racha contigua más larga con suma menor o igual a `limite` sobre lecturas no negativas, pero al contraer mueve el índice ANTES de actualizar el acumulador:

```python
izq = 0
suma = 0
mejor = 0
for der in range(len(a)):
    suma += a[der]
    while suma > limite:
        izq += 1          # BUG: primero mueve el indice...
        suma -= a[izq]    # ...y luego resta -- el orden correcto es el inverso
    mejor = max(mejor, der - izq + 1)
```

Con `a = [4, 1, 1]` y `limite = 2`, ¿qué ocurre?

### Opciones
- [x] La resta usa el izq YA incrementado: expulsa de la suma un elemento que SIGUE dentro de la ventana y jamás descuenta el que salió (a[0] = 4 nunca se resta — en der = 0 el while resta a[1] y a[2]). En der = 1 el while empuja izq hasta 3 y lee a[3], fuera del arreglo: en Python revienta con IndexError; en JavaScript a[3] es undefined, la suma se vuelve NaN y el while SALE como si nada — estado corrupto sin ningún error visible. El orden correcto es actualizar el acumulador primero (restar a[izq]) y mover el índice después.
- Da lo mismo: restar antes o después de incrementar solo cambia el orden de dos líneas independientes, no el resultado.
- El único efecto es que la ventana queda un elemento más corta de lo debido; el resultado final no cambia.
- El while se vuelve infinito porque la suma nunca baja.
### Justificación
Verificado a mano: en der = 0, suma = 4 dispara el while — izq pasa a 1 y se resta a[1] = 1 (suma 3), izq pasa a 2 y se resta a[2] = 1 (suma 2) — el 4 que causó la violación sigue «dentro» según los índices pero ya no según la suma. En der = 1, suma = 3 dispara otra vez: izq = 3 y a[3] no existe — IndexError en Python; en JavaScript undefined convierte la suma en NaN, toda comparación con NaN es falsa, el while sale y el programa TERMINA reportando un mejor corrupto. Es la trampa que el libro enuncia con su cura exacta: actualiza el acumulador, después mueve el índice, siempre en ese orden. No son «líneas independientes»: intercambiarlas cambia QUÉ elemento se resta. No es «un elemento más corta»: la suma deja de corresponder al contenido y el índice se sale del arreglo. Y no hay bucle infinito: la suma sí baja (resta elementos, solo que los equivocados) — el modo de fallo es reventar o corromperse en silencio, que es peor.

## La racha sin lecturas repetidas
type: code
tiempo: 15

Deduplicación en línea: una banda escanea etiquetas y quieres la racha contigua más larga SIN etiquetas repetidas (cada etiqueta es un carácter de un string). Es la combinación que el libro marca como la más común del OA: ventana variable + conteo de lo que hay dentro — expandes siempre, y cuando el carácter entrante ya está en la ventana, contraes desde la izquierda hasta expulsar su duplicado. Drill validado localmente contra casos unitarios; el juez real es el OA.

### Especificación
`ventanaSinRepetidos(s)`:
- `s` es un string (puede incluir espacios y símbolos; sensible a mayúsculas: `a` y `A` son etiquetas distintas).
- Devuelve la LONGITUD (entero) del substring contiguo más largo sin caracteres repetidos.
- Bordes exactos: string vacío → `0`; un solo carácter → `1`; todos los caracteres iguales → `1`.

### Firma
```javascript
function ventanaSinRepetidos(s) {
  // TODO: set/conteo de lo que hay dentro; while el entrante ya este, expulsa desde izq
  return 0;
}
```
```python
def ventana_sin_repetidos(s):
    # TODO: set/conteo de lo que hay dentro; while el entrante ya este, expulsa desde izq
    return 0
```

### Casos
```json
[
  { "input": ["abcabcbb"], "expected": 3, "hint": true },
  { "input": [""], "expected": 0 },
  { "input": ["z"], "expected": 1 },
  { "input": ["aaaaa"], "expected": 1 },
  { "input": ["pwwkew"], "expected": 3 },
  { "input": ["abba"], "expected": 2 },
  { "input": ["au"], "expected": 2 },
  { "input": ["dvdf"], "expected": 3 }
]
```

### Solución
```javascript
function ventanaSinRepetidos(s) {
  let izq = 0, mejor = 0;
  const dentro = new Set();
  for (let der = 0; der < s.length; der++) {
    while (dentro.has(s[der])) {   // el entrante ya esta: expulsa desde la izquierda
      dentro.delete(s[izq]);       // actualiza el estado ANTES de mover el indice
      izq++;
    }
    dentro.add(s[der]);
    mejor = Math.max(mejor, der - izq + 1);
  }
  return mejor;
}
```
```python
def ventana_sin_repetidos(s):
    izq = 0
    mejor = 0
    dentro = set()
    for der in range(len(s)):
        while s[der] in dentro:      # el entrante ya esta: expulsa desde la izquierda
            dentro.discard(s[izq])   # actualiza el estado ANTES de mover el indice
            izq += 1
        dentro.add(s[der])
        mejor = max(mejor, der - izq + 1)
    return mejor
```

### Pistas
- La condición de contracción es «el carácter que INTENTA entrar ya está dentro» — se contrae ANTES de agregarlo, y con while, no con if: expulsar el duplicado puede requerir varios pasos.
- El orden dentro del while es la trampa del banco anterior a este drill: primero `dentro.discard(s[izq])` (o delete), después `izq += 1`. Al revés, expulsas al equivocado.
- Caso que delata media implementación: `abba` debe dar 2 — al entrar la segunda `a`, izq ya avanzó más allá de la primera; si tu ventana «retrocede» para recuperarla, la monotonía se rompió y el resultado sale 3.

## El pedido urgente más corto que junta la meta
type: code
tiempo: 15

Surtido urgente: recorres la fila de contenedores en orden; cada uno aporta `nums[i]` unidades (enteros POSITIVOS). Necesitas el tramo CONTIGUO más corto cuya suma alcance la meta. Es la ventana variable en su dirección «mínima»: la ventana VÁLIDA se mide y luego se ENCOGE buscando una más corta — el while procesa mientras la ventana siga válida, al revés del drill anterior. Drill validado localmente contra casos unitarios; el juez real es el OA.

### Especificación
`menorVentanaConSuma(nums, objetivo)`:
- `nums` es un arreglo de enteros POSITIVOS (cada uno ≥ 1); `objetivo` es un entero ≥ 1.
- Devuelve la LONGITUD MÍNIMA de un subarreglo contiguo con suma ≥ `objetivo`.
- Contrato de imposible, EXACTO: si ningún subarreglo alcanza (la suma total queda corta) o `nums` está vacío, devuelve `-1`. OJO de examen: otros enunciados de este mismo clásico devuelven 0 — aquí el contrato es -1; en el OA el centinela lo fija el enunciado que tienes enfrente, no tu memoria de otro juez.
- Valores hasta 10^9 y sumas hasta ~10^14: enteros siempre (caben exactos en el número de JS, < 2^53).

### Firma
```javascript
function menorVentanaConSuma(nums, objetivo) {
  // TODO: expande siempre; while la ventana sea VALIDA (suma >= objetivo): mide y encoge
  return 0;
}
```
```python
def menor_ventana_con_suma(nums, objetivo):
    # TODO: expande siempre; while la ventana sea VALIDA (suma >= objetivo): mide y encoge
    return 0
```

### Casos
```json
[
  { "input": [[2, 3, 1, 2, 4, 3], 7], "expected": 2, "hint": true },
  { "input": [[1, 4, 4], 4], "expected": 1 },
  { "input": [[1, 1, 1, 1], 10], "expected": -1 },
  { "input": [[], 5], "expected": -1 },
  { "input": [[5], 5], "expected": 1 },
  { "input": [[1, 2, 3, 4, 5], 15], "expected": 5 },
  { "input": [[1, 2, 3, 4, 5], 11], "expected": 3 },
  { "input": [[1000000000, 1000000000, 1000000000], 3000000000], "expected": 3 }
]
```

### Solución
```javascript
function menorVentanaConSuma(nums, objetivo) {
  let izq = 0, suma = 0, mejor = Infinity;
  for (let der = 0; der < nums.length; der++) {
    suma += nums[der];
    while (suma >= objetivo) {                  // ventana VALIDA: mide y trata de encogerla
      mejor = Math.min(mejor, der - izq + 1);
      suma -= nums[izq];                        // acumulador primero...
      izq++;                                    // ...indice despues
    }
  }
  return mejor === Infinity ? -1 : mejor;
}
```
```python
def menor_ventana_con_suma(nums, objetivo):
    izq = 0
    suma = 0
    mejor = float("inf")
    for der in range(len(nums)):
        suma += nums[der]
        while suma >= objetivo:                 # ventana VALIDA: mide y trata de encogerla
            mejor = min(mejor, der - izq + 1)
            suma -= nums[izq]                   # acumulador primero...
            izq += 1                            # ...indice despues
    return -1 if mejor == float("inf") else mejor
```

### Pistas
- Aquí la dirección se invierte respecto de «la más larga»: se mide DENTRO del while (cuando la ventana es válida) y se encoge para buscar una más corta — los positivos garantizan que encoger solo puede bajar la suma, que es la monotonía de esta variante.
- Arranca `mejor` en infinito y tradúcelo a -1 solo al final: mezclar el centinela con las comparaciones de mínimo es la fuente clásica de un -1 que «gana» un min.
- Relee tu propia Especificación antes del submit: ¿este enunciado pide 0 o -1 para el imposible? Los casos de borde del juez existen exactamente para cobrar esa línea.

## El árbol de decisión completo, de memoria
type: production
tiempo: 5

Sin mirar el libro, escribe tu árbol de decisión de 30 segundos para un enunciado del OA que «huele a ventana o dos punteros»: las preguntas EN ORDEN, qué respuesta manda a qué plantilla, y el paso de verificación previo a teclear. Debe cubrir la palabra disfrazada, fija contra variable, extremos opuestos, y la condición no monótona con su salida.

### Modelo
1. ¿La pregunta es sobre un tramo CONTIGUO/consecutivo, aunque la historia diga «racha de días», «rango de paquetes» o «bloque de horas»? Si no hay contigüidad — pares o tripletas elegidas libremente — la ventana queda descartada: arreglo ordenado + par/tripleta que suma → extremos opuestos (con bucle externo que fija el primero si son tres).
2. ¿El tamaño del tramo lo FIJA el enunciado («exactamente K»)? → ventana fija: desplaza, resta el que sale, suma el que entra. ¿Piden «el más largo/corto que cumple»? → ventana variable: expandir con for, contraer con while (nunca if).
3. ¿La validez de la ventana es UNA desigualdad sobre UN acumulador (suma ≤ B, fallos ≤ K, «sin repetidos» vía conteo del entrante)? → plantilla directa. ¿Depende de VARIOS umbrales independientes a la vez (cada tipo presente al menos K veces)? → no hay monotonía: fija la dimensión pequeña y acotada (número de distintos permitidos) e itera la ventana clásica para cada valor fijo.
4. Antes de teclear: contraejemplo mental de 2-3 elementos contra la monotonía — ¿expandir puede volver la ventana inválida por un umbral nuevo mientras otro se mantiene, sin disparador claro de contracción? Si sí, regresa al paso 3: la plantilla directa está mal aplicada aunque pase el ejemplo.

### Regla
El árbol existe porque la trampa cara del OA no es de sintaxis sino de diseño: la plantilla directa aplicada sin monotonía pasa el ejemplo del enunciado y falla el juez en silencio. Cada bifurcación descarta una familia entera en segundos — contigüidad descarta pares; «exactamente K» descarta la variable; un solo acumulador descarta el rodeo de fijar dimensión — y el contraejemplo final es el seguro contra el «casi funciona», que cuesta 30 segundos contra los 15 minutos de una solución condenada.

### Rúbrica
- La primera pregunta del árbol es la CONTIGÜIDAD detrás de la historia de negocio, no la técnica.
- Distingue fija («exactamente K») de variable («el más largo/corto que cumple») por el texto del enunciado, y la variable contrae con while.
- El criterio de monotonía está formulado como «una desigualdad sobre un acumulador» contra «varios umbrales independientes», con la salida de fijar la dimensión acotada para el segundo caso.
- Cierra con el contraejemplo mental de 2-3 elementos ANTES de comprometerse con la plantilla.
- Lo escribiste completo, de memoria, en 5 minutos o menos.
