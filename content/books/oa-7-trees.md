---
module_id: oa-7-trees
spine: OA Amazon
title: "Árboles Binarios"
subtitle: "Recorrer y devolver hacia arriba"
source_canonical: "itc-c4-arboles; itc-c6-grafos-i; patrones Amazon-tagged de LCA, Validate BST, All Nodes Distance K, House Robber III"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 40
---

# Árboles Binarios

> **Pregunta raíz.** Los árboles son, con diferencia, el filtro más consistente de Amazon — aparecen en una fracción enorme de los OAs reportados, y casi siempre con la misma estructura de fondo: un **DFS recursivo que no solo desciende, sino que devuelve información hacia arriba** desde cada subárbol hacia su padre, que la combina para construir la respuesta global. Dominar esa estructura —recorrer hacia abajo, devolver información hacia arriba, combinar en cada nivel— es la clave que abre la mayoría de los problemas de árboles del examen, sin importar qué tan distintos se vean en la superficie.

## Prólogo

La teoría de árboles —BST, AVL, por qué la altura logarítmica importa— ya la construiste completa en `itc-c4-arboles`, y BFS/DFS los tienes de primer principio en `itc-c6-grafos-i`. Este módulo vive en la otra naturaleza: reflejo de examen. Los cuatro recorridos deben ser memoria muscular, tecleables sin pensar, para que tu atención se concentre en la parte específica y nueva de cada problema.

---

## 1. Los cuatro recorridos — memoria muscular

```python
class Nodo:
    def __init__(self, val, izq=None, der=None):
        self.val = val
        self.izq = izq
        self.der = der


def inorder(nodo, resultado):
    if nodo is None:
        return
    inorder(nodo.izq, resultado)
    resultado.append(nodo.val)
    inorder(nodo.der, resultado)


def preorder(nodo, resultado):
    if nodo is None:
        return
    resultado.append(nodo.val)
    preorder(nodo.izq, resultado)
    preorder(nodo.der, resultado)


def postorder(nodo, resultado):
    if nodo is None:
        return
    postorder(nodo.izq, resultado)
    postorder(nodo.der, resultado)
    resultado.append(nodo.val)


def level_order(raiz):
    from collections import deque
    if raiz is None:
        return []
    resultado = []
    cola = deque([raiz])
    while cola:
        nivel = []
        for _ in range(len(cola)):
            nodo = cola.popleft()
            nivel.append(nodo.val)
            if nodo.izq:
                cola.append(nodo.izq)
            if nodo.der:
                cola.append(nodo.der)
        resultado.append(nivel)
    return resultado
```

**Recuerda de tu teoría (`itc-c4-arboles`)**: inorder sobre un BST da los valores en orden ascendente — esa propiedad es exactamente lo que vas a explotar en la sección 3 para validar un BST. Level-order es BFS puro, la misma cola FIFO de `itc-c6-grafos-i`, con el truco de `range(len(cola))` para procesar un nivel completo a la vez antes de pasar al siguiente — memorízalo así, es el patrón exacto que necesitas cada vez que un problema pida "por niveles" o "el valor más a la derecha de cada fila".

---

## 2. DFS que devuelve información hacia arriba — la estructura central

### 2.1 El patrón, en su forma más general

```python
def dfs_devuelve_info(nodo):
    if nodo is None:
        return None   # valor base para arbol vacio, especifico del problema

    info_izq = dfs_devuelve_info(nodo.izq)
    info_der = dfs_devuelve_info(nodo.der)

    # AQUI combinas info_izq, info_der, y nodo.val para:
    # 1) potencialmente actualizar una respuesta global (via variable
    #    externa/nonlocal, o una lista mutable capturada por closure)
    # 2) construir y devolver la info que ESTE subarbol le pasa a su padre

    return None   # reemplaza por: info que este subarbol aporta hacia arriba
```

**Por qué este patrón cubre tantos problemas distintos**: la mayoría de las preguntas sobre árboles — profundidad, diámetro, si es balanceado, la suma máxima de un camino, House Robber III — tienen la misma forma lógica: **la respuesta en un nodo depende de resolver primero, completamente, ambos subárboles**, y luego combinar esa información. Esto es exactamente DFS post-order (resuelve hijos antes que el padre), con una capa de "combina y propaga" en el momento en que cada llamada recursiva regresa — el mismo orden de finalización que ya dominas de tu teoría de grafos, aplicado aquí a árboles.

---

## 3. Validar BST — con rango, nunca con el vecino inmediato

### 3.1 La trampa que hay que evitar desde el diseño

Un error común: verificar solo que cada nodo sea mayor que su hijo izquierdo inmediato y menor que su hijo derecho inmediato. **Esto no basta** — un BST exige que **todo** el subárbol izquierdo sea menor, y **todo** el subárbol derecho sea mayor, no solo el hijo directo. Un árbol puede tener cada par padre-hijo localmente correcto y aun así violar la propiedad BST dos niveles más abajo.

### 3.2 La solución — pasar un rango válido hacia abajo

```python
def es_bst_valido(nodo, minimo=float('-inf'), maximo=float('inf')):
    """
    Pasa el rango [minimo, maximo] valido HACIA ABAJO en la recursion --
    cada nodo debe caer dentro de ese rango, y el rango se estrecha
    conforme desciendes por la izquierda (nuevo maximo = valor del padre)
    o por la derecha (nuevo minimo = valor del padre).
    """
    if nodo is None:
        return True
    if not (minimo < nodo.val < maximo):
        return False
    return (es_bst_valido(nodo.izq, minimo, nodo.val) and
            es_bst_valido(nodo.der, nodo.val, maximo))
```

**Nota que esta es la excepción a la sección 2**: aquí la información fluye **hacia abajo** (el rango válido), no hacia arriba — porque la pregunta ("¿está este nodo dentro del rango permitido por todos sus ancestros?") depende de lo que ya sabes de arriba, no de lo que vas a descubrir abajo. Reconocer cuál dirección de flujo necesita tu problema —hacia arriba (la mayoría, sección 2) o hacia abajo (validación de restricciones heredadas, como aquí)— es parte de la deducción rápida que este módulo entrena.

**Alternativa usando la propiedad de inorder**: ya sabes, de la sección 1, que inorder sobre un BST válido da valores estrictamente ascendentes — recorre inorder y verifica que cada valor sea mayor al anterior. Ambas soluciones son válidas; la de rango es más directa de razonar bajo presión.

---

## 4. LCA (Lowest Common Ancestor) — el patrón de "encontrar en ambos lados"

```python
def lca(raiz, p, q):
    """
    Si p y q estan en subarboles distintos de 'raiz', raiz mismo
    es el LCA. Si ambos estan del mismo lado, el LCA esta mas abajo
    en ese lado -- recursion natural.
    """
    if raiz is None or raiz.val == p or raiz.val == q:
        return raiz

    izq = lca(raiz.izq, p, q)
    der = lca(raiz.der, p, q)

    if izq and der:
        return raiz   # p y q encontrados en lados distintos: raiz es el LCA
    return izq if izq else der   # ambos del mismo lado, o solo uno encontrado
```

**La deducción**: si encuentras `p` en el subárbol izquierdo y `q` en el derecho (o viceversa), el nodo actual es, necesariamente, el punto donde sus caminos desde la raíz se separan — exactamente la definición de ancestro común más bajo. Si ambos están del mismo lado, el LCA real está más profundo en ese lado, así que propagas ese resultado hacia arriba sin modificarlo.

---

## 5. Nodos a distancia K — sin mapa de padres, el problema real

### 5.1 Por qué esto es más difícil de lo que parece

Dado un árbol binario, un nodo objetivo, y una distancia K, encuentra todos los nodos exactamente a distancia K del objetivo. El problema es que DFS estándar solo conoce el camino **hacia abajo** desde cualquier nodo — pero "distancia K" puede requerir subir por ancestros y luego bajar por una rama distinta, y un árbol binario estándar no tiene punteros hacia el padre.

### 5.2 La deducción — DFS que devuelve distancia, y explora el otro subárbol al regresar

**La idea central**: haz DFS desde la raíz buscando el nodo objetivo. Cuando la recursión encuentra el objetivo (o lo encuentra en un subárbol) y **regresa hacia arriba**, en cada nivel de retorno sabes exactamente **a qué distancia está ese ancestro del objetivo** — y desde ahí, puedes explorar hacia el **otro** subárbol (el que la búsqueda original no tomó) con una distancia restante ajustada, recolectando los nodos que caen exactamente a K de distancia total.

```python
def nodos_a_distancia_k(raiz, objetivo_val, k):
    resultado = []

    def recolectar_a_distancia(nodo, distancia_restante):
        """DFS simple: recolecta todos los nodos a exactamente
        distancia_restante desde 'nodo', explorando hacia ABAJO."""
        if nodo is None or distancia_restante < 0:
            return
        if distancia_restante == 0:
            resultado.append(nodo.val)
            return
        recolectar_a_distancia(nodo.izq, distancia_restante - 1)
        recolectar_a_distancia(nodo.der, distancia_restante - 1)

    def dfs_buscar_y_propagar(nodo):
        """
        Devuelve la distancia desde 'nodo' hasta el objetivo, si el
        objetivo esta en el subarbol de 'nodo' -- o -1 si no esta.
        Al REGRESAR (post-order), si el objetivo esta de un lado,
        explora el OTRO lado con la distancia restante ajustada --
        exactamente el patron de la seccion 2, con una exploracion
        lateral adicional en el camino de regreso.
        """
        if nodo is None:
            return -1

        if nodo.val == objetivo_val:
            recolectar_a_distancia(nodo, k)
            return 0

        dist_izq = dfs_buscar_y_propagar(nodo.izq)
        if dist_izq != -1:
            if dist_izq + 1 == k:
                resultado.append(nodo.val)
            else:
                recolectar_a_distancia(nodo.der, k - dist_izq - 2)
            return dist_izq + 1

        dist_der = dfs_buscar_y_propagar(nodo.der)
        if dist_der != -1:
            if dist_der + 1 == k:
                resultado.append(nodo.val)
            else:
                recolectar_a_distancia(nodo.izq, k - dist_der - 2)
            return dist_der + 1

        return -1

    dfs_buscar_y_propagar(raiz)
    return resultado
```

**Por qué `k - dist_izq - 2`**: si el objetivo está a `dist_izq` del hijo izquierdo del nodo actual, está a `dist_izq + 1` del nodo actual mismo. El subárbol derecho cuelga directamente del nodo actual, así que su raíz está a `dist_izq + 2` del objetivo — la distancia restante a buscar dentro de ese subárbol derecho es `k - (dist_izq + 2)`. Verifica esta aritmética a mano con un árbol pequeño antes de confiar en el código — es exactamente el tipo de conteo de distancias donde un off-by-one se esconde fácil.

---

## 6. House Robber III — DP en árbol, el par incluir/no-incluir

### 6.1 El problema

Un ladrón no puede robar dos casas conectadas directamente (padre-hijo) en un árbol de casas — maximiza el botín total.

### 6.2 La deducción — cada nodo devuelve DOS valores hacia arriba

**La idea**: en vez de que cada llamada recursiva devuelva un solo número, devuelve un **par**: `(máximo si incluyo este nodo, máximo si NO incluyo este nodo)`. Esto es exactamente el patrón de la sección 2, con la información que fluye hacia arriba siendo un par en vez de un escalar — necesario porque la decisión óptima en el padre depende de **ambas** posibilidades de cada hijo, no solo del máximo absoluto de cada uno.

```python
def house_robber_arbol(raiz):
    def dfs(nodo):
        if nodo is None:
            return (0, 0)   # (incluir, no_incluir)

        incluir_izq, no_incluir_izq = dfs(nodo.izq)
        incluir_der, no_incluir_der = dfs(nodo.der)

        # Si incluyo este nodo, NO puedo incluir sus hijos directos.
        incluir_actual = nodo.val + no_incluir_izq + no_incluir_der
        # Si NO incluyo este nodo, cada hijo puede o no incluirse --
        # tomo lo mejor de cada uno independientemente.
        no_incluir_actual = max(incluir_izq, no_incluir_izq) + max(incluir_der, no_incluir_der)

        return (incluir_actual, no_incluir_actual)

    return max(dfs(raiz))


if __name__ == "__main__":
    raiz = Nodo(3, Nodo(2, der=Nodo(3)), Nodo(3, der=Nodo(1)))
    print(house_robber_arbol(raiz))   # 7
```

**Por qué esto es exactamente DP, no solo recursión**: cada nodo resuelve dos subproblemas (incluir/no incluir) en función de los mismos dos subproblemas ya resueltos en sus hijos — subestructura óptima y subproblemas bien definidos, la misma estructura de DP que ya conoces de `cp7-dp-competitivo`, aplicada aquí sobre la forma recursiva del árbol en vez de sobre un arreglo lineal.

---

## Señales de reconocimiento

- **"En un árbol binario..."** — el disparador más directo, obviamente.
- **Profundidad, diámetro, balance** — DFS que devuelve un escalar hacia arriba (sección 2).
- **LCA** — el patrón de "encontrado en ambos lados = aquí está la respuesta".
- **Validar BST** — rango heredado hacia abajo, nunca comparación con el vecino inmediato.
- **"Nodos a distancia K"**, **"camino más corto entre dos nodos"** — sospecha del patrón de "DFS que devuelve distancia y explora el otro lado al regresar" si no hay punteros a padre disponibles.
- **"Maximiza/minimiza [algo] sin elegir nodos adyacentes"** en un árbol — DP en árbol con par incluir/no-incluir.

---

## Trampas OA

**Recursión que no propaga bien**: olvidar devolver el valor combinado correcto desde cada nivel de la recursión — un error fácil de cometer bajo presión, donde la recursión desciende correctamente pero la información no vuelve a subir de forma consistente. Verifica siempre, explícitamente, qué devuelve cada camino de tu función recursiva (incluyendo el caso base) antes de confiar en el resultado.

**Validar BST con vecino inmediato en vez de rango**: ya cubierto en la sección 3 — el error más común y más silencioso de esta familia, porque pasa árboles pequeños de prueba y falla en árboles más profundos donde la violación ocurre a más de un nivel de distancia.

**Off-by-one en cálculo de distancias** (sección 5): verifica siempre a mano, con un árbol pequeño dibujado en papel, antes de confiar en la aritmética de "distancia restante" al cambiar de subárbol.

---

## Conexiones

**Con `itc-c4-arboles` e `itc-c6-grafos-i`**: relacionado, otra naturaleza — la prueba de por qué BST da O(altura), el mecanismo de balance de AVL, la prueba completa de BFS/DFS, todo eso ya lo dominas de primer principio. Aquí es reflejo: reconocer la firma del problema y teclear la estructura de DFS-que-devuelve-información sin tener que rederivar nada.

**Con `cp7-dp-competitivo`**: House Robber III es DP en árbol — la misma estructura de "estado que resume lo necesario del pasado (o, aquí, de los subárboles)" que ya dominas, aplicada sobre la forma recursiva de un árbol en vez de sobre una secuencia lineal.

**Con `oa-6-heap-topk`**: en variantes donde necesitas los K valores más grandes dentro de un árbol (no solo un arreglo), la composición natural es DFS/BFS para recolectar valores más un heap de tamaño K — otra prueba de que los problemas reales combinan patrones, no los usan aislados.

---

## Síntesis

1. Los cuatro recorridos —inorder, preorder, postorder, level-order— deben ser memoria muscular; inorder sobre BST da orden ascendente, level-order es BFS con el truco de `range(len(cola))` por nivel.
2. La estructura central de la mayoría de problemas de árboles: DFS post-order que devuelve información hacia arriba desde cada subárbol, combinada en cada nivel — profundidad, diámetro, LCA, DP en árbol comparten esta forma.
3. Validar BST exige pasar un **rango** hacia abajo, nunca comparar solo con el hijo inmediato.
4. LCA se resuelve reconociendo cuándo los dos objetivos aparecen en lados distintos del árbol actual.
5. Nodos a distancia K sin punteros a padre se resuelve con DFS que devuelve distancia y explora el subárbol opuesto en el camino de regreso — verificar la aritmética de distancias a mano.
6. House Robber III (y DP en árbol en general) hace que cada nodo devuelva un **par** de valores (incluir/no-incluir), no un escalar — la misma estructura de DP que ya conoces, aplicada sobre la recursión del árbol.

---

## Lo que deberías poder hacer en 30 segundos

1. **Teclear los cuatro recorridos de memoria**, sin pensar en la estructura recursiva.
2. **Reconocer si el problema necesita información fluyendo hacia arriba (la mayoría) o hacia abajo (validación de restricciones heredadas)** antes de escribir la función recursiva.
3. **Identificar si necesitas devolver un escalar o un par/tupla** desde cada nivel de recursión, según si la decisión del padre depende de una sola posibilidad o de varias por hijo.
4. **Anticipar la necesidad de "explorar el otro lado" al regresar de la recursión** cuando el problema involucra distancia o camino entre dos nodos sin punteros a padre disponibles.

---

## Fuentes

- `itc-c4-arboles` e `itc-c6-grafos-i` de esta misma colección — la teoría completa de árboles balanceados, BFS/DFS, y sus pruebas de primer principio.
- `cp7-dp-competitivo` de esta misma colección — la estructura general de DP aplicada aquí a árboles.
- "Lowest Common Ancestor of a Binary Tree", "Validate Binary Search Tree", "All Nodes Distance K in Binary Tree", "House Robber III" — problemas estándar y ampliamente citados en preparación de entrevistas técnicas de la industria, frecuentemente reportados bajo el tag Amazon.
