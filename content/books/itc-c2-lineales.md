---
module_id: itc-c2-lineales
spine: ITC
title: "Estructuras de datos lineales y amortización"
subtitle: "Por qué dónde guardas un dato cambia lo que cuesta usarlo"
source_canonical: "Berkeley CS61B; CLRS cap. 10, cap. 17"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Estructuras de datos lineales y amortización

> **Pregunta raíz.** Tienes una secuencia de elementos — n cosas, en orden. Necesitas: (a) acceder al elemento en la posición i, (b) insertar un elemento nuevo en alguna posición, (c) quitar uno. ¿Por qué no existe *una* estructura de datos que haga las tres cosas rápido? La respuesta no es "porque nadie lo ha inventado todavía" — es que **acceso rápido e inserción rápida son objetivos físicamente en tensión**, dado cómo funciona la memoria de una computadora real. Este módulo deduce esa tensión desde la RAM misma, y de ahí construye cada estructura lineal como una respuesta distinta a esa tensión.

## Prólogo — de dónde nace esto

Imagina dos formas de organizar una fila de casilleros en una escuela. Opción A: casilleros numerados 1 a 1000, todos en el mismo pasillo, en orden. Si te dicen "ve al casillero 743", caminas directo — sabes exactamente dónde está por su número. Pero si quieren insertar un casillero nuevo *entre* el 500 y el 501, tienes que renumerar y mover físicamente 500 casilleros para hacer espacio. Opción B: cada casillero tiene una notita pegada que dice "el siguiente está en el pasillo X, puerta Y". Insertar uno nuevo es trivial — solo cambias dos notitas. Pero si te piden "ve al casillero 743", no hay atajo: tienes que empezar en el primero y seguir notitas una por una, 743 veces.

Esto no es una metáforita bonita — es **literalmente** cómo funcionan un array y una lista ligada en la RAM de tu computadora. El array es la Opción A: memoria contigua, direccionable por aritmética. La lista ligada es la Opción B: memoria dispersa, conectada por punteros. Todo lo que sigue en este módulo — por qué el array es O(1) para acceso y O(n) para insertar al inicio, por qué la lista ligada es exactamente lo opuesto, por qué existe el array dinámico como compromiso, por qué existen pilas/colas/deques como interfaces restringidas sobre estas estructuras — se deriva de esta única distinción física. Apréndela bien, porque de aquí para adelante todo es consecuencia lógica, no lista de hechos a memorizar.

---

## 1. El modelo de memoria — lo que realmente hay debajo

Antes de hablar de "arrays" como abstracción, hay que hablar de qué es la RAM a nivel físico, porque de ahí sale toda la complejidad de acceso.

La memoria RAM es, conceptualmente, un arreglo gigantesco de celdas, cada una con una **dirección** numérica (piensa en ella como el número de casillero). El hardware tiene un circuito — el decodificador de direcciones — que, dado un número de dirección, activa exactamente esa celda en tiempo constante, sin importar qué tan lejos esté numéricamente de la última celda que accediste. Esto es el mismo modelo RAM (Random Access Machine) del módulo anterior: acceder a la dirección `k` cuesta lo mismo que acceder a la dirección `k+1,000,000`.

**Un array es la explotación directa de esta propiedad física.** Si guardas n elementos en memoria contigua empezando en la dirección `base`, y cada elemento ocupa `tamaño` bytes, entonces la dirección del elemento `i` es simplemente:

```
dirección(i) = base + i * tamaño
```

Esto es **aritmética**, no búsqueda. No tienes que "encontrar" el elemento i — lo *calculas*. Esa es la razón mecánica, no una convención arbitraria, de por qué `arr[i]` es O(1): es una multiplicación y una suma, ambas O(1) en el modelo RAM, seguidas de un acceso a memoria que también es O(1). El acceso indexado de un array **es** aritmética de direcciones disfrazada de sintaxis de corchetes.

**Una lista ligada abandona la contigüidad a propósito.** Cada elemento (nodo) vive en una dirección de memoria arbitraria, potencialmente lejísimos unos de otros, y la única forma de ir del nodo i al nodo i+1 es seguir un **puntero** almacenado explícitamente dentro del nodo — la "notita" de la analogía. No hay fórmula que calcule dónde está el nodo 743; tienes que empezar en el nodo 0 y saltar 743 veces, cada salto siendo una lectura de memoria dependiente de la anterior (no puedes calcular el salto 743 sin haber completado el salto 742 primero — son secuencialmente dependientes, no paralelizables).

Con este único hecho físico ya puedes **deducir**, sin memorizar tablas, el comportamiento de ambas estructuras para cada operación. Vamos operación por operación.

---

## 2. Array estático — deducción operación por operación

### 2.1 Acceso: `arr[i]` — O(1)

Ya lo dedujimos arriba: aritmética de direcciones. Costo constante, independiente de n e independiente de i.

### 2.2 Inserción al final (si hay espacio libre) — O(1)

Si el array tiene capacidad sobrante, agregar al final es: calcular la dirección del siguiente slot vacío (aritmética O(1)) y escribir ahí. No mueves nada existente.

### 2.3 Inserción al inicio o en medio — O(n), y aquí está la trampa

Aquí es donde la intuición ingenua falla si no piensas en el mecanismo. Si quieres insertar un elemento en la posición 0 de un array que ya tiene n elementos, **no hay espacio libre en la posición 0** — ya está ocupada. La única forma de hacer espacio es desplazar *todos* los elementos existentes una posición a la derecha, empezando por el último para no sobrescribir:

```python
def insertar_al_inicio(arr, n, valor):
    """
    arr tiene capacidad > n (hay espacio libre al final).
    Inserta `valor` en la posición 0, desplazando todo lo demás.
    Costo: Theta(n) -- hay que mover los n elementos existentes.
    """
    for i in range(n, 0, -1):
        arr[i] = arr[i - 1]
    arr[0] = valor
```

**Esto no es un defecto de implementación — es una consecuencia física inevitable.** Como cada posición del array está *definida* por su dirección aritmética (`base + i*tamaño`), insertar en la posición 0 obliga a que todo lo que antes estaba en la posición i ahora esté en la posición i+1, y la única forma de lograr eso es *físicamente copiar* cada elemento a su nueva dirección. No existe un truco algorítmico que evite esto mientras mantengas la contigüidad — es la contigüidad misma la que lo exige.

**La trampa común**: alguien que solo memoriza "array = O(1) para todo" cae en esto exactamente cuando su código empieza a insertar al inicio de una lista de Python (`list.insert(0, x)`) dentro de un loop, sin darse cuenta de que convirtió un algoritmo que "debería" ser O(n) en uno O(n²) — porque cada inserción al inicio es O(n), y lo repites n veces.

### 2.4 Eliminación — simétrica a la inserción

Eliminar del final: O(1) (nada que desplazar). Eliminar del inicio o en medio: O(n) (hay que desplazar todo lo posterior una posición a la izquierda para "cerrar el hueco").

### 2.5 El límite fundamental de un array **estático**: la capacidad es fija

Un array clásico (en C, por ejemplo) se declara con una capacidad fija al momento de crearse — el sistema operativo le reserva exactamente ese bloque contiguo de memoria, ni un byte más. Si intentas insertar el elemento n+1 cuando la capacidad es n, **no hay espacio físico contiguo disponible** — la memoria justo después de tu array probablemente ya está ocupada por otra cosa. Esto obliga, si quieres una estructura que crezca, a una decisión de diseño completamente nueva: el **array dinámico**.

---

## 3. Array dinámico — por qué duplicar y no sumar una constante

### 3.1 El problema que resuelve

Queremos una estructura tipo array (acceso O(1) por índice) pero que pueda **crecer** conforme insertamos elementos, sin conocer de antemano cuántos vamos a necesitar. La solución mecánica: cuando el array estático interno se llena, **pedimos al sistema un bloque de memoria contigua más grande, copiamos todo el contenido viejo ahí, y liberamos el bloque viejo.** Esta operación se llama **resize** (o *growth spurt*, en la terminología de CS61B).

```python
class ArrayDinamico:
    """
    Reimplementacion minima (didactica) de lo que hace list de Python
    o ArrayList de Java por dentro.
    Fiel al patron de crecimiento de CS61B / CLRS 17.4.
    """
    def __init__(self):
        self._capacidad = 1
        self._tamano = 0
        self._datos = [None] * self._capacidad

    def __len__(self):
        return self._tamano

    def __getitem__(self, i):
        if not (0 <= i < self._tamano):
            raise IndexError("indice fuera de rango")
        return self._datos[i]  # O(1): aritmetica de direcciones

    def append(self, valor):
        if self._tamano == self._capacidad:
            self._resize(self._capacidad * 2)  # DUPLICAR, no sumar constante
        self._datos[self._tamano] = valor
        self._tamano += 1

    def _resize(self, nueva_capacidad):
        nuevo_bloque = [None] * nueva_capacidad
        for i in range(self._tamano):
            nuevo_bloque[i] = self._datos[i]   # copia fisica, Theta(tamano actual)
        self._datos = nuevo_bloque
        self._capacidad = nueva_capacidad


if __name__ == "__main__":
    ad = ArrayDinamico()
    for i in range(10):
        ad.append(i)
        print(f"append({i}) -> tamano={len(ad)}, capacidad={ad._capacidad}")
```

Corriendo esto verías la capacidad saltar: 1, 2, 4, 8, 16 — duplicando cada vez que se llena, no creciendo de uno en uno.

### 3.2 La pregunta que hay que responder con rigor: ¿por qué duplicar y no sumar una constante k?

Esta es la decisión de diseño central del módulo, y hay que **deducirla comparando las dos estrategias**, no aceptarla como convención.

**Estrategia "sumar constante k"**: cuando se llena, creces la capacidad en `k` slots fijos (ej. +10 cada vez). Parece razonable — creces "poco a poco". Analicemos el costo total de hacer n `append()` empezando de capacidad 0, con k=10:

Necesitas `n/k` resizes. El resize número j copia aproximadamente `j·k` elementos (el tamaño que tenía el array en ese momento). El costo total de copiar, sumando todos los resizes:

```
costo_total_copias ~= k + 2k + 3k + ... + (n/k)*k = k * (1 + 2 + ... + n/k)
                    = k * (n/k)(n/k + 1)/2
                    ~= n^2/(2k)
```

Eso es **Θ(n²)** para hacer n inserciones — cuadrático. Cada `append()` individual, en promedio, cuesta Θ(n/k), es decir, **crece con n**. Eso es inaceptable: quisiéramos que `append()` fuera "casi siempre barato" sin importar cuán grande sea ya el array.

**Estrategia "duplicar"**: cuando se llena, la capacidad pasa de C a 2C. Los resizes ocurren en tamaños 1, 2, 4, 8, 16, ..., hasta n — una progresión geométrica. El costo total de copiar, sumando todos los resizes:

```
costo_total_copias = 1 + 2 + 4 + 8 + ... + n  (aprox., la ultima potencia de 2 <= n)
                    < 2n     (suma de una serie geometrica: converge a 2x el ultimo termino)
```

Eso es **Θ(n)** para hacer n inserciones — lineal. Dividido entre las n operaciones, cada `append()` cuesta, **en promedio sobre la secuencia**, Θ(1).

**La diferencia cualitativa**: sumar una constante hace que los resizes ocurran con frecuencia *constante* (cada k inserciones) mientras el trabajo de cada resize *crece linealmente* con n — el peor combo posible. Duplicar hace que los resizes ocurran con frecuencia *decreciente geométricamente* (cada vez más espaciados) exactamente cuando el trabajo de cada resize crece — la frecuencia decreciente compensa exactamente el trabajo creciente, y el producto se mantiene acotado. Esto no es una coincidencia numérica: es la propiedad definitoria de las series geométricas (`1+2+4+...+n < 2n`) versus las series aritméticas (`1+2+3+...+m ≈ m²/2`). **Duplicar convierte una suma que crecería cuadráticamente en una que crece linealmente**, y esa es la única razón real por la que se elige duplicar (o cualquier factor de crecimiento multiplicativo constante — 1.5x, 2x — todos dan Θ(n) total; la constante específica es un trade-off de espacio desperdiciado vs. frecuencia de copia, no una diferencia de clase asintótica).

### 3.3 Análisis amortizado — deducido, no citado

Ya vimos informalmente el resultado (Θ(n) total ÷ n operaciones = O(1) por operación en promedio sobre la secuencia). Ahora formalicemos esto, porque **"amortizado" tiene una definición técnica precisa que es fácil confundir con "caso promedio"**, y esa confusión es una trampa común que hay que cerrar de raíz.

**Por qué amortizado ≠ promedio (caso probabilístico)**: el análisis de caso promedio (visto en el módulo anterior) requiere asumir una *distribución de probabilidad* sobre los inputs — es una afirmación estadística ("en promedio, sobre inputs aleatorios..."). El análisis amortizado **no asume nada sobre probabilidad**. Es una afirmación matemática determinista sobre el costo total de una secuencia *específica* de n operaciones, dividido entre n. No hay azar involucrado — si corres exactamente esta secuencia de n `append()`, el costo total *garantizado* es Θ(n), sin excepción, sin importar qué tan "mala suerte" tengas. La analogía correcta: no es "en promedio llueve poco", es "estas 100 facturas suman garantizado $1000, así que cada una te cuesta $10 en promedio *de esta cuenta específica*, aunque la factura #64 sola sea de $500".

Hay tres métodos formales para probar cotas amortizadas (CLRS cap. 17). Los tres llegan a la misma conclusión aquí; vale la pena ver los tres porque cada uno ilumina un ángulo distinto del mismo mecanismo.

**Método agregado**: suma el costo total real de las n operaciones y divide entre n. Ya lo hicimos arriba: costo total de copias ≈ 2n, más n escrituras O(1) de los `append()` mismos = Θ(n) total, entre n operaciones = **O(1) amortizado por operación**. Es el método más directo pero el menos generalizable (no separa el costo por *tipo* de operación).

**Método contable (accounting method)** — la analogía de "pagar por adelantado": le asignas a cada operación un **costo amortizado ficticio** (lo que "cobras" al usuario), distinto de su costo real, de tal forma que el costo ficticio siempre alcance para cubrir el costo real, con el sobrante acumulado como "crédito" que paga los resizes caros futuros. Concretamente: cobra **3 unidades** por cada `append()` (aunque su costo real inmediato sea 1 unidad de escritura). De esas 3: 1 unidad paga la escritura real de este `append()`; las otras 2 se guardan como crédito **asociado a este elemento específico**. ¿Para qué? Cuando ocurre un resize que duplica de C a 2C, hay que volver a copiar los C elementos existentes — pero cada uno de esos C elementos ya trae guardado su crédito de 2 unidades desde que fue insertado, así que el crédito acumulado (2C) alcanza sobradamente para pagar la copia (C elementos, 1 unidad cada uno). El "banco" nunca se queda en números rojos. Esto es literalmente la intuición de "pagar por adelantado un poco de más en cada operación barata, para tener fondos cuando llegue la operación cara" — como ahorrar 2 pesos cada semana para tener con qué pagar la refacción anual del coche que ocurre una vez, no cada semana.

**Método del potencial**: define una función de potencial Φ que mide "energía acumulada" en la estructura de datos (aquí, Φ = 2·tamaño_actual − capacidad, aproximadamente — mide cuánto "colchón" de crédito hay antes del próximo resize). El costo amortizado de una operación se define como costo_real + ΔΦ (cambio en el potencial). Cuando una operación barata sucede, aumenta el potencial (acumula colchón); cuando el resize caro sucede, consume ese potencial acumulado, dejando el costo amortizado bajo. Es matemáticamente equivalente al método contable pero con más maquinaria formal — útil para estructuras más complejas donde "asignar crédito a cada elemento" se vuelve confuso.

**El resultado que debes retener**: `append()` en un array dinámico con duplicación es **O(1) amortizado**, aunque operaciones individuales ocasionales sean O(n). Esta es exactamente la estructura interna de `list.append()` en Python y `ArrayList.add()` en Java — no es una curiosidad académica, es literalmente cómo está implementada la estructura de datos que usas todos los días.

### 3.4 Trampa: shrink sin cuidado causa "thrashing"

Si además implementas `pop()` reduciendo la capacidad cada vez que el tamaño baja de la mitad, con un factor de reducción mal elegido puedes crear un patrón patológico: insertar hasta duplicar (resize), sacar un elemento (shrink), insertar de nuevo (resize), sacar (shrink)... cada operación individual dispara un resize completo, destruyendo la garantía amortizada. La solución estándar: el umbral de shrink debe ser más agresivo que el de growth (ej. duplicar al llenarse, pero solo reducir a la mitad cuando el tamaño baja a **un cuarto** de la capacidad, no a la mitad) — esto deja un "colchón" que absorbe secuencias alternadas de insert/delete sin disparar resizes consecutivos.

---

## 4. Lista ligada — la estructura opuesta, deducida del mismo mecanismo

### 4.1 Por qué existe: cuando la inserción importa más que el acceso indexado

Si tu patrón de uso es "inserto y elimino constantemente en posiciones arbitrarias, casi nunca pido el elemento en la posición i por índice", el array dinámico es la estructura equivocada — pagas O(n) por cada inserción/eliminación en medio. La lista ligada invierte el trade-off exactamente al abandonar la contigüidad.

```python
class Nodo:
    def __init__(self, valor):
        self.valor = valor
        self.anterior = None
        self.siguiente = None


class ListaDoblementeLigada:
    """
    Fiel a la estructura clasica de CS61B (DLList), con nodos centinela
    (sentinel nodes) para eliminar casos especiales de inicio/fin vacio.
    """
    def __init__(self):
        # Nodo centinela: no guarda un valor real, simplifica todos los
        # bordes (lista vacia, insertar al inicio, insertar al final)
        # eliminando el chequeo "es None?" en cada operacion.
        self._centinela = Nodo(None)
        self._centinela.siguiente = self._centinela
        self._centinela.anterior = self._centinela
        self._tamano = 0

    def __len__(self):
        return self._tamano

    def insertar_al_inicio(self, valor):
        self._insertar_despues(self._centinela, valor)

    def insertar_al_final(self, valor):
        self._insertar_despues(self._centinela.anterior, valor)

    def _insertar_despues(self, nodo_previo, valor):
        # Costo: O(1) -- reasignar 4 punteros, sin desplazar nada.
        nuevo = Nodo(valor)
        siguiente_original = nodo_previo.siguiente

        nuevo.anterior = nodo_previo
        nuevo.siguiente = siguiente_original
        nodo_previo.siguiente = nuevo
        siguiente_original.anterior = nuevo

        self._tamano += 1

    def eliminar_nodo(self, nodo):
        # Costo: O(1) SI YA TIENES el puntero al nodo.
        # Costo: O(n) si primero tienes que ENCONTRARLO por posicion.
        nodo.anterior.siguiente = nodo.siguiente
        nodo.siguiente.anterior = nodo.anterior
        self._tamano -= 1

    def obtener(self, i):
        # Costo: O(n) -- no hay aritmetica de direcciones, hay que
        # recorrer nodo por nodo, sin atajo posible.
        if not (0 <= i < self._tamano):
            raise IndexError("indice fuera de rango")
        actual = self._centinela.siguiente
        for _ in range(i):
            actual = actual.siguiente
        return actual.valor

    def __iter__(self):
        actual = self._centinela.siguiente
        while actual is not self._centinela:
            yield actual.valor
            actual = actual.siguiente


if __name__ == "__main__":
    dl = ListaDoblementeLigada()
    dl.insertar_al_final(1)
    dl.insertar_al_final(2)
    dl.insertar_al_inicio(0)
    print(list(dl))            # [0, 1, 2]
    print(dl.obtener(1))       # 1, pero costo O(n) recorrer, no O(1)
```

### 4.2 La distinción crítica: O(1) para insertar/eliminar es condicional

Nota el comentario en `eliminar_nodo`: es O(1) **si ya tienes el puntero al nodo**. Esta es una distinción que se pierde con frecuencia y genera afirmaciones falsas tipo "las listas ligadas eliminan en O(1)". La verdad completa: eliminar un nodo *dado su puntero* es O(1) (reasignar cuatro punteros). Pero **encontrar** ese nodo por posición o por valor es O(n) (no hay atajo, hay que recorrer). Si tu caso de uso es "elimina el elemento en la posición 500", el costo real es O(n) para encontrarlo + O(1) para eliminarlo = O(n) total. La ganancia real de la lista ligada aparece cuando **ya tienes una referencia al nodo** (por ejemplo, porque acabas de visitarlo en una iteración, o porque mantienes punteros externos a nodos específicos) — ahí sí insertas/eliminas en O(1) puro, algo que el array nunca puede ofrecer sin desplazar.

### 4.3 El costo oculto: overhead de punteros y fragmentación

Cada nodo de una lista doblemente ligada guarda, además del valor, dos punteros (anterior y siguiente). En una máquina de 64 bits, cada puntero ocupa 8 bytes — 16 bytes de overhead *por elemento*, sin contar el valor mismo. Si guardas enteros pequeños, puedes estar pagando más en punteros que en datos reales. El array dinámico no tiene este overhead — memoria contigua sin punteros intermedios. Este es un trade-off de **espacio**, además del de tiempo, y hay que declararlo explícitamente al elegir estructura.

---

## 5. Pilas (Stack) — el invariante LIFO, deducido de su necesidad

### 5.1 Por qué existe esta restricción

Una pila no es una estructura de datos nueva a nivel de mecanismo — es una **interfaz restringida** sobre un array dinámico o una lista ligada, que solo permite operar en un extremo. La pregunta es: ¿por qué querrías *restringir* algo que ya podías hacer libremente?

Porque hay una clase entera de problemas donde el orden de procesamiento natural es "lo último que entró es lo primero que sale" (LIFO — Last In, First Out), y modelar explícitamente esa restricción en el tipo de dato previene errores de uso y comunica intención. Ejemplos donde el mecanismo LIFO es *inherente al problema*, no una elección arbitraria: la pila de llamadas de funciones (call stack) — cuando `f()` llama a `g()` que llama a `h()`, `h()` debe terminar antes de que `g()` pueda continuar, y `g()` antes que `f()` — es LIFO por la naturaleza misma de cómo el control de ejecución se anida. Deshacer (undo) en un editor: la última acción hecha es la primera que deshaces. Verificar paréntesis balanceados: al encontrar un paréntesis de cierre, debe corresponder al de apertura *más reciente* aún sin cerrar.

### 5.2 Implementación — sobre array dinámico es la elección natural

```python
class Pila:
    """
    LIFO. Implementada sobre ArrayDinamico: push/pop en el extremo final
    son exactamente las operaciones O(1) amortizado que ya dedujimos
    en la seccion 3. No hay razon para pagar el overhead de punteros
    de una lista ligada si solo operas en un extremo.
    """
    def __init__(self):
        self._datos = ArrayDinamico()

    def push(self, valor):
        self._datos.append(valor)          # O(1) amortizado

    def pop(self):
        if len(self._datos) == 0:
            raise IndexError("pop de pila vacia")
        valor = self._datos[len(self._datos) - 1]
        self._datos._tamano -= 1           # O(1): no hay que desplazar nada
        return valor

    def peek(self):
        if len(self._datos) == 0:
            raise IndexError("peek de pila vacia")
        return self._datos[len(self._datos) - 1]

    def esta_vacia(self):
        return len(self._datos) == 0


def parentesis_balanceados(expresion):
    """
    Caso de uso canonico: verificar balanceo usando el invariante LIFO.
    El ultimo parentesis abierto debe ser el primero en cerrarse.
    """
    pila = Pila()
    pares = {')': '(', ']': '[', '}': '{'}
    for char in expresion:
        if char in '([{':
            pila.push(char)
        elif char in ')]}':
            if pila.esta_vacia() or pila.pop() != pares[char]:
                return False
    return pila.esta_vacia()


if __name__ == "__main__":
    print(parentesis_balanceados("(a[b]{c})"))   # True
    print(parentesis_balanceados("(a[b)]"))       # False -- orden LIFO violado
```

**Por qué NO usar una lista ligada aquí**: como solo operamos en un extremo, el array dinámico da O(1) amortizado sin el overhead de 16 bytes de punteros por nodo. La lista ligada solo justificaría su costo si necesitaras insertar/eliminar en posiciones arbitrarias del medio — algo que una pila, por definición, nunca hace.

---

## 6. Colas (Queue) — el invariante FIFO, y por qué un array ingenuo falla

### 6.1 Por qué existe

Lo simétrico a la pila: hay problemas donde el orden natural es "lo primero que entró es lo primero que sale" (FIFO — First In, First Out). Ejemplos inherentes: una fila de impresión (el documento que mandaste primero se imprime primero), BFS (breadth-first search) en grafos — donde procesar en orden de llegada es *lo que define* que la búsqueda sea por niveles, un scheduler round-robin de procesos.

### 6.2 La trampa: implementar una cola con un array "ingenuo" es O(n) por dequeue

Si implementas `dequeue()` (sacar del frente) sobre un array simplemente quitando el elemento 0 y desplazando todo, ya vimos en la sección 2.4 que eso es O(n) — exactamente la trampa de "eliminar del inicio de un array". Necesitamos algo mejor.

### 6.3 La solución: buffer circular (circular array / ring buffer)

En vez de desplazar elementos cuando sacamos del frente, mantenemos dos índices — `frente` y `final` — y dejamos que **"envuelvan" (wrap around)** el array usando aritmética modular, en vez de mover datos físicamente.

```python
class ColaCircular:
    """
    FIFO usando un buffer circular sobre un array de capacidad fija
    con resize dinamico (combinando las lecciones de las secciones 2 y 3).
    Fiel al patron estandar de implementacion de deque/queue eficiente.
    """
    def __init__(self):
        self._capacidad = 4
        self._datos = [None] * self._capacidad
        self._frente = 0        # indice del proximo elemento a sacar
        self._tamano = 0

    def __len__(self):
        return self._tamano

    def enqueue(self, valor):
        if self._tamano == self._capacidad:
            self._resize(self._capacidad * 2)
        # indice circular: (frente + tamano) mod capacidad
        indice_insercion = (self._frente + self._tamano) % self._capacidad
        self._datos[indice_insercion] = valor
        self._tamano += 1

    def dequeue(self):
        if self._tamano == 0:
            raise IndexError("dequeue de cola vacia")
        valor = self._datos[self._frente]
        self._datos[self._frente] = None
        # avanzar el frente circularmente -- ESTA es la operacion clave:
        # en vez de desplazar n-1 elementos, solo movemos el indice.
        self._frente = (self._frente + 1) % self._capacidad
        self._tamano -= 1
        return valor

    def _resize(self, nueva_capacidad):
        # Al hacer resize, "desenrollamos" el buffer circular en un
        # array nuevo empezando limpio desde el indice 0.
        nuevo_bloque = [None] * nueva_capacidad
        for i in range(self._tamano):
            nuevo_bloque[i] = self._datos[(self._frente + i) % self._capacidad]
        self._datos = nuevo_bloque
        self._capacidad = nueva_capacidad
        self._frente = 0


if __name__ == "__main__":
    cola = ColaCircular()
    for x in [10, 20, 30]:
        cola.enqueue(x)
    print(cola.dequeue())   # 10
    cola.enqueue(40)
    cola.enqueue(50)        # dispara resize; el wrap-around se resuelve limpio
    while len(cola) > 0:
        print(cola.dequeue())   # 20, 30, 40, 50 -- orden FIFO preservado
```

**Por qué esto es O(1) amortizado**: `enqueue` es exactamente el `append` del array dinámico (O(1) amortizado, por la sección 3). `dequeue` es O(1) puro — mover un índice con aritmética modular, sin tocar el resto del arreglo. Ningún elemento se desplaza jamás; solo cambia *dónde apunta* el índice `frente`. Esa es la idea central: convertimos "eliminar del inicio" (que en un array lineal exige desplazar todo) en "mover un puntero circularmente" (O(1)), sacrificando la propiedad de que el índice 0 del array subyacente siempre sea el frente lógico de la cola.

### 6.4 Trampa explícita: off-by-one en índices circulares

El error más común implementando un buffer circular es confundir **cuándo el buffer está lleno vs. vacío**, porque ambos casos pueden hacer que `frente == final` si no llevas un contador de tamaño explícito. Fíjate que la implementación de arriba evita esto manteniendo `_tamano` como variable independiente — nunca infiere "vacío" o "lleno" comparando únicamente `frente` contra `final`. Una implementación ingenua que solo usa dos índices sin contador tiene que sacrificar un slot del array (dejarlo siempre vacío) para poder distinguir ambos casos, o mantener una bandera booleana adicional — si no haces ninguna de las dos cosas, `enqueue`/`dequeue` sobre un buffer exactamente lleno o exactamente vacío produce comportamiento indefinido. Este es *el* bug clásico de buffers circulares en C/C++ en sistemas embebidos — vale la pena grabarlo como reflejo de revisión de código.

---

## 7. Deque (Double-Ended Queue) — la generalización que unifica pila y cola

### 7.1 Por qué existe

Una vez que tienes un buffer circular que soporta `enqueue`/`dequeue` en O(1) en un extremo, la pregunta natural es: ¿por qué no O(1) en *ambos* extremos? Un deque es exactamente eso: inserción y eliminación O(1) (amortizado) tanto al frente como al final. Con un deque puedes implementar tanto una pila (usando solo un extremo) como una cola (usando ambos extremos, uno para entrar, otro para salir) — es la estructura lineal más general de las cuatro que hemos visto, y por eso `collections.deque` en Python está implementado así, no como lista ligada simple ni como array dinámico simple.

La extensión de `ColaCircular` a deque es directa: agregar `agregar_al_frente` (retroceder el índice `frente` circularmente, con módulo cuidando el caso negativo) y `eliminar_del_final` (calcular el índice final igual que en `enqueue` y limpiarlo). No lo escribo completo aquí por espacio, pero el mecanismo es exactamente el mismo truco de aritmética modular sobre ambos extremos simétricamente — es un buen ejercicio de código para ti extenderlo tú mismo desde `ColaCircular`.

---

## 8. Tabla de trade-offs — la decisión de ingeniería resumida

| Operación | Array (estático) | Array dinámico | Lista doblemente ligada |
|---|---|---|---|
| Acceso por índice `arr[i]` | O(1) | O(1) | O(n) |
| Insertar/eliminar al final | O(1)* | O(1) amortizado | O(1)** |
| Insertar/eliminar al inicio | O(n) | O(n) | O(1)** |
| Insertar/eliminar en medio | O(n) | O(n) | O(n) para encontrar + O(1) para operar |
| Overhead de memoria por elemento | ninguno | ninguno (salvo capacidad no usada) | 2 punteros (16 bytes en 64-bit) |
| Localidad de caché | excelente | excelente | pésima (ver Conexiones) |

*(*) si hay capacidad libre. (**) si ya tienes el puntero al nodo relevante.*

**La decisión real de ingeniería** no es "¿cuál estructura es mejor?" — es "¿cuál es mi patrón de acceso dominante?". Si accedes por índice constantemente y raramente insertas/eliminas fuera del final: array dinámico, sin duda. Si insertas/eliminas constantemente en posiciones arbitrarias y rara vez necesitas el elemento i-ésimo por índice: lista ligada. Si el patrón es mixto, frecuentemente la respuesta correcta no es ninguna de las dos puras, sino una estructura híbrida (ej. un array de bloques enlazados — *unrolled linked list* — que amortiza el overhead de punteros repartiéndolo entre varios elementos por nodo).

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo de CS61B/CLRS citado arriba.)*

**Localidad de caché — por qué la teoría de complejidad no captura todo el rendimiento real.** Todo el análisis de este módulo asumió el modelo RAM: cada acceso a memoria cuesta O(1), sin importar la dirección. En hardware real esto es **falso** en un sentido que importa muchísimo en la práctica: el procesador no lee directamente de RAM en cada acceso — lee de una jerarquía de cachés (L1, L2, L3) mucho más rápidas pero mucho más pequeñas que la RAM. Cuando accedes a una dirección de memoria, el hardware trae automáticamente un **bloque contiguo** alrededor de esa dirección (una "cache line", típicamente 64 bytes) a la caché, apostando a que vas a acceder pronto a direcciones cercanas — esa apuesta se llama *localidad espacial*. Un array recorrido secuencialmente explota esto perfectamente: al traer el elemento i, el hardware de facto ya trajo gratis los elementos i+1, i+2... hasta llenar la cache line, así que los siguientes accesos son casi instantáneos (cache hits). Una lista ligada **destruye** esta ventaja: como los nodos viven en direcciones arbitrarias y dispersas (cada `malloc`/allocación puede terminar en cualquier parte del heap), recorrer una lista ligada nodo por nodo típicamente dispara un cache miss en *cada* nodo — cada acceso puede costar 100-200 veces más ciclos de reloj que un cache hit, aunque el modelo RAM diga que ambos son "O(1)". Esto es exactamente por qué, en benchmarks reales, un array dinámico frecuentemente vence a una lista ligada incluso en operaciones donde la lista ligada "gana" en Big-O — la complejidad asintótica describe *cuántas* operaciones, no *cuánto cuesta cada una* en hardware real, y esos dos factores pueden divergir brutalmente cuando la localidad de memoria entra en juego.

**Con el modelo de memoria y sistemas operativos.** La razón por la que un `malloc` de un nodo de lista ligada puede terminar en cualquier dirección del heap, mientras que un array se reserva como bloque contiguo, tiene que ver con cómo el sistema operativo y el allocador de memoria (malloc/free, o el garbage collector en lenguajes gestionados) gestionan el heap — un tema que conecta directamente con sistemas operativos y con por qué la fragmentación de memoria es un problema de ingeniería real en sistemas de larga duración (como un servidor que corre meses sin reiniciar).

**Con AUCTORUM/Kee — la decisión real de estructura de datos en producción.** Cuando decides cómo modelar, por ejemplo, la cola de trabajos pendientes en un sistema como BullMQ (usado en AUCTORUM Med) o el historial de eventos del Sleep Cycle daemon de Kee, estás tomando exactamente esta decisión: ¿es un patrón FIFO puro (cola circular, óptimo)? ¿Necesitas acceso aleatorio frecuente además de inserción (array dinámico con índice adicional)? ¿O el patrón dominante es inserción/eliminación en ambos extremos sin acceso por índice (deque)? Elegir mal aquí no es un error académico — es la diferencia entre un sistema que escala linealmente con la carga y uno que degrada cuadráticamente el primer día que alguien manda 10,000 jobs de golpe.

---

## Síntesis — el mapa mental

1. Toda la tensión de este módulo nace de un solo hecho físico: la RAM permite acceso O(1) por **dirección calculada** (aritmética), pero calcular una dirección requiere que los elementos vivan en **posiciones predecibles** — es decir, contiguas.
2. **Array**: explota la contigüidad al máximo → acceso O(1), pero insertar/eliminar en posiciones distintas al final exige desplazar físicamente elementos → O(n).
3. **Lista ligada**: abandona la contigüidad a propósito, reemplazándola por punteros explícitos → insertar/eliminar es O(1) *si ya tienes el nodo*, pero acceder por índice exige recorrer secuencialmente → O(n). El costo oculto: overhead de punteros y pésima localidad de caché.
4. **Array dinámico**: resuelve la limitación de capacidad fija del array estático mediante `resize` — y la elección de **duplicar** (en vez de sumar constante) es lo que convierte una suma de costos que sería Θ(n²) en una que es Θ(n), dando **O(1) amortizado** por `append()`. Esto se prueba formalmente con tres métodos equivalentes: agregado, contable (pagar por adelantado), y potencial.
5. **Amortizado ≠ promedio**: amortizado es una garantía determinista sobre el costo total de una secuencia específica de operaciones; promedio es una afirmación estadística que depende de una distribución de probabilidad asumida. No las confundas.
6. **Pila (LIFO) y cola (FIFO)** no son estructuras nuevas a nivel de mecanismo — son **interfaces restringidas** sobre array dinámico (pila) o buffer circular (cola), donde la restricción existe porque modela un orden de procesamiento que es inherente a ciertos problemas (call stack, undo, BFS, scheduling).
7. **Buffer circular**: la solución al problema "eliminar del frente de un array es O(n)" — usa aritmética modular para mover *índices* en vez de mover *datos*, dando O(1) real para `dequeue`.
8. **Deque**: la generalización que hace O(1) ambos extremos, unificando pila y cola bajo una sola estructura.
9. Y la lección que trasciende el módulo: **la complejidad asintótica (Big-O) no es todo el rendimiento real** — la localidad de caché puede hacer que un algoritmo "peor" en Big-O gane en la práctica, porque el modelo RAM ignora a propósito la jerarquía de memoria real del hardware.

---

## Preguntas que deberías poder responder

1. Deriva desde la fórmula `dirección(i) = base + i*tamaño` por qué `arr[i]` es O(1) sin importar el valor de `i`. ¿Qué asume esta fórmula sobre el tipo de dato almacenado (pista: piensa en un array de strings de longitud variable vs. un array de enteros)?
2. Explica, sin ver el texto, por qué insertar al inicio de un array de n elementos es Θ(n), usando el argumento físico (no "porque así es"), y da un ejemplo de código donde esto convierte un algoritmo O(n) en O(n²) por accidente.
3. Prueba, con el método contable (asignando crédito explícito por operación), que `append()` en un array dinámico con factor de crecimiento 1.5x (en vez de 2x) sigue siendo O(1) amortizado. ¿Cambia la conclusión cualitativa, o solo la constante?
4. ¿Por qué "amortizado" no es lo mismo que "caso promedio"? Da un ejemplo donde una estructura tiene buen caso amortizado pero **mal** caso promedio bajo cierta distribución de inputs (o argumenta por qué esto no puede pasar).
5. En la `ListaDoblementeLigada`, explica exactamente por qué `eliminar_nodo(nodo)` es O(1) pero "eliminar el elemento en la posición 500" no lo es, aunque ambas usen la misma función internamente.
6. Diseña (en papel, no necesitas correrlo) el caso de prueba que rompería una implementación de buffer circular que no lleva un contador `_tamano` explícito y solo compara `frente == final` para decidir si está vacío o lleno.
7. Da un ejemplo concreto (no de este texto) donde un array con Big-O peor gana en benchmarks reales a una lista ligada con Big-O mejor, y explica el mecanismo de hardware (no solo "caché es más rápido") que lo causa.
8. ¿Por qué una pila se implementa naturalmente sobre un array dinámico y no sobre una lista ligada, dado que ambas dan O(1) para las operaciones que una pila necesita? ¿Qué factor, más allá del Big-O, decide esto?

---

## Fuentes

- UC Berkeley CS61B, *Data Structures*, notas y spec de proyecto sobre `AList`/`SLList`/`DLList` y análisis de arrays dinámicos: https://sp21.datastructur.es/ (y versiones posteriores del curso en https://cs61b-2.gitbook.io/cs61b/)
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 10 (Elementary Data Structures: stacks, queues, linked lists) y Capítulo 17 (Amortized Analysis: método agregado, contable, potencial; ejemplo de tabla dinámica en 17.4).
- MIT OpenCourseWare, 6.006, materiales relacionados de estructuras de datos y análisis amortizado: https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
