# Harness of `sql` for scripts/forge/bank-check.mjs (design §9.3 k, §5.7). Owner: forge/e2-datos.
# stdin: { v: 1, code, id, tipo, titulo, enunciado, secciones: [{ titulo, cuerpo, cercas: [{ lenguaje, codigo }] }] }
# stdout (last line): { "resultados": [{ "lenguaje": "sql", "ok": bool, "detalle"?: str }] }
# Checks what the app's py.check checks at import (src/forge/bank/check/sql.ts): the reference runs in every fixture
# and the naive query differs in at least one, with the same comparison as src/forge/eval/sql.ts. The block between
# the two markers is SQL_HARNESS_PY of src/forge/eval/sql.ts, byte for byte (sql-harness-parity.test.ts checks it).
import json
import re
import sys
import unicodedata

# --- harness (igual a SQL_HARNESS_PY) ---
import sqlite3, math

def _cell(v):
    if isinstance(v, (bytes, bytearray, memoryview)):
        return "x'" + bytes(v).hex() + "'"
    if isinstance(v, float) and not math.isfinite(v):
        return str(v)
    return v

def _query(con, sql):
    cur = con.execute(sql)
    cols = [d[0] for d in (cur.description or [])]
    rows = [[_cell(v) for v in r] for r in cur.fetchall()]
    return {"cols": cols, "rows": rows}

def _err(e):
    return {"error": type(e).__name__ + ": " + str(e)}

def run_sql(esquema, datos, fixture, referencia, consulta):
    con = sqlite3.connect(":memory:")
    try:
        try:
            con.executescript(esquema)
            con.executescript(datos)
            if fixture:
                con.executescript(fixture)
            con.commit()
        except Exception as e:
            return {"setup": _err(e)}
        con.execute("PRAGMA query_only = ON")
        try:
            ref = _query(con, referencia)
        except Exception as e:
            ref = _err(e)
        try:
            alumno = _query(con, consulta)
        except Exception as e:
            alumno = _err(e)
        return {"ref": ref, "alumno": alumno}
    finally:
        con.close()
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


def _key(v):
    if v is None:
        return ("N",)
    if isinstance(v, bool):
        return ("n", int(v))
    if isinstance(v, int):
        return ("n", v)
    if isinstance(v, float):
        if v.is_integer():
            return ("n", int(v))
        r = round(v, 9)
        return ("n", 0 if r == 0 else r)
    return ("s", str(v))


def _same(ref, got, ordered):
    if len(ref["cols"]) != len(got["cols"]):
        return False
    a = [tuple(_key(v) for v in r) for r in ref["rows"]]
    b = [tuple(_key(v) for v in r) for r in got["rows"]]
    if len(a) != len(b):
        return False
    if ordered:
        return a == b
    return sorted(a, key=repr) == sorted(b, key=repr)


def main():
    spec = json.loads(sys.stdin.read())
    m = re.search(r"^\s*orden\s*:\s*(si|no)\s*$", spec.get("enunciado", ""), re.M | re.I)
    if not m:
        return {"lenguaje": "sql", "ok": False, "detalle": "falta la línea orden: si | no"}
    ordered = m.group(1).lower() == "si"
    esquema = _sql_fences(_section(spec, "esquema"))
    datos = _sql_fences(_section(spec, "datos"))
    sol = _sql_fences(_section(spec, "solucion"))
    ing = _sql_fences(_section(spec, "ingenua"))
    fx = _sql_fences(_section(spec, "fixtures"))
    if not (esquema and datos and sol and ing and fx):
        return {"lenguaje": "sql", "ok": False, "detalle": "faltan cercas sql en Esquema, Datos, Fixtures, Solución o Ingenua"}
    differs = False
    for f in fx:
        first = next((l for l in f.splitlines() if l.strip()), "")
        fm = re.match(r"^\s*--\s*fixture:\s*(\S.*)$", first)
        nombre = fm.group(1).strip() if fm else "?"
        out = run_sql(esquema[0], datos[0], f, sol[0].strip().rstrip(";"), ing[0].strip().rstrip(";"))
        if "setup" in out:
            return {"lenguaje": "sql", "ok": False, "detalle": "fixture %s: no carga (%s)" % (nombre, out["setup"]["error"])}
        if "error" in out["ref"]:
            return {"lenguaje": "sql", "ok": False, "detalle": "la referencia falla en el fixture %s (%s)" % (nombre, out["ref"]["error"])}
        if "error" in out["alumno"] or not _same(out["ref"], out["alumno"], ordered):
            differs = True
    if not differs:
        return {"lenguaje": "sql", "ok": False, "detalle": "la ingenua da el mismo resultado que la referencia en todos los fixtures"}
    return {"lenguaje": "sql", "ok": True}


if __name__ == "__main__":
    print(json.dumps({"resultados": [main()]}, ensure_ascii=False))
