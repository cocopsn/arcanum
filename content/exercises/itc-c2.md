---
module_id: ca000000-0000-4000-8000-000000000003
spine: ITC
title: Ejercicios — C2 · Estructuras lineales
kind: exercises
languages: [javascript, python]
generated_by: Auctorum (semilla de ejemplo)
version: 1
---

# C2 · Estructuras lineales

## Paréntesis balanceados (pila)
type: code

Devuelve true si la cadena de `()[]{}` está balanceada (cada apertura cierra en orden). Vacía = true.

### Especificación
isBalanced(s): usa una PILA; al abrir empuja el cierre esperado; al cerrar, debe coincidir con el tope; al final la pila debe estar vacía.

### Firma
```javascript
function isBalanced(s) {
  // tu código
}
```
```python
def is_balanced(s):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [""], "expected": true },
  { "input": ["()"], "expected": true },
  { "input": ["([{}])"], "expected": true },
  { "input": ["(]"], "expected": false },
  { "input": ["("], "expected": false },
  { "input": [")("], "expected": false }
]
```

### Solución
```javascript
function isBalanced(s) {
  const close = { '(': ')', '[': ']', '{': '}' };
  const st = [];
  for (const c of s) {
    if (close[c]) st.push(close[c]);
    else if (st.pop() !== c) return false;
  }
  return st.length === 0;
}
```
```python
def is_balanced(s):
    close = {'(': ')', '[': ']', '{': '}'}
    st = []
    for c in s:
        if c in close:
            st.append(close[c])
        elif not st or st.pop() != c:
            return False
    return len(st) == 0
```

### Pistas
- Una pila: apila lo que esperas cerrar.
- Cerrar con la pila vacía ya es falso.

### Patrones
- `\.replace\(` — Resolverlo con replace repetido funciona pero O(n²); la PILA es el patrón O(n) idiomático.

## Rotar un arreglo k a la derecha
type: code

Devuelve un NUEVO arreglo rotado k posiciones a la derecha. k puede ser mayor que la longitud.

### Especificación
rotate(a, k): normaliza k = k mod n; el resultado es los últimos k seguidos de los primeros n-k.

### Firma
```javascript
function rotate(a, k) {
  // tu código
}
```
```python
def rotate(a, k):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[], 3], "expected": [] },
  { "input": [[1], 5], "expected": [1] },
  { "input": [[1, 2, 3, 4], 1], "expected": [4, 1, 2, 3] },
  { "input": [[1, 2, 3, 4], 4], "expected": [1, 2, 3, 4] },
  { "input": [[1, 2, 3, 4], 6], "expected": [3, 4, 1, 2] }
]
```

### Solución
```javascript
function rotate(a, k) {
  const n = a.length;
  if (n === 0) return [];
  const s = ((k % n) + n) % n;
  return a.slice(n - s).concat(a.slice(0, n - s));
}
```
```python
def rotate(a, k):
    n = len(a)
    if n == 0:
        return []
    s = k % n
    return a[n - s:] + a[:n - s]
```

### Pistas
- k mod n evita rotar de más.
- Ojo con n=0 (evita dividir entre cero).
