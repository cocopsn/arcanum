---
module_id: ca000000-0000-4000-8000-000000000004
spine: ITC
title: Ejercicios — C3 · Hashing
kind: exercises
languages: [javascript, python]
generated_by: Auctorum (semilla de ejemplo)
version: 1
---

# C3 · Hashing

## Two-sum (índices, con hash)
type: code

Devuelve los índices [i, j] (i<j) de los DOS números que suman `target`. Hay exactamente una respuesta. Hazlo en O(n) con un mapa (no O(n²)).

### Especificación
twoSum(a, target): recorre; para cada a[i] busca si el complemento (target - a[i]) ya se vio en un MAPA valor→índice; si sí, devuelve [índiceVisto, i]; si no, guarda a[i]→i.

### Firma
```javascript
function twoSum(a, target) {
  // tu código
}
```
```python
def two_sum(a, target):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[2, 7, 11, 15], 9], "expected": [0, 1] },
  { "input": [[3, 2, 4], 6], "expected": [1, 2] },
  { "input": [[3, 3], 6], "expected": [0, 1] },
  { "input": [[-1, -2, -3, -4], -7], "expected": [2, 3] }
]
```

### Solución
```javascript
function twoSum(a, target) {
  const seen = new Map();
  for (let i = 0; i < a.length; i++) {
    const need = target - a[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(a[i], i);
  }
  return [];
}
```
```python
def two_sum(a, target):
    seen = {}
    for i, x in enumerate(a):
        need = target - x
        if need in seen:
            return [seen[need], i]
        seen[x] = i
    return []
```

### Pistas
- El mapa recuerda qué valores ya viste y en qué índice.
- Busca el COMPLEMENTO antes de guardar el actual.

### Patrones
- `for\s*\([^)]*\)[^]*for\s*\(` — Dos lazos anidados es O(n²); el MAPA lo hace O(n) — ese es el punto de la celda de hashing.

## Primer elemento sin repetir
type: code

Devuelve el ÍNDICE del primer elemento que aparece exactamente una vez, o -1 si todos se repiten. Dos pasadas con un conteo (hash).

### Especificación
firstUnique(a): 1) cuenta apariciones en un mapa; 2) recorre en orden y devuelve el índice del primero con conteo 1.

### Firma
```javascript
function firstUnique(a) {
  // tu código
}
```
```python
def first_unique(a):
    # tu código
    pass
```

### Casos
```json
[
  { "input": [[]], "expected": -1 },
  { "input": [[7]], "expected": 0 },
  { "input": [[2, 2, 3, 3]], "expected": -1 },
  { "input": [[4, 5, 4, 6]], "expected": 1 },
  { "input": [[1, 1, 2]], "expected": 2 }
]
```

### Solución
```javascript
function firstUnique(a) {
  const cnt = new Map();
  for (const x of a) cnt.set(x, (cnt.get(x) || 0) + 1);
  for (let i = 0; i < a.length; i++) if (cnt.get(a[i]) === 1) return i;
  return -1;
}
```
```python
def first_unique(a):
    cnt = {}
    for x in a:
        cnt[x] = cnt.get(x, 0) + 1
    for i, x in enumerate(a):
        if cnt[x] == 1:
            return i
    return -1
```

### Pistas
- Primero cuenta TODO, luego busca el primer conteo == 1.
- El orden importa: recorre el arreglo, no las llaves del mapa.

## ¿Por qué O(1) esperado y no garantizado?
type: complexity

Una tabla hash con encadenamiento da búsqueda O(1) ESPERADO. ¿Cuándo degenera a O(n)?

### Opciones
- Nunca — siempre es O(1)
- Cuando la tabla está vacía
- [x] Cuando muchas/todas las llaves colisionan al mismo bucket
- Cuando el arreglo está ordenado

### Justificación
O(1) esperado asume hashing uniforme (las llaves se reparten). Si una función hash adversarial (o mala suerte) manda todo al mismo bucket, esa cadena tiene longitud n → la búsqueda recorre n. Por eso es esperado, no garantizado.
