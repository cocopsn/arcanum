---
module_id: fred-s2-ml-anomalias
spine: FrED
title: "Machine Learning aplicado a procesos físicos"
subtitle: "Cómo un sistema sabe que una máquina va a fallar antes de que falle"
source_canonical: "scikit-learn; anomaly detection; AI4I 2020"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 42
---

# Machine Learning aplicado a procesos físicos

> **Pregunta raíz.** Un extrusor de FrED Factory produce, cada segundo, un vector de valores: temperatura, velocidad de husillo, torque, vibración. La inmensa mayoría del tiempo, esos valores son "normales" — pero nadie te dio, de antemano, una definición precisa de qué significa "normal" ni una lista etiquetada de "esto fue una falla, esto no". ¿Cómo construyes un sistema que aprenda a reconocer que algo anda mal, sin que un humano le diga explícitamente qué buscar, y sin tener suficientes ejemplos históricos de fallas reales para "enseñarle" con supervisión? Esa es la pregunta que este módulo responde, y la respuesta — detección de anomalías no supervisada — resulta ser un problema estructuralmente distinto de la clasificación convencional que probablemente ya conoces, y hay que deducirlo como tal, no tratarlo como "clasificación con menos pasos".

## Prólogo — de dónde nace esto

Si quisieras enseñarle a un modelo a reconocer "fallas de rodamiento" de la forma convencional (aprendizaje supervisado), necesitarías miles de ejemplos etiquetados de "esto es una falla de rodamiento" contra los cuales entrenar. El problema es doblemente cruel en manufactura real: primero, **las fallas son raras por diseño** — si tu proceso falla constantemente, tienes un problema de ingeniería mucho más grave que necesitar más datos de entrenamiento. Segundo, y más sutil: **el catálogo de formas en que algo puede fallar nunca está completo**. Puedes tener ejemplos etiquetados de las tres fallas que ya observaste, pero la cuarta falla — la que nunca ha ocurrido todavía, quizás porque es nueva, o porque tu proceso apenas empieza a operar en un régimen distinto — no tiene ejemplos etiquetados por definición. No puedes etiquetar lo que no has visto.

Esto obliga a un cambio de pregunta completamente distinto al de la clasificación supervisada. En vez de preguntar "¿este ejemplo se parece a los ejemplos de falla que ya vi?", necesitas preguntar **"¿este ejemplo se parece al comportamiento normal masivo que sí tengo en abundancia, o se distingue de él?"**. Es una inversión completa del problema: no aprendes qué es una falla — aprendes qué es normal, con suficiente precisión como para que cualquier cosa que se aleje lo suficiente de eso "normal" dispare una señal, sin importar si esa desviación específica ya se había visto antes o no. Esa inversión es la raíz conceptual de toda la detección de anomalías no supervisada, y es lo primero que hay que internalizar antes de tocar cualquier algoritmo específico.

---

## 1. Qué es una anomalía — la taxonomía deducida desde el contexto de manufactura

Antes de detectar anomalías, hay que ser precisos sobre qué estamos buscando — "algo raro" es demasiado vago para diseñar un sistema. La literatura de detección de anomalías distingue tres tipos, y la distinción no es académica: **cada tipo exige un mecanismo de detección distinto**, y confundirlos lleva a sistemas que fallan silenciosamente en producción.

**Anomalía puntual (point anomaly)**: un solo dato individual que se desvía drásticamente del resto, sin necesidad de contexto adicional para reconocerlo como anómalo. Ejemplo en FrED: una lectura de temperatura de 500°C cuando el rango normal de operación es 190-220°C — ese valor es anómalo **por sí solo**, comparado contra la distribución general de valores observados, sin necesitar mirar qué pasó antes o después.

**Anomalía contextual**: un valor que sería completamente normal en un contexto, pero anómalo en otro — el valor mismo no es extremo, es la **combinación con su contexto** lo que lo hace anómalo. El ejemplo clásico (adaptado del contexto original de detección de anomalías en series de tiempo climáticas, pero directamente aplicable aquí): una temperatura ambiente de 30°C es normal en verano, anómala en pleno invierno. Traducido a manufactura: una velocidad de husillo de cierto valor puede ser perfectamente normal durante el arranque de la máquina (rampa de aceleración) pero anómala si ocurre en plena operación estable — el mismo número, dos veredictos distintos según el contexto temporal/operacional en que aparece.

**Anomalía colectiva**: un grupo de valores individuales, cada uno perfectamente normal por separado, que juntos como secuencia constituyen un patrón anómalo. Ejemplo: una serie de lecturas de vibración que individualmente están dentro de rango, pero que muestran una **tendencia sostenida al alza** durante horas — cada lectura sola no dispara ninguna alerta, pero el patrón colectivo es la firma temprana de un rodamiento degradándose progresivamente, precisamente el tipo de señal que quieres capturar **antes** de que se convierta en una falla puntual obvia (que ya sería demasiado tarde para prevención).

**Por qué esta distinción importa prácticamente**: un detector diseñado únicamente para anomalías puntuales (como el IsolationForest que vamos a construir en detalle) es ciego, por diseño, a anomalías contextuales y colectivas si se le alimenta el dato crudo sin ningún procesamiento adicional de contexto temporal. Vamos a ver esto explícitamente como trampa en la sección 6 — no es un detalle menor, es la limitación estructural más importante de la herramienta central de este módulo, y hay que saberlo desde el principio para no sobre-confiar en ella.

---

## 2. Por qué detección NO supervisada — deducido desde la escasez estructural de etiquetas

Ya lo planteamos en el prólogo intuitivamente; formalicemos la deducción.

En aprendizaje supervisado, necesitas un dataset `{(x_i, y_i)}` donde `y_i` es la etiqueta verdadera ("falla" / "normal") para cada ejemplo `x_i`. Para que un clasificador aprenda a distinguir la clase minoritaria (falla) de forma confiable, necesitas **suficientes ejemplos de la clase minoritaria** — no solo unos cuantos, sino suficientes para que el modelo pueda generalizar el patrón, no memorizar los pocos casos específicos que viste.

En manufactura real, esto choca contra una realidad estadística ineludible: si tu tasa de falla real es, digamos, 0.1% de las operaciones (una tasa deseable y típica en procesos maduros), entonces de cada 1000 registros solo esperas ~1 ejemplo de falla. Para acumular unos cientos de ejemplos etiquetados de falla — el mínimo razonable para que un clasificador supervisado generalice bien — necesitarías cientos de miles de registros y, más restrictivo aún, **tiempo real de operación** durante el cual esas fallas ocurran naturalmente (no puedes simplemente "generar más datos etiquetados" sin esperar a que la máquina falle de verdad, o sin recurrir a simulación, que trae sus propios supuestos y limitaciones).

**La consecuencia de diseño**: en la fase temprana de cualquier sistema de monitoreo de una máquina o proceso nuevo, **casi nunca tienes suficientes ejemplos etiquetados de falla** para entrenar un clasificador supervisado confiable — pero **sí tienes abundancia** de datos de operación normal (es, literalmente, la mayoría del tiempo de vida de la máquina). Esto invierte el problema exactamente como planteamos en el prólogo: en vez de aprender "qué es una falla" (para lo cual no tienes suficientes ejemplos), aprendes "qué es normal" (para lo cual tienes datos en abundancia), y detectas anomalías como **desviaciones del modelo de normalidad aprendido**, sin necesitar ni un solo ejemplo etiquetado de falla para entrenar. Esta es la razón estructural, no una preferencia metodológica arbitraria, de por qué la detección de anomalías no supervisada domina el espacio de mantenimiento predictivo temprano — es la única opción viable cuando las etiquetas de la clase que te interesa son estructuralmente escasas.

---

## 3. IsolationForest — deducido desde una pregunta distinta a la de otros métodos

### 3.1 La intuición que rompe con el enfoque convencional

La mayoría de los métodos de detección de anomalías "clásicos" (previos a Isolation Forest) funcionan modelando explícitamente la **densidad** de la distribución de datos normales — construyen un perfil de "qué tan común es cada región del espacio de características" y marcan como anómalo lo que cae en regiones de baja densidad. Esto funciona, pero requiere modelar la distribución completa de los datos normales — un problema potencialmente costoso, especialmente en alta dimensión (más sensores = más dimensiones = la "maldición de la dimensionalidad" hace que estimar densidad de forma confiable se vuelva progresivamente más difícil).

Isolation Forest (Liu, Ting, Zhou, 2008) hace una pregunta radicalmente distinta, y esa es la clave conceptual que hay que deducir, no memorizar: **en vez de preguntar "¿qué tan denso es el vecindario de este punto?", pregunta "¿qué tan fácil es AISLAR este punto del resto, usando cortes al azar?"**

### 3.2 La deducción del mecanismo: por qué un anómalo se aísla con menos cortes

Piensa en un salón lleno de gente conversando en grupos (el comportamiento normal, denso, agrupado) y una sola persona parada sola en una esquina, alejada de todos (el punto anómalo). Si jugaras un juego de "sepáralos con líneas divisorias al azar, una a la vez, hasta que cada persona quede sola en su propia región" — ¿a quién le toma menos líneas quedar aislado?

A la persona en la esquina. Porque está rodeada de espacio vacío en todas direcciones — casi **cualquier** línea que traces al azar tiene una alta probabilidad de separarla del resto del grupo denso, simplemente porque hay poca "compañía" cercana con la que compartir una región. En cambio, alguien en medio de un grupo denso necesita **muchas** líneas sucesivas, cada una separando cuidadosamente a la persona de sus vecinos más cercanos, antes de quedar completamente sola — porque cada línea al azar tiene alta probabilidad de caer *entre* dos personas del grupo denso sin separar a la persona específica que estás tratando de aislar del resto de su vecindario inmediato.

**Esta es exactamente la intuición formal de Isolation Forest, traducida a corte de datos**: construye un **árbol de aislamiento (isolation tree)** de la siguiente forma — selecciona una característica al azar (ej. "temperatura"), selecciona un valor de corte al azar dentro del rango observado de esa característica, y divide los datos en dos: los que quedan arriba del corte, los que quedan abajo. Repite recursivamente en cada subconjunto resultante, hasta que cada punto queda completamente aislado en su propia hoja del árbol (o hasta alcanzar una profundidad máxima predefinida, por razones de costo computacional).

**El path length (longitud de camino) es la métrica central**: para cada punto, cuenta cuántos cortes sucesivos hicieron falta para aislarlo completamente — esa es su **longitud de camino** en el árbol de aislamiento. Por la intuición geométrica de la sección anterior, **un punto anómalo (aislado espacialmente del resto) tiende a requerir MENOS cortes para quedar aislado — path length corto**. Un punto normal, rodeado de vecinos densos, tiende a requerir **MÁS** cortes — path length largo.

**Por qué usar un bosque (forest) y no un solo árbol**: un solo árbol de aislamiento, construido con cortes completamente al azar, tiene alta varianza — la elección específica de qué característica y qué valor de corte usar en cada paso es aleatoria, así que un solo árbol puede dar un path length poco confiable para un punto específico por pura casualidad de qué cortes se hicieron. La solución, exactamente el mismo principio de reducción de varianza que ves en cualquier método de ensamble (bagging, random forests para clasificación): construye **muchos** árboles de aislamiento independientes, cada uno con su propia secuencia aleatoria de cortes, y **promedia** el path length de cada punto a través de todos los árboles. Ese promedio es mucho más estable y confiable que el resultado de un solo árbol — la aleatoriedad individual de cada árbol se cancela parcialmente al promediar sobre muchos.

**La puntuación de anomalía (anomaly score)**: se normaliza el path length promedio contra el path length esperado para un punto "típico" en un árbol de ese tamaño (una fórmula basada en el comportamiento esperado de árboles de búsqueda binarios no balanceados, análoga a la altura esperada de un BST bajo inserciones aleatorias, aunque aquí construida deliberadamente sin ningún esfuerzo de balance — es un detalle formal de la fórmula original del paper que no es necesario memorizar para usar la herramienta correctamente, pero vale la pena reconocer la conexión conceptual: es literalmente la misma matemática de "altura esperada de un árbol construido con cortes al azar" que ya viste en el módulo de árboles, aplicada aquí no para optimizar búsqueda, sino como **señal** — un path length anormalmente corto es la señal de anomalía). El resultado final es un score donde valores cercanos a 1 indican alta anomalía, valores cercanos a 0 (o negativos, según la convención de la implementación) indican comportamiento normal.

### 3.3 Por qué esto escala mejor que estimar densidad explícitamente

La ventaja computacional central, y la razón práctica de la popularidad de este método en producción: no necesitas calcular ninguna distancia entre pares de puntos (a diferencia de métodos basados en vecinos más cercanos, cuyo costo crece con el cuadrado del número de puntos si se hace de forma ingenua) ni estimar densidad de forma explícita (costoso en alta dimensión). Solo necesitas hacer cortes al azar y contar profundidad — un mecanismo con costo computacional que escala de forma mucho más favorable con el volumen de datos, exactamente el tipo de propiedad que importa cuando estás procesando millones de lecturas de sensores por día, como en el contexto de FrED Factory a escala.

---

## 4. Preprocesamiento — por qué StandardScaler no es opcional

### 4.1 El problema que el escalado resuelve

IsolationForest hace cortes al azar sobre el **rango de valores** de cada característica. Si tienes temperatura (rango típico 190-220, una diferencia de ~30 unidades) y vibración (rango típico 0.001-0.05, una diferencia de ~0.05 unidades) sin escalar, el algoritmo va a hacer cortes "proporcionalmente al azar" dentro de cada rango — pero el rango de temperatura es cientos de veces más grande en magnitud absoluta que el de vibración. Esto no rompe el algoritmo de forma catastrófica (a diferencia de algunos otros métodos de ML donde el escalado es absolutamente crítico para la convergencia del entrenamiento), pero **sesga sutilmente qué características dominan la estructura de los cortes** — características con rangos numéricos más amplios en magnitud absoluta tienden a "dominar" más cortes simplemente por tener más rango numérico que dividir, no porque sean intrínsecamente más informativas para detectar anomalías.

**StandardScaler** resuelve esto transformando cada característica para que tenga media 0 y desviación estándar 1 — poniendo todas las características en una escala numérica comparable, de forma que ninguna domine los cortes solo por la magnitud arbitraria de las unidades en que fue medida originalmente (grados Celsius vs. milímetros/segundo vs. newton-metro de torque — unidades físicas completamente distintas, sin relación numérica natural entre sus rangos).

**Trampa explícita**: escalar usando estadísticas (media, desviación estándar) calculadas sobre **todo** el dataset, incluyendo los datos que vas a usar para evaluar el modelo, es una forma sutil de **data leakage** — el modelo "ve" información sobre la distribución completa (incluyendo posibles casos de prueba) antes de tiempo. La práctica correcta: ajustar (`fit`) el scaler únicamente sobre los datos de entrenamiento, y luego aplicar (`transform`) esa misma transformación (con los parámetros ya fijados del entrenamiento) tanto a los datos de entrenamiento como a cualquier dato nuevo que llegue después — nunca recalcular el scaler sobre datos nuevos.

---

## 5. Pipeline completo: código real end-to-end

```python
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest

# --------------------------------------------------------------
# 1. Simulacion de datos de sensores estilo FrED / AI4I 2020.
#    En produccion esto vendria del pipeline MQTT del modulo anterior
#    (fred-s1-datos-industriales) ya agregado en una tabla de features.
# --------------------------------------------------------------
np.random.seed(42)
n_normal = 2000
n_anomalias = 20   # las fallas son raras, por diseño del proceso

# Comportamiento normal: temperatura, torque, velocidad correlacionados
# alrededor de un punto de operacion estable, con ruido gaussiano.
temp_normal = np.random.normal(loc=205, scale=3, size=n_normal)
torque_normal = np.random.normal(loc=40, scale=2, size=n_normal)
velocidad_normal = np.random.normal(loc=1500, scale=20, size=n_normal)

# Anomalias puntuales: valores que se alejan claramente de la
# distribucion normal en una o mas dimensiones simultaneamente.
temp_anom = np.random.normal(loc=205, scale=3, size=n_anomalias) + \
            np.random.choice([-1, 1], n_anomalias) * np.random.uniform(15, 30, n_anomalias)
torque_anom = np.random.normal(loc=40, scale=2, size=n_anomalias) + \
              np.random.choice([-1, 1], n_anomalias) * np.random.uniform(10, 20, n_anomalias)
velocidad_anom = np.random.normal(loc=1500, scale=20, size=n_anomalias)

df = pd.DataFrame({
    "temperatura_c": np.concatenate([temp_normal, temp_anom]),
    "torque_nm": np.concatenate([torque_normal, torque_anom]),
    "velocidad_rpm": np.concatenate([velocidad_normal, velocidad_anom]),
})
etiqueta_real = np.array([0]*n_normal + [1]*n_anomalias)  # SOLO para evaluar despues,
                                                            # el modelo NUNCA la ve en entrenamiento

# --------------------------------------------------------------
# 2. Preprocesamiento: escalar ANTES de pasar al modelo.
#    fit_transform sobre el dataset completo aqui es aceptable
#    porque en este ejemplo didactico no separamos train/test --
#    en produccion, fit SOLO sobre el conjunto de entrenamiento
#    (ver seccion 4.1, trampa de data leakage).
# --------------------------------------------------------------
scaler = StandardScaler()
X_escalado = scaler.fit_transform(df[["temperatura_c", "torque_nm", "velocidad_rpm"]])

# --------------------------------------------------------------
# 3. IsolationForest: el parametro `contamination` es la
#    proporcion ESPERADA de anomalias en los datos -- una
#    estimacion de dominio, no un hiperparametro que se optimiza
#    ciegamente por accuracy (ver seccion 6 para el porque).
# --------------------------------------------------------------
proporcion_esperada = n_anomalias / (n_normal + n_anomalias)  # ~0.0099

modelo = IsolationForest(
    n_estimators=100,          # numero de arboles en el bosque
    contamination=proporcion_esperada,
    random_state=42,
)
modelo.fit(X_escalado)

# predict devuelve 1 (normal) o -1 (anomalia) segun el umbral
# derivado de `contamination`. decision_function da el score
# continuo -- util para ajustar el umbral manualmente en produccion
# en vez de confiar ciegamente en el default.
predicciones = modelo.predict(X_escalado)
scores = modelo.decision_function(X_escalado)

df["prediccion_anomalia"] = (predicciones == -1).astype(int)
df["score_anomalia"] = scores

# --------------------------------------------------------------
# 4. Evaluacion (SOLO posible aqui porque simulamos las etiquetas;
#    en produccion real raramente tienes esto de forma confiable
#    y temprana -- es precisamente el problema que motivo la
#    seccion 2 de este modulo).
# --------------------------------------------------------------
verdaderos_positivos = ((df["prediccion_anomalia"] == 1) & (etiqueta_real == 1)).sum()
falsos_positivos = ((df["prediccion_anomalia"] == 1) & (etiqueta_real == 0)).sum()
falsos_negativos = ((df["prediccion_anomalia"] == 0) & (etiqueta_real == 1)).sum()

print(f"Verdaderos positivos (fallas detectadas correctamente): {verdaderos_positivos}")
print(f"Falsos positivos (alarmas sobre maquina sana):          {falsos_positivos}")
print(f"Falsos negativos (fallas NO detectadas):                {falsos_negativos}")
```

**Qué hace este código, sección por sección, y por qué en ese orden**: simula datos con comportamiento normal denso y anomalías puntuales dispersas (sección 1 aplicada); escala **antes** de modelar (sección 4); entrena IsolationForest declarando explícitamente una estimación de la proporción de anomalías esperada, no un valor arbitrario (sección 6, siguiente); y evalúa contra las etiquetas reales — un lujo que tenemos aquí solo porque generamos los datos nosotros mismos, exactamente la limitación estructural que motivó todo el módulo (sección 2).

---

## 6. El parámetro de contaminación — el trade-off crítico de producción

### 6.1 Qué controla exactamente

`contamination` en scikit-learn no es un hiperparámetro que optimizas ciegamente maximizando una métrica de accuracy — es una **estimación de dominio** de qué fracción de tus datos esperas que sean anómalos, y esa estimación **determina directamente el umbral** que separa "normal" de "anomalía" sobre el score continuo que produce `decision_function`. Si declaras `contamination=0.01`, el modelo marca como anomalía aproximadamente el 1% de los puntos con los scores más bajos (más fáciles de aislar) — sin importar si ese 1% corresponde realmente a fallas genuinas o no.

### 6.2 El trade-off, deducido desde el costo real de cada tipo de error

**Si subestimas `contamination`** (declaras un valor más bajo que la tasa real de anomalías): el umbral se vuelve más estricto, el modelo marca como anomalía solo los casos más extremos — aumentas el riesgo de **falsos negativos**: fallas reales que el sistema no detecta porque su desviación, aunque real, no fue lo suficientemente extrema para cruzar el umbral estricto. En manufactura, un falso negativo significa que **una falla real pasa desapercibida** — el proceso sigue operando en condición anómala hasta que la falla se manifiesta de forma obvia (posiblemente ya como daño físico, pérdida de material, o peor, un riesgo de seguridad).

**Si sobreestimas `contamination`** (declaras un valor más alto que la tasa real): el umbral se vuelve más laxo, el modelo marca más puntos como anomalía — aumentas el riesgo de **falsos positivos**: operación completamente normal marcada incorrectamente como sospechosa. En manufactura, un falso positivo significa **parar una línea de producción sana** — un costo real y medible (tiempo de producción perdido, intervención de un operador para investigar una "falla" que no existía, posible desgaste de confianza del equipo humano en el sistema si ocurre con demasiada frecuencia, llevando eventualmente a que la gente empiece a ignorar las alertas — el peor desenlace posible, porque entonces ni siquiera las alertas verdaderas se atienden).

**No existe una elección "correcta" universal de `contamination` — es una decisión de negocio disfrazada de parámetro técnico**, que depende del **costo relativo real** de cada tipo de error en tu contexto específico: si una falla no detectada puede causar daño catastrófico o un riesgo de seguridad, sesgas hacia un umbral más sensible (tolerando más falsos positivos, porque el costo de un falso negativo es desproporcionadamente mayor). Si las paradas de línea son extremadamente costosas y las fallas reales son manejables si se detectan con algo de retraso, sesgas hacia un umbral más conservador. Esta decisión **no se puede tomar solo con matemáticas** — requiere conversación explícita con quien entiende el costo real de operación de FrED Factory (o de cualquier línea de producción real), y es exactamente el tipo de decisión donde el ingeniero que solo sabe ajustar hiperparámetros sin entender el proceso físico y su economía subyacente toma decisiones peligrosamente mal calibradas.

---

## 7. Regresión aplicada a control de calidad — el complemento predictivo

Detección de anomalías responde "¿esto es raro?". Una pregunta distinta, complementaria, es: "**dado el estado actual del proceso, ¿qué valor de calidad debería esperar en el producto resultante?**" — esto es un problema de **regresión**, no de detección de anomalías, y vale la pena distinguirlos con precisión porque resuelven necesidades distintas.

**El caso de uso deducido**: si tienes datos históricos de parámetros de proceso (temperatura de extrusión, velocidad, presión) junto con una medición de calidad del producto resultante (por ejemplo, diámetro del filamento producido, con tolerancia especificada), puedes entrenar un modelo de regresión que **prediga** la calidad esperada dado el estado actual de los parámetros de proceso — **antes** de que el producto termine de fabricarse y sea medido físicamente. Esto habilita control de calidad **predictivo**: si el modelo predice que, con los parámetros actuales, el producto va a salir fuera de tolerancia, puedes ajustar el proceso **antes** de desperdiciar material, en vez de descubrir el defecto solo después de fabricar la pieza completa y medirla.

```python
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

# Datos historicos: parametros de proceso -> diametro resultante del filamento
X = df[["temperatura_c", "torque_nm", "velocidad_rpm"]]
y_diametro_simulado = (
    1.75  # diametro objetivo en mm (estandar comun de filamento FDM)
    + 0.002 * (df["temperatura_c"] - 205)
    - 0.001 * (df["velocidad_rpm"] - 1500)
    + np.random.normal(0, 0.01, len(df))  # ruido de medicion/proceso
)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_diametro_simulado, test_size=0.2, random_state=42
)

modelo_regresion = RandomForestRegressor(n_estimators=100, random_state=42)
modelo_regresion.fit(X_train, y_train)

predicciones = modelo_regresion.predict(X_test)
error_absoluto_medio = mean_absolute_error(y_test, predicciones)
print(f"Error absoluto medio en prediccion de diametro: {error_absoluto_medio:.4f} mm")

# Uso en produccion: dado el estado ACTUAL del proceso (sin haber
# fabricado la pieza todavia), predecir si el resultado estara
# dentro de tolerancia.
tolerancia = 0.05  # +/- mm, ejemplo tipico de impresion FDM
estado_actual = pd.DataFrame({
    "temperatura_c": [212],
    "torque_nm": [41],
    "velocidad_rpm": [1480],
})
diametro_predicho = modelo_regresion.predict(estado_actual)[0]
dentro_de_tolerancia = abs(diametro_predicho - 1.75) <= tolerancia
print(f"Diametro predicho: {diametro_predicho:.3f} mm, "
      f"dentro de tolerancia: {dentro_de_tolerancia}")
```

**Por qué RandomForestRegressor y no solo regresión lineal aquí**: la relación entre parámetros de proceso y calidad del producto en un proceso físico real raramente es puramente lineal — puede haber interacciones no lineales entre temperatura y velocidad (el efecto de la temperatura sobre el diámetro puede ser distinto a velocidades altas que a velocidades bajas). Un modelo de ensamble basado en árboles puede capturar esas no-linealidades sin que tengas que especificarlas manualmente de antemano (a diferencia de una regresión lineal, donde tendrías que agregar explícitamente términos de interacción si sospechas que existen) — al costo de ser menos interpretable que un coeficiente lineal simple. Este es, de nuevo, un trade-off explícito de ingeniería, no una elección "obviamente correcta": si necesitas explicabilidad regulatoria estricta (común en ciertos contextos de manufactura certificada), un modelo lineal simple con términos de interacción explícitos y bien entendidos puede ser preferible a un bosque aleatorio más preciso pero más opaco.

---

## 8. Trampas y edge cases explícitos

**Desbalance de clases distorsiona la intuición de "accuracy"**: si tu tasa real de fallas es 1%, un modelo que simplemente predice "todo es normal" siempre, sin aprender nada, tiene 99% de accuracy — un número que suena excelente pero es completamente inútil, porque falla exactamente en el 1% de casos que te importan detectar. Esta es la razón por la que, en el código de la sección 5, evaluamos con verdaderos positivos, falsos positivos y falsos negativos por separado, no con accuracy global — accuracy es una métrica engañosa por diseño cuando las clases están desbalanceadas, y en detección de anomalías **el desbalance es la norma, no la excepción**.

**Anomalía contextual engañando a un detector ingenuo**: como se estableció en la sección 1, IsolationForest alimentado únicamente con valores instantáneos de sensores (sin contexto temporal) es ciego a anomalías contextuales por diseño. Una velocidad de 500 RPM durante el arranque de la máquina es normal; la misma velocidad de 500 RPM en plena operación estable (cuando el rango normal esperado es 1500 RPM) es una anomalía severa — pero si el modelo solo ve el valor aislado "500 RPM" sin saber en qué fase de operación está la máquina, puede fallar en distinguir ambos casos. **La mitigación estándar**: enriquecer las características de entrada con contexto explícito — no solo el valor instantáneo, sino también features derivadas como "tiempo desde el último arranque", "fase de operación actual" (categórica, si está disponible del PLC), o estadísticas de ventana móvil (media y desviación estándar de los últimos N segundos, que capturan tendencia reciente en vez de solo el instante actual). Esto convierte, en efecto, un problema de anomalía contextual en uno de anomalía puntual sobre un espacio de características enriquecido — no cambias el algoritmo, cambias qué información le das para trabajar.

**El peligro real de un umbral mal calibrado en producción**: ya lo desarrollamos formalmente en la sección 6, pero vale la pena remarcarlo como la trampa de mayor consecuencia práctica del módulo completo: desplegar un sistema de detección de anomalías con `contamination` copiado de un ejemplo de tutorial, sin calibrarlo contra el costo real de falsos positivos/negativos de tu proceso específico, es la forma más común y más costosa de que un proyecto de ML en manufactura falle en producción — no por un error en el algoritmo, sino por una decisión de umbral tomada sin suficiente contexto de dominio.

---

## 9. Trade-offs explícitos: el consejo del temario, simplicidad sobre sofisticación

**IsolationForest vs. otros métodos**: existen alternativas — Local Outlier Factor (basado en densidad local, más sensible a anomalías contextuales dentro de vecindarios pero más costoso computacionalmente), One-Class SVM (una frontera de decisión aprendida, potente pero sensible a la elección de kernel e hiperparámetros, y con peor escalabilidad a datasets grandes), autoencoders (redes neuronales que aprenden a reconstruir datos normales, marcando como anómalo lo que reconstruyen mal — potente para datos de alta dimensión y estructura compleja como imágenes o series de tiempo largas, pero exige considerablemente más datos, cómputo, y experiencia de tuning que IsolationForest). **La recomendación práctica, y la razón de que IsolationForest sea frecuentemente el punto de partida correcto**: es rápido de entrenar, tiene pocos hiperparámetros que calibrar cuidadosamente (`n_estimators` y `contamination` son, en la práctica, los que más importan), escala bien a datasets grandes, y no requiere supuestos fuertes sobre la forma de la distribución de los datos normales. Para un primer sistema de monitoreo en un contexto como FrED Factory, **la ganancia marginal de un método más sofisticado (autoencoders, ensambles más complejos) raramente justifica el costo adicional de implementación y mantenimiento**, comparado con la ganancia de simplemente tener *algún* sistema de detección funcionando en producción, generando datos, y siendo iterado con feedback real de operación — un sistema simple desplegado y monitoreado activamente vence, en la práctica de ingeniería real, a un sistema sofisticado que tarda meses en llegar a producción o que nadie en el equipo entiende lo suficiente para mantener y calibrar con confianza.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**Mantenimiento predictivo — el destino natural de este sistema.** Todo lo que este módulo construye — detección de anomalías puntuales, contextuales, colectivas; regresión de calidad — es la base técnica del **mantenimiento predictivo (predictive maintenance)**: en vez de mantenimiento reactivo (arreglar cuando ya falló) o mantenimiento preventivo programado (arreglar cada X horas de operación sin importar el estado real, desperdiciando vida útil de componentes sanos), el mantenimiento predictivo usa exactamente las señales de anomalía colectiva de la sección 1 — la tendencia sostenida en vibración, por ejemplo — para predecir **cuándo** un componente probablemente va a fallar, permitiendo programar el mantenimiento justo antes de esa ventana, maximizando la vida útil real del componente sin arriesgar una falla no planeada. La conexión con el gemelo digital del módulo anterior (`fred-s1-datos-industriales`) es directa: un gemelo digital que mantiene un modelo físico actualizado del estado de la máquina puede combinarse con los modelos estadísticos de este módulo para dar predicciones de vida útil restante mucho más ricas que cualquiera de los dos enfoques por separado — el gemelo digital aporta el modelo del mecanismo físico subyacente, la detección de anomalías aporta la señal empírica de que algo se está desviando de ese modelo.

**El puente hacia visión computacional para defectos.** Todo el pipeline de este módulo asume datos estructurados de sensores numéricos (temperatura, torque, vibración). Pero una fracción significativa de los defectos de calidad en manufactura son **visuales** — una superficie con textura irregular, un defecto de capa visible en una pieza impresa en 3D, una deformación geométrica que un sensor numérico simple no captura directamente pero que una cámara sí. La detección de anomalías en imágenes sigue el mismo principio conceptual raíz de este módulo (aprender qué es "normal" a partir de ejemplos normales abundantes, sin necesitar etiquetas exhaustivas de cada tipo posible de defecto), pero exige arquitecturas de modelo distintas (típicamente redes neuronales convolucionales, autoencoders visuales) diseñadas para el tipo de estructura espacial que una imagen tiene y que un vector de features numéricas de sensores no — ese es exactamente el contenido de un módulo posterior sobre visión computacional en FrED, que se construye sobre la misma pregunta raíz de este módulo, aplicada a un tipo de dato distinto.

---

## Síntesis — el mapa mental

1. Detección de anomalías no supervisada existe porque las etiquetas de "falla" son **estructuralmente escasas** en manufactura real — fallas raras por diseño, y el catálogo de formas de fallar nunca está completo. La solución invierte el problema: aprende qué es normal (datos abundantes), detecta lo que se desvía.
2. Tres tipos de anomalía — puntual, contextual, colectiva — exigen mecanismos de detección distintos. Confundirlos es la trampa estructural más importante del módulo: un detector diseñado para anomalías puntuales es ciego por diseño a las otras dos, salvo que enriquezcas explícitamente las features con contexto.
3. **IsolationForest** invierte la pregunta de "¿qué tan denso es el vecindario?" (métodos basados en densidad) a "¿qué tan fácil es aislar este punto con cortes al azar?" — un punto anómalo, espacialmente aislado, requiere **menos cortes** (path length corto) para quedar completamente separado del resto; se usa un **bosque** (no un solo árbol) para reducir la varianza de la aleatoriedad de los cortes individuales, promediando path length sobre muchos árboles.
4. El **escalado** (StandardScaler) previene que características con rangos numéricos absolutos más amplios dominen los cortes solo por magnitud de unidad, no por relevancia real — y debe ajustarse únicamente sobre datos de entrenamiento para evitar data leakage.
5. **`contamination`** no es un hiperparámetro técnico neutral — es una decisión de negocio sobre el costo relativo real de falsos positivos (parar una línea sana) vs. falsos negativos (dejar pasar una falla real), y esa decisión exige contexto de dominio, no solo optimización matemática ciega.
6. **Regresión** complementa la detección de anomalías respondiendo una pregunta distinta: no "¿esto es raro?" sino "¿qué calidad debo esperar dado el estado actual del proceso?" — habilitando control de calidad predictivo antes de fabricar la pieza completa.
7. El desbalance de clases hace que **accuracy sea una métrica engañosa** en este dominio — evalúa siempre con verdaderos/falsos positivos/negativos por separado, nunca con accuracy global.
8. **Simplicidad sobre sofisticación** como principio de ingeniería real: IsolationForest, con pocos hiperparámetros y buena escalabilidad, es frecuentemente el punto de partida correcto — un sistema simple en producción, iterado con feedback real, vence a un sistema sofisticado que nunca llega a desplegarse con confianza del equipo.

---

## Preguntas que deberías poder responder

1. Explica, sin ver el texto, por qué la escasez de etiquetas de falla en manufactura no es un problema temporal que "más datos" resuelve trivialmente — ¿qué característica estructural del problema hace que sea fundamentalmente distinto a simplemente necesitar un dataset más grande?
2. Da un ejemplo concreto (no de este texto) de anomalía contextual en un proceso físico que conozcas, y explica por qué un detector basado únicamente en el valor instantáneo fallaría en detectarla correctamente.
3. Deduce, con tus propias palabras y sin ver el texto, por qué un punto espacialmente aislado requiere menos cortes al azar para quedar completamente separado del resto — usa la analogía del salón lleno de gente o construye la tuya propia.
4. ¿Por qué IsolationForest usa un bosque de árboles en vez de un solo árbol de aislamiento? Conecta tu respuesta con el principio general de reducción de varianza por promediado que aparece en otros métodos de ensamble.
5. Explica por qué `contamination=0.01` no es "más correcto" ni "más incorrecto" en abstracto que `contamination=0.05` — ¿qué información adicional, fuera del modelo mismo, necesitas para justificar una elección sobre la otra?
6. Diseña (en palabras, no código) tres features derivadas que convertirían el ejemplo de "velocidad anómala solo durante arranque" de una anomalía contextual invisible a una anomalía puntual detectable por IsolationForest sin cambiar el algoritmo.
7. ¿Por qué evaluar un sistema de detección de anomalías con accuracy global es engañoso quirúrgicamente en este dominio específico? Da el número de accuracy que obtendría un modelo que simplemente predice "todo normal" siempre, dada una tasa de falla real de 1%, y explica por qué ese número es inútil.
8. Explica la diferencia de pregunta que responde detección de anomalías vs. regresión de calidad en este módulo — ¿por qué necesitas ambas, y no basta con una sola de las dos herramientas, para un sistema completo de control de calidad predictivo?

---

## Fuentes

- Liu, F. T., Ting, K. M., Zhou, Z.-H., "Isolation Forest", *IEEE International Conference on Data Mining (ICDM)*, 2008 — el paper original que introduce el mecanismo de path length y bosque de aislamiento.
- scikit-learn, documentación oficial de `IsolationForest`: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html
- scikit-learn, documentación oficial de `StandardScaler`: https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.StandardScaler.html
- scikit-learn, documentación de `RandomForestRegressor`: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html
- scikit-learn, guía de usuario sobre detección de novedad y outliers (comparativa de métodos, incluyendo Local Outlier Factor y One-Class SVM): https://scikit-learn.org/stable/modules/outlier_detection.html
- AI4I 2020 Predictive Maintenance Dataset — dataset sintético de mantenimiento predictivo ampliamente usado como referencia didáctica en la comunidad de ML aplicado a manufactura, disponible en el UCI Machine Learning Repository y en Kaggle.
