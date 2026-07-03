---
module_id: ca000000-0000-4000-8000-000000000005
spine: ITC
title: El árbol que se niega a inclinarse
subtitle: Por qué un AVL garantiza O(log n) — y de dónde sale ese logaritmo
source_canonical: MIT 6.006 Lecture 6-7; CLRS cap. 13 (Red-Black); Adelson-Velsky & Landis (1962)
depth: raiz
structure: pregunta-raiz + prologo + nucleo + conexiones + sintesis + preguntas + fuentes
generated_by: ejemplo semilla — reemplázalo con tu libro generado en Sonnet 5
version: 0.1-ejemplo
reading_minutes: 18
---

> Un árbol de búsqueda binario puede degenerar en una lista y volver O(n) lo que prometía ser O(log n). ¿Qué invariante, exactamente, lo impide — y por qué basta?

## Prólogo

Un BST guarda una promesa: la clave a la izquierda es menor, a la derecha es mayor, así que buscar es "descender decidiendo". Si el árbol está balanceado, cada decisión descarta la mitad: O(log n). Pero la promesa tiene letra chica. Inserta 1, 2, 3, 4, 5 en orden y el BST se convierte en una lista enlazada disfrazada: la búsqueda vuelve a recorrer todo, O(n). El BST no garantiza nada sobre su forma; solo sobre su orden.

El AVL (Adelson-Velsky y Landis, 1962 — el primer árbol auto-balanceado de la historia) añade UNA restricción: en cada nodo, las alturas de sus dos subárboles difieren en a lo sumo 1. Esa única invariante local, mantenida en cada inserción, fuerza una propiedad global: la altura del árbol es O(log n). No es magia; es una recurrencia que puedes derivar.

## La recurrencia de la altura mínima

La pregunta correcta no es "¿qué altura tiene un AVL?" sino "¿cuál es el árbol AVL MÁS DESBALANCEADO posible con altura h?" — porque ese es el peor caso. Sea N(h) el número **mínimo** de nodos de un AVL de altura h. Un árbol de altura h tiene una raíz, un subárbol de altura h-1 (para llegar a h), y el otro subárbol lo más flaco posible sin romper la invariante: altura h-2. Entonces:

    N(h) = 1 + N(h-1) + N(h-2)

Con N(0) = 1 y N(1) = 2. Esa recurrencia es la de Fibonacci desplazada: N(h) ≈ φ^h, con φ ≈ 1.618 el número áureo. Invirtiendo: si un AVL con n nodos tiene altura h, entonces n ≥ N(h) ≈ φ^h, de donde h ≤ log_φ(n) = O(log n). **Ese es el logaritmo.** No lo asumimos; cae de contar el árbol más flaco que la invariante permite.

```python
def height(node):
    # -1 para el árbol vacío hace que un nodo hoja tenga altura 0
    if node is None:
        return -1
    return 1 + max(height(node.left), height(node.right))

def balance_factor(node):
    # la invariante AVL exige |balance_factor| <= 1 en TODO nodo
    return height(node.left) - height(node.right)
```

## Las rotaciones — cómo se restaura la invariante

Una inserción puede empujar un balance factor a ±2. La reparación es una **rotación**: un re-enganche local de tres punteros que baja el subárbol pesado y sube el ligero, preservando el orden del BST. Hay cuatro casos, pero solo dos formas:

- **Caso simple (LL o RR):** el subárbol pesado está "recto" (izquierda-izquierda o derecha-derecha). Una rotación simple basta.
- **Caso doble (LR o RL):** el subárbol pesado está "quebrado" (izquierda-derecha). Una rotación simple lo empeoraría; primero rotas el hijo, luego la raíz.

El detalle que la mayoría olvida: tras insertar, subes por el camino hacia la raíz actualizando alturas, y rebalanceas en el **primer** nodo desbalanceado que encuentres. Una sola rotación (simple o doble) por inserción es suficiente — porque restaura la altura del subárbol a la que tenía antes de insertar.

## Conexiones

Esta idea — *acotar una altura para acotar un costo* — no es exclusiva de los AVL. El **heap binario** (celda C5) es otro árbol de altura acotada, pero por una vía distinta: es *completo* por construcción (se llena por niveles), así que su altura es ⌊log n⌋ sin necesidad de rotaciones. Compara los dos: el AVL paga rotaciones para mantener orden total buscable; el heap renuncia al orden total (solo garantiza padre ≥ hijos) y a cambio no rota nunca. Misma meta (altura log), distinto trato.

Y el **B-tree** (la fuente CS61B lo cubre) lleva la idea al disco: en vez de altura 1 de holgura, permite muchas llaves por nodo para que la altura sea logarítmica en una base grande — porque en disco lo caro es bajar de nivel, no comparar. El AVL es el caso b=2 de una familia.

## Síntesis

El AVL no "es rápido". Es rápido *porque* una invariante local barata (|balance| ≤ 1 por nodo) compra una garantía global cara (altura O(log n)), y esa compra la puedes derivar contando: el árbol más flaco permitido crece como Fibonacci, luego la altura es logarítmica en n. Las rotaciones son el precio — O(1) por inserción — de mantener la invariante. Todo lo demás (búsqueda, inserción, borrado en O(log n)) se sigue de la altura acotada.

## Preguntas que deberías poder responder

- ¿Por qué N(h) = 1 + N(h-1) + N(h-2) y no N(h) = 1 + 2·N(h-1)? ¿Qué representa cada término?
- Deriva, sin mirar, por qué la altura es O(log n) a partir de que N(h) ≈ φ^h.
- Da una secuencia de inserciones que dispare una rotación DOBLE, y explica por qué la simple no sirve ahí.
- ¿Por qué basta UNA rotación por inserción para restaurar la invariante en todo el camino a la raíz?

## Fuentes

- MIT 6.006 (Spring 2020) Lecture 6-7 — Binary Search Trees, AVL. https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec6/
- CLRS, *Introduction to Algorithms*, cap. 13 (árboles rojo-negros — la otra respuesta al mismo problema).
- G. Adelson-Velsky, E. Landis, "An algorithm for the organization of information" (1962) — el paper original.
