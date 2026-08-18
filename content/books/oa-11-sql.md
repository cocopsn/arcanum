---
module_id: oa-11-sql
spine: OA Amazon
title: "SQL — Agregación Condicional"
subtitle: "Filas a columnas en un GROUP BY"
source_canonical: "PostgreSQL documentation (aggregate functions, CASE expressions); patrones estándar de reportes SQL en la industria"
depth: standard
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 25
---

# SQL — Agregación Condicional

> **Pregunta raíz.** Algunas variantes del OA traen SQL en vez de (o además de) el problema algorítmico — y para ti esto es ventaja directa: ya operas Postgres en producción con AUCTORUM Med, así que la sintaxis no es el problema. El patrón que domina esta familia de problemas es uno solo: **convertir filas en columnas dentro de un `GROUP BY`**, usando `SUM(CASE WHEN condición THEN valor END)` — una construcción que aparece, con variaciones mínimas, en la inmensa mayoría de los "reportes" que un OA de SQL pide.

## Prólogo

Este módulo es corto a propósito — el patrón central es simple una vez que lo ves, y tu ventaja real no es aprenderlo (ya lo has escrito, probablemente, en migraciones o reportes de AUCTORUM) sino reconocer **cuándo un enunciado en lenguaje natural está pidiendo exactamente esto**, y evitar las trampas de formato que un juez de SQL, igual que uno de código, evalúa carácter por carácter.

---

## 1. El patrón central — agregación condicional

**El problema típico**: tienes una tabla de pedidos con columnas `cliente`, `estado` (por ejemplo: 'pendiente', 'enviado', 'entregado'), y `peso`. El reporte pedido: una fila por cliente, con una columna por cada estado, mostrando el peso total de pedidos en ese estado.

**La deducción**: `GROUP BY` agrupa filas, pero por sí solo no puede "esparcir" un valor de una columna hacia múltiples columnas de salida — para eso necesitas que cada columna de salida sea, en realidad, una **suma condicional** que solo cuenta las filas que cumplen el criterio de esa columna específica, e ignora (suma 0, o más precisamente `NULL`, que `SUM` ignora) las demás.

```sql
SELECT
    cliente,
    SUM(CASE WHEN estado = 'pendiente' THEN peso ELSE 0 END) AS peso_pendiente,
    SUM(CASE WHEN estado = 'enviado'   THEN peso ELSE 0 END) AS peso_enviado,
    SUM(CASE WHEN estado = 'entregado' THEN peso ELSE 0 END) AS peso_entregado
FROM pedidos
GROUP BY cliente
ORDER BY cliente;
```

**Por qué `CASE WHEN ... THEN peso ELSE 0 END` y no simplemente filtrar con `WHERE`**: si filtraras con `WHERE estado = 'pendiente'`, perderías las filas de los otros estados **para ese cliente**, y no podrías construir las otras columnas en la misma consulta. El `CASE` dentro del `SUM` deja pasar **todas** las filas al `GROUP BY`, pero cada suma condicional selectivamente "cuenta" solo las que le corresponden — esa es la pieza conceptual completa de todo este módulo.

**Variante sin `ELSE`**: `SUM(CASE WHEN estado = 'pendiente' THEN peso END)` (sin `ELSE`) funciona igual de bien, porque `CASE` sin `ELSE` devuelve `NULL` implícitamente para las filas que no cumplen, y `SUM` **ignora los `NULL`** por diseño — exactamente el mecanismo, no una coincidencia. Ambas formas son válidas; usa la que te resulte más rápida de teclear bajo reloj.

---

## 2. Conteo condicional — la misma idea con COUNT

Si el reporte pide **cuántos** pedidos hay en cada estado, no la suma de un valor, usa `COUNT` en vez de `SUM`, con la misma estructura:

```sql
SELECT
    cliente,
    COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS num_pendientes,
    COUNT(CASE WHEN estado = 'entregado' THEN 1 END) AS num_entregados
FROM pedidos
GROUP BY cliente;
```

**Por qué `COUNT(CASE WHEN ... THEN 1 END)` y no `COUNT(*)` con `WHERE`**: exactamente la misma razón que en la sección 1 — `COUNT` ignora los `NULL` igual que `SUM`, así que `CASE WHEN condición THEN 1 END` (sin `ELSE`, devolviendo `NULL` implícito para las filas que no cumplen) cuenta solo las filas que sí cumplen, dentro de la misma fila de `GROUP BY` que también está calculando otras columnas condicionales.

---

## Señales de reconocimiento

- **"Reporte por cliente/región/estado"** con una columna por categoría → agregación condicional, casi sin excepción.
- **"Total en cada categoría, mostrado como columnas"** — la frase que más directamente describe el patrón de este módulo.
- **"Cuántos... por..."** con desglose en columnas → la variante de `COUNT` de la sección 2.

---

## Trampas OA

**Formato decimal con ceros finales**: si el juez espera `150.00` y tu consulta devuelve `150` o `150.0`, la comparación carácter por carácter falla — verifica si necesitas `ROUND(valor, 2)` o `CAST(valor AS DECIMAL(10,2))` explícito para forzar el formato exacto de decimales que el problema especifica, exactamente la misma disciplina de formato estricto que ya viste en `oa-0-fundamentos` para salidas de código.

**Orden estricto**: si el problema no especifica `ORDER BY` explícitamente pero el juez compara resultados en un orden específico, agrega `ORDER BY` de todas formas sobre la columna que tenga más sentido (típicamente la clave de agrupación) — SQL no garantiza ningún orden particular de filas sin un `ORDER BY` explícito, y confiar en el orden "natural" que tu motor de base de datos parece dar es exactamente el tipo de suposición que falla en el juez aunque funcione en tus pruebas locales.

**NULL handling**: si la columna que sumas/cuentas puede tener valores `NULL` genuinos (no solo el `NULL` implícito del `CASE` sin `ELSE`), verifica cómo el problema espera que se traten — un cliente sin ningún pedido en una categoría específica debería mostrar `0`, no `NULL`, en la mayoría de los reportes esperados; el patrón `SUM(CASE ...)` ya da `0` correctamente para ese caso porque `SUM` de un conjunto vacío de valores no-NULL para esa condición específica da `NULL`, así que si el problema exige explícitamente `0` en vez de `NULL`, envuelve con `COALESCE(SUM(CASE ...), 0)`.

---

## Síntesis

1. `SUM(CASE WHEN condición THEN valor ELSE 0 END)` (o su variante sin `ELSE`, aprovechando que `SUM`/`COUNT` ignoran `NULL`) es el patrón central que convierte filas en columnas dentro de un `GROUP BY`.
2. `COUNT(CASE WHEN condición THEN 1 END)` es la misma idea aplicada a conteo en vez de suma.
3. Las trampas son de formato (decimales, orden) y de manejo de `NULL` — no de lógica del patrón central, que es simple una vez reconocido.

---

## Lo que deberías poder hacer en 30 segundos

1. **Reconocer "reporte con columna por categoría" como agregación condicional**, sin dudar.
2. **Decidir `SUM` vs. `COUNT`** según si el problema pide un total de valor o un conteo de filas.
3. **Verificar formato decimal y necesidad de `ORDER BY` explícito** antes de dar la consulta por terminada.
4. **Decidir si necesitas `COALESCE(..., 0)`** según si el problema exige `0` explícito en vez de `NULL` para categorías vacías.

---

## Fuentes

- PostgreSQL, documentación oficial de funciones de agregación y expresiones `CASE`: https://www.postgresql.org/docs/current/functions-conditional.html
- Patrón estándar de agregación condicional ("conditional aggregation" / pivot manual con `CASE`), ampliamente documentado en la práctica de reportes SQL de la industria.
