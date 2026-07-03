---
module_id: cb000000-0000-4000-8000-000000000002
spine: FrED
title: La máquina que aprende a asustarse
subtitle: Detección de anomalías cuando no tienes etiquetas de "falla"
source_canonical: scikit-learn IsolationForest; AI4I 2020 Predictive Maintenance (UCI); Liu, Ting & Zhou (2008)
depth: raiz
structure: pregunta-raiz + prologo + nucleo + conexiones + sintesis + preguntas + fuentes
generated_by: ejemplo semilla — reemplázalo con tu libro generado en Sonnet 5
version: 0.1-ejemplo
reading_minutes: 12
---

> En una línea de producción real casi nunca tienes ejemplos etiquetados de "falla" — la máquina rara vez se rompe. ¿Cómo entrenas un detector de anomalías sin la clase que quieres detectar?

## Prólogo

El instinto de clasificación falla aquí: no puedes entrenar "normal vs falla" cuando el 99.9% de tus datos son normales y las fallas son escasas, tardías y distintas cada vez. El giro es dejar de preguntar "¿esto es una falla?" y preguntar "¿esto es RARO?". La rareza no necesita etiquetas: la defines respecto a la densidad de lo que ya viste.

## Por qué un Isolation Forest, y no una frontera

La familia clásica (one-class SVM, elliptic envelope) intenta dibujar la frontera de "lo normal" y marcar lo de afuera. Isolation Forest invierte la lógica: en vez de modelar lo normal, **aísla lo raro**. Construye árboles partiendo el espacio con cortes aleatorios; un punto anómalo — que vive en una región poco poblada — queda aislado en pocos cortes (camino corto a la hoja), mientras un punto normal, rodeado de vecinos, necesita muchos. La *longitud de camino promedio* es la señal de anomalía. Es barato, escala, y no asume forma gaussiana de los datos.

```python
from sklearn.ensemble import IsolationForest

# contamination = la fracción esperada de anomalías; es una decisión de negocio,
# no un hiperparámetro a optimizar a ciegas — fija el umbral de cuántas alarmas toleras.
model = IsolationForest(n_estimators=200, contamination=0.01, random_state=42)
model.fit(X_train_normal)         # entrena SOLO con operación normal
scores = model.score_samples(X)   # más negativo = más anómalo
```

## El error que arruina el pipeline: falsos positivos vs falsos negativos

En mantenimiento, los dos errores no cuestan igual. Un **falso negativo** (no detectaste la falla que venía) puede ser una parada de línea de miles de dólares. Un **falso positivo** (alarma sin falla) cuesta la confianza del operador: si el sistema "grita" seguido, lo apagan, y entonces no sirve para nada. `contamination` es exactamente esa perilla: súbela y detectas más (menos FN, más FP); bájala y molestas menos (menos FP, más FN). No hay valor "óptimo" universal — hay un valor que respeta el costo relativo de TU planta.

## Conexiones

Este pipeline es el corazón del flujo de la celda S3 (sensor → MQTT → InfluxDB → Grafana): el detector consume el mismo stream de features que la base de tiempo almacena, y sus alarmas se vuelven anotaciones en el tablero. La detección de anomalías no vive sola; es un nodo en la tubería de datos industrial. Y la idea de "puntuar rareza sin etiquetas" reaparece en visión (celda de FrED/CV): un autoencoder que reconstruye mal lo que nunca vio es el mismo principio con otra maquinaria.

## Síntesis

Sin etiquetas de falla, no clasificas: modelas la normalidad y mides desviación. Isolation Forest lo hace aislando lo raro (camino corto = anómalo), sin asumir forma de los datos. El entregable real no es el modelo — es la decisión de `contamination` justificada por el costo asimétrico de FN vs FP en tu proceso.

## Preguntas que deberías poder responder

- ¿Por qué no puedes usar un clasificador supervisado normal/falla en este problema?
- Explica, en una frase, por qué "camino corto en el árbol" significa "anómalo".
- Si tu operador se queja de demasiadas alarmas, ¿subes o bajas `contamination`? ¿Qué error empeoras a cambio?

## Fuentes

- scikit-learn — IsolationForest. https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html
- AI4I 2020 Predictive Maintenance Dataset (UCI). https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset
- F. T. Liu, K. M. Ting, Z.-H. Zhou, "Isolation Forest" (ICDM 2008) — el paper original.
