---
module_id: itc-c3-hashing
spine: ITC
title: "Hashing y tablas hash"
subtitle: "Cómo se compra el tiempo constante y qué se paga por él"
source_canonical: "MIT 6.006 L4; CLRS cap. 11"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Hashing y tablas hash

> **Pregunta raíz.** Un array ordenado con búsqueda binaria ya te da O(log n) — con un millón de elementos, eso son ~20 comparaciones. Es rápido. Entonces, ¿por qué querrías algo mejor, y qué tendrías que sacrificar para conseguir O(1) — buscar sin importar cuántos elementos haya? La respuesta corta: sacrificas la garantía de peor caso a cambio de velocidad esperada, y esa transacción — velocidad garantizada vs. velocidad probable — es la tensión que define todo este módulo.

## Prólogo — de dónde nace esto

Piensa en una biblioteca con un millón de libros. Si los libros están ordenados alfabéticamente por autor, encontrar uno te toma "dividir a la mitad" repetidamente — búsqueda binaria, O(log n), unos 20 pasos. Rápido, pero no instantáneo: cada paso implica ir físicamente a otro punto del estante.

Ahora imagina otro sistema: cada libro tiene una **regla mecánica** que, dado el nombre del autor, te dice exactamente en qué estante y qué repisa está — sin buscar, sin comparar, solo calculas. "García Márquez" siempre va al estante 47, repisa 3. Aplicas la regla, caminas directo. Eso es O(1): no *buscas*, *calculas* la ubicación.

El problema es obvio en cuanto lo piensas dos segundos: **hay más autores posibles de los que caben estantes**. Millones de combinaciones de nombres posibles, pero tu biblioteca solo tiene, digamos, 10,000 repisas. La regla mecánica *tiene* que mapear muchísimos autores distintos a la misma repisa — es matemáticamente inevitable. Cuando eso pasa, dos libros de autores distintos "quieren" la misma repisa. Eso es una **colisión**, y cómo la resuelvas determina si tu sistema mantiene su promesa de O(1) o degenera silenciosamente en algo mucho peor.

Esa es la estructura completa del módulo en una imagen: la regla mecánica es la **función hash**, la repisa es el **slot** de la tabla, y el resto de este texto es la deducción rigurosa de cómo diseñar esa regla, qué hacer cuando colisiona (porque *va a* colisionar), y bajo qué condiciones el sistema completo se rompe.

---

## 1. El problema que resuelve: por qué el direccionamiento directo no escala

### 1.1 El caso ideal (y por qué es ideal solo en teoría)

Supón que tus claves son enteros pequeños: `0, 1, 2, ..., m-1`. Puedes usar **direccionamiento directo**: un array `T` de tamaño `m`, donde `T[k]` guarda directamente el elemento con clave `k`. Insertar, buscar, eliminar: todos O(1) puro, sin ambigüedad, sin colisión posible — porque cada clave tiene su slot exclusivo y dedicado.

¿Por qué esto no es la solución universal? Porque exige reservar un array de tamaño `m` = **el tamaño de todo el universo de claves posibles**, no el tamaño de los datos que realmente vas a guardar. Si tus claves son strings arbitrarios (nombres de usuario, URLs, direcciones de correo), el universo de claves posibles es astronómicamente más grande que cualquier cantidad de memoria que tengas — no hay array que puedas reservar. Si tus claves son números de 64 bits, el universo tiene 2⁶⁴ ≈ 1.8×10¹⁹ posibles valores, aunque solo vayas a guardar, digamos, 10,000 elementos reales. Reservar un array de ese tamaño para guardar 10,000 cosas es un desperdicio de memoria de proporciones absurdas — es como construir una biblioteca con una repisa para *cada libro que jamás podría existir*, para guardar solo mil libros reales.

**La necesidad que esto genera**: queremos mantener la velocidad O(1) del direccionamiento directo, pero usando un array de tamaño proporcional a **cuántos elementos realmente guardamos** (n), no al tamaño del universo de claves posibles (que puede ser inmenso o incluso infinito, como el conjunto de todos los strings posibles).

### 1.2 La función hash como puente entre universo gigante y tabla pequeña

La solución: una función `h: U → {0, 1, ..., m-1}` que toma cualquier clave del universo `U` (potencialmente gigante) y la mapea a un índice dentro de una tabla de tamaño `m` (chica, proporcional a n, no a |U|). Esto es exactamente la "regla mecánica" de la biblioteca: toma el nombre del autor (universo gigante de strings posibles) y produce un número de repisa (tabla chica).

Con esto, guardas el elemento de clave `k` en `T[h(k)]`. Buscar `k` es: calcular `h(k)` (operación aritmética, O(1) si la función hash es O(1) de calcular) y acceder a `T[h(k)]` (O(1), aritmética de direcciones — el mismo mecanismo del módulo anterior sobre arrays). Si no hubiera colisiones, tendrías O(1) puro, sin condiciones.

**Pero por construcción, va a haber colisiones** — y aquí es donde el módulo se pone interesante, porque esa inevitabilidad no es un defecto de diseño, es una consecuencia matemática ineludible que hay que probar, no asumir.

---

## 2. Colisiones — deducidas como inevitabilidad matemática, no como mala suerte

### 2.1 El pigeonhole principle (principio del palomar)

Enunciado trivial pero de consecuencias profundas: **si metes más de m objetos en m casillas, al menos una casilla tiene más de un objeto.** No es una probabilidad, es una certeza lógica — no hay forma de evitarlo con ningún truco de asignación.

Aplicado aquí: si el universo de claves `U` tiene más de `m` elementos posibles (que es *siempre* el caso cuando |U| >> m, como en nuestro escenario), entonces **cualquier función hash h: U → {0,...,m-1}, sin excepción, tiene garantizado que existen al menos dos claves distintas k₁ ≠ k₂ tales que h(k₁) = h(k₂)**. No existe ninguna función hash — por más inteligente, por más "aleatoria" que parezca — que evite esto si el dominio es más grande que el codominio. Esto hay que interiorizarlo bien: **la colisión no es un bug de una mala función hash — es una propiedad matemática inevitable de cualquier función hash**, dado que mapeamos un conjunto grande a uno chico. Lo único que una buena función hash puede controlar es *qué tan frecuentes* son las colisiones en la práctica, nunca eliminarlas en principio.

### 2.2 La paradoja del cumpleaños — por qué las colisiones llegan MUCHO antes de lo que la intuición dice

Aquí es donde la intuición ingenua falla de forma dramática, y vale la pena deducirlo con números, no solo enunciarlo.

Pregunta: en un salón de 23 personas, ¿cuál es la probabilidad de que dos compartan cumpleaños (de 365 posibles)? La intuición dice "baja, hay 365 días y solo 23 personas, ¿por qué colisionarían?". La respuesta real es **>50%**. Con 70 personas, la probabilidad supera el 99.9%.

La deducción: es más fácil calcular la probabilidad de que **no** haya colisión, y restarla de 1. La primera persona "ocupa" un día libremente (probabilidad 365/365). La segunda debe evitar ese día (364/365). La tercera debe evitar los dos anteriores (363/365). Y así sucesivamente:

```
P(sin colisión con k personas) = (365/365) × (364/365) × (363/365) × ... × ((365-k+1)/365)
```

Con k=23, este producto cae por debajo de 0.5 — es decir, P(colisión) > 0.5. El motivo intuitivo de por qué esto sorprende: no estamos preguntando "¿alguien comparte cumpleaños **conmigo**?" (eso sí sería raro con solo 23 personas) — estamos preguntando "¿existe **algún par** entre las 23 personas que coincida?", y el número de **pares posibles** crece como C(k,2) = k(k-1)/2, es decir, **cuadráticamente** con k, no linealmente. Con 23 personas hay 253 pares posibles comparando entre sí — y cada par tiene una oportunidad independiente de colisionar.

**Traducido a tablas hash**: si tienes una tabla de tamaño m y empiezas a insertar claves con una función hash "aleatoria" (uniforme), **no necesitas insertar cerca de m elementos para empezar a ver colisiones — las empiezas a ver con aproximadamente √m elementos**, por la misma matemática cuadrática de pares. Esto es una trampa de intuición constante: alguien asume "mi tabla tiene 1,000,000 de slots y solo tengo 1,000 elementos, seguro no hay colisiones" — y se equivoca, porque el número relevante de comparaciones de pares crece como (1000)²/2 ≈ 500,000, comparado contra 1,000,000 de slots, dando una probabilidad de colisión nada despreciable. Esta es exactamente la razón matemática detrás de los **ataques de "birthday attack"** en criptografía (tangente que retomamos en Conexiones).

### 2.3 Consecuencia de diseño: la colisión no se evita, se **gestiona**

Dado que 2.1 prueba que las colisiones son inevitables y 2.2 prueba que llegan antes de lo esperado, el diseño de una tabla hash **tiene** que incluir, desde el día uno, un mecanismo explícito de resolución de colisiones — no es un "extra" opcional, es un requisito estructural. Hay dos familias de solución, y las vamos a deducir por separado.

---

## 3. Qué hace a una función hash BUENA — uniformidad, deducida desde el porqué

Antes de resolver colisiones, hay que preguntar: ¿qué controla *cuántas* colisiones tienes? La respuesta es la calidad de la función hash. Pero "calidad" necesita definición rigurosa.

### 3.1 El supuesto de hashing uniforme simple (Simple Uniform Hashing)

CLRS define la propiedad deseada: **cada clave tiene la misma probabilidad de mapear a cualquiera de los m slots, independientemente de a dónde mapean las demás claves.** Formalmente, para cualquier clave k, P(h(k) = j) = 1/m para cada slot j.

¿Por qué esta propiedad es exactamente lo que quieres? Porque si se cumple, la distribución de claves entre slots se comporta como el experimento de lanzar n pelotas a m cajas al azar — el mejor comportamiento posible dado que las colisiones son inevitables (sección 2). Bajo este supuesto, se puede probar (CLRS 11.2) que el número esperado de elementos por slot es n/m — el **factor de carga** α = n/m — y que las operaciones de búsqueda tardan, en promedio, O(1 + α). Si mantienes α = O(1) (es decir, m crece proporcionalmente a n), obtienes O(1) esperado. Esa es la promesa completa del hashing: **no** es una garantía de peor caso, es una garantía **esperada bajo el supuesto de uniformidad**.

### 3.2 Por qué una función hash "obvia" puede ser mala

Ejemplo clásico de mala función hash: `h(k) = k mod m` donde `m` es una potencia de 2 y las claves tienden a ser números pares (o múltiplos de alguna potencia de 2, algo común en direcciones de memoria o IDs generados por ciertos sistemas). Si m = 2^p, `k mod m` solo depende de los **p bits menos significativos** de k — ignora completamente el resto de los bits. Si tus claves tienen patrones en esos bits bajos (común en la práctica: IDs secuenciales, direcciones alineadas), terminas con colisiones masivas concentradas en pocos slots, mientras otros slots quedan vacíos — exactamente lo opuesto a la uniformidad que queríamos.

**La lección de diseño**: `mod` con un número primo, no con una potencia de 2, suele distribuir mejor porque no favorece ningún patrón de bits específico de las claves. Esta es la razón práctica (no arbitraria) de por qué muchas implementaciones de tablas hash usan tamaños primos o funciones más sofisticadas como **multiplicative hashing** (`h(k) = floor(m * (k*A mod 1))` para una constante A bien elegida) que mezclan mejor los bits de la clave.

### 3.3 Hashing universal — por qué la aleatoriedad derrota al adversario

Hay un problema más profundo con *cualquier* función hash fija y conocida públicamente: si un atacante conoce exactamente tu función `h`, puede **construir deliberadamente** un conjunto de claves que todas colisionen al mismo slot — convirtiendo tu tabla hash de O(1) esperado en O(n) garantizado, a propósito. Esto no es hipotético; es un vector de ataque real (retomado en Conexiones como *hash flooding*).

La solución, propuesta originalmente por Carter y Wegman: **hashing universal**. En vez de usar una función hash fija, eliges **aleatoriamente, en tiempo de ejecución**, una función de una **familia** de funciones hash predefinida, cada vez que se crea la tabla. El atacante puede conocer *toda la familia* de funciones posibles, pero no sabe *cuál* de ellas se eligió al azar para esta ejecución específica — por lo tanto no puede precomputar un conjunto de claves que garanticen colisión, porque esas claves dependerían de la función específica, que es un secreto determinado por aleatoriedad en tiempo de ejecución.

**Definición formal (CLRS 11.3.3)**: una familia de funciones hash H es *universal* si, para cualquier par de claves distintas k₁ ≠ k₂, la fracción de funciones h ∈ H tales que h(k₁) = h(k₂) es a lo más 1/m. Es decir: elegida `h` al azar de la familia, la probabilidad de colisión entre dos claves fijas cualesquiera es como máximo la que esperarías de una función perfectamente uniforme. Esto te da una **garantía probabilística sobre el desempeño esperado, independiente de qué claves específicas te dé el adversario** — porque la aleatoriedad está en la elección de la función, no en las claves.

**El punto conceptual que hay que retener**: sin aleatoriedad, cualquier función hash determinista y pública tiene, para cualquier tabla de tamaño m, *algún* conjunto de n claves que la rompe (de nuevo, pigeonhole: existen m clases de equivalencia bajo h, así que basta escoger n claves de la misma clase). Con hashing universal, esa debilidad deja de ser explotable porque el atacante no sabe cuál función se usó. Esto es literalmente el mismo principio de defensa que usa la criptografía moderna: no confíes en que el algoritmo sea secreto, confía en que una clave aleatoria (aquí, la función hash elegida) sea impredecible.

---

## 4. Resolución de colisiones — dos familias de solución, deducidas por su mecanismo

Ya establecimos que las colisiones son inevitables. Ahora: cuando `h(k1) = h(k2)`, ¿qué hacemos con el segundo elemento que "quiere" el mismo slot?

### 4.1 Encadenamiento (chaining) — cada slot es una lista

**La idea, deducida directamente**: si un slot puede recibir más de una clave, hazlo capaz de *guardar más de una* — convierte cada slot en una lista ligada (o cualquier estructura dinámica) que acumula todas las claves que mapearon ahí.

```python
class TablaHashEncadenamiento:
    """
    Implementacion desde cero de una tabla hash con chaining.
    Fiel al esquema de CLRS 11.2, con resize dinamico para mantener
    el factor de carga acotado (analogo a la seccion de arrays dinamicos
    del modulo anterior -- el mismo patron de amortizacion aplica aqui).
    """
    def __init__(self, capacidad_inicial=8):
        self._capacidad = capacidad_inicial
        self._cubetas = [[] for _ in range(self._capacidad)]
        self._n = 0   # numero de elementos guardados

    def _hash(self, clave):
        # Usamos el hash nativo de Python (basado en SipHash para strings,
        # con aleatorizacion por proceso -- una forma practica de
        # hashing universal, ver seccion 3.3) y lo reducimos mod capacidad.
        return hash(clave) % self._capacidad

    def _factor_de_carga(self):
        return self._n / self._capacidad

    def insertar(self, clave, valor):
        indice = self._hash(clave)
        cubeta = self._cubetas[indice]
        for i, (k, v) in enumerate(cubeta):
            if k == clave:
                cubeta[i] = (clave, valor)   # actualizar valor existente
                return
        cubeta.append((clave, valor))
        self._n += 1
        # Rehashing: igual que el array dinamico, mantenemos el factor
        # de carga acotado duplicando la capacidad cuando crece demasiado.
        if self._factor_de_carga() > 0.75:
            self._resize(self._capacidad * 2)

    def buscar(self, clave):
        indice = self._hash(clave)
        for k, v in self._cubetas[indice]:
            if k == clave:
                return v
        raise KeyError(clave)

    def eliminar(self, clave):
        indice = self._hash(clave)
        cubeta = self._cubetas[indice]
        for i, (k, v) in enumerate(cubeta):
            if k == clave:
                del cubeta[i]
                self._n -= 1
                return
        raise KeyError(clave)

    def _resize(self, nueva_capacidad):
        viejas_cubetas = self._cubetas
        self._capacidad = nueva_capacidad
        self._cubetas = [[] for _ in range(self._capacidad)]
        self._n = 0
        # Reinsertar TODO: los indices cambian porque `capacidad` cambio,
        # asi que no se puede copiar directo -- hay que rehashear cada clave.
        for cubeta in viejas_cubetas:
            for clave, valor in cubeta:
                self.insertar(clave, valor)


if __name__ == "__main__":
    tabla = TablaHashEncadenamiento(capacidad_inicial=4)
    datos = {"armando": 1, "miranda": 2, "marco": 3, "joshua": 4, "coco": 5}
    for k, v in datos.items():
        tabla.insertar(k, v)
    for k in datos:
        assert tabla.buscar(k) == datos[k]
    print("capacidad final:", tabla._capacidad, "factor de carga:", tabla._factor_de_carga())
```

**Por qué esto mantiene O(1) esperado amortizado**: idéntico argumento al array dinámico del módulo anterior. Mientras el factor de carga α = n/m se mantenga acotado (constante), el costo esperado de una búsqueda es O(1 + α) = O(1). El `resize` (rehashing completo) es O(n) cuando ocurre, pero ocurre con frecuencia geométricamente decreciente exactamente igual que el array dinámico — el mismo análisis amortizado del módulo anterior (método agregado: la suma total de trabajo de rehash a lo largo de n inserciones es O(n), dividido entre n operaciones da O(1) amortizado por inserción) **aplica aquí sin modificación conceptual**. Esta es una de las razones por las que vale la pena haber entendido bien la sección de arrays dinámicos antes de este módulo: el mecanismo de amortización es literalmente el mismo, solo aplicado a una estructura distinta.

**Trade-off de encadenamiento**: cada slot vacío desperdicia el espacio de un puntero a lista vacía (o None); cada colisión exige seguir punteros (con el costo de localidad de caché del módulo anterior — recorrer una lista ligada dispersa en memoria). La ventaja: simplicidad, y el factor de carga puede *superar* 1 sin romper la estructura (solo hace las listas más largas) — a diferencia del direccionamiento abierto.

### 4.2 Direccionamiento abierto (open addressing) — todo vive en la tabla misma

**La idea alternativa, deducida desde una restricción distinta**: ¿y si no queremos el overhead de punteros de las listas ligadas? Entonces todos los elementos deben vivir directamente en los slots del array — sin estructuras auxiliares. Cuando el slot `h(k)` está ocupado, necesitamos una **secuencia de sondeo (probe sequence)**: una regla determinista que dice "si este slot está ocupado, prueba el siguiente según esta fórmula".

**Linear probing**: si `h(k)` está ocupado, prueba `h(k)+1`, luego `h(k)+2`, etc. (módulo m). Simple, con excelente localidad de caché (slots contiguos) — pero sufre de **clustering primario**: una vez que empieza a formarse un bloque contiguo de slots ocupados, cualquier clave que colisione dentro de ese rango alarga el bloque, lo que aumenta la probabilidad de que la *siguiente* colisión también caiga ahí. Es un efecto de retroalimentación positiva: los clusters grandes atraen más colisiones, que los hacen más grandes todavía.

**Quadratic probing**: si `h(k)` está ocupado, prueba `h(k)+1²`, `h(k)+2²`, `h(k)+3²`... Rompe el clustering primario (los saltos no son contiguos), pero introduce **clustering secundario**: dos claves que colisionan en el mismo slot inicial siguen exactamente la misma secuencia de sondeo después — siguen "compitiendo" por los mismos slots subsecuentes, aunque ya no formen un bloque físicamente contiguo.

**Double hashing**: usa una **segunda** función hash `h₂(k)` para determinar el tamaño del salto: prueba `h(k)`, `h(k)+h₂(k)`, `h(k)+2·h₂(k)`, etc. Como el salto depende de la clave misma (vía h₂), dos claves distintas que colisionan en el slot inicial típicamente tienen secuencias de sondeo *distintas* de ahí en adelante — resolviendo tanto el clustering primario como el secundario. Es, en la práctica, la técnica de sondeo con mejor comportamiento asintótico de las tres, al precio de calcular una segunda función hash por cada inserción/búsqueda.

**Trampa crítica de direccionamiento abierto: eliminar no es trivial.** Si simplemente vacías (`None`) el slot de un elemento eliminado, rompes las búsquedas futuras: una búsqueda que sigue la secuencia de sondeo puede llegar a ese slot vacío y concluir "la clave no está" cuando en realidad estaba más adelante en la secuencia, detrás del hueco que acabas de crear. La solución estándar: marcar el slot con un valor especial **"eliminado" (tombstone)**, distinto de "vacío" — las búsquedas siguen atravesando tombstones (porque pudo haber algo después), pero las inserciones nuevas sí pueden reusar ese slot. Sin esta distinción explícita entre "nunca ocupado" y "ocupado y luego eliminado", el direccionamiento abierto se rompe silenciosamente.

**Restricción estructural**: a diferencia de encadenamiento, el factor de carga **no puede superar 1** en direccionamiento abierto — no hay dónde poner el elemento n+1 si ya hay m slots todos ocupados. En la práctica, el rendimiento se degrada notablemente mucho antes de llegar a α=1 (usualmente se hace rehash bastante antes, α > 0.7 típicamente), porque las secuencias de sondeo se alargan rápido cuando la tabla está casi llena.

---

## 5. El factor de carga y el rehashing — por qué mantienen O(1) amortizado

Ya lo mencionamos de pasada en el código: el factor de carga `α = n/m` es la variable que controla todo. Formalicemos la intuición.

Bajo hashing uniforme simple con encadenamiento, el costo esperado de una búsqueda **no exitosa** (la clave no está) es Θ(1+α): tienes que calcular el hash (O(1)) y recorrer la lista completa del slot correspondiente, cuya longitud esperada es α. El costo esperado de una búsqueda **exitosa** es también Θ(1+α) (CLRS 11.2, teorema 11.2). **Mientras α se mantenga O(1)** — es decir, mientras m crezca proporcionalmente a n — el costo esperado se mantiene O(1), sin importar qué tan grande sea n en términos absolutos.

Esto es exactamente por qué el `resize` en la sección 4.1 dispara cuando α supera un umbral (0.75 en el código): sin ese rehash, si n sigue creciendo mientras m se queda fijo, α crece sin límite, y el costo esperado O(1+α) deja de ser O(1) — se convierte en O(n/m), que para m fijo es Θ(n). El rehashing existe **precisamente** para evitar que esto pase: es el mecanismo activo que mantiene la promesa de O(1) a través del tiempo de vida de la estructura, exactamente como el resize del array dinámico del módulo anterior mantenía O(1) amortizado para `append`.

---

## 6. Cuándo degrada a O(n) — y por qué eso no es un caso hipotético

Toda la promesa de O(1) descansa sobre el supuesto de hashing uniforme simple (sección 3.1). Cuando ese supuesto se rompe, la tabla hash degenera silenciosamente — el código sigue "funcionando" (da las respuestas correctas), solo que mucho más lento de lo esperado, y eso es peligrosamente fácil de no notar hasta que ya es un problema en producción.

**Causa 1 — mala función hash con las claves reales.** Si tu función hash no distribuye uniformemente *las claves que realmente vas a recibir* (no las claves hipotéticas del análisis teórico), terminas con muchas claves cayendo en pocos slots. Ejemplo concreto: si usas `hash(k) = primer_caracter(k)` para strings, y todas tus claves empiezan con la misma letra (común en ciertos dominios: nombres de columnas de base de datos con prefijo compartido, IDs con formato fijo), todas colisionan en el mismo slot, y la tabla completa degenera a una lista ligada de tamaño n — cada búsqueda se vuelve O(n).

**Causa 2 — ataque de colisión deliberado (hash flooding).** Como dedujimos en 3.3, si el atacante conoce tu función hash exacta (sin aleatorización), puede construir deliberadamente n claves que **todas** colisionan al mismo slot. Esto convierte una operación que debería ser O(1) en O(n) por cada inserción del atacante — un ataque de denegación de servicio (DoS) donde n peticiones maliciosas cuestan Θ(n²) en total en vez de Θ(n). Este no es un escenario académico: fue explotado en la práctica contra varios lenguajes/frameworks web (PHP, Python en versiones antiguas, Java) que usaban funciones hash deterministas y predecibles para parsear parámetros de formularios en hash tables — un atacante podía tumbar un servidor entero con un solo request HTTP diseñado con miles de claves colisionantes. La mitigación es exactamente el hashing universal/aleatorizado de la sección 3.3: Python, desde la versión 3.3, aleatoriza el hash de strings por proceso (`PYTHONHASHSEED`) precisamente por esta razón — es una defensa de seguridad, no solo una optimización de rendimiento.

**Causa 3 — usar como clave un objeto mutable cuyo hash cambia.** Esta es una trampa de corrección, no solo de rendimiento, y hay que marcarla explícitamente porque es un bug clásico:

```python
# TRAMPA: usar una lista (mutable) como clave.
# En Python esto ni siquiera compila (TypeError: unhashable type: 'list'),
# precisamente para PREVENIR este bug en tiempo de ejecucion.
# Pero en lenguajes/estructuras que SI lo permiten (o si implementas
# tu propio __hash__ sobre un objeto mutable), el bug es real:

class Punto:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def __hash__(self):
        return hash((self.x, self.y))
    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

tabla = {}
p = Punto(1, 2)
tabla[p] = "valor guardado en el slot de hash((1,2))"

p.x = 999   # MUTAS el objeto DESPUES de usarlo como clave

# Ahora hash(p) cambio, pero el objeto sigue "viviendo" en el slot
# viejo de la tabla interna. Buscar tabla[p] ahora calcula el NUEVO
# hash, busca en el slot NUEVO (que esta vacio), y falla -- aunque
# el objeto "logicamente" siga siendo el mismo que insertaste.
```

**Por qué esto rompe la tabla, no solo el objeto**: una tabla hash asume, como invariante estructural, que **el hash de una clave nunca cambia mientras esté dentro de la tabla** — porque la posición física del elemento depende del hash calculado *en el momento de la inserción*. Si el hash cambia después, la tabla queda en un estado inconsistente: el elemento sigue físicamente en el slot viejo, pero cualquier búsqueda futura calcula el slot nuevo y no lo encuentra ahí. Esta es la razón de diseño, no arbitraria, de por qué Python prohíbe usar tipos mutables (`list`, `dict`, `set`) como claves de diccionario — y por qué, si implementas `__hash__` en una clase propia, la convención (no forzada por el lenguaje, mantenida por disciplina) es basar el hash únicamente en atributos que **no van a cambiar** durante la vida del objeto dentro de una tabla, o simplemente no sobreescribir `__hash__` en clases mutables.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo de MIT 6.006 / CLRS citado arriba.)*

**Hash flooding como vector de ataque — tu ángulo de ciberseguridad.** Ya lo mencionamos en la sección 6, pero vale la pena profundizar el ángulo ofensivo/defensivo porque conecta directo con tu interés en Red Team. El ataque explota exactamente el pigeonhole principle (sección 2.1) de forma deliberada: si conoces la función hash (o puedes inferirla observando comportamiento, como timing de respuestas — un ataque de canal lateral, *side-channel*), puedes precomputar offline un conjunto de claves que garantizadamente colisionan, y enviarlas todas en una sola petición. Un servidor sin protección procesa esto en Θ(n²) en vez de Θ(n), y con n relativamente modesto (miles de claves, un payload de pocos KB) puedes consumir CPU del servidor durante segundos o minutos con un solo request — devastador para disponibilidad con un costo de ataque trivial. La defensa en profundidad tiene tres capas: (1) hashing aleatorizado por proceso (hace que el atacante no pueda precomputar colisiones sin conocer la semilla), (2) límites de tamaño de payload/número de parámetros aceptados por petición (limita n antes de que llegue a la tabla hash), y (3) estructuras alternativas con garantía de peor caso (árboles balanceados) para casos donde el input es explícitamente no confiable — sacrificando el O(1) esperado por un O(log n) garantizado que un adversario no puede romper.

**Hashing criptográfico vs. hashing de tablas — dos problemas que se parecen en el nombre pero no en el objetivo.** Una función hash de tabla (como las de este módulo) solo necesita ser *rápida* y *razonablemente uniforme en la práctica* — no necesita ser resistente a que alguien, dado `h(k)`, pueda reconstruir `k` o encontrar una `k'` distinta con el mismo hash de forma deliberada (a menos que se use en contexto de seguridad, como vimos arriba). Una función hash **criptográfica** (SHA-256, por ejemplo) tiene requisitos radicalmente más estrictos: resistencia a preimagen (dado h(k), computacionalmente inviable encontrar k), resistencia a segunda preimagen, y resistencia a colisión (computacionalmente inviable encontrar *cualquier* par k₁≠k₂ con el mismo hash — nota que esto no contradice el pigeonhole principle: las colisiones siguen existiendo matemáticamente, solo que encontrarlas debe ser computacionalmente impracticable, no imposible). Estas propiedades criptográficas tienen un costo: SHA-256 es órdenes de magnitud más lento de calcular que una función hash de tabla optimizada para velocidad. Usar SHA-256 como función hash de una tabla hash interna sería un desperdicio masivo de rendimiento sin beneficio real (no necesitas resistencia a preimagen para indexar un diccionario interno) — y usar una función hash de tabla rápida (no criptográfica) para, por ejemplo, guardar contraseñas, sería una vulnerabilidad de seguridad catastrófica. Son la misma palabra, problemas completamente distintos, con requisitos de diseño casi opuestos (velocidad vs. resistencia computacional deliberada).

**Hashing consistente en sistemas distribuidos.** El rehashing completo de la sección 5 (`_resize`, que reinserta *todos* los elementos) funciona perfecto para una tabla hash en memoria de un solo proceso — pero se vuelve catastrófico en un sistema distribuido donde "los slots" son servidores físicos distintos (ej. un sistema de caché distribuido tipo Memcached, o partición de datos entre nodos de una base de datos). Si `h(k) mod n_servidores` determina a qué servidor va cada clave, y `n_servidores` cambia (agregas o quitas un nodo), un rehash ingenuo reasigna **casi todas** las claves a servidores distintos — lo que significa mover casi todos los datos por la red, un costo prohibitivo en sistemas grandes. **Hashing consistente** (Karger et al.) resuelve esto mapeando tanto claves como servidores a puntos en un círculo (espacio hash circular), de forma que agregar o quitar un servidor solo reasigna las claves que caían en el segmento inmediatamente adyacente a ese servidor en el círculo — típicamente una fracción pequeña (~1/n_servidores) del total, no casi todas. Esta es la técnica detrás de sistemas de caché distribuido a gran escala y de partición de datos en bases de datos distribuidas modernas — la misma pregunta raíz de este módulo ("¿cómo mapeo un universo grande a un espacio chico sin que todo se rompa cuando el espacio chico cambia de tamaño?"), pero resuelta para el caso donde "cambiar de tamaño" significa mover terabytes por una red, no simplemente reasignar punteros en RAM.

---

## Síntesis — el mapa mental

1. El direccionamiento directo da O(1) puro, pero exige un array del tamaño del **universo completo de claves posibles** — inviable cuando ese universo es gigante comparado con los datos reales que vas a guardar.
2. La función hash resuelve esto mapeando el universo grande a una tabla chica (tamaño proporcional a n, no a |U|) — pero por el **pigeonhole principle**, cualquier función hash con dominio mayor que el codominio garantiza colisiones. No es un defecto, es matemática inevitable.
3. La **paradoja del cumpleaños** demuestra que las colisiones aparecen mucho antes de lo que la intuición ingenua predice — con ~√m elementos en una tabla de tamaño m, no con ~m — porque el número de pares comparables crece cuadráticamente, no linealmente, con el número de elementos.
4. Una función hash "buena" cumple **hashing uniforme simple**: cada clave tiene probabilidad 1/m de caer en cualquier slot dado. Bajo este supuesto, el costo esperado de búsqueda es Θ(1+α), donde α = n/m es el **factor de carga**.
5. Contra adversarios que conocen tu función hash, ninguna función determinista fija es segura (siempre existe un conjunto de claves que la rompe). **Hashing universal** resuelve esto eligiendo la función hash **al azar de una familia** en tiempo de ejecución, negándole al atacante la capacidad de precomputar colisiones garantizadas.
6. Las colisiones se resuelven con **encadenamiento** (cada slot es una lista, simple, tolera α > 1, paga overhead de punteros y localidad de caché pobre) o **direccionamiento abierto** (todo vive en la tabla, mejor localidad de caché, restringido a α < 1, requiere manejo cuidadoso de eliminación vía tombstones, y sondeo — linear/quadratic/double hashing — cada uno con su propio patrón de clustering).
7. El **rehashing** (duplicar la tabla cuando α cruza un umbral) mantiene O(1) amortizado a lo largo de la vida de la estructura — el mismo argumento de análisis amortizado del array dinámico del módulo anterior, aplicado aquí sin modificación conceptual.
8. La tabla **degrada silenciosamente a O(n)** cuando el supuesto de uniformidad se rompe: mala función hash para las claves reales, ataque deliberado de colisión (hash flooding), o el bug de mutar una clave después de insertarla (rompiendo la invariante de que el hash de una clave no cambia mientras vive en la tabla).

---

## Preguntas que deberías poder responder

1. Deriva por qué el direccionamiento directo, aunque da O(1) puro sin colisiones, es inviable en la práctica para claves tipo string — ¿qué tamaño de array necesitarías en el peor caso?
2. Usando el pigeonhole principle, prueba formalmente que no puede existir una función hash sin colisiones si |U| > m. ¿Qué relación tiene esto con por qué una función hash "perfecta" (sin colisiones) solo es posible en casos muy específicos (hashing perfecto/estático, con el conjunto de claves conocido de antemano)?
3. Explica, usando el argumento de conteo de pares (no memorizando el resultado), por qué las colisiones en una tabla hash aparecen con O(√m) elementos y no O(m). ¿Qué tiene esto que ver con por qué SHA-256 usa un espacio de salida de 256 bits en vez de, digamos, 64?
4. Compara encadenamiento vs. direccionamiento abierto: si tu factor de carga esperado va a superar 1 ocasionalmente (picos de tráfico), ¿cuál elegirías y por qué? Si tu prioridad es minimizar cache misses en un sistema de muy alto rendimiento, ¿cuál elegirías?
5. Explica por qué eliminar un elemento en direccionamiento abierto con linear probing no puede simplemente vaciar el slot — construye un ejemplo concreto (3-4 claves) donde vaciar el slot rompe una búsqueda futura.
6. ¿Por qué el hashing universal (elegir la función al azar de una familia) derrota un ataque de hash flooding, pero usar una función hash "muy compleja y difícil de adivinar" (sin aleatoriedad real, solo ofuscada) no lo derrota? ¿Qué principio de seguridad general ilustra esta distinción (pista: piensa en "seguridad por oscuridad" vs. criptografía moderna)?
7. Da un ejemplo concreto de un objeto que sería peligroso usar como clave de diccionario si Python no lo prohibiera, y explica exactamente en qué momento (qué línea de código) se rompería la invariante de la tabla.
8. En hashing consistente para sistemas distribuidos, ¿por qué "casi todas las claves se mueven cuando cambia el número de servidores" es un problema real de ingeniería (no solo una curiosidad matemática)? ¿Qué costo concreto pagas si ignoras esto y usas `h(k) mod n_servidores` directo en un sistema de caché distribuido en producción?

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lecture 4 (Hashing): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 11 (Hash Tables): direccionamiento directo (11.1), tablas hash y encadenamiento (11.2), funciones hash y hashing universal (11.3), direccionamiento abierto (11.4).
- Carter, J. L. y Wegman, M. N., "Universal Classes of Hash Functions", *Journal of Computer and System Sciences*, 1979 — el paper original de hashing universal referenciado en CLRS 11.3.3.
- Karger, D. et al., "Consistent Hashing and Random Trees", 1997 — paper original de hashing consistente para sistemas distribuidos (mencionado en Conexiones).
