---
module_id: ca000000-0000-4000-8000-000000000002
spine: ITC
title: Ejercicios — C1 · Análisis asintótico e invariantes
kind: exercises
languages: [javascript, python]
generated_by: Auctorum (semilla de ejemplo)
version: 1
---

# C1 · Análisis asintótico

Banco semilla de ejemplo — escribe el código desde cero y ejecútalo aquí. Reemplázalo por bancos que generes con IA (Sonnet 5) contra este mismo contrato.

## Complejidad de un lazo anidado
type: multiple_choice

¿Cuál es la complejidad en tiempo de `for i in 0..n: for j in 0..n: op()`?

### Opciones
- O(n)
- O(n log n)
- [x] O(n²)
- O(2ⁿ)

### Justificación
Dos lazos anidados que recorren n cada uno ejecutan la operación n·n = n² veces. La complejidad la fija la cantidad de operaciones en función de la entrada, no el número de líneas.

## Complejidad de la búsqueda binaria
type: multiple_choice

En un arreglo ORDENADO de n elementos, ¿cuántas comparaciones hace la búsqueda binaria en el peor caso?

### Opciones
- n
- n/2
- [x] log₂(n)
- √n

### Justificación
Cada comparación DESCARTA la mitad del espacio restante, así que el número de pasos es cuántas veces divides n entre 2 hasta llegar a 1: log₂(n). Ese logaritmo ES la garantía del orden.

## Búsqueda lineal
type: code

Devuelve el ÍNDICE de la primera aparición de `target` en `a`, o -1 si no está. No uses indexOf/index.

### Especificación
linearSearch(a, target): recorre i de 0 a n-1; si a[i] === target devuelve i; si terminas, -1.

### Firma
```javascript
function linearSearch(a, target) {
  // tu código
}
```
```python
def linear_search(a, target):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[], 3], "expected": -1 },
  { "input": [[3], 3], "expected": 0 },
  { "input": [[5, 1, 3, 3], 3], "expected": 2 },
  { "input": [[1, 2, 4], 3], "expected": -1 },
  { "input": [[7, 7, 7], 7], "expected": 0 }
]
```

### Solución
```javascript
function linearSearch(a, target) {
  for (let i = 0; i < a.length; i++) if (a[i] === target) return i;
  return -1;
}
```
```python
def linear_search(a, target):
    for i in range(len(a)):
        if a[i] == target:
            return i
    return -1
```

### Pistas
- Necesitas el índice, no el valor: itera con un contador.
- El vacío devuelve -1 sin entrar al lazo.
