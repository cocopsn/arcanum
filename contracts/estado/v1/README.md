# Contrato de estado v1

Fuente canónica: `Auctorum/auctorum` → `contracts/estado/v1/`. Cada repo que lo expone o lo
consume lo **copia entero** y corre su gate (`node verificar.mjs` o `python verificar.py`), que
falla si la copia no tiene la `HUELLA` de la canónica. Cambiar el contrato = cambiarlo aquí,
`node contracts/estado/v1/verificar.mjs --sellar`, y volver a copiar el directorio a cada repo.

## Qué es y qué no es

Estado **operativo** entre los sistemas del dueño: salud, versión, despliegues, conteos
agregados, eventos operativos y costos. **Nunca** contenido de usuarios:

| sistema | puede salir | no sale jamás |
|---|---|---|
| Med | salud, versión, deploys, colas, conteos por tenant **opaco** (`t_` + 12 hex), costos | nombres, slugs, PHI, texto de errores |
| Primus | salud, versión, deploys, conteos agregados | ningún dato de cliente o prospecto |
| Pendy | salud, versión, estado del feed | datos personales de Miranda (ánimo, peso, hábitos) |
| Arcanum | progreso, rachas, riesgo de olvido (datos del propio dueño) | — |
| Kee | salud, versión, deploys, eventos operativos | su vida, su memoria, su pizarrón |

El esquema (`esquemas.json`) es **cerrado**: todo objeto declara `additionalProperties`, y toda
cadena es enum, patrón cerrado o fecha. Un error de validación nombra la **ruta** del campo, nunca
su valor. Quien emite valida su propia respuesta antes de enviarla y, si no valida, responde 500
sin cuerpo: fallar cerrado.

## Endpoints (todos `GET`, sólo lectura)

`/api/estado/v1/salud` · `/version` · `/despliegues` · `/metricas` · `/eventos?desde=<ISO>` ·
y en el recolector de la plataforma `/costos`. Ver `openapi.yaml`.

Kee no abre puertos: publica las mismas respuestas como blobs `estado/v1/<nombre>.json` en un
contenedor propio (`estado`), separado del de Mission Control, con lectura concedida por rol a
quien deba leerlo. Mismo esquema, mismo validador.

## Identidad

- **Dentro de Azure:** Entra con identidad administrada, audiencia por servicio, sin secretos.
- **Fuera de Azure:** JWT HS256 (`token.mjs` / `tokens.py`), una llave por par emisor→receptor en
  Key Vault (`estado-v1-<emisor>-a-<receptor>`), vida ≤ 900 s, `scope` = `estado:leer`.
  401 = autenticación (sin token, malformado, algoritmo, emisor, firma, vencido, vida, audiencia);
  403 = token válido sin el scope.
- Bitácora por llamada en cada extremo: quién, endpoint, estado, milisegundos. **Sin payload.**

## Escrituras

Una sola en v1: Kee → Pendy (el feed de lo que el dueño marca como compartible). Ningún comando
remoto: nadie despliega, reinicia ni mueve datos de otro sistema por este contrato.
