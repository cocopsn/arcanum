---
module_id: itc-c4-arboles
spine: ITC
title: "Árboles de búsqueda balanceados"
subtitle: "Por qué el orden logarítmico necesita mantenerse a la fuerza"
source_canonical: "MIT 6.006 L6-L7; CLRS cap. 12-13"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Árboles de búsqueda balanceados

> **Pregunta raíz.** Ya tienes dos herramientas poderosas: el array ordenado (búsqueda O(log n), pero inserción O(n) porque hay que desplazar) y la tabla hash (búsqueda O(1) esperado, pero sin ningún orden — no puedes pedir "el siguiente elemento mayor" ni recorrer en secuencia). ¿Existe una estructura que dé **ambas cosas**: operaciones O(log n) *y* que mantenga los elementos en orden, permitiendo recorridos ordenados, rangos, predecesor/sucesor? La respuesta es sí — pero el camino para llegar ahí revela por qué "árbol de búsqueda" y "árbol *balanceado* de búsqueda" son dos animales completamente distintos, y por qué el segundo exige maquinaria activa que el primero no necesita.

## Prólogo — de dónde nace esto

Piensa en cómo organizarías un archivo físico de expedientes por apellido, si tu objetivo es poder **buscar rápido** y **también** poder decir "dame todos los expedientes entre 'García' y 'Martínez', en orden". Un array ordenado logra esto con búsqueda binaria — pero insertar un expediente nuevo en medio exige recorrer físicamente el archivero corriendo todo lo que viene después, exactamente el problema que ya diagnosticamos en el módulo de estructuras lineales. Una tabla hash resuelve la inserción rápida — pero destruye el orden: los expedientes están dispersos según un cálculo aritmético que no tiene relación con el orden alfabético; no hay forma de pedir "el siguiente" sin escanear toda la tabla.

La solución estructural: organiza los expedientes como una **jerarquía de decisiones binarias**. Empiezas en un expediente "raíz" cualquiera. Si buscas un apellido menor, vas a la izquierda; si es mayor, vas a la derecha; repites la decisión en cada nivel. Esto es exactamente cómo un humano organiza intuitivamente un árbol genealógico de decisiones — y es exactamente la estructura de un **árbol binario de búsqueda (BST)**. Pero hay una trampa que vamos a exponer con todo rigor en la sección 2: **la jerarquía que construyes depende del orden en que insertas los expedientes**, y si los insertas ya ordenados alfabéticamente, la "jerarquía" que obtienes degenera en una simple lista — perdiendo toda la ventaja. Ese único hecho es la razón de existir de todo el resto del módulo: los árboles **balanceados** (AVL, en este caso) son la respuesta activa a esa degeneración.

---

## 1. El árbol binario de búsqueda — el invariante deducido desde la necesidad

### 1.1 ¿Qué invariante necesitas para que "izquierda/derecha" tenga sentido de búsqueda?

Un árbol binario, sin más, es solo una estructura jerárquica de nodos con hasta dos hijos cada uno — no tiene, por sí sola, ninguna propiedad de búsqueda. Para que "ir a la izquierda o a la derecha" te lleve consistentemente hacia la clave que buscas (y no sea una jerarquía arbitraria que tengas que recorrer entera, como cualquier árbol genérico), necesitas imponer una **invariante de orden**:

**Invariante BST**: para todo nodo `x`, todas las claves en el subárbol izquierdo de `x` son **menores** que la clave de `x`, y todas las claves en el subárbol derecho de `x` son **mayores**. Esta propiedad se cumple **recursivamente** en cada subárbol, no solo en el nodo raíz.

Esta invariante es exactamente lo que convierte una búsqueda en un algoritmo tipo búsqueda binaria: en cada nodo, comparas la clave buscada contra la clave del nodo actual, y esa comparación te dice **de forma determinística y correcta** hacia qué mitad del árbol dirigirte, descartando la otra mitad por completo — sin tener que examinarla nunca. Es la misma lógica de "divide y descarta" de la búsqueda binaria sobre un array, solo que la estructura de datos misma *es* la jerarquía de divisiones, en vez de calcularla sobre índices de un array plano.

```python
class Nodo:
    def __init__(self, clave, valor=None):
        self.clave = clave
        self.valor = valor
        self.izquierda = None
        self.derecha = None
        self.padre = None


class BST:
    """
    BST minimo, sin balance, para exponer el problema que motiva
    el resto del modulo. Fiel al esquema de CLRS cap. 12.
    """
    def __init__(self):
        self.raiz = None

    def buscar(self, clave):
        actual = self.raiz
        while actual is not None:
            if clave == actual.clave:
                return actual
            elif clave < actual.clave:
                actual = actual.izquierda
            else:
                actual = actual.derecha
        return None   # no encontrado

    def insertar(self, clave, valor=None):
        nuevo = Nodo(clave, valor)
        if self.raiz is None:
            self.raiz = nuevo
            return
        actual = self.raiz
        while True:
            if clave < actual.clave:
                if actual.izquierda is None:
                    actual.izquierda = nuevo
                    nuevo.padre = actual
                    return
                actual = actual.izquierda
            else:
                if actual.derecha is None:
                    actual.derecha = nuevo
                    nuevo.padre = actual
                    return
                actual = actual.derecha

    def altura(self, nodo):
        if nodo is None:
            return -1   # convencion: altura de arbol vacio es -1
        return 1 + max(self.altura(nodo.izquierda), self.altura(nodo.derecha))
```

### 1.2 Por qué búsqueda/inserción/eliminación son O(altura), no O(log n)

Nota que el costo de `buscar` e `insertar` no es "O(log n)" por definición — es **O(h)**, donde `h` es la altura del árbol (el número de niveles). En cada paso bajas exactamente un nivel, así que el número de comparaciones está acotado por cuántos niveles tiene el árbol. **Si el árbol está balanceado, h = O(log n)** — pero esto es una propiedad que hay que *garantizar*, no algo que un BST cualquiera te da gratis. Aquí es donde el módulo se pone serio.

### 1.3 El recorrido in-order — por qué el invariante también resuelve "dame todo en orden"

Una consecuencia directa (no una función extra que hay que diseñar aparte) del invariante BST: si recorres el árbol **in-order** (recursivamente: primero todo el subárbol izquierdo, luego el nodo actual, luego todo el subárbol derecho), obtienes automáticamente **todas las claves en orden ascendente**. Esto se sigue directamente de la definición del invariante — es una prueba trivial por inducción sobre la estructura del árbol (caso base: árbol vacío o de un nodo, trivialmente ordenado; paso inductivo: si ambos subárboles se recorren en orden por hipótesis, y todo el izquierdo es menor que la raíz que es menor que todo el derecho, concatenar izquierda+raíz+derecha da orden global). Esta propiedad — recorrido ordenado gratis — es exactamente lo que ni el array plano sin más estructura ni la tabla hash pueden ofrecer sin trabajo adicional, y es la mitad de la respuesta a la pregunta raíz del módulo.

---

## 2. El problema central — degeneración a lista ligada

### 2.1 El caso que rompe todo

¿Qué pasa si insertas las claves `1, 2, 3, 4, 5, ..., n` **en ese orden exacto**, en el BST de la sección 1?

Cada clave nueva es mayor que todas las anteriores, así que el `while` de `insertar` siempre baja por la derecha, nunca por la izquierda. El árbol resultante no tiene "forma de árbol" en ningún sentido útil — es una cadena: raíz(1) → derecha(2) → derecha(3) → ... → derecha(n). **Altura h = n-1.** Buscar la clave n exige recorrer los n nodos, uno por uno — exactamente O(n), idéntico al costo de recorrer una lista ligada. Toda la ventaja teórica de "divide y descarta" que motivó el diseño del BST se evapora completamente, **no por un error de implementación, sino por el orden de inserción de los datos** — algo que en la práctica está fuera de tu control (llegan datos de un usuario, de un sensor, de un stream externo, frecuentemente ya ordenados o casi ordenados).

**Por qué esto no es un caso hipotético raro**: en la práctica, insertar datos ya ordenados es un patrón *común*, no patológico — un log de eventos con timestamps crecientes, IDs autoincrementales de una base de datos, un stream que llega pre-ordenado de otro sistema. Si tu servicio recibe 10 millones de registros con IDs secuenciales y los inserta en un BST sin balance, cada inserción cuesta, en promedio, O(n/2) — porque el árbol es efectivamente una lista de longitud creciente. El costo total de las 10 millones de inserciones es **Θ(n²)**, no Θ(n log n). Con n=10,000,000, la diferencia entre n² y n log n no es una curiosidad académica — es la diferencia entre un proceso que termina en minutos y uno que no termina en tu vida útil como ingeniero (n² con n=10⁷ son 10¹⁴ operaciones; n log n con el mismo n son ~2.3×10⁸ — cinco a seis órdenes de magnitud de diferencia).

**Esta es la razón de existir de todo lo que sigue en el módulo**: un BST sin garantía de balance es una estructura cuyo peor caso es tan malo como la peor estructura lineal posible, a pesar de que su *mejor* caso sea excelente. Necesitamos una forma de **garantizar** que el árbol nunca degenera, sin importar el orden de inserción — y esa garantía tiene que mantenerse **activamente**, con trabajo adicional en cada inserción/eliminación, porque el desbalance puede aparecer en cualquier momento.

---

## 3. AVL — el balance como invariante adicional, y su costo

### 3.1 El factor de balance — la métrica que hace el desbalance detectable

Adelson-Velsky y Landis (de ahí "AVL") propusieron en 1962 la primera solución rigurosa: además del invariante de orden del BST, imponer un **invariante de balance** verificable en O(1) por nodo:

**Factor de balance de un nodo x**: `FB(x) = altura(subárbol izquierdo de x) − altura(subárbol derecho de x)`.

**Invariante AVL**: para todo nodo `x` en el árbol, `FB(x) ∈ {-1, 0, 1}`.

¿Por qué esta métrica específica y no otra? Porque es la forma más **débil** posible de invariante que sigue siendo suficiente para garantizar O(log n) — y "más débil" aquí es una virtud de diseño, no un defecto: cuanto más débil (menos estricto) el invariante que aún garantiza el resultado que quieres, menos trabajo de reequilibrado necesitas hacer en cada operación. Un invariante más fuerte (ej. "ambos subárboles deben tener *exactamente* la misma altura") sería demasiado restrictivo — imposible de mantener con número arbitrario de nodos (¿qué haces con un árbol de 5 nodos, donde no puedes repartir 5 en dos mitades exactamente iguales?). AVL permite una diferencia de hasta 1 nivel entre subárboles hermanos, y vamos a probar rigurosamente en la sección 3.2 que **eso es suficiente** para garantizar altura logarítmica.

### 3.2 La derivación central del módulo: por qué el invariante AVL garantiza h = O(log n)

Esta es la pieza intelectual más importante de todo el texto — hazla completa, no la aceptes de memoria.

**Pregunta**: dado que cada nodo respeta `FB(x) ∈ {-1,0,1}`, ¿cuál es la altura **máxima** posible de un árbol AVL con `n` nodos? Equivalentemente (más fácil de atacar): **¿cuál es el número MÍNIMO de nodos que puede tener un árbol AVL de altura h?** Si encontramos esa función, `n ≥ N(h)`, y de ahí despejamos h en función de n.

**Construcción de la recurrencia**: sea `N(h)` el mínimo número de nodos posible en un árbol AVL de altura exactamente `h`. Para minimizar nodos en altura h, uno de los dos subárboles debe tener la altura máxima permitida por el invariante relativa al otro — es decir, la forma de "estirar la altura gastando el menor número de nodos posible" es que un subárbol tenga altura `h-1` (el máximo que permite alcanzar altura h en la raíz) y el otro tenga la altura mínima que el invariante todavía permite junto a él, que es `h-2` (porque `FB ≤ 1` en valor absoluto — la diferencia máxima permitida es exactamente 1 nivel). Ambos subárboles, para minimizar nodos totales, deben ser ellos mismos árboles AVL **mínimos** de sus respectivas alturas. Esto da la recurrencia:

```
N(h) = 1 + N(h-1) + N(h-2)
```

con casos base `N(-1) = 0` (árbol vacío, convención de altura -1) y `N(0) = 1` (un solo nodo, altura 0).

**Reconoce la forma**: esta recurrencia es *estructuralmente idéntica* a la de Fibonacci (`F(k) = F(k-1) + F(k-2)`), salvo el `+1` y el desfase de índices. No es coincidencia estética — es la misma estructura combinatoria: en Fibonacci, cada término se construye combinando los dos anteriores; aquí, cada árbol mínimo se construye combinando (mediante una raíz) los dos árboles mínimos de alturas inmediatamente inferiores. De hecho, se puede probar formalmente (por inducción, comparando término a término) que:

```
N(h) = F(h+3) - 1
```

donde `F` es la secuencia de Fibonacci estándar (F(0)=0, F(1)=1, F(2)=1, F(3)=2, ...). Verifiquemos los primeros términos para confiar en la fórmula antes de usarla: `N(0) = F(3)-1 = 2-1 = 1` ✓. `N(1) = 1+N(0)+N(-1) = 1+1+0 = 2`, y `F(4)-1 = 3-1 = 2` ✓. `N(2) = 1+N(1)+N(0) = 1+2+1 = 4`, y `F(5)-1 = 5-1 = 4` ✓. La fórmula se sostiene.

**El paso final — despejar h**: se sabe (crecimiento asintótico estándar de Fibonacci, demostrable por su fórmula cerrada de Binet) que `F(k)` crece **exponencialmente** en k, específicamente `F(k) ≈ φ^k / √5` donde `φ = (1+√5)/2 ≈ 1.618` (la razón áurea). Entonces:

```
n ≥ N(h) = F(h+3) - 1 ≈ φ^(h+3) / √5 - 1
```

Despejando h (tomando logaritmo base φ de ambos lados, y absorbiendo constantes):

```
h = O(log_φ(n)) = O(log(n))
```

**Esta es la prueba completa**: el invariante AVL (diferencia de altura ≤ 1 entre subárboles hermanos) fuerza que el número de nodos crezca *al menos* exponencialmente con la altura — y por lo tanto, invirtiendo la relación, la altura crece *a lo más* logarítmicamente con el número de nodos. **h = O(log n) no es una esperanza estadística ni un comportamiento típico — es una garantía matemática de peor caso**, derivada directamente del invariante de balance, sin ninguna suposición sobre el orden de inserción de los datos. Esto es exactamente lo que un BST sin balance no puede ofrecer (sección 2), y es la razón de ser de todo el resto de la maquinaria de este módulo (las rotaciones).

**Nota de calibración cuantitativa**: la base del logaritmo es φ ≈ 1.618, no 2 — así que la altura real de un AVL es *ligeramente mayor* que la de un árbol "perfectamente balanceado" (base 2), pero sigue siendo O(log n) con constante razonable: `log_φ(n) ≈ 1.44 · log₂(n)`. Con n = 10⁶, un árbol perfectamente balanceado tendría altura ~20; un AVL en su peor caso teórico tendría altura ~29 — ambos radicalmente mejores que los 10⁶ de la lista degenerada.

---

## 4. Rotaciones — el mecanismo que restaura el invariante

### 4.1 Por qué se rompe el invariante al insertar (y por qué NO puedes simplemente "reinsertar todo ordenado")

Al insertar un nuevo nodo con el algoritmo BST estándar (sección 1), el nuevo nodo aumenta la altura de la cadena de ancestros por la que descendió — y eso puede violar `FB(x) ∈ {-1,0,1}` en alguno de esos ancestros. La solución ingenua ("cuando se desbalancee, reconstruye todo el árbol óptimamente desde cero") sería correcta pero **inaceptablemente cara**: reconstruir el árbol completo cuesta O(n), y si haces eso en cada inserción, pierdes toda la ventaja de O(log n) por inserción — terminarías con O(n) por inserción, exactamente el mismo problema que estamos tratando de resolver.

**Lo que necesitamos**: una operación **local** (que solo toca un número constante de nodos alrededor del punto de desbalance) que restaure el invariante sin reconstruir nada más. Esa operación es la **rotación**.

### 4.2 La rotación simple — mecánica y por qué preserva el invariante BST

Una **rotación** reorganiza un pequeño subconjunto de nodos (un nodo desbalanceado y sus hijos/nietos inmediatos) para reducir la altura de un lado sin violar el invariante de orden BST. Aquí está la rotación hacia la derecha (usada cuando el desbalance está a la izquierda), con el argumento de por qué preserva el orden:

```
        y                    x
       / \                  / \
      x   T3      -->      T1   y
     / \                       / \
    T1  T2                    T2  T3
```

Antes de la rotación (invariante BST implica): `T1 < x < T2 < y < T3`.
Después de la rotación, verificamos que el mismo orden se preserve en la nueva forma: `x` es ahora la raíz, con `T1` a la izquierda (correcto, T1 < x) y `y` a la derecha con `T2` como su hijo izquierdo y `T3` como derecho — necesitamos `T2 < y < T3` (correcto, se mantiene) y `x < T2` (correcto, porque originalmente T2 estaba entre x e y). **El invariante de orden BST se preserva exactamente porque la rotación solo reorganiza punteros, nunca mueve una clave fuera del rango que el invariante original ya garantizaba** — es una reestructuración de la jerarquía, no una modificación de qué claves están en qué "vecindad" ordenada.

```python
def rotar_derecha(self, y):
    """
    y es el nodo desbalanceado. x es su hijo izquierdo.
    Costo: O(1) -- solo reasigna un numero constante de punteros,
    sin tocar T1, T2, T3 como subarboles (solo sus raices se reenganchan).
    """
    x = y.izquierda
    T2 = x.derecha

    # Reenganchar
    x.derecha = y
    y.izquierda = T2
    if T2 is not None:
        T2.padre = y

    # Actualizar padre
    x.padre = y.padre
    y.padre = x
    if x.padre is not None:
        if x.padre.izquierda is y:
            x.padre.izquierda = x
        else:
            x.padre.derecha = x

    # CRITICO: recalcular alturas de ABAJO hacia ARRIBA
    # (y primero, porque ahora es el hijo; x despues, porque depende de y)
    self._actualizar_altura(y)
    self._actualizar_altura(x)

    return x   # nueva raiz de este subarbol
```

**Costo O(1) por rotación**: solo reasigna un número constante de punteros y recalcula un número constante de alturas — no toca los subárboles T1, T2, T3 como conjuntos de nodos, solo reengancha sus raíces. Esto es lo que hace viable mantener el balance sin sacrificar el costo logarítmico de la inserción: cada inserción hace O(log n) de descenso más, en el peor caso, O(log n) rotaciones subiendo de vuelta por el camino de ancestros (aunque, como veremos, en la práctica basta con **una** rotación, o **una doble**, para restaurar el balance completo del árbol después de una inserción — un resultado no trivial que probamos en la sección 4.4).

### 4.3 Los cuatro casos — deducidos, no memorizados

Cuando insertas un nodo y subes por los ancestros actualizando alturas, el primer ancestro con `|FB| = 2` es el punto de desbalance. Hay **cuatro** configuraciones posibles, según por dónde entró el nuevo nodo relativo al desbalanceado — y hay que deducir por qué son exactamente estas cuatro y no más ni menos.

El desbalance tiene dos grados de libertad: (1) ¿el subárbol *pesado* está a la izquierda o a la derecha del nodo desbalanceado?, y (2) dentro de ese subárbol pesado, ¿el nuevo nodo entró por el hijo izquierdo o el derecho de la raíz de ese subárbol? Dos decisiones binarias → 2×2 = **4 casos**, ni uno más:

- **LL (Left-Left)**: pesado a la izquierda, insertado en el subárbol izquierdo del hijo izquierdo. **Una rotación simple a la derecha** basta (sección 4.2) — la geometría del desbalance es simétrica a la que la rotación simple está diseñada para corregir directamente.
- **RR (Right-Right)**: espejo de LL. **Una rotación simple a la izquierda** basta.
- **LR (Left-Right)**: pesado a la izquierda, pero insertado en el subárbol **derecho** del hijo izquierdo.
- **RL (Right-Left)**: espejo de LR.

### 4.4 Por qué LR y RL necesitan DOBLE rotación — deducido geométricamente, no memorizado

Aquí está la parte que casi todos memorizan sin entender por qué. Analicemos LR con cuidado.

En el caso LR, el nodo desbalanceado `z` tiene su hijo izquierdo `y` pesado, pero el nuevo nodo se insertó en el subárbol **derecho** de `y` (llamémoslo con raíz `x`). Si aplicas directamente una rotación simple a la derecha sobre `z` (tratando esto como si fuera LL), ¿qué pasa? La rotación simple mueve `y` a la posición de raíz y cuelga `z` a su derecha — pero el problema es que **el peso adicional sigue estando del lado derecho de `y`** (donde está `x` con el nuevo nodo), así que después de la rotación simple, el subárbol resultante sigue desbalanceado — solo que ahora el desbalance se movió de forma, no se resolvió. Una rotación simple **asume que el peso extra está "alineado" en línea recta con la dirección de la rotación** (por eso funciona perfecto en LL/RR, donde el peso sí está alineado) — pero en LR/RL, el peso está en una "zigzag", no en línea recta, y por lo tanto una sola rotación no puede enderezarlo.

**La solución, deducida geométricamente**: primero aplica una rotación simple a la **izquierda** sobre `y` (el hijo intermedio, no el nodo desbalanceado raíz) — esto convierte la configuración en zigzag (LR) en una configuración en línea recta (LL), moviendo `x` a la posición donde estaba `y`. **Ahora sí**, aplica la rotación simple a la **derecha** sobre `z` (el nodo originalmente desbalanceado), que ahora sí corrige un desbalance alineado en línea recta. Dos rotaciones simples encadenadas — eso es la "rotación doble", y no es una operación primitiva nueva, es literalmente la composición de dos rotaciones simples que ya definimos, aplicada en el orden correcto para "enderezar el zigzag antes de corregir la altura".

```python
def rebalancear(self, nodo):
    """
    Dado un nodo con |FB| = 2 recien detectado, aplica la rotacion
    (simple o doble) que corresponda segun los 4 casos deducidos arriba.
    """
    fb = self._factor_balance(nodo)

    if fb > 1:  # pesado a la izquierda
        if self._factor_balance(nodo.izquierda) < 0:
            # caso LR: primero enderezar el zigzag
            nodo.izquierda = self.rotar_izquierda(nodo.izquierda)
        # caso LL (o LR ya enderezado a LL): rotacion simple derecha
        return self.rotar_derecha(nodo)

    if fb < -1:  # pesado a la derecha
        if self._factor_balance(nodo.derecha) > 0:
            # caso RL: primero enderezar el zigzag
            nodo.derecha = self.rotar_derecha(nodo.derecha)
        # caso RR (o RL ya enderezado a RR): rotacion simple izquierda
        return self.rotar_izquierda(nodo)

    return nodo   # ya estaba balanceado
```

**Costo**: aunque sea "doble", sigue siendo O(1) — dos operaciones O(1) encadenadas siguen siendo O(1), solo con una constante ligeramente mayor. No rompe la garantía de costo constante por corrección de desbalance.

---

## 5. Implementación completa — AVL desde cero con inserción

```python
class NodoAVL:
    __slots__ = ("clave", "valor", "izquierda", "derecha", "altura")

    def __init__(self, clave, valor=None):
        self.clave = clave
        self.valor = valor
        self.izquierda = None
        self.derecha = None
        self.altura = 0   # altura de un nodo hoja recien creado


class ArbolAVL:
    """
    AVL completo con insercion, rotaciones y mantenimiento de altura.
    Fiel al esquema de MIT 6.006 L7 / CLRS 13 adaptado al invariante
    de factor de balance (la formulacion clasica de Adelson-Velsky/Landis).
    """
    def __init__(self):
        self.raiz = None

    def _altura(self, nodo):
        return nodo.altura if nodo is not None else -1

    def _actualizar_altura(self, nodo):
        # TRAMPA CRITICA: si olvidas esta actualizacion despues de CUALQUIER
        # cambio estructural (insercion, rotacion), el factor de balance
        # calculado despues sera INCORRECTO, y el arbol puede degenerar
        # silenciosamente sin que ningun error se dispare -- el bug mas
        # peligroso de un AVL mal implementado, porque no truena, solo
        # deja de dar la garantia O(log n) sin avisar.
        nodo.altura = 1 + max(self._altura(nodo.izquierda), self._altura(nodo.derecha))

    def _factor_balance(self, nodo):
        if nodo is None:
            return 0
        return self._altura(nodo.izquierda) - self._altura(nodo.derecha)

    def rotar_derecha(self, y):
        x = y.izquierda
        T2 = x.derecha
        x.derecha = y
        y.izquierda = T2
        self._actualizar_altura(y)   # y primero: ahora es hijo
        self._actualizar_altura(x)   # x despues: depende de la altura de y
        return x

    def rotar_izquierda(self, x):
        y = x.derecha
        T2 = y.izquierda
        y.izquierda = x
        x.derecha = T2
        self._actualizar_altura(x)
        self._actualizar_altura(y)
        return y

    def _rebalancear(self, nodo):
        self._actualizar_altura(nodo)
        fb = self._factor_balance(nodo)

        if fb > 1:
            if self._factor_balance(nodo.izquierda) < 0:
                nodo.izquierda = self.rotar_izquierda(nodo.izquierda)   # LR
            return self.rotar_derecha(nodo)                             # LL

        if fb < -1:
            if self._factor_balance(nodo.derecha) > 0:
                nodo.derecha = self.rotar_derecha(nodo.derecha)         # RL
            return self.rotar_izquierda(nodo)                           # RR

        return nodo

    def insertar(self, clave, valor=None):
        self.raiz = self._insertar_rec(self.raiz, clave, valor)

    def _insertar_rec(self, nodo, clave, valor):
        if nodo is None:
            return NodoAVL(clave, valor)
        if clave < nodo.clave:
            nodo.izquierda = self._insertar_rec(nodo.izquierda, clave, valor)
        elif clave > nodo.clave:
            nodo.derecha = self._insertar_rec(nodo.derecha, clave, valor)
        else:
            nodo.valor = valor   # clave ya existe: actualizar
            return nodo
        # Al regresar de la recursion (post-order), rebalanceamos
        # de ABAJO hacia ARRIBA -- esto es lo que garantiza que
        # SOLO se necesite, como maximo, una rotacion/rotacion-doble
        # para restaurar el invariante en TODO el camino hasta la raiz
        # (resultado no trivial: la primera correccion desde abajo ya
        # restaura la altura del subarbol a su valor pre-insercion).
        return self._rebalancear(nodo)

    def in_order(self):
        resultado = []
        def _rec(nodo):
            if nodo is not None:
                _rec(nodo.izquierda)
                resultado.append(nodo.clave)
                _rec(nodo.derecha)
        _rec(self.raiz)
        return resultado


if __name__ == "__main__":
    avl = ArbolAVL()
    # Insertamos EN ORDEN -- el caso que degeneraba el BST simple (seccion 2)
    for clave in range(1, 16):
        avl.insertar(clave)

    print("in-order:", avl.in_order())          # sigue ordenado: 1..15
    print("altura del arbol:", avl.raiz.altura)  # ~3-4, NO 14 como en el BST simple

    assert avl.in_order() == list(range(1, 16))
    # log2(15) ~= 3.9 -- la altura real debe estar cerca de eso, no de 14.
    assert avl.raiz.altura <= 4
    print("OK: insercion ordenada NO degenero el arbol")
```

Corre esto y compáralo mentalmente contra la sección 2: **el mismo patrón de inserción que degeneraba el BST simple a una lista de altura 14 produce, en el AVL, un árbol de altura ~4** — la maquinaria de rotaciones está haciendo exactamente el trabajo que prometimos: convertir el peor caso del BST simple en el caso típico garantizado del AVL.

---

## 6. Eliminación — más sutil que inserción, y por qué

La inserción siempre añade un nodo hoja y sube corrigiendo — un solo punto de entrada. La eliminación tiene **tres casos según el número de hijos del nodo a eliminar** (0, 1, o 2), y el caso de 2 hijos es el que exige cuidado: no puedes simplemente "quitar" un nodo con dos subárboles sin romper el invariante BST — necesitas reemplazarlo con su **sucesor in-order** (el menor elemento del subárbol derecho, alcanzado bajando siempre a la izquierda desde ahí) o su **predecesor in-order** (simétrico), copiar esa clave/valor al nodo que ibas a eliminar, y **luego** eliminar el nodo sucesor/predecesor de su posición original (que, por construcción, tiene a lo más un hijo, reduciéndolo a un caso más simple).

**Por qué es "más sutil" que la inserción, específicamente**: después de eliminar y rebalancear localmente en el punto donde ocurrió el cambio estructural, **la corrección puede tener que propagarse hasta la raíz** — a diferencia de la inserción, donde (como se nota en el comentario del código de arriba) una sola rotación/rotación-doble en el punto más bajo de desbalance ya restaura la altura completa del subárbol a su valor anterior, deteniendo la propagación ahí mismo. En eliminación, restaurar el balance en un punto **puede reducir la altura de ese subárbol**, lo cual puede a su vez desbalancear al *padre* de ese subárbol, que entonces también necesita rebalanceo, potencialmente en cascada hasta la raíz. El costo sigue siendo O(log n) en el peor caso (como mucho, un número de rotaciones proporcional a la altura), pero el número de rotaciones necesarias en el peor caso de eliminación puede ser mayor que en inserción — una distinción de matiz que vale la pena tener presente, aunque ambos casos permanezcan O(log n).

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo de MIT 6.006 / CLRS citado arriba.)*

**B-trees y por qué las bases de datos NO usan AVL para índices en disco.** Todo el análisis de este módulo asumió (implícitamente, igual que en módulos anteriores) el modelo RAM: cada acceso a un nodo cuesta O(1), sin importar dónde esté en memoria. Cuando los datos viven en **disco** (o en el índice de una base de datos, que puede ser demasiado grande para caber en RAM), esa suposición se rompe de forma brutal: un acceso a disco (incluso SSD, y mucho más HDD) cuesta órdenes de magnitud más que un acceso a RAM — y lo que domina el costo no es cuántas *comparaciones* haces, sino cuántas veces tienes que **tocar** un bloque de disco distinto. Un AVL, aunque tenga altura O(log n) óptima en número de *nodos*, tiene fan-out de solo 2 por nodo — así que para n=10⁹ registros, la altura es ~30, lo que significa **hasta 30 accesos a disco separados** para una sola búsqueda, cada uno potencialmente costando milisegundos. Un **B-tree** resuelve esto generalizando el invariante BST a nodos con **muchos** hijos (cientos, no dos), diseñados explícitamente para que cada nodo del árbol ocupe exactamente un bloque de disco — maximizando cuántas decisiones de "izquierda/derecha" (en realidad "cuál de mis cientos de hijos") resuelves por cada acceso a disco. Con fan-out de, digamos, 200, la misma base de 10⁹ registros tiene altura ~4, no ~30 — una reducción de casi un orden de magnitud en accesos a disco. Este es exactamente el mismo principio de "modelo de cómputo real vs. modelo RAM idealizado" que vimos con localidad de caché en el módulo de estructuras lineales, aplicado un nivel más arriba en la jerarquía de memoria (RAM vs. disco, en vez de caché vs. RAM). Es la razón concreta y verificable de por qué MySQL (InnoDB), PostgreSQL y la inmensa mayoría de sistemas de bases de datos relacionales usan variantes de B-tree (específicamente B+trees) para sus índices, no AVL ni red-black trees.

**Red-black trees — dónde viven, y el trade-off contra AVL.** Un red-black tree es otra estrategia de árbol auto-balanceado, con un invariante distinto (basado en "colorear" nodos rojo/negro con reglas sobre caminos desde la raíz a las hojas) que también garantiza h = O(log n), pero con una **constante de balance más laxa** que AVL — permite más desbalance relativo antes de intervenir. El trade-off directo: AVL, al estar más estrictamente balanceado, da búsquedas ligeramente más rápidas (altura más cercana al óptimo teórico), pero paga con **más rotaciones** durante inserciones/eliminaciones para mantener ese balance más estricto. Red-black tolera más desbalance, así que necesita **menos rotaciones** en promedio para mantenerse dentro de su invariante (más laxo), a costa de alturas ligeramente mayores y por lo tanto búsquedas ligeramente más lentas. **La regla de decisión de ingeniería**: si tu carga de trabajo es dominada por búsquedas (lecturas) con pocas modificaciones, AVL gana (altura más óptima donde más importa). Si tu carga tiene muchas inserciones/eliminaciones frecuentes, red-black gana (menos trabajo de reequilibrado por escritura). Esta es exactamente la razón práctica, no arbitraria, de por qué `std::map` y `std::set` de C++ están implementados típicamente como red-black trees (uso general, mezcla de lecturas y escrituras), y por qué `TreeMap` de Java también usa red-black — en ambos casos, la biblioteca estándar apuesta por el balance de trade-offs adecuado para uso general, no por el balance más estricto posible.

---

## Síntesis — el mapa mental

1. Ni el array ordenado (inserción O(n)) ni la tabla hash (sin orden) dan simultáneamente **orden mantenido** y **operaciones O(log n)** — el BST nace exactamente para llenar ese hueco, imponiendo el invariante de orden (izquierda menor, derecha mayor) que convierte "bajar por el árbol" en un algoritmo de descarte tipo búsqueda binaria.
2. El costo de las operaciones de un BST es O(**altura**), no O(log n) por definición — y un BST sin restricción adicional puede degenerar a altura O(n) con inserciones ya ordenadas (la cadena/lista ligada disfrazada de árbol). Esto no es un caso hipotético, es un patrón común en datos reales (IDs secuenciales, timestamps).
3. AVL impone un invariante de balance adicional (`FB(x) ∈ {-1,0,1}` en cada nodo) que **garantiza matemáticamente** h = O(log n), probado rigurosamente vía la recurrencia `N(h) = 1 + N(h-1) + N(h-2)` — estructuralmente Fibonacci, cuyo crecimiento exponencial en h implica, al invertir, crecimiento logarítmico de h en n.
4. Las **rotaciones** son la operación local de costo O(1) que restaura el invariante de balance sin reconstruir el árbol completo — la razón por la que mantener el balance no destruye la ventaja de costo logarítmico por operación.
5. Los cuatro casos de desbalance (LL, RR, LR, RL) se derivan de dos decisiones binarias geométricas (lado pesado × lado de entrada del nuevo nodo). LL/RR se corrigen con **una** rotación simple porque el peso está alineado en línea recta con la dirección de corrección; LR/RL necesitan **rotación doble** porque el peso está en zigzag, y la primera rotación de la doble solo endereza esa zigzag antes de que la segunda corrija la altura.
6. La eliminación es estructuralmente más compleja que la inserción porque la corrección de balance puede necesitar propagarse hasta la raíz (en vez de detenerse en el primer punto de corrección), aunque el costo total siga siendo O(log n).
7. El olvido más peligroso al implementar un AVL es no actualizar la altura de un nodo después de cualquier cambio estructural — el árbol sigue "funcionando" (respuestas correctas) pero pierde silenciosamente su garantía de balance, sin ningún error visible que lo delate.

---

## Preguntas que deberías poder responder

1. Deriva desde cero, sin ver el texto, la recurrencia `N(h) = 1 + N(h-1) + N(h-2)` para el número mínimo de nodos de un AVL de altura h — explica en tus propias palabras por qué el segundo subárbol usa `h-2` y no `h-1` en esa recurrencia.
2. Usando la relación `N(h) = F(h+3) - 1` y el crecimiento exponencial de Fibonacci (`F(k) ≈ φ^k/√5`), deriva la cota `h = O(log n)` paso a paso, sin saltarte el despeje del logaritmo.
3. Explica geométricamente (con un dibujo mental de tres nodos en zigzag) por qué una sola rotación simple NO puede corregir un desbalance tipo LR, y por qué la primera rotación de la doble rotación resuelve exactamente ese obstáculo geométrico.
4. Construye, insertando manualmente las claves `[30, 10, 40, 5, 20, 35, 50, 3]` una a una en un AVL vacío, identificando en qué inserción(es) se dispara una rotación y de qué tipo (LL/RR/LR/RL).
5. ¿Por qué olvidar `_actualizar_altura` después de una rotación es un bug particularmente peligroso comparado con, digamos, un `IndexError`? ¿Qué comportamiento observarías en producción antes de detectar el problema?
6. Explica por qué la eliminación en un AVL puede requerir propagar el rebalanceo hasta la raíz, mientras que la inserción típicamente se detiene en el primer punto de corrección — ¿qué diferencia estructural entre ambas operaciones causa esto?
7. Dado que un B-tree con fan-out 200 tiene altura ~4 para mil millones de registros, mientras un AVL tiene altura ~30 para el mismo n, ¿por qué NO usarías siempre B-trees, incluso para estructuras que viven completamente en RAM? (Pista: piensa en qué modelo de costo estás asumiendo y si sigue aplicando.)
8. Da un escenario concreto de ingeniería (no de este texto) donde elegirías red-black tree sobre AVL, y otro donde elegirías AVL sobre red-black — justifica ambos con el trade-off de rotaciones vs. altura de búsqueda.

---

## Fuentes

- MIT 6.006, *Introduction to Algorithms*, Lecture 6 (Binary Search Trees) y Lecture 7 (AVL Trees): https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/
- Cormen, Leiserson, Rivest, Stein (CLRS), *Introduction to Algorithms*, 3ª/4ª edición — Capítulo 12 (Binary Search Trees) y Capítulo 13 (Red-Black Trees; el análisis de altura logarítmica vía invariante de balance sigue el mismo patrón de argumento que CLRS usa para red-black, adaptado aquí al invariante AVL clásico).
- Adelson-Velsky, G. M. y Landis, E. M., "An algorithm for the organization of information", *Doklady Akademii Nauk SSSR*, 1962 — el paper original de árboles AVL.
