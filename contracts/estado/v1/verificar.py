"""Gate portátil del contrato de estado v1 para repos Python (Kee). Gemelo de `verificar.mjs`:
    python contracts/estado/v1/verificar.py
Sale 1 nombrando la causa si la copia no es la canónica, si el validador aprueba lo inválido o
rechaza lo válido, si un error no nombra su campo, o si un caso de token no da su motivo."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR)

from tokens import firmar_token, verificar_token  # noqa: E402
from validar import validar_respuesta  # noqa: E402


def huella_de(d: str) -> str:
    h = hashlib.sha256()
    for f in sorted(x for x in os.listdir(d) if x != "HUELLA" and not x.startswith(".") and x != "__pycache__"):
        with open(os.path.join(d, f), encoding="utf-8", newline="") as fh:
            contenido = fh.read().replace("\r\n", "\n")
        h.update(f"{f}\n{hashlib.sha256(contenido.encode('utf-8')).hexdigest()}\n".encode("utf-8"))
    return h.hexdigest()


def main() -> int:
    fallos: list[str] = []
    with open(os.path.join(DIR, "HUELLA"), encoding="utf-8") as fh:
        declarada = fh.read().strip()
    medida = huella_de(DIR)
    if declarada != medida:
        fallos.append(f"la copia del contrato NO es la canónica: HUELLA {declarada[:12]} != medida {medida[:12]}")

    with open(os.path.join(DIR, "esquemas.json"), encoding="utf-8") as fh:
        esquemas = json.load(fh)
    with open(os.path.join(DIR, "fixtures.json"), encoding="utf-8") as fh:
        fixtures = json.load(fh)
    for fx in fixtures:
        errores = validar_respuesta(esquemas, fx["esquema"], fx["respuesta"])
        if fx["valido"] and errores:
            fallos.append(f"«{fx['caso']}» debía ser válida y dio: {'; '.join(errores)}")
        if not fx["valido"] and not errores:
            fallos.append(f"«{fx['caso']}» debía ser RECHAZADA y el validador la aprobó")
        nombrar = fx.get("debe_nombrar")
        if not fx["valido"] and nombrar and not any(e.startswith(nombrar) for e in errores):
            fallos.append(f"«{fx['caso']}»: el error no nombra {nombrar} (dijo: {'; '.join(errores)})")

    abierto = copy.deepcopy(esquemas)
    abierto["respuestas"]["salud"]["additionalProperties"] = True
    extra = next((f for f in fixtures if f["caso"] == "salud con campo extra"), None)
    if extra is None or any("no permitido" in e for e in validar_respuesta(abierto, "salud", extra["respuesta"])):
        fallos.append("autoexamen: con el esquema abierto el campo extra siguió rechazado")

    llave = "x" * 40
    ahora = 1793815200  # 2026-11-04T18:00:00Z
    casos = [
        ("válido", firmar_token("kee", "med", llave, ahora=ahora), {"ok": True}),
        ("audiencia equivocada", firmar_token("kee", "primus", llave, ahora=ahora), {"status": 401, "motivo": "audiencia"}),
        ("vencido", firmar_token("kee", "med", llave, ahora=ahora - 3600), {"status": 401, "motivo": "vencido"}),
        ("otro emisor", firmar_token("intruso", "med", llave, ahora=ahora), {"status": 401, "motivo": "emisor_desconocido"}),
        ("firma con otra llave", firmar_token("kee", "med", "y" * 40, ahora=ahora), {"status": 401, "motivo": "firma"}),
        ("sin scope", firmar_token("kee", "med", llave, scope="otra:cosa", ahora=ahora), {"status": 403, "motivo": "sin_scope"}),
        ("sin token", None, {"status": 401, "motivo": "sin_token"}),
    ]
    for nombre, tok, esperado in casos:
        r = verificar_token(tok, "med", {"kee": llave}, ahora=ahora)
        if esperado.get("ok"):
            bien = r.get("ok") is True
        else:
            bien = r.get("ok") is False and r.get("status") == esperado["status"] and r.get("motivo") == esperado["motivo"]
        if not bien:
            fallos.append(f"token «{nombre}»: esperado {esperado}, dio {r}")

    if fallos:
        print(f"contrato estado/v1: {len(fallos)} fallo(s)", file=sys.stderr)
        for f in fallos:
            print(f"  x {f}", file=sys.stderr)
        return 1
    print(f"contrato estado/v1: copia canónica ({medida[:12]}), {len(fixtures)} fixtures y {len(casos)} casos de token en verde")
    return 0


if __name__ == "__main__":
    sys.exit(main())
