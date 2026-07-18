---
module_id: fred-op-8-cv-industrial
spine: FrED
path: Operativo
title: "Computer Vision para control industrial"
subtitle: "De la imagen a la acción física, con confianza"
source_canonical: "OpenCV; Stanford CS231n; contexto FrED/Schneider; ORION Bridge"
depth: deep
structure: hybrid
generated_by: "Claude Sonnet 5"
version: 1
reading_minutes: 45
---

# Computer Vision para control industrial

> **Pregunta raíz.** Una cámara mira una pieza que pasa por una línea de producción. En algún lugar de esa imagen puede haber un defecto — una grieta, una deformación, una dimensión fuera de tolerancia — o puede no haberlo. **¿Cómo convierte un sistema una matriz de números (eso es, literalmente, lo único que una cámara le da a una computadora) en la decisión binaria "rechaza esta pieza" o "déjala pasar", con suficiente confiabilidad como para disparar una acción física real, en el tiempo que la pieza tarda en pasar frente a la cámara?** Este módulo construye esa cadena completa, desde el píxel hasta el comando validado que llega al Bridge — y, como ya es el patrón de esta ruta operativa, la pieza que codificas a mano no es la visión misma, es la disciplina de la decisión que la visión alimenta.

## Prólogo — de dónde nace esto

Ya construiste, en el módulo de ML aplicado a procesos físicos (`fred-s2-ml-anomalias`), la maquinaria para detectar cuándo un vector de sensores numéricos —temperatura, torque, vibración— se desvía de lo normal. Este módulo resuelve un problema estructuralmente idéntico pero con una fuente de datos radicalmente distinta: en vez de un puñado de números por segundo, una cámara te da **cientos de miles o millones de números por cuadro** — la matriz de píxeles de una imagen — y el desafío no es solo detectar la anomalía, es primero **extraer, de ese océano de números, la información espacial específica** (¿hay un borde donde no debería? ¿la dimensión medida está fuera de tolerancia?) que constituye la señal relevante.

La pregunta raíz de este módulo tiene dos respuestas posibles, y la tensión entre ellas —visión clásica basada en reglas explícitas vs. deep learning que aprende el patrón desde datos— es el primer eje que hay que deducir con cuidado, porque la intuición moderna de "usa deep learning para todo lo que involucre imágenes" es exactamente el tipo de sofisticación innecesaria que ya identificaste como trampa en el módulo de ML: a veces la herramienta más simple, más rápida, y más interpretable es la correcta, y saber cuándo es cuándo es precisamente la habilidad que este módulo construye.

---

## 1. Qué es una imagen para una computadora — la deducción que lo cambia todo

### 1.1 La matriz de píxeles, no una "foto"

Para un humano, una imagen es una escena visual coherente. Para una computadora, una imagen es, sin ninguna excepción ni magia adicional, una **matriz de números** — para una imagen en escala de grises, una matriz 2D donde cada entrada es un valor de intensidad (típicamente 0-255, un byte por píxel); para una imagen a color, típicamente tres matrices apiladas (canales rojo, verde, azul), cada una con la misma estructura. Una imagen de 1920×1080 píxeles a color es, literalmente, más de 6 millones de números individuales, sin ninguna estructura semántica inherente —"esto es un borde", "esto es una pieza"— codificada explícitamente en esos números. Toda la inteligencia del sistema de visión, sea clásica o basada en deep learning, consiste en **extraer estructura semántica útil a partir de esa matriz cruda de intensidades**, y esa es exactamente la raíz de por qué existen dos familias de técnica completamente distintas para hacerlo.

### 1.2 Por qué esto es más parecido a lo que ya conoces de lo que parece

Piensa en la matriz de píxeles como un array bidimensional — exactamente el tipo de estructura que ya dedujiste completamente en el módulo de estructuras lineales, con la misma aritmética de direccionamiento (`imagen[fila][columna]` es, mecánicamente, la misma operación de acceso O(1) que `arr[i]`). Cada operación de procesamiento de imagen que vas a ver en este módulo —un filtro, una convolución, una detección de bordes— es, en su núcleo computacional, una operación aritmética aplicada sistemáticamente sobre esta matriz, no algo cualitativamente distinto del resto de la programación que ya dominas.

---

## 2. Visión clásica con OpenCV — reglas explícitas, deducidas desde el problema de "qué constituye un borde"

### 2.1 Filtros y convolución — suavizar antes de decidir

Antes de poder detectar algo, casi siempre necesitas **reducir ruido**: una cámara real introduce variación aleatoria de píxel a píxel (ruido del sensor, compresión, iluminación imperfecta) que, sin tratar, puede confundirse con la señal real que buscas. Un **filtro de suavizado** (por ejemplo, un filtro Gaussiano) recorre la imagen con una ventana pequeña (un *kernel*, típicamente 3×3 o 5×5), reemplazando cada píxel por un promedio ponderado de sus vecinos — la operación matemática que hace esto se llama **convolución**, y es, mecánicamente, exactamente lo que sugiere: desliza el kernel sobre cada posición de la imagen, calcula una suma ponderada de los píxeles bajo el kernel en esa posición, y esa suma se convierte en el valor del píxel de salida.

**Por qué esto reduce ruido, deducido y no solo afirmado**: el ruido aleatorio, por definición, no está correlacionado entre píxeles vecinos — un píxel con ruido positivo probablemente tiene vecinos con ruido en direcciones distintas. Promediar sobre una ventana de vecinos hace que ese ruido no correlacionado tienda a cancelarse parcialmente (la misma intuición estadística de que el promedio de muchas muestras ruidosas converge hacia el valor real, subyacente en cualquier promediado estadístico), mientras que la señal real de la imagen —bordes, formas, texturas genuinas— sí está correlacionada espacialmente (un borde real se extiende sobre múltiples píxeles consecutivos, no es un evento aislado de un solo píxel), así que el suavizado la preserva mucho mejor de lo que destruye el ruido.

### 2.2 Detección de bordes — deducida desde qué es, matemáticamente, un borde

**La pregunta raíz de esta técnica**: ¿qué distingue, en términos puramente numéricos, un borde real (el límite entre una pieza y el fondo, o una grieta) de una región uniforme de la imagen? La respuesta: un borde es un lugar donde la intensidad de los píxeles **cambia rápidamente** en una dirección espacial — una región uniforme (el interior de una pieza sin defectos, el fondo liso) tiene intensidad casi constante entre píxeles vecinos; un borde tiene una diferencia de intensidad grande entre un lado y el otro.

**Esto es, literalmente, una derivada espacial** — la tasa de cambio de intensidad respecto a la posición. El operador de **Sobel**, uno de los detectores de bordes clásicos más usados, aproxima exactamente esta derivada aplicando dos kernels de convolución (uno para la dirección horizontal, otro para la vertical) que, en esencia, calculan "cuánto cambia la intensidad si me muevo un píxel en esta dirección". Donde esa magnitud de cambio supera un umbral, marcas el píxel como parte de un borde.

```python
import cv2
import numpy as np

def detectar_bordes(ruta_imagen):
    """
    Deteccion de bordes clasica con OpenCV: suavizado -> gradiente
    (Sobel, la derivada espacial deducida en la seccion 2.2) ->
    umbralizacion. Fiel al pipeline estandar de OpenCV.
    """
    imagen = cv2.imread(ruta_imagen, cv2.IMREAD_GRAYSCALE)

    # Suavizado: reduce ruido antes de calcular derivadas, porque
    # el ruido tiene alta frecuencia espacial y una derivada lo
    # amplificaria dramaticamente si no se suaviza primero.
    suavizada = cv2.GaussianBlur(imagen, (5, 5), sigmaX=0)

    # Canny: el detector de bordes clasico mas usado en la practica,
    # que internamente aplica Sobel y luego un algoritmo de
    # supresion de no-maximos + umbralizacion con histeresis (el
    # mismo concepto de histeresis de dos umbrales que ya viste en
    # el modulo del Reactive Observer para evitar oscilacion de
    # ruido alrededor de un unico umbral -- aqui aplicado a
    # gradientes de intensidad, no a series de tiempo).
    bordes = cv2.Canny(suavizada, threshold1=50, threshold2=150)

    return bordes
```

**Nota la reaparición explícita de histéresis**: el algoritmo de Canny usa dos umbrales (50 y 150 en el código) exactamente por la misma razón que ya dedujiste en el módulo del Reactive Observer — un solo umbral produce bordes fragmentados o ruidosos ante pequeñas variaciones de gradiente cerca del límite; dos umbrales con una "zona de histéresis" entre ellos dan bordes más consistentes y continuos.

### 2.3 Umbralización y contornos — de bordes a formas cerradas

Detectar bordes te da píxeles individuales marcados como "borde" o "no borde" — todavía no te da **regiones** o **formas** coherentes que puedas medir o clasificar. La **umbralización** (thresholding) convierte una imagen en escala de grises en una imagen **binaria** (cada píxel es 0 o 255) según si su intensidad supera un valor de corte — el mecanismo más simple posible de separar "objeto" de "fondo", apropiado cuando hay buen contraste entre ambos. La detección de **contornos** entonces recorre esa imagen binaria y agrupa píxeles conectados en curvas cerradas — cada contorno representa la silueta de una región distinta, lista para medir (área, perímetro, dimensiones) o comparar contra una forma esperada.

```python
def detectar_defecto_por_contorno(ruta_imagen, area_minima_defecto=50):
    """
    Pipeline completo: umbralizar -> encontrar contornos -> decidir
    si algun contorno constituye un defecto por su area.
    Esta es exactamente la parte que en produccion se convierte en
    la decision binaria "rechazar/aceptar" de la seccion 4.
    """
    imagen = cv2.imread(ruta_imagen, cv2.IMREAD_GRAYSCALE)
    suavizada = cv2.GaussianBlur(imagen, (5, 5), sigmaX=0)

    # Umbralizacion adaptativa: en vez de un umbral GLOBAL fijo (que
    # se rompe si la iluminacion varia entre distintas zonas de la
    # misma imagen -- ver seccion 6.1), calcula un umbral LOCAL para
    # cada region, adaptandose a variaciones de iluminacion dentro
    # de la propia imagen.
    binaria = cv2.adaptiveThreshold(
        suavizada, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=11, C=2,
    )

    contornos, _ = cv2.findContours(binaria, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    defectos_encontrados = []
    for contorno in contornos:
        area = cv2.contourArea(contorno)
        if area > area_minima_defecto:
            x, y, ancho, alto = cv2.boundingRect(contorno)
            defectos_encontrados.append({"area": area, "bbox": (x, y, ancho, alto)})

    return {
        "tiene_defecto": len(defectos_encontrados) > 0,
        "defectos": defectos_encontrados,
    }
```

### 2.4 Por qué la visión clásica a veces es la elección correcta, no la ingenua

Aquí está la deducción que contradice la intuición moderna por defecto: para muchos problemas de control de calidad industrial —verificar que una pieza tiene la silueta correcta, medir una dimensión, detectar la ausencia de un componente esperado en una posición fija— la visión clásica es **más rápida** (una convolución y una umbralización son operaciones aritméticas simples, órdenes de magnitud más baratas computacionalmente que la inferencia de una red neuronal profunda), **más interpretable** (puedes inspeccionar exactamente por qué el sistema marcó algo como defecto — "el contorno detectado tiene un área de 340 píxeles, por encima del umbral de 50" es una explicación completamente auditable, a diferencia de "la red neuronal asignó 0.87 de probabilidad a la clase 'defecto'") y **más robusta cuando el problema es genuinamente geométrico y bien definido** (una pieza que debe tener exactamente 4 agujeros en posiciones fijas es un problema de conteo y geometría, no un problema que necesite aprender patrones visuales complejos y variables).

---

## 3. Cuándo sí necesitas deep learning — CNNs, ancladas a CS231n

### 3.1 El problema que la visión clásica no puede resolver bien

La visión clásica funciona extremadamente bien cuando puedes **especificar explícitamente** qué constituye un defecto en términos de reglas geométricas o de intensidad (un área de contorno, un umbral de intensidad, una posición esperada). Se rompe cuando el defecto que buscas tiene una **variabilidad visual compleja** que no se reduce fácilmente a una regla simple — una grieta puede tener cualquier forma, orientación, y longitud; una textura de superficie defectuosa puede diferir de la normal de formas sutiles que no corresponden a "un borde más fuerte aquí" de manera consistente. **Escribir reglas explícitas para cubrir toda esa variabilidad se vuelve, en la práctica, imposible o insosteniblemente frágil** — cada regla nueva que agregas para capturar un caso cubre ese caso específico pero no generaliza a variaciones que no anticipaste.

### 3.2 La deducción de por qué una CNN resuelve esto — aprender el patrón en vez de especificarlo

Una **red neuronal convolucional (CNN)**, el tipo de arquitectura de deep learning que domina el reconocimiento visual moderno (el terreno central de CS231n de Stanford), invierte el enfoque: en vez de que un humano especifique explícitamente qué patrón buscar (un filtro de Sobel fijo, un umbral fijo), la red **aprende automáticamente**, a partir de ejemplos etiquetados de "esto es un defecto" y "esto es normal", qué combinaciones de patrones visuales (a través de capas sucesivas de convoluciones aprendidas, no fijas de antemano como en la sección 2) predicen mejor la etiqueta correcta.

**La conexión mecánica con lo que ya construiste en la sección 2, y por qué "convolucional" no es un nombre arbitrario**: una CNN usa exactamente la misma operación matemática de convolución que ya dedujiste para el suavizado y la detección de bordes clásicos — la diferencia central es que, en visión clásica, **tú** eliges los valores del kernel (un kernel Gaussiano fijo, un kernel de Sobel fijo, diseñados matemáticamente de antemano para hacer una tarea específica); en una CNN, los valores del kernel son **parámetros aprendidos** durante el entrenamiento, ajustados automáticamente para minimizar el error de clasificación sobre los datos de entrenamiento. La primera capa de una CNN entrenada para detectar defectos frecuentemente termina aprendiendo, por su cuenta, filtros que se parecen sorprendentemente a detectores de bordes clásicos como Sobel — no porque se le haya dicho explícitamente que lo hiciera, sino porque detectar bordes resulta ser información útil para casi cualquier tarea de reconocimiento visual, y el proceso de entrenamiento lo descubre por sí mismo. Las capas más profundas de la red, apiladas sobre esas primeras, aprenden a combinar esos patrones simples en detectores de estructuras progresivamente más complejas y abstractas — exactamente el tipo de jerarquía de características que un pipeline de reglas explícitas tendría que construir manualmente, capa por capa, si intentaras replicar el mismo poder de generalización.

### 3.3 El costo de esa capacidad — por qué no usas CNN para todo

Entrenar y desplegar una CNN exige: datos etiquetados en cantidad suficiente (potencialmente cientos o miles de ejemplos de cada clase de defecto — un problema que se agrava exactamente por la misma razón que ya dedujiste en el módulo de ML: **los defectos son raros por diseño**, así que acumular suficientes ejemplos etiquetados de cada tipo de defecto real es, estructuralmente, difícil), mayor costo computacional de inferencia (una pasada hacia adelante por una red con millones de parámetros es órdenes de magnitud más cara que una convolución con un kernel de Sobel de 3×3), y menor interpretabilidad directa (explicar por qué una red profunda clasificó una imagen específica como defectuosa es un problema activo de investigación, no una operación trivial como en visión clásica). Esta es exactamente la misma tensión de "simplicidad sobre sofisticación, hasta que el problema real lo amerita" que ya reconoces del módulo de ML — la decisión correcta no es "usa siempre lo más sofisticado disponible", es **usa la herramienta cuya capacidad coincide con la complejidad real del problema**, sin pagar el costo adicional de capacidad que no necesitas.

---

## 4. Medición dimensional — calibración cámara-mundo, de píxeles a milímetros

### 4.1 El problema: una imagen no tiene unidades físicas por sí sola

Un contorno detectado en la sección 2.3 te da un área o un ancho **en píxeles** — un número sin ningún significado físico directo hasta que sepas la relación entre "un píxel" y "una unidad de longitud real" en el plano donde la pieza realmente está. Esa relación depende de la distancia entre la cámara y la pieza, del ángulo de la cámara, y de las propiedades ópticas específicas del lente — no es un valor universal ni algo que puedas asumir sin medición explícita.

### 4.2 La calibración — deducida desde la necesidad de una referencia conocida

La solución estándar: coloca en el campo de visión de la cámara un objeto de **dimensión física conocida con precisión** (un patrón de calibración, comúnmente un tablero de ajedrez impreso con cuadros de tamaño exacto conocido), toma una imagen, mide cuántos píxeles ocupa ese objeto conocido en la imagen, y de ahí derivas el factor de conversión píxeles-a-milímetros para ese setup específico de cámara/distancia/ángulo. Para el caso más simple (cámara perpendicular al plano de la pieza, sin distorsión de lente significativa), esto se reduce a una simple razón: si el cuadro del tablero mide 10mm de lado real y ocupa 40 píxeles en la imagen, el factor de conversión es 0.25mm/píxel, y cualquier medición posterior en píxeles sobre ese mismo setup se multiplica por ese factor para obtener milímetros reales.

```python
def calibrar_factor_conversion(ruta_imagen_calibracion, tamano_cuadro_mm=10.0):
    """
    Calibracion simple: detecta las esquinas de un tablero de
    ajedrez de calibracion, mide la distancia en pixeles entre
    esquinas conocidas, deriva el factor mm/pixel.
    """
    imagen = cv2.imread(ruta_imagen_calibracion, cv2.IMREAD_GRAYSCALE)
    encontrado, esquinas = cv2.findChessboardCorners(imagen, (9, 6))

    if not encontrado:
        raise ValueError("no se detecto el patron de calibracion en la imagen")

    # Distancia en pixeles entre dos esquinas horizontalmente
    # adyacentes -- corresponde a exactamente un cuadro del tablero.
    distancia_px = np.linalg.norm(esquinas[1][0] - esquinas[0][0])
    factor_mm_por_px = tamano_cuadro_mm / distancia_px

    return factor_mm_por_px


def medir_dimension_real(contorno, factor_mm_por_px):
    _, _, ancho_px, alto_px = cv2.boundingRect(contorno)
    return {"ancho_mm": ancho_px * factor_mm_por_px, "alto_mm": alto_px * factor_mm_por_px}
```

**Por qué esto no es un paso trivial que puedas hacer una vez y olvidar**: el factor de conversión es válido **únicamente** para el setup exacto (posición de cámara, distancia, ángulo, lente) que existía en el momento de la calibración. Cualquier cambio físico de ese setup invalida el factor calculado — la trampa central que desarrollamos explícitamente en la sección 6.3.

---

## 5. El pipeline completo, y la parte que codificas a mano

### 5.1 De la cámara a la acción física

El flujo completo: **cámara** (captura la imagen cruda) → **preprocesamiento** (suavizado, corrección de iluminación si aplica) → **detección/medición** (contornos clásicos o inferencia de CNN, más la conversión a unidades reales de la sección 4) → **decisión** (¿esto constituye un defecto que amerita rechazar la pieza?) → **acción física**, exactamente a través del mismo patrón de handler del Bridge que ya construiste en `fred-op-2-dispatcher`: la decisión de CV se traduce en un intent (por ejemplo, "activar el actuador de rechazo en la posición X"), que pasa por la validación de capability card de `fred-op-4-capability-cards` antes de convertirse en un comando real ejecutado por un handler específico.

### 5.2 Por qué la decisión binaria es la parte a mano — el argumento de confiabilidad

Todo lo anterior —filtros, contornos, incluso una CNN entrenada— produce, en el mejor de los casos, una **medida continua**: un área de contorno, un score de confianza de clasificación, una dimensión medida. Convertir esa medida continua en la decisión binaria **rechazar/aceptar** que efectivamente dispara una acción física exige elegir un **umbral de decisión**, y esa elección es exactamente donde vive la confiabilidad real del sistema completo — el mismo argumento, estructuralmente idéntico, que ya construiste para `contamination` en el módulo de ML y para el envelope de capability cards: **la calidad de todo el pipeline de visión, por sofisticado que sea, se colapsa en la calidad de una sola decisión de umbral**, y esa decisión tiene un costo asimétrico real que no se resuelve con matemática pura.

```python
class DecisorCalidad:
    """
    El componente 'a mano' del pipeline de CV industrial -- la
    logica de decision que convierte una medida continua (area de
    contorno, score de una CNN, dimension medida) en la accion
    binaria rechazar/aceptar, con el costo asimetrico de cada tipo
    de error tratado explicitamente, no como un umbral arbitrario.
    """

    def __init__(self, umbral_area_defecto_px, tolerancia_dimension_mm,
                 dimension_objetivo_mm, costo_falso_negativo, costo_falso_positivo):
        self.umbral_area = umbral_area_defecto_px
        self.tolerancia_mm = tolerancia_dimension_mm
        self.dimension_objetivo_mm = dimension_objetivo_mm
        # Los costos NO se usan para calcular el umbral automaticamente
        # aqui -- se documentan explicitamente como el RAZONAMIENTO
        # detras de por que este umbral especifico, no otro, fue
        # elegido -- exactamente la disciplina de "defiende tu
        # numero" de toda esta ruta operativa.
        self.costo_falso_negativo = costo_falso_negativo
        self.costo_falso_positivo = costo_falso_positivo

    def decidir(self, resultado_deteccion: dict, dimension_medida_mm: float = None) -> dict:
        razones_rechazo = []

        if resultado_deteccion["tiene_defecto"]:
            area_maxima = max(d["area"] for d in resultado_deteccion["defectos"])
            if area_maxima > self.umbral_area:
                razones_rechazo.append(f"defecto de area {area_maxima}px supera umbral {self.umbral_area}px")

        if dimension_medida_mm is not None:
            desviacion = abs(dimension_medida_mm - self.dimension_objetivo_mm)
            if desviacion > self.tolerancia_mm:
                razones_rechazo.append(
                    f"dimension {dimension_medida_mm:.2f}mm fuera de tolerancia "
                    f"(objetivo {self.dimension_objetivo_mm}±{self.tolerancia_mm}mm)"
                )

        return {
            "aceptar": len(razones_rechazo) == 0,
            "razones_rechazo": razones_rechazo,
        }
```

**Por qué esta clase está diseñada para exigir que documentes los costos, aunque no los use en un cálculo automático**: exactamente igual que `contamination` en detección de anomalías, no existe una fórmula universal que derive el umbral correcto a partir de los costos — pero forzar que el código **declare explícitamente** cuáles son esos costos relativos (aunque la elección final del umbral siga siendo una decisión humana informada por ellos, no una salida automática de una fórmula) es la disciplina que separa un umbral defendible de uno arbitrario.

---

## 6. Edge cases y trampas explícitas

### 6.1 Iluminación cambiante — la maldición de la visión industrial

Un pipeline de visión clásica calibrado con un umbral de intensidad fijo, bajo condiciones de iluminación específicas, se rompe silenciosamente en cuanto la iluminación cambia — una nube que pasa frente a una ventana cercana, una luz fluorescente que empieza a fallar, incluso la hora del día si hay luz natural involucrada, pueden desplazar la distribución de intensidades de la imagen lo suficiente como para que un umbral que funcionaba perfectamente ayer clasifique incorrectamente hoy, sin que nada en el código haya cambiado. **Esta es, con razón, la trampa más citada en la práctica real de visión industrial** — y la razón de que el código de la sección 2.3 use `adaptiveThreshold` (umbralización local, recalculada por región) en vez de un umbral global fijo: la umbralización adaptativa es, precisamente, una mitigación estructural contra variación de iluminación **dentro** de una misma imagen (por ejemplo, una pieza mal iluminada de un lado). Contra variación **entre** imágenes capturadas en momentos distintos, la mitigación de producción real generalmente exige control activo del entorno de captura —iluminación artificial controlada y consistente, encerrando la estación de inspección para excluir luz ambiental variable— más que solo software: es un problema que **el hardware del setup físico** tiene que resolver en gran medida, no solo el algoritmo.

### 6.2 Falsos positivos/negativos — el costo asimétrico, aplicado aquí

Ya construiste el marco general de este trade-off en el módulo de ML de fundamentos FrED. Aquí, aplicado específicamente a control de calidad visual: un **falso negativo** (dejar pasar una pieza que en realidad tiene un defecto) tiene el costo de que un producto defectuoso llegue al cliente final — potencialmente con consecuencias de seguridad, de reputación de marca, o de garantía, dependiendo del producto. Un **falso positivo** (rechazar una pieza que en realidad está bien) tiene el costo de desperdiciar material bueno y, si la tasa de falsos positivos es alta, ralentizar la línea de producción o generar desconfianza del equipo humano hacia el sistema — el mismo riesgo de "fatiga de alertas" ya identificado en el módulo del Reactive Observer, aquí aplicado a un sistema de inspección en vez de a un sistema de monitoreo de telemetría. **La calibración correcta del umbral de decisión (sección 5.2) depende enteramente de cuál de estos dos costos es mayor en tu contexto específico** — para una pieza de bajo costo con alto volumen, quizás toleras más falsos positivos para minimizar el riesgo de que un defecto real llegue al cliente; para una pieza costosa donde el material desperdiciado importa mucho, la calibración se inclina en la otra dirección.

### 6.3 Calibración perdida — cámara movida, medidas erróneas silenciosamente

Este es, posiblemente, el edge case más peligroso de toda la sección de medición dimensional, precisamente porque **falla sin ningún error visible**. Si la cámara se mueve físicamente (un golpe accidental, una vibración de la línea de producción que desalinea el montaje, alguien que ajusta el setup sin recalibrar), el factor de conversión mm/píxel calculado en la sección 4.2 deja de ser válido — pero el sistema **sigue produciendo números**, con la misma confianza aparente que antes, solo que ahora incorrectos. Una pieza que en realidad mide 50.0mm podría reportarse como 48.5mm o 51.5mm, dependiendo de la magnitud del desplazamiento de la cámara, sin ninguna excepción ni advertencia — el sistema no "sabe" que su calibración ya no es válida, porque nada en el pipeline verifica activamente esa validez de forma continua. **La mitigación de producción real**: recalibración periódica programada (no solo una vez al instalar el sistema), y idealmente algún mecanismo de verificación continua — por ejemplo, medir periódicamente un objeto de referencia de dimensión conocida que permanece fijo en el campo de visión, y alertar si la medida reportada de ese objeto de referencia se desvía de su valor conocido, una señal indirecta de que la calibración completa del sistema puede haberse invalidado.

### 6.4 Latencia — la decisión debe llegar antes de que la pieza pase

Un sistema de visión en una línea de producción en movimiento tiene una **ventana de tiempo estrictamente acotada** entre el momento en que la cámara captura la imagen y el momento en que la pieza llega a la estación donde una acción física (como un actuador de rechazo) necesitaría dispararse — si el procesamiento (preprocesamiento, detección, decisión, y el viaje del comando a través del Bridge hasta el handler correspondiente) tarda más que esa ventana, la decisión llega tarde para ser útil, sin importar qué tan correcta sea. Esta es exactamente la misma disciplina de latencia crítica que ya identificaste en el módulo del Reactive Observer y en el de Transport: para el caso de visión industrial de alta velocidad, esto frecuentemente empuja la decisión hacia **visión clásica** en vez de una CNN pesada (recordando el trade-off de la sección 3.3: convoluciones fijas simples son órdenes de magnitud más rápidas que la inferencia de una red profunda), o hacia ejecutar la inferencia de la CNN en hardware especializado de baja latencia en el edge (una GPU o acelerador dedicado físicamente cerca de la línea), nunca dependiendo de un viaje de red hacia un servidor remoto para la decisión crítica en tiempo real — el mismo argumento de edge computing que ya construiste completo en el módulo de fundamentos FrED, aquí aplicado específicamente a inferencia visual.

### 6.5 Por qué deep learning necesita datos de defectos que son raros — la conexión directa con anomaly detection

Ya lo estableciste como principio general en el módulo de ML de fundamentos FrED: las fallas son raras por diseño en cualquier proceso maduro, y eso significa que acumular suficientes ejemplos etiquetados de **cada tipo específico de defecto visual** para entrenar una CNN de clasificación supervisada de forma confiable es, estructuralmente, difícil por la misma razón exacta que ya dedujiste ahí. **La solución conceptual es la misma inversión de pregunta**: en vez de entrenar un clasificador que necesita ejemplos abundantes de cada clase de defecto (supervisado, requiere datos de la clase minoritaria que no tienes), puedes entrenar un modelo que aprenda qué es una imagen "normal" a partir de imágenes de piezas sin defecto —abundantes por definición— y detectar como anómalo cualquier imagen que se desvíe significativamente de ese patrón aprendido, sin necesitar haber visto ejemplos de ese tipo específico de defecto antes. Esto es, literalmente, el mismo principio de detección de anomalías no supervisada del módulo `fred-s2-ml-anomalias`, aplicado ahora al dominio de imágenes en vez de vectores de sensores numéricos — arquitecturas como los autoencoders (mencionados de pasada en ese módulo como alternativa más costosa a IsolationForest para datos de alta dimensión y estructura compleja) son exactamente el tipo de herramienta diseñada para este escenario: aprenden a reconstruir imágenes normales con alta fidelidad, y marcan como anómala cualquier imagen que reconstruyen mal, sin haber necesitado ver esa forma específica de defecto durante el entrenamiento.

---

## 7. Trade-offs explícitos

**Visión clásica vs. deep learning**: ya desarrollado en profundidad en las secciones 2.4 y 3.3 — clásica gana en velocidad, interpretabilidad, y robustez cuando el problema es geométricamente bien definido y no requiere generalizar sobre variabilidad visual compleja; deep learning gana en capacidad cuando el patrón que buscas es demasiado variable o sutil para reglas explícitas, a costa de mayor necesidad de datos, mayor costo computacional, y menor interpretabilidad directa. Muchos sistemas de producción real usan **ambos en conjunto**: visión clásica para pre-filtrar rápidamente casos obviamente normales (descartando la mayoría del flujo sin gastar el costo de una CNN), reservando la inferencia más costosa solo para los casos ambiguos que el filtro rápido no puede resolver con confianza — el mismo patrón de "capa barata primero, capa costosa solo cuando la barata no basta" que ya reconociste en el gate de verificación de twin de AutoCard (match rate barato antes de sanity probes costosas).

**Falsos positivos vs. negativos**: ya desarrollado en la sección 6.2 — la calibración del umbral de decisión depende del costo relativo real de cada tipo de error en tu línea de producción específica, no de una respuesta matemática universal.

**Edge vs. cloud para la inferencia**: ya conectado en la sección 6.4 con el argumento de latencia del módulo de fundamentos FrED — inferencia en el edge para decisiones que deben llegar dentro de la ventana de tiempo de una línea en movimiento; la nube puede seguir siendo apropiada para reentrenamiento periódico del modelo con datos acumulados, análisis histórico de tendencias de defectos, o casos donde la latencia no es crítica.

---

## Conexiones — cross-domain

*(Expansión enriquecedora, separada del núcleo canónico citado arriba.)*

**La conexión con anomaly detection — visión es otra forma de detectar lo anómalo.** Ya se desarrolló en profundidad en la sección 6.5, pero vale la pena remarcar la estructura completa del paralelo: exactamente igual que el módulo `fred-s2-ml-anomalias` invirtió la pregunta de "¿qué es una falla?" a "¿qué es normal?" por la escasez estructural de datos de falla, la visión industrial para detección de defectos enfrenta la misma inversión por la misma razón — y la misma herramienta conceptual (detección de anomalías no supervisada, ahora sobre imágenes en vez de vectores numéricos) resuelve ambos problemas con el mismo principio de fondo. Reconocer esta unidad conceptual entre dos dominios que superficialmente parecen distintos (sensores numéricos vs. imágenes) es exactamente el tipo de transferencia de conocimiento que un ingeniero de nivel senior hace naturalmente, en vez de tratar cada nuevo tipo de dato como un problema completamente nuevo desde cero.

**Cómo la decisión de CV se convierte en un comando validado por capability card — el cierre con OP-4.** La decisión binaria de la sección 5.2 (`aceptar: False, razones_rechazo: [...]`) no dispara una acción física directamente — se convierte en un intent (por ejemplo, "activar actuador de rechazo") que atraviesa exactamente el mismo flujo intent → capability card → validation → protocolo → hardware que construiste completo en `fred-op-0-bridge` y `fred-op-4-capability-cards`. Esto significa que, sin importar qué tan confiable sea tu pipeline de visión, la capability card del actuador de rechazo sigue siendo la garantía final e independiente de que el comando específico que la decisión de CV genera está dentro de límites físicos seguros — la misma defensa en profundidad, ahora con la visión como una fuente más de intents junto al LLM, no como un camino alternativo que se salta la validación.

**El ángulo de seguridad: un sistema de visión engañable.** Cualquier sistema que toma una decisión de seguridad basada en una imagen tiene una superficie de ataque específica del dominio visual: **adversarial examples**, patrones sutiles y deliberadamente diseñados (frecuentemente imperceptibles o casi imperceptibles para un humano) que pueden hacer que una CNN clasifique incorrectamente una imagen con alta confianza — un área activa de investigación en seguridad de machine learning. Para control de calidad industrial, el escenario de amenaza más realista no es necesariamente un atacante sofisticado generando adversarial examples deliberados, sino algo más mundano pero igualmente peligroso: una superficie reflectante colocada deliberada o accidentalmente en el campo de visión, una etiqueta o patrón que confunde al detector de contornos, o simplemente la explotación de la trampa de iluminación de la sección 6.1 de forma deliberada. La defensa de fondo es la misma que ya reconoces del ángulo Nahual en módulos anteriores: nunca confíes en una sola fuente de señal para una decisión de seguridad crítica sin verificación independiente — exactamente la razón de que la capability card, no la decisión de visión por sí sola, sea la garantía final antes de que cualquier comando toque hardware real.

**La cadena completa: ve → decide → comanda hardware vía Bridge.** Este módulo cierra, de forma concreta y con código real, la cadena completa que la pregunta raíz de `fred-op-0-bridge` planteó desde el primer módulo de esta ruta: un sistema puede "ver" el mundo físico (aquí, literalmente, con una cámara), procesar esa percepción hasta una decisión (la matriz de píxeles reducida, a través de todo el pipeline de este módulo, a un booleano), y esa decisión puede convertirse en una acción física real — pero **en cada paso de esa cadena, desde el primer módulo de esta ruta hasta este último, la misma disciplina se sostiene sin excepción**: ninguna fuente de decisión, sea un LLM, un modelo de anomalías, o un pipeline de visión, toca hardware directamente sin pasar por la capa de validación determinista que hace que todo el sistema, en conjunto, sea confiable.

---

## Síntesis — el mapa mental

1. Una imagen es, sin excepción, una **matriz de números** — toda la inteligencia de un sistema de visión consiste en extraer estructura semántica útil de esa matriz cruda, con dos familias de técnica radicalmente distintas para hacerlo.
2. **Visión clásica** (filtros, convolución, detección de bordes vía derivada espacial, umbralización, contornos) usa reglas y kernels **diseñados explícitamente** — rápida, interpretable, robusta cuando el problema es geométricamente bien definido.
3. **CNNs** usan exactamente la misma operación de convolución, pero con kernels **aprendidos** de datos etiquetados en vez de diseñados a mano — necesarias cuando el patrón buscado tiene variabilidad visual demasiado compleja para reglas explícitas, a costa de más datos, más cómputo, y menos interpretabilidad directa.
4. La **calibración cámara-mundo** convierte medidas en píxeles a unidades físicas reales usando un objeto de referencia de dimensión conocida — válida únicamente para el setup físico exacto en que se calculó, y silenciosamente inválida si ese setup cambia sin recalibrar.
5. El pipeline completo (cámara → preprocesamiento → detección/medición → decisión → acción vía handler del Bridge) reduce, en su último paso crítico, a una **decisión binaria con un umbral** — y esa decisión, no la sofisticación del procesamiento previo, es donde vive la confiabilidad real del sistema, exactamente el mismo patrón de `contamination` en ML y de envelopes en capability cards.
6. **Iluminación cambiante** es la trampa más citada de visión industrial real — mitigada parcialmente con umbralización adaptativa, pero exigiendo control físico del entorno de captura para variación entre capturas, no solo software.
7. **Calibración perdida** falla silenciosamente, sin ningún error visible — exige verificación continua contra un objeto de referencia conocido, no solo una calibración inicial de instalación.
8. Los **defectos raros por diseño** empujan hacia detección de anomalías no supervisada sobre imágenes normales abundantes, exactamente el mismo principio del módulo de ML de fundamentos aplicado al dominio visual — y, sin importar la sofisticación del pipeline de visión, la decisión final siempre pasa por la misma capability card que valida cualquier otra fuente de intent en el Bridge.

---

## Preguntas que deberías poder responder

*(Las primeras cuatro son, deliberadamente, del tipo defensa de diseño ante un revisor.)*

1. Explica, desde el mecanismo de convolución, por qué una CNN y un detector de bordes clásico (Sobel) están haciendo, en su núcleo computacional, la misma operación matemática — ¿qué distingue entonces a ambos enfoques, si la operación de base es la misma?
2. Da un criterio concreto (no genérico) para decidir, ante un problema real de control de calidad en FrED Factory, si usarías visión clásica o deep learning — ¿qué característica específica del defecto que buscas inclinaría la decisión hacia un lado u otro?
3. Explica por qué la calibración cámara-mundo puede volverse silenciosamente incorrecta sin que el sistema produzca ningún error visible — ¿qué mecanismo de verificación continua propondrías para detectar esta falla antes de que cause un problema real de medición?
4. ¿Por qué la decisión binaria final del pipeline de CV (rechazar/aceptar) es la parte que codificas a mano con más cuidado, y no el pipeline de detección en sí? Conecta tu respuesta con el mismo argumento ya usado para `contamination` en el módulo de ML y para los envelopes de capability cards.
5. Diseña, en palabras, cómo manejarías iluminación cambiante en una estación de inspección real de FrED — distingue qué parte de la mitigación es software y qué parte es diseño físico del entorno de captura.
6. Explica el costo asimétrico de un falso positivo vs. un falso negativo en un contexto específico de control de calidad que definas tú mismo — ¿hacia qué lado calibrarías el umbral de decisión, y por qué?
7. ¿Por qué los defectos visuales raros empujan hacia detección de anomalías no supervisada en vez de clasificación supervisada tradicional? Conecta tu respuesta directamente con la deducción del módulo `fred-s2-ml-anomalias`.
8. Describe la cadena completa desde que una cámara captura una imagen hasta que un actuador físico se mueve como resultado — nombra explícitamente en qué punto de esa cadena la capability card interviene, y por qué su intervención no depende de qué tan confiable sea el pipeline de visión que generó la decisión.

---

## Fuentes

- OpenCV, documentación oficial (filtros, detección de bordes con Canny, umbralización adaptativa, detección de contornos, calibración de cámara): https://docs.opencv.org/
- Stanford CS231n, *Convolutional Neural Networks for Visual Recognition*, materiales del curso (arquitectura de CNNs, la relación entre convolución clásica y convolución aprendida): http://cs231n.stanford.edu/
- El modelo de capability cards (`fred-op-4-capability-cards`) y la arquitectura del ORION Bridge (`fred-op-0-bridge` a `fred-op-2-dispatcher`) de esta misma serie — el destino de validación de cualquier decisión de CV antes de convertirse en acción física.
- El módulo de detección de anomalías (`fred-s2-ml-anomalias`) de esta misma serie — el principio de detección no supervisada aplicado aquí al dominio visual en la sección 6.5.
