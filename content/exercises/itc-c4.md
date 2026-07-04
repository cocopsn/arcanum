---
module_id: ca000000-0000-4000-8000-000000000005
spine: ITC
title: Ejercicios — C4 · Árboles de búsqueda
kind: exercises
languages: [javascript]
generated_by: Auctorum (semilla de ejemplo)
version: 1
---

# C4 · Árboles

Los ejercicios de árbol son solo JavaScript: el árbol es un objeto anidado `{ val, left, right }`.

## Altura de un árbol binario
type: code

Dado un nodo `{ val, left, right }` (o null), devuelve su ALTURA: el árbol vacío (null) tiene altura -1, una hoja tiene altura 0.

### Especificación
height(node): si node es null → -1; si no → 1 + max(height(izq), height(der)). Recursión pura.

### Firma
```javascript
function height(node) {
  // node es { val, left, right } o null
}
```

### Casos
```json
[
  { "input": [null], "expected": -1 },
  { "input": [{ "val": 1, "left": null, "right": null }], "expected": 0 },
  { "input": [{ "val": 1, "left": { "val": 2, "left": null, "right": null }, "right": null }], "expected": 1 },
  { "input": [{ "val": 8, "left": { "val": 4, "left": { "val": 2, "left": null, "right": null }, "right": null }, "right": { "val": 12, "left": null, "right": null } }], "expected": 2 }
]
```

### Solución
```javascript
function height(node) {
  if (node === null) return -1;
  return 1 + Math.max(height(node.left), height(node.right));
}
```

### Pistas
- El caso base es null → -1 (así una hoja da 0).
- Combina las dos alturas con max y suma 1.

## Recorrido inorden (BST → ordenado)
type: code

Dado un nodo `{ val, left, right }` (o null), devuelve un arreglo con los valores en INORDEN (izquierda, raíz, derecha). En un BST esto sale ordenado.

### Especificación
inorder(node): si null → []; si no → inorder(izq) ++ [val] ++ inorder(der).

### Firma
```javascript
function inorder(node) {
  // node es { val, left, right } o null
}
```

### Casos
```json
[
  { "input": [null], "expected": [] },
  { "input": [{ "val": 5, "left": null, "right": null }], "expected": [5] },
  { "input": [{ "val": 2, "left": { "val": 1, "left": null, "right": null }, "right": { "val": 3, "left": null, "right": null } }], "expected": [1, 2, 3] }
]
```

### Solución
```javascript
function inorder(node) {
  if (node === null) return [];
  return [...inorder(node.left), node.val, ...inorder(node.right)];
}
```

### Pistas
- Inorden = izquierda, luego raíz, luego derecha.
- Concatena los tres pedazos.

## La recurrencia de la altura AVL
type: complexity

El número MÍNIMO de nodos de un AVL de altura h cumple N(h) = 1 + N(h-1) + N(h-2). ¿Por qué NO es N(h) = 1 + 2·N(h-1)?

### Opciones
- Porque los AVL no tienen dos hijos
- [x] Porque un subárbol puede tener altura h-2 sin romper el balance (|dif| ≤ 1)
- Porque la raíz cuenta doble
- Es un error, sí debería ser 2·N(h-1)

### Justificación
Para MINIMIZAR nodos a altura h, un subárbol llega a h-1 (para dar la altura) y el otro se hace lo más flaco permitido: h-2 (la invariante AVL permite diferencia de 1). Por eso 1 + N(h-1) + N(h-2) — la recurrencia de Fibonacci, de donde sale h = O(log n).
