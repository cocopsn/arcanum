"""Validador del contrato de estado v1 (Milla 12), gemelo de `validar.mjs`.

PURO: sin dependencias. Implementa el MISMO subconjunto de JSON Schema y se prueba contra las
MISMAS fixtures (`fixtures/`). Una palabra clave desconocida lanza: ignorarla aprobaría de más.
"""
from __future__ import annotations

import math
import re
from typing import Any

CONOCIDAS = {
    "type", "enum", "pattern", "required", "properties", "additionalProperties", "propertyNames",
    "maxProperties", "items", "maxItems", "minimum", "maximum", "anyOf", "$ref",
}


def _tipo(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "integer" if v.is_integer() else "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def _cumple_tipo(v: Any, t: str) -> bool:
    real = _tipo(v)
    if t == "number":
        return real in ("number", "integer")
    return real == t


def _nodo(esquemas: dict, esq: dict, v: Any, ruta: str, errores: list[str]) -> None:
    if "$ref" in esq:
        d = esquemas["definiciones"].get(esq["$ref"])
        if d is None:
            raise ValueError(f"$ref desconocido: {esq['$ref']}")
        _nodo(esquemas, d, v, ruta, errores)
        return
    for k in esq:
        if k not in CONOCIDAS:
            raise ValueError(f"palabra clave no soportada: {k} en {ruta}")
    if "anyOf" in esq:
        ok = False
        for alt in esq["anyOf"]:
            e: list[str] = []
            _nodo(esquemas, alt, v, ruta, e)
            if not e:
                ok = True
                break
        if not ok:
            errores.append(f"{ruta}: no cumple ninguna alternativa")
        return
    if "type" in esq and not _cumple_tipo(v, esq["type"]):
        errores.append(f"{ruta}: se esperaba {esq['type']}, llegó {_tipo(v)}")
        return
    if "enum" in esq and v not in esq["enum"]:
        errores.append(f"{ruta}: valor fuera del vocabulario")
    if "pattern" in esq and isinstance(v, str):
        # JSON Schema usa la semántica de RegExp de ECMAScript; los patrones del contrato son
        # anclados y sin construcciones que difieran entre los dos motores.
        if re.search(esq["pattern"], v) is None:
            errores.append(f"{ruta}: no cumple el patrón")
    if _tipo(v) in ("integer", "number"):
        if "minimum" in esq and v < esq["minimum"]:
            errores.append(f"{ruta}: menor que {esq['minimum']}")
        if "maximum" in esq and v > esq["maximum"]:
            errores.append(f"{ruta}: mayor que {esq['maximum']}")
        if isinstance(v, float) and not math.isfinite(v):
            errores.append(f"{ruta}: no es finito")
    if isinstance(v, list):
        if "maxItems" in esq and len(v) > esq["maxItems"]:
            errores.append(f"{ruta}: más de {esq['maxItems']} elementos")
        if "items" in esq:
            for i, x in enumerate(v):
                _nodo(esquemas, esq["items"], x, f"{ruta}[{i}]", errores)
    if isinstance(v, dict):
        if "maxProperties" in esq and len(v) > esq["maxProperties"]:
            errores.append(f"{ruta}: más de {esq['maxProperties']} llaves")
        for r in esq.get("required", []):
            if r not in v:
                errores.append(f"{ruta}.{r}: falta")
        props = esq.get("properties", {})
        ap = esq.get("additionalProperties", None)
        for k, x in v.items():
            if "propertyNames" in esq:
                _nodo(esquemas, esq["propertyNames"], k, f"{ruta}{{{k}}}", errores)
            if k in props:
                _nodo(esquemas, props[k], x, f"{ruta}.{k}", errores)
            elif ap is False:
                errores.append(f"{ruta}.{k}: campo no permitido por el contrato")
            elif isinstance(ap, dict):
                _nodo(esquemas, ap, x, f"{ruta}.{k}", errores)
            elif ap is None and esq.get("type") == "object":
                errores.append(f"{ruta}.{k}: objeto sin additionalProperties declarado")


def validar_respuesta(esquemas: dict, nombre: str, respuesta: Any) -> list[str]:
    """Errores de `respuesta` contra el esquema `nombre`; lista vacía = válida."""
    esq = esquemas["respuestas"].get(nombre)
    if esq is None:
        raise ValueError(f"respuesta desconocida: {nombre}")
    errores: list[str] = []
    _nodo(esquemas, esq, respuesta, nombre, errores)
    return errores


def buscar_canarios(respuesta: Any, marcadores: list[str]) -> list[str]:
    """Rutas donde aparece algún marcador prohibido (en valores o en llaves)."""
    bajos = [m.lower() for m in marcadores]
    hallazgos: list[str] = []

    def visitar(v: Any, ruta: str) -> None:
        if isinstance(v, str):
            s = v.lower()
            if any(m in s for m in bajos):
                hallazgos.append(ruta)
        elif isinstance(v, list):
            for i, x in enumerate(v):
                visitar(x, f"{ruta}[{i}]")
        elif isinstance(v, dict):
            for k, x in v.items():
                if any(m in str(k).lower() for m in bajos):
                    hallazgos.append(f"{ruta}{{{k}}}")
                visitar(x, f"{ruta}.{k}")

    visitar(respuesta, "$")
    return hallazgos
