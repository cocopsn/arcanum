"""Tokens del contrato de estado v1 (gemelo de `token.mjs`; se llama `tokens.py` porque `token` es un módulo de la biblioteca estándar): JWT HS256 por PAR emisor→receptor,
vida máxima 15 min, `scope` explícito. Sólo stdlib."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

SCOPE_LECTURA = "estado:leer"
VIDA_MAXIMA_S = 900
HOLGURA_S = 60


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _desb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _hmac(datos: str, secreto: str) -> bytes:
    return hmac.new(secreto.encode("utf-8"), datos.encode("ascii"), hashlib.sha256).digest()


def firmar_token(iss: str, aud: str, secreto: str, scope: str = SCOPE_LECTURA,
                 vida_s: int = 300, ahora: float | None = None) -> str:
    if not secreto or len(secreto) < 32:
        raise ValueError("llave del par ausente o corta")
    if vida_s > VIDA_MAXIMA_S:
        raise ValueError("vida mayor que la permitida")
    iat = int(ahora if ahora is not None else time.time())
    cab = _b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    cuerpo = _b64u(json.dumps({"iss": iss, "aud": aud, "scope": scope, "iat": iat,
                               "exp": iat + vida_s}, separators=(",", ":")).encode())
    return f"{cab}.{cuerpo}.{_b64u(_hmac(cab + '.' + cuerpo, secreto))}"


def verificar_token(token: str | None, audiencia: str, llaves: dict[str, str],
                    scope: str = SCOPE_LECTURA, ahora: float | None = None) -> dict:
    def no(status: int, motivo: str) -> dict:
        return {"ok": False, "status": status, "motivo": motivo}

    if not token or not isinstance(token, str):
        return no(401, "sin_token")
    partes = token.split(".")
    if len(partes) != 3:
        return no(401, "malformado")
    try:
        cab = json.loads(_desb64u(partes[0]))
        cuerpo = json.loads(_desb64u(partes[1]))
    except Exception:
        return no(401, "malformado")
    if not isinstance(cab, dict) or cab.get("alg") != "HS256":
        return no(401, "algoritmo")
    iss = cuerpo.get("iss") if isinstance(cuerpo, dict) else None
    secreto = llaves.get(iss) if isinstance(iss, str) else None
    if not secreto:
        return no(401, "emisor_desconocido")
    esperada = _hmac(partes[0] + "." + partes[1], secreto)
    try:
        dada = _desb64u(partes[2])
    except Exception:
        return no(401, "malformado")
    if not hmac.compare_digest(dada, esperada):
        return no(401, "firma")
    t = int(ahora if ahora is not None else time.time())
    exp, iat = cuerpo.get("exp"), cuerpo.get("iat")
    if not isinstance(exp, (int, float)) or not isinstance(iat, (int, float)):
        return no(401, "malformado")
    if exp < t - HOLGURA_S or iat > t + HOLGURA_S:
        return no(401, "vencido")
    if exp - iat > VIDA_MAXIMA_S:
        return no(401, "vida_excesiva")
    if cuerpo.get("aud") != audiencia:
        return no(401, "audiencia")
    scopes = cuerpo.get("scope", "").split(" ") if isinstance(cuerpo.get("scope"), str) else []
    if scope not in scopes:
        return no(403, "sin_scope")
    return {"ok": True, "emisor": iss}
