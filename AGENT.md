# ARCANUM · AGENT.md — el tutor adversarial (Bloque 6, patrón Kee)

Diseño del agente tutor por-módulo: **adversarial por diseño** (persona estilo Asuka),
**RAG local-first**, y la **decisión** sobre la integración con el proyecto local del
usuario, "Kee".

## Persona — adversarial al servicio del aprendizaje

El tutor NO es complaciente. Dos modos **simultáneos** (no se elige uno):

1. **Contenido rico cuando se necesita.** Cuando el aprendiz de verdad choca con un
   muro, el tutor explica a fondo, desde el primer principio, con el detalle que haga
   falta. El recurso es rico — no minimalista.
2. **Fricción encima.** "Ahora dime por qué." No regala la solución de un ejercicio:
   guía con la pregunta correcta hasta que el aprendiz la derive. Corrige duro. Si una
   nota del usuario tiene un error, lo señala sin suavizar.

Regla dura: **nunca da la respuesta final de un problema/tarea**. Empuja a que salga.
La persona es configurable (el system prompt vive en la Edge Function y se ajusta sin
tocar el cliente).

## RAG — retrieval local-first

ARCANUM es local-first: el conocimiento del usuario (notas, mastery, prerrequisitos)
vive en el **log event-sourced del cliente**, no en una base consultable server-side.
Por eso el **retrieval ocurre en el cliente** y el **arming + generación** en la nube:

```
cliente (local)                         Edge Function (ai-router, action:"tutor")
─────────────────                       ─────────────────────────────────────────
buildTutorContext(readModel, ...)  ──▶  arma el system prompt Asuka con el contexto
  · tópico + summary autorado            + llama al modelo (router [openai, anthropic])
  · mastery % + status                   + devuelve la respuesta (markdown)
  · prerrequisitos (títulos)
  · LAS NOTAS del usuario del módulo  ◀──  respuesta = BORRADOR EDITABLE
```

- Retrieval: `src/lib/tutor.ts` → `buildTutorContext` (puro, testeable).
- Transporte/IA: `src/sync/ai.ts` → `askTutor`; Edge Function `supabase/functions/ai-router`
  acción `tutor`. Keys SOLO en los secrets de la función (`Deno.env.get`), nunca en el
  cliente. Sin sesión/keys → `askTutor` devuelve null → el cliente degrada con honestidad
  (el reto y la evaluación heurística siguen funcionando offline).
- UI: `src/ui/subject/TutorSheet.tsx`.

## Contenido generado = borrador editable (patrón OCR)

Lo que el tutor genera (explicaciones, ejercicios extra) **nunca se presenta como verdad
fija**. Entra como **borrador editable** que el usuario revisa, corrige y valida — igual
que el OCR de la Fase 2. Si lo guarda, se persiste como **nota** (`note.created`), editada
por él. La generación cruda no toca el grafo de maestría ni se trata como hecho.

## El patrón "Kee" y la decisión tomada

Kee es el agente local del usuario (corre en su hardware). De Kee se reutiliza el
**PATRÓN**, no la instancia:

- **Estructura de system prompt**: rol explícito + reglas de comportamiento (aquí: la
  persona adversarial + la regla de no-regalar-respuesta) + el contexto inyectado al final.
- **Definición de tools / contrato de salida**: respuesta estructurada y acotada (aquí:
  markdown conciso; en `evaluate`, JSON `{summary, strengths, gaps, challenge}`).
- **Enfoque RAG**: recuperar el contexto relevante del usuario ANTES de generar, para que
  la respuesta sea específica a dónde está — no genérica.

**Decisión (tomada, no a consultar): se copia el PATRÓN ahora.** NO se integra Kee
corriendo en hardware local de forma directa, porque eso requeriría **exponer Kee a la
red** (un endpoint accesible desde la Edge Function / el cliente), con su superficie de
seguridad. Queda como **puerta futura documentada**:

> **Kee-directo (futuro).** Para enrutar el tutor a la instancia real de Kee: exponer Kee
> tras un endpoint autenticado (túnel + token, nunca abierto), y en `ai-router` añadir un
> proveedor `"kee"` al router `[openai, anthropic, kee]` que apunte a ese endpoint. El
> contrato (TutorContext → respuesta markdown) ya está; solo cambia el transporte. Mientras
> tanto, el system prompt aquí debe reconciliarse con el system prompt real de Kee del
> usuario (este archivo documenta el patrón; los detalles exactos de Kee los aporta el dueño).

## Resumen de archivos

| Pieza | Archivo |
|---|---|
| RAG retrieval (puro) | `src/lib/tutor.ts` |
| Transporte IA | `src/sync/ai.ts` (`askTutor`) |
| Prompt + modelo | `supabase/functions/ai-router/index.ts` (acción `tutor`) |
| UI (borrador→nota) | `src/ui/subject/TutorSheet.tsx` |
| Evaluador adversarial (Bloque 5, mismo espíritu) | `src/core/evaluation.ts`, acción `evaluate` |
