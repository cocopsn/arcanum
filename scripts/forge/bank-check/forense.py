# Harness of `forense` for scripts/forge/bank-check.mjs (design §6.3, §5.4). Owner: forge/e2-datos.
# stdin: { v: 1, code, id, tipo, titulo, enunciado, secciones: [{ titulo, cuerpo, cercas: [{ lenguaje, codigo }] }] }
# stdout (last line): { "resultados": [{ "lenguaje": "sql", "ok": bool, "detalle"?: str }] }
# It builds the forense `spec` of §5.4 from the sections and runs verify_forense(spec), the SAME ingestion check the
# app runs at import (src/forge/bank/check/forense.ts via src/forge/eval/forensics.ts). The block between the two
# markers is FORENSE_HARNESS_PY of src/forge/eval/forensics.ts, byte for byte (forense-harness-parity.test.ts).
import json
import re
import sys
import unicodedata

# --- harness (igual a FORENSE_HARNESS_PY) ---

import sqlite3, math, re, json
from datetime import datetime, timedelta, timezone

_ID = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

def _q(name):
    # identificador validado y entre comillas dobles (rc80)
    if not isinstance(name, str) or not _ID.match(name): raise ValueError("identificador inválido: " + str(name))
    return '"' + name + '"'

def _nombre(name):
    # nombre de un objeto que creó el autor, entre comillas dobles
    return '"' + str(name).replace('"', '""') + '"'

_PASO = re.compile(r"^--\s*paso:\s*(\S+)\s*$")

def _pasos(sql):
    # [(id, sql)] por líneas «-- paso: <id>», como pasosOf; el SQL antes del primer paso queda con id None (rc100)
    out = []
    for line in sql.splitlines():
        m = _PASO.match(line.strip())
        if m: out.append((m.group(1), []))
        elif out: out[-1][1].append(line)
        elif line.strip() and not line.strip().startswith("--"): out.append((None, [line]))
    return [(i, "\n".join(ls)) for i, ls in out]

def _err(e):
    return type(e).__name__ + ": " + str(e)

def _cell(v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "x'" + bytes(v).hex() + "'"
    if isinstance(v, float) and not math.isfinite(v):
        return str(v)
    return v

def _load(esquema, datos, pipeline):
    # :memory:, executescript de los tres y commit; la última línea antes de devolver la conexión la deja de solo lectura
    con = sqlite3.connect(":memory:")
    try:
        con.executescript(esquema)
        con.executescript(datos)
        con.executescript(pipeline)
        con.commit()
    except Exception:
        con.close()
        raise
    con.execute("PRAGMA query_only = ON")
    return con

def _solo(pipeline, correccion, paso):
    # todo tomado de la corrección salvo «paso», que queda como en el que miente
    fix = dict(_pasos(correccion))
    return "\n".join("-- paso: " + i + "\n" + (s if i == paso else fix[i]) for i, s in _pasos(pipeline))

def _count(con, sql):
    # {"filas": n} | {"error": "Tipo: msg"}; una sola sentencia
    try:
        return {"filas": len(con.execute(sql).fetchall())}
    except Exception as e:
        return {"error": _err(e)}

def _ts(v):
    # ISO a fecha con zona; sin zona, UTC; una fecha sola es 00:00 UTC; None si no se entiende
    try:
        d = datetime.fromisoformat(str(v).strip().replace("Z", "+00:00"))
    except Exception:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)

def invariant_broken(con, inv, corte):
    t, sobre = inv["tipo"], _q(inv["sobre"]); cols = [_q(c) for c in inv.get("columnas", [])]
    tol = inv.get("tolerancia", 0)
    if t == "conteo":   return abs(con.execute("SELECT COUNT(*) FROM " + sobre).fetchone()[0] - inv["esperado"]) > tol
    if t == "suma":     return abs(con.execute("SELECT TOTAL(" + cols[0] + ") FROM " + sobre).fetchone()[0] - inv["esperado"]) > tol
    if t == "unicidad": return con.execute("SELECT 1 FROM " + sobre + " GROUP BY " + ", ".join(cols) + " HAVING COUNT(*) > 1 LIMIT 1").fetchone() is not None
    if t == "nulos":    return con.execute("SELECT COUNT(*) FROM " + sobre + " WHERE " + " OR ".join(c + " IS NULL" for c in cols)).fetchone()[0] > inv.get("esperado", 0)
    if t == "frescura":
        m = _ts(con.execute("SELECT MAX(" + cols[0] + ") FROM " + sobre).fetchone()[0])
        return m is None or m < _ts(corte) - timedelta(days=tol)
    raise ValueError("tipo de invariante desconocido: " + str(t))

def run_pasos(esquema, datos, pipeline):
    # por paso: los objetos nuevos de sqlite_master y el COUNT(*) de cada uno
    con = sqlite3.connect(":memory:")
    try:
        try:
            con.executescript(esquema)
            con.executescript(datos)
            con.commit()
        except Exception as e:
            return {"setup": _err(e)}
        vistos = set(r[0] for r in con.execute("SELECT name FROM sqlite_master").fetchall())
        pasos = []
        for i, s in _pasos(pipeline):
            try:
                con.executescript(s)
                objetos = []
                for r in con.execute("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").fetchall():
                    if r[0] in vistos: continue
                    vistos.add(r[0])
                    objetos.append({"nombre": r[0], "filas": con.execute("SELECT COUNT(*) FROM " + _nombre(r[0])).fetchone()[0]})
                pasos.append({"id": i, "objetos": objetos})
            except Exception as e:
                pasos.append({"id": i, "error": _err(e)})
        return {"pasos": pasos}
    finally:
        con.close()

def run_control(esquema, datos, pipeline, control):
    # {"cols", "rows" (hasta 20), "filas"} | {"error"} | {"setup"}
    try:
        con = _load(esquema, datos, pipeline)
    except Exception as e:
        return {"setup": _err(e)}
    try:
        cur = con.execute(control)
        cols = [d[0] for d in (cur.description or [])]
        rows = [[_cell(v) for v in r] for r in cur.fetchall()]
        return {"cols": cols, "rows": rows[:20], "filas": len(rows)}
    except Exception as e:
        return {"error": _err(e)}
    finally:
        con.close()

def _fuentes(spec):
    # (nombre, datos, sql) de cada base: el que miente, el corregido y, con datos limpios, el corregido sobre ellos
    out = [("pipeline", spec["datos"], spec["pipeline"]), ("corregido", spec["datos"], spec["correccion"])]
    if spec.get("datos_limpios"): out.append(("corregido sobre datos limpios", spec["datos_limpios"], spec["correccion"]))
    return out

def _control(cons, sql):
    return {"miente": _count(cons[0], sql), "corregido": _count(cons[1], sql), "limpios": _count(cons[2], sql) if len(cons) > 2 else None}

def _distingue(o):
    def alarma(x): return "filas" in x and x["filas"] >= 1
    def silencio(x): return "filas" in x and x["filas"] == 0
    return alarma(o["miente"]) and silencio(o["corregido"]) and (o["limpios"] is None or silencio(o["limpios"]))

def grade_controles(spec, controles):
    # por control: {"miente", "corregido", "limpios" (None sin datos limpios)}
    try:
        cons = [_load(spec["esquema"], d, s) for _, d, s in _fuentes(spec)]
    except Exception as e:
        return {"setup": _err(e)}
    try:
        return {"controles": [_control(cons, c) for c in controles]}
    finally:
        for c in cons: c.close()

def verify_forense(spec):
    # {"problemas": [str]}: la ingesta completa, la misma al importar en la app y en bank-check
    problemas = []
    esquema, datos, pipeline, correccion, corte = spec["esquema"], spec["datos"], spec["pipeline"], spec["correccion"], spec["corte"]
    invs = dict((inv["id"], inv) for inv in spec["invariantes"])
    cons = []
    # 1. el pipeline y la corrección cargan (y la corrección sobre datos limpios, si los hay)
    for nombre, d, sql in _fuentes(spec):
        try:
            cons.append(_load(esquema, d, sql))
        except Exception as e:
            problemas.append("el " + nombre + " no carga: " + _err(e))
            return {"problemas": problemas}
    miente, corregidos = cons[0], cons[1:]
    # 2. la corrección tiene los mismos pasos que el pipeline, en el mismo orden
    if [i for i, _ in _pasos(correccion)] != [i for i, _ in _pasos(pipeline)]:
        problemas.append("la corrección no tiene los mismos pasos que el pipeline")
        return {"problemas": problemas}
    for m in spec["mentiras"]:
        inv = invs.get(m["invariante"])
        if inv is None:
            problemas.append("la mentira «" + m["id"] + "» rompe «" + str(m["invariante"]) + "», que no es un invariante")
            continue
        # 3. su invariante está roto en el pipeline que miente
        if not invariant_broken(miente, inv, corte):
            problemas.append("la mentira «" + m["id"] + "» no rompe su invariante en el pipeline")
        # 5. nace aquí: con los demás pasos de la corrección y sólo el suyo como en el que miente, sigue roto
        if not invariant_broken(_load(esquema, datos, _solo(pipeline, correccion, m["paso"])), inv, corte):
            problemas.append("la mentira «" + m["id"] + "» no nace en el paso «" + m["paso"] + "»")
    # 4. cada invariante se cumple en el corregido (y en el corregido sobre datos limpios)
    for inv in spec["invariantes"]:
        if any(invariant_broken(c, inv, corte) for c in corregidos):
            problemas.append("el invariante «" + inv["id"] + "» no se cumple en el corregido")
    # 6. cada control de referencia alarma sobre el que miente y calla sobre el corregido (y sobre datos limpios)
    for i, c in enumerate(spec["controles"]):
        if not _distingue(_control(cons, c)):
            problemas.append("el control de referencia " + str(i + 1) + " no distingue los dos pipelines")
    for c in cons: c.close()
    return {"problemas": problemas}

# --- fin del arnés ---


def _nm(s):
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower().strip()


def _section(spec, name):
    for s in spec.get("secciones", []):
        t = _nm(s.get("titulo", ""))
        if t == name or t.startswith(name):
            return s
    return None


def _sql_fences(sec):
    if not sec:
        return []
    return [c["codigo"] for c in sec.get("cercas", []) if (c.get("lenguaje") or "").lower() in ("sql", "sqlite")]


def _json_fence(sec):
    if not sec:
        return None
    cercas = sec.get("cercas", [])
    f = next((c for c in cercas if (c.get("lenguaje") or "").lower() == "json"), None)
    if f is None and cercas:
        f = cercas[0]
    return json.loads(f["codigo"]) if f else None


def main():
    spec_in = json.loads(sys.stdin.read())
    cm = re.search(r"^\s*corte\s*:\s*(\S+)\s*$", spec_in.get("enunciado", ""), re.M | re.I)
    if not cm:
        return {"lenguaje": "sql", "ok": False, "detalle": "falta la línea corte:"}
    esquema = _sql_fences(_section(spec_in, "esquema"))
    datos = _sql_fences(_section(spec_in, "datos"))
    pipeline = _sql_fences(_section(spec_in, "pipeline"))
    correccion = _sql_fences(_section(spec_in, "correccion"))
    controles = _sql_fences(_section(spec_in, "control de referencia"))
    limpios = _sql_fences(_section(spec_in, "datos limpios"))
    try:
        invariantes = _json_fence(_section(spec_in, "invariantes"))
        mentiras = _json_fence(_section(spec_in, "mentiras"))
    except Exception as e:
        return {"lenguaje": "sql", "ok": False, "detalle": "Invariantes o Mentiras no es JSON: " + str(e)}
    if not (esquema and datos and pipeline and correccion and controles and isinstance(invariantes, list) and isinstance(mentiras, list)):
        return {"lenguaje": "sql", "ok": False, "detalle": "faltan secciones de forense"}
    spec = {
        "esquema": esquema[0],
        "datos": datos[0],
        "pipeline": pipeline[0],
        "correccion": correccion[0],
        "datos_limpios": limpios[0] if limpios else None,
        "invariantes": invariantes,
        "mentiras": mentiras,
        "controles": [c.strip().rstrip(";") for c in controles],
        "corte": cm.group(1),
    }
    try:
        problemas = verify_forense(spec)["problemas"]
    except Exception as e:
        return {"lenguaje": "sql", "ok": False, "detalle": _err(e)[:300]}
    return {"lenguaje": "sql", "ok": problemas == [], "detalle": "; ".join(problemas)[:300]}


if __name__ == "__main__":
    print(json.dumps({"resultados": [main()]}, ensure_ascii=False))
