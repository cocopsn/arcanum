// CURRICULUM SPINES (WHITE ROOM) — REAL structure extracted via Playwright/WebFetch
// from canonical sources (CS50, MIT 6.006 OCW, Berkeley CS61B, Stanford CS231n, DW
// Nico's Weg, Goethe-Institut). Generated, not hand-invented: titles + sourceUrls are
// EXTRACTED. Bodies fill on demand (tutor); the 3 demo cells carry a first-principle
// exit-gate rubric anchored to the source (CLRS for CS, etc.). Where a source was
// JS-rendered / blocked (DW chapters, ResearchGate) the course URL is anchored honestly.
// Regenerate via scratchpad/gen-spines.mjs from the extraction output.

/** A PATH declared on a spine — a parallel route with its OWN cells + fog-of-war. */
export interface SpinePath {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface SpineCell {
  id: string;
  title: string;
  /** which path this cell belongs to (slug). Absent = the spine's FIRST path (the default route). */
  pathSlug?: string;
  /** shareable concept tag → the informative cross-path "ya lo viste" note (never unseals) */
  concept?: string;
  /** structural nature — decides the gate: 'a_mano' (defend from first principles) vs 'delegable'
   *  (direct + audit an assistant) vs 'mixto' (declare `parts`). Absent = 'a_mano' (never lighten by default). */
  nature?: "a_mano" | "delegable" | "mixto";
  /** sub-parts with their own nature, for 'mixto' */
  parts?: { name: string; nature: "a_mano" | "delegable" }[];
  /** REAL extracted canonical source URLs (lecture/reading) — anchored, never invented */
  sourceUrls: string[];
  /** real lecture-video URLs (YouTube / OCW), demo cells only */
  videoUrls?: string[];
  /** the adversarial EXIT GATE: a justify-not-recognize question + first-principle rubric */
  gate?: { question: string; rubric: string[] };
  /** HEAVY MISSION cell: a directed order anchored to the real source (assignment +
   *  deliverable). The seed marks such a cell kind:'mission'; the interrogator GENERATES
   *  pointed questions against the real lecture and judges the learner's returned evidence
   *  (no pre-authored question — the source IS the anchor). */
  mission?: { assignment: string; deliverable: string };
  /** BRANCH point: this cell depends on `branchFrom` (a cell id) instead of the linear
   *  predecessor — used for side-tracks (e.g. IoT enters mid-spine as a branch, not the tail). */
  branchFrom?: string;
  /** cross-spine NON-DUPLICATION: ids of cells in OTHER spines this cell builds on (shared
   *  foundation lives once in the log; this cell references it instead of recreating it). */
  references?: string[];
  /** interrogation calibration: 'pattern' = competitive (ICPC) pattern-recognition + efficiency
   *  (the real judge is Codeforces/AtCoder); default/absent = first-principle (FrED/ITC). */
  interrogationMode?: "pattern";
  /** conceptual SEE-ALSO across spines (a genuinely SEPARATE cell of another nature, NOT a
   *  dedup) — e.g. competitive graphs relates to ITC's graphs but is reflex-under-clock, not depth. */
  related?: string[];
}

export interface Spine {
  goalId: string;
  goalTitle: string;
  color: string;
  sigil: string;
  /** the parallel PATHS of this spine. The FIRST is the default route (cells without pathSlug land
   *  there). The capability is GENERIC (not FrED-only): the switcher row shows on every world, naming
   *  the route and offering "+" to spawn a second path. */
  paths: SpinePath[];
  /** ordered cells — course order IS the DAG dependency (a linear chain PER PATH) */
  cells: SpineCell[];
}

/** The paths of a spine, by goalId → used by the seed + tests. */
export function pathsOf(sp: Spine): SpinePath[] {
  return sp.paths;
}
/** Resolve a cell's path id: its declared pathSlug, else the spine's first (default) path. */
export function pathIdForCell(sp: Spine, cell: SpineCell): string {
  const slug = cell.pathSlug;
  const found = slug ? sp.paths.find((p) => p.slug === slug) : undefined;
  return (found ?? sp.paths[0]!).id;
}

export const SPINES: Spine[] = [
  {
    "goalId": "a0000000-0000-4000-8000-000000000001",
    "goalTitle": "ITC",
    "color": "#25B0C9",
    "sigil": "itc",
    "paths": [
      { "id": "a1000000-0000-4000-8000-000000000001", "slug": "principal", "name": "Ruta principal", "description": "La secuencia curada de ITC (TC1031): estructuras de datos y algoritmos desde primer principio." }
    ],
    "cells": [
      {
        "id": "ca000000-0000-4000-8000-000000000001",
        "title": "ITC-0 · CS50 — rampa mínima (pensamiento computacional, C, memoria) · nodo cero",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/",
          "https://cs50.harvard.edu/x/weeks/1/",
          "https://cs50.harvard.edu/x/weeks/4/",
          "https://cs50.harvard.edu/x/weeks/5/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000002",
        "title": "C1 · Análisis asintótico y correctitud — Big-O, invariantes de lazo, demostrar cotas · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec1/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec2/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 Lecture 1-2 (modelo de cómputo, notación asintótica) y el aparato de CLRS cap. 2-3 (la vara del rigor). El objetivo NO es 'qué es Big-O' sino el ARGUMENTO: invariante de lazo (inicialización/mantenimiento/terminación) y demostrar una cota superior/inferior formalmente, no 'es más rápido'.",
          "deliverable": "Elige un algoritmo simple (insertion sort o búsqueda binaria) y entrega: (1) su invariante de lazo y la prueba de correctitud por inducción, (2) la demostración formal de su cota Θ (no solo el resultado: el argumento de por qué). Apóyate en CLRS para el formalismo."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000003",
        "title": "C2 · Estructuras lineales — arrays dinámicos, listas, pilas, colas, deques; amortización · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec2/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/3.-references-recursion-and-lists",
          "https://cs61b-2.gitbook.io/cs61b-textbook/4.-sllists"
        ],
        "mission": {
          "assignment": "Trabaja CS61B (listas, ADTs) + 6.006 L2 (arrays dinámicos). Construye desde cero, no uses la librería: una lista enlazada y un array dinámico (con duplicado de capacidad). Entiende la AMORTIZACIÓN: por qué el append es O(1) amortizado aunque el resize sea O(n).",
          "deliverable": "Implementa un array dinámico desde cero y entrega: el código + la prueba del análisis amortizado (argumento del agregado o del potencial) de por qué N appends cuestan O(N) total. Cubre los edge cases: vacío, un elemento, el resize exacto en la frontera de capacidad."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000004",
        "title": "C3 · Hashing — tablas hash, colisiones, costo amortizado, cuándo degrada · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec4/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/19.-hashing-i",
          "https://cs61b-2.gitbook.io/cs61b-textbook/20.-hashing-ii"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L4 (hashing, encadenamiento, el modelo de árbol de decisión) + CS61B Hashing I/II + CLRS cap. 11. Implementa una tabla hash con encadenamiento desde cero. Entiende POR QUÉ es O(1) esperado bajo hashing uniforme simple (SUHA) y EXACTAMENTE cuándo degenera a O(n).",
          "deliverable": "Tu tabla hash con encadenamiento + la justificación: por qué el costo esperado de búsqueda es O(1+α) (factor de carga), el argumento del valor esperado, y un caso concreto donde degenera a O(n) (todas las llaves colisionan / función hash adversarial). Edge cases: tabla vacía, colisión, rehash."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000005",
        "title": "C4 · Árboles de búsqueda balanceados — BST, AVL, rotaciones; derivar O(log n) · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec6/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec7/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/16.-adts-and-bsts",
          "https://cs61b-2.gitbook.io/cs61b-textbook/17.-b-trees",
          "https://cs61b-2.gitbook.io/cs61b-textbook/18.-red-black-trees"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L6-L7 (BST, invariante; AVL, rotaciones) + CS61B (B-trees, red-black) + CLRS como vara. El corazón: DERIVAR que la altura de un AVL es O(log n) desde la recurrencia del número MÍNIMO de nodos N(h)=1+N(h-1)+N(h-2) (crecimiento tipo Fibonacci), no asumirlo. Entiende cuándo basta una rotación simple y cuándo se necesita doble (left-right).",
          "deliverable": "Entrega la DERIVACIÓN de primer principio de la altura O(log n) del AVL: plantea N(h)=1+N(h-1)+N(h-2), muestra la cota inferior tipo Fibonacci y concluye h=O(log n). Además: por qué una rotación simple restaura la invariante en el caso left-left pero FALLA en left-right (requiere doble), y por qué una rotación preserva el orden in-order del BST. Prepárate para defenderlo contra una entrada degenerada (10M inserciones ordenadas)."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000006",
        "title": "C5 · Heaps y colas de prioridad — heapify, heapsort, costo · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec8/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/21.-heaps-and-priority-queues"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L8 (heaps binarios, heapify, heapsort) + CS61B Heaps. Implementa un heap binario desde cero (sift-up/sift-down). El argumento clave: por qué build-heap es O(n) y NO O(n log n).",
          "deliverable": "Tu heap binario + la demostración de por qué construir el heap desde abajo es O(n): la suma Σ h·(n/2^h) converge a O(n) (argumento de la suma de alturas), contrastado con insertar n veces que sí es O(n log n). Edge cases: heap vacío, un elemento, extracción del último."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000007",
        "title": "C6 · Grafos I — representación, BFS/DFS, conectividad, orden topológico · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec9/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec10/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/22.-tree-traversals-and-graphs",
          "https://cs61b-2.gitbook.io/cs61b-textbook/23.-graph-traversals-and-implementations"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L9-L10 (BFS, DFS) + CS61B Graph Traversals. Implementa BFS y DFS desde cero sobre lista de adyacencia. Entiende por qué ambos son O(V+E) y cómo DFS da el orden topológico de un DAG.",
          "deliverable": "Tu BFS y DFS + el argumento de O(V+E) (cada vértice y arista se visita O(1) veces). Produce un orden topológico de un DAG vía DFS y JUSTIFICA su correctitud (por qué el orden inverso de finalización funciona). Edge cases: grafo vacío, desconectado, con ciclo (detección)."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000008",
        "title": "C7 · Grafos II — caminos mínimos (Dijkstra, Bellman-Ford), MST · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec11/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec12/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec13/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/24.-shortest-paths",
          "https://cs61b-2.gitbook.io/cs61b-textbook/25.-minimum-spanning-trees"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L11-L13 (caminos mínimos: Bellman-Ford, Dijkstra) + CS61B (shortest paths, MST) + CLRS cap. 22-24. El corazón: POR QUÉ Dijkstra (greedy) falla con aristas negativas y cuándo se necesita Bellman-Ford; la propiedad del corte que justifica el MST greedy.",
          "deliverable": "Entrega: (1) un contraejemplo concreto donde Dijkstra da un camino mínimo INCORRECTO con una arista negativa, y por qué su invariante greedy se rompe; (2) el argumento de la propiedad del corte (cut property) que prueba la correctitud de Prim/Kruskal para el MST."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000009",
        "title": "C8 · Programación dinámica — subestructura óptima, memoización vs tabulación · MISIÓN",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec15/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/mit6_006s20_lec16/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/"
        ],
        "mission": {
          "assignment": "Trabaja 6.006 L15-L18 (DP: subproblemas, SRTBOT, memoización vs tabulación). Resuelve desde cero un problema DP (LCS, LIS o edit distance): identifica los SUBPROBLEMAS y la relación de recurrencia antes de codificar.",
          "deliverable": "Tu solución DP + la justificación: cuál es el subproblema y por qué tiene subestructura óptima, la recurrencia, y el trade-off memoización (top-down) vs tabulación (bottom-up) en tiempo/espacio. Nombra el caveat pseudopolinomial si aplica (p. ej. knapsack)."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000010",
        "title": "IoT · TC1004B — implementación end-to-end (sensor→ESP32→MQTT→dashboard) · rama, se apoya en FrED",
        "sourceUrls": [
          "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/protocols/mqtt.html"
        ],
        "branchFrom": "ca000000-0000-4000-8000-000000000005",
        "references": [
          "cb000000-0000-4000-8000-000000000001",
          "cb000000-0000-4000-8000-000000000003",
          "cb000000-0000-4000-8000-000000000005"
        ],
        "mission": {
          "assignment": "TC1004B (Implementación de IoT). El FUNDAMENTO de datos — MQTT, sensores, pipelines — YA lo trabajas en FrED (S1 datos industriales, S3 pipelines, H1 embebidos): NO lo repetimos, esas celdas viven una sola vez (ver 'se apoya en'). Aquí construyes lo PROPIO de TC1004B: implementar el camino completo en hardware real, un sensor publicando por MQTT desde un ESP32 hasta un dashboard, con el cliente MQTT de ESP-IDF.",
          "deliverable": "Un ESP32 leyendo un sensor real y publicando por MQTT (cliente esp-mqtt), + cómo ese flujo se conecta al pipeline que ya montaste en FrED S3. Entrega el código del publisher + el tópico/payload y qué harías para que el dashboard de FrED lo consuma. (Si no tienes hardware, simúlalo y dilo honestamente.)"
        }
      }
    ]
  },
  {
    "goalId": "a0000000-0000-4000-8000-000000000002",
    "goalTitle": "FrED Factory",
    "color": "#1F9E84",
    "sigil": "fred",
    "paths": [
      { "id": "a1000000-0000-4000-8000-000000000002", "slug": "fundamentos", "name": "Fundamentos", "description": "Conocimiento de dominio TRANSFERIBLE: datos industriales, ML de anomalías, pipelines, embebidos, PID, proceso FrED. Lo que sirve en cualquier planta, no solo aquí." },
      { "id": "a1000000-0000-4000-8000-000000000003", "slug": "operativo", "name": "Operativo", "description": "La ruta operativa (Orión / AutoCard). Vacía por diseño: sus celdas entran por ingesta de libros ancladas a este path — nada inventado aquí." }
    ],
    "cells": [
      {
        "id": "cb000000-0000-4000-8000-000000000001",
        "title": "S1 · Datos industriales — del sensor a la decisión (OPC-UA / MQTT / Modbus, PLC) · MISIÓN",
        "sourceUrls": [
          "https://mqtt.org/",
          "https://opcfoundation.org/about/opc-technologies/opc-ua/",
          "https://www.modbus.org/",
          "https://nodered.org/docs/",
          "https://web.mit.edu/2.810/www/"
        ],
        "mission": {
          "assignment": "Aún no programes: entiende la ARQUITECTURA del dato industrial de punta a punta (sensor → PLC → broker → consumidor → decisión). Estudia MQTT (mqtt.org), OPC-UA (opcfoundation.org) y Modbus (modbus.org), qué es un PLC y cómo se comunica, y el patrón productor/broker/consumidor (Node-RED docs). Vives en el FrED real: piensa termopar de extrusión → protocolo → pipeline.",
          "deliverable": "Un diagrama propio del flujo completo del dato (en notas), + una defensa razonada: ¿cuándo MQTT, cuándo OPC-UA, cuándo Modbus, y por qué? (latencia, modelo de datos, pub/sub vs request/response, determinismo). No 'MQTT es mejor': el trade-off por contexto."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000002",
        "title": "S2 · ML en procesos físicos — pipeline de detección de anomalías (ENTREGABLE real) · MISIÓN",
        "sourceUrls": [
          "https://scikit-learn.org/stable/modules/outlier_detection.html",
          "https://www.kaggle.com/datasets/stephanmatzka/predictive-maintenance-dataset-ai4i-2020",
          "https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset",
          "https://docs.opencv.org/4.x/"
        ],
        "mission": {
          "assignment": "Toma un dataset REAL de sensores industriales (AI4I 2020 Predictive Maintenance en Kaggle/UCI, o uno equivalente de 'manufacturing sensor data') y CORRE en Python un pipeline de detección de anomalías en series de tiempo que FUNCIONE — no sofisticado, funcional (IsolationForest / LocalOutlierFactor de scikit-learn, o un umbral sobre residuales). Roza visión: revisa OpenCV para defectos/medición dimensional como segundo caso.",
          "deliverable": "Describe tu pipeline que corre: qué dataset, qué método elegiste y POR QUÉ, qué anomalías detecta y — clave — QUÉ se le escapa (falsos negativos, drift, estacionalidad). Pega el fragmento de Python y un resultado concreto (cuántas anomalías marcó, una que sea real vs una falsa)."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000003",
        "title": "S3 · Pipelines de datos industriales — stack MQTT→InfluxDB→Grafana (ENTREGABLE real) · MISIÓN",
        "sourceUrls": [
          "https://mosquitto.org/",
          "https://docs.influxdata.com/influxdb/",
          "https://grafana.com/docs/grafana/latest/",
          "https://docs.docker.com/get-started/"
        ],
        "mission": {
          "assignment": "Monta LOCALMENTE el stack mínimo que existe de verdad en el FrED: un script que genera datos simulados de sensores → publica por MQTT (Mosquitto) → los persiste en InfluxDB/TimescaleDB (serie de tiempo) → los grafica en Grafana. Usa Docker para los servicios. Entiende el edge computing: por qué procesar cerca del sensor.",
          "deliverable": "Describe tu stack corriendo (qué contenedores, cómo fluye el dato) + defiende la arquitectura: ¿por qué una base de series de tiempo y no SQL normal?, ¿qué hace el broker?, ¿qué procesarías en el edge y qué en la nube? Pega el docker-compose o el script generador."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000004",
        "title": "S4 · IA en el FrED + papers del Dr. Ramírez Cedillo (vocabulario del equipo) · MISIÓN",
        "sourceUrls": [
          "https://scholar.google.com/citations?user=dVVYljgAAAAJ",
          "https://fredfactory.mit.edu/research",
          "https://www.researchgate.net/profile/Erick-Ramirez-Cedillo",
          "https://www.researchgate.net/publication/334556755_Structural_design_optimization_of_knee_replacement_implants_for_Additive_Manufacturing"
        ],
        "mission": {
          "assignment": "Visión computacional para control de calidad en extrusión, SCADA, y DfMA desde el software. LO MÁS IMPORTANTE: lee ≥2 papers del Dr. Erick Ramírez Cedillo (ResearchGate / Google Scholar — fuente real; si pide login, ábrelos desde Scholar o el repositorio Tec). Esto te da el vocabulario EXACTO del equipo para el día 1 en el lab.",
          "deliverable": "Explica el MÉTODO de UNO de los papers del Dr. Ramírez (no lo resumas): qué problema ataca, qué técnica usa, por qué funciona y dónde tiene límites. Cita el paper. Anclar el dominio es tu ventaja diferenciadora."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000005",
        "title": "H1 · Electrónica y embebidos básicos (entender, no competir) · MISIÓN",
        "sourceUrls": [
          "https://docs.arduino.cc/",
          "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/",
          "https://www.tinkercad.com/circuits"
        ],
        "mission": {
          "assignment": "Microcontrolador vs microprocesador; Arduino / ESP32 / Raspberry Pi y cuándo cada uno; sensores de manufactura (termopar/PT100, presión, encoder, posición); PWM para control de motores; leer un esquemático. Foco: entender lo suficiente para hablar con un mecatrónico, no para competir.",
          "deliverable": "Lee un sensor y manda el dato por serial — Arduino/ESP32 real o Tinkercad Circuits simulado. Describe qué sensor, cómo lo conectaste, y qué viste en el monitor serial. Explica qué hace el PWM si controlaras un motor."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000006",
        "title": "H2 · Control y automatización — lazo cerrado, PID, SCADA (anclado al FrED) · MISIÓN",
        "sourceUrls": [
          "https://en.wikipedia.org/wiki/PID_controller",
          "https://www.tinkercad.com/circuits"
        ],
        "mission": {
          "assignment": "Lazo cerrado, PID (qué hace cada término P/I/D y POR QUÉ, no la matemática profunda), actuadores, robótica industrial (tipos, coordenadas, end-effectors), SCADA a nivel hardware. Ancla al FrED real: motores paso a paso, sensores de temperatura para la extrusión, encoders, bobinado.",
          "deliverable": "Explica desde el primer principio cómo un PID mantiene la temperatura de extrusión del FrED en un setpoint: qué mide, qué corrige cada término, qué pasa si la ganancia es muy alta (oscila) o muy baja (lento). No la fórmula — el porqué del lazo."
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000007",
        "title": "H3 · Manufactura y el proceso FrED — extrusión, aditiva, métricas de línea · MISIÓN",
        "sourceUrls": [
          "https://fredfactory.mit.edu/",
          "https://news.mit.edu/2025/tabletop-factory-box-makes-hands-on-manufacturing-education-more-accessible-0403",
          "https://meche.mit.edu/news-media/tabletop-factory-box-makes-hands-manufacturing-education-more-accessible"
        ],
        "mission": {
          "assignment": "La extrusión como proceso industrial; manufactura aditiva (FDM/SLA/SLS conceptual); Design for Manufacturing; el FrED Factory de MIT (lee el artículo de MIT News de abril 2025 + fredfactory.mit.edu); métricas de línea (takt time, OEE, throughput).",
          "deliverable": "Explica el proceso del FrED (qué hace, de fibra a producto) y define UNA métrica de línea (takt time u OEE) con un ejemplo numérico de cómo la calcularías en esa línea. ¿Qué cuello de botella buscarías primero?"
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000008",
        "title": "H4 · Integración SW↔HW — sistemas ciberfísicos, gemelo digital, seguridad IoT (síntesis) · MISIÓN",
        "sourceUrls": [
          "https://en.wikipedia.org/wiki/Cyber-physical_system",
          "https://mqtt.org/",
          "https://opcfoundation.org/about/opc-technologies/opc-ua/"
        ],
        "mission": {
          "assignment": "Síntesis: sistemas ciberfísicos (CPS), gemelo digital básico, MQTT vs OPC-UA vs Modbus EN CONTEXTO, y seguridad en IoT industrial — aquí tu background de NAHUAL es un ángulo diferenciador que pocos en el lab tienen.",
          "deliverable": "Traza el dato naciendo en un sensor del FrED → protocolo → pipeline → modelo ML → acción de control/alerta en dashboard, nombrando la tecnología en cada salto. Luego: nombra UN vector de ataque realista en ese flujo IoT industrial y cómo lo mitigarías (tu ángulo de seguridad)."
        }
      }
    ]
  },
  {
    "goalId": "a0000000-0000-4000-8000-000000000003",
    "goalTitle": "Alemán",
    "color": "#C0455F",
    "sigil": "aleman",
    "paths": [
      { "id": "a1000000-0000-4000-8000-000000000004", "slug": "principal", "name": "Ruta principal", "description": "La lengua que ordena el pensamiento: DW Nico's Weg + Goethe, A1 → B1." }
    ],
    "cells": [
      {
        "id": "cc000000-0000-4000-8000-000000000001",
        "title": "A1.1 — Hallo! Begrüßung, Alphabet & sein (greetings, the verb sein, W-/yes-no questions)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789",
          "https://en.wikipedia.org/wiki/German_grammar",
          "https://en.wikipedia.org/wiki/German_verbs"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000002",
        "title": "A1.2 — Artikel & V2-Wortstellung: der/die/das + Verb in Position 2",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789"
        ],
        "videoUrls": [
          "https://www.youtube.com/playlist?list=PLs7zUO7VPyJ5DV1iBRgSw2uDl832n0bLg"
        ],
        "gate": {
          "question": "Write three German sentences about your morning that ALL start with a word other than the subject (e.g. 'Heute…', 'Am Morgen…', 'Manchmal…'). For each sentence, state in one line WHY the finite verb lands where it does and WHY each noun's article has the gender and case it does — i.e. justify the V2 rule and the nominative-vs-accusative choice from the grammar, do not just translate. A correct answer that cannot explain why 'trinke' precedes 'ich' after a fronted adverb does not pass.",
          "rubric": [
            "GENDER + ARTICLE: each noun carries the correct grammatical gender — der (masc.) / die (fem.) / das (neut.) for definite, ein/eine for indefinite — not guessed from English or Spanish cognates (e.g. 'das Mädchen' neuter, 'die Sonne' fem.).",
            "V2 VERB POSITION: in a main declarative clause the finite verb stands in exactly the SECOND position regardless of what occupies first position — 'Heute trinke ich Kaffee', NOT 'Heute ich trinke Kaffee'. Fronting an adverb/object forces subject inversion.",
            "QUESTION WORD ORDER: W-questions put the question word first + verb second ('Was kostet das?'); yes/no questions front the finite verb ('Trinkst du Kaffee?'). Learner must produce both, not just statements.",
            "SEIN / VERB CONJUGATION: the verb agrees with its subject in person and number — ich bin / du bist / er ist; regular verbs ich trinke / du trinkst / er trinkt. No bare infinitives as finite verbs.",
            "CASE ON THE ARTICLE: nominative for the subject vs. accusative for the direct object is reflected in the article — masculine der→den ('Der Mann' subject vs. 'Ich sehe den Mann' object); fem./neut./plural articles unchanged in accusative. Learner shows they distinguish subject from object, not just memorized phrases.",
            "NEGATION: 'kein/keine' negates a noun (with correct gender/case), 'nicht' negates a verb/adjective — 'Ich habe kein Auto', NOT 'Ich habe nicht ein Auto'."
          ]
        }
      },
      {
        "id": "cc000000-0000-4000-8000-000000000003",
        "title": "A1.3 — Familie & Possessivartikel (mein/dein), Negation kein/nicht",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789",
          "https://en.wikipedia.org/wiki/German_articles",
          "https://en.wikipedia.org/wiki/German_declension"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000004",
        "title": "A1.4 — Lebensmittel & Akkusativ: bestimmter/unbestimmter Artikel im Akkusativ, Plural",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789",
          "https://en.wikipedia.org/wiki/Accusative_case",
          "https://en.wikipedia.org/wiki/German_articles"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000005",
        "title": "A1.5 — Im Büro & Alltag: regelmäßige Verben, Zahlen/Uhrzeit, Modalverben (können/müssen)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789",
          "https://en.wikipedia.org/wiki/German_conjugation",
          "https://en.wikipedia.org/wiki/German_verbs"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000006",
        "title": "A2.1 — Perfekt (Vergangenheit) & trennbare Verben: über Erlebnisse berichten",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690",
          "https://en.wikipedia.org/wiki/Perfect_(grammar)",
          "https://en.wikipedia.org/wiki/German_verbs"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000007",
        "title": "A2.2 — Dativ: Präpositionen, indirektes Objekt, Wechselpräpositionen (Akk./Dat.)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690",
          "https://en.wikipedia.org/wiki/Dative_case",
          "https://en.wikipedia.org/wiki/Grammatical_case"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000008",
        "title": "A2.3 — Konnektoren & einfacher zusammenhängender Text: weil/dass, Komparativ/Superlativ",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690",
          "https://en.wikipedia.org/wiki/German_sentence_structure",
          "https://en.wikipedia.org/wiki/German_grammar"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000009",
        "title": "B1.1 — Nebensätze & Meinung äußern: wenn/obwohl, Argumentation, Genitiv",
        "sourceUrls": [
          "https://learngerman.dw.com/en/advanced/c-39756769",
          "https://en.wikipedia.org/wiki/German_sentence_structure",
          "https://en.wikipedia.org/wiki/German_grammar"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000010",
        "title": "B1.2 — Konjunktiv II & Passiv: höfliche Bitten, Hypothesen, formelle Register",
        "sourceUrls": [
          "https://learngerman.dw.com/en/advanced/c-39756769",
          "https://en.wikipedia.org/wiki/Subjunctive_mood",
          "https://en.wikipedia.org/wiki/German_verbs"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000011",
        "title": "B2.1 — Komplexe Argumentation: Relativsätze, Nominalstil, abstrakte Themen (Goethe B2 gate)",
        "sourceUrls": [
          "https://www.goethe.de/en/spr/kup/prf/prf/gb2.html",
          "https://en.wikipedia.org/wiki/German_sentence_structure",
          "https://en.wikipedia.org/wiki/German_declension"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000012",
        "title": "B2.2 — Fließende Interaktion & Standpunkt: detaillierter Text, Pro/Contra, Konnektoren-Vielfalt",
        "sourceUrls": [
          "https://www.goethe.de/en/spr/kup/prf/prf/gb2.html",
          "https://en.wikipedia.org/wiki/German_grammar",
          "https://en.wikipedia.org/wiki/German_sentence_structure"
        ]
      }
    ]
  },
  {
    "goalId": "a0000000-0000-4000-8000-000000000004",
    "goalTitle": "Competitiva (ICPC)",
    "color": "#C9952F",
    "sigil": "icpc",
    "paths": [
      { "id": "a1000000-0000-4000-8000-000000000005", "slug": "principal", "name": "Ruta principal", "description": "Reconocimiento de patrones bajo el reloj (ICPC): el juez real es Codeforces/AtCoder." }
    ],
    "cells": [
      {
        "id": "cd000000-0000-4000-8000-000000000001",
        "title": "CP1 · Two pointers / sliding window — el patrón de la ventana · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/silver/two-pointers",
          "https://cses.fi/problemset/",
          "https://cses.fi/book/book.pdf"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón: two pointers / sliding window. Lee la sección de USACO Guide, reconoce LA SEÑAL (subarreglo/par con una condición monótona) y resuelve 2-3 problemas representativos de la sección. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: el patrón y QUÉ señal del enunciado lo delató, tu veredicto real + tiempo, y por qué tu solución es O(n) y no O(n²) (por qué los punteros no retroceden). El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000002",
        "title": "CP2 · Binary search (incl. binary search on answer) — buscar en el espacio de respuestas · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/silver/binary-search",
          "https://codeforces.com/problemset?tags=binary+search",
          "https://cses.fi/book/book.pdf"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón: binary search — sobre arreglo ordenado Y 'binary search on answer' (buscar el mínimo/máximo factible cuando feasible(x) es monótona). Resuelve un problema de cada tipo en la plataforma. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: por qué el problema ERA binary-search-on-answer (qué predicado monótono feasible(x) lo permite) y no two pointers/greedy, tu veredicto + tiempo, y la complejidad O(n log(rango)) con el porqué del log. El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000003",
        "title": "CP3 · Prefix sums / difference arrays — precomputar para responder en O(1) · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/silver/prefix-sums",
          "https://usaco.guide/silver/more-prefix-sums",
          "https://cses.fi/problemset/"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón: prefix sums y difference arrays (consultas de rango O(1) tras O(n) de precómputo; updates de rango con diferencias). Resuelve 2 problemas de la sección. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: qué señal pedía precómputo (muchas consultas de suma de rango), tu veredicto + tiempo, y por qué el difference array convierte un update de rango O(n) en O(1). El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000004",
        "title": "CP4 · Sorting + greedy — ordenar y tomar la decisión local correcta · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/bronze/intro-sorting",
          "https://usaco.guide/silver/sorting-custom",
          "https://usaco.guide/bronze/intro-greedy",
          "https://usaco.guide/silver/greedy-sorting"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón: ordenar (comparador custom) + greedy (exchange argument). Resuelve un problema greedy donde el orden correcto es la clave. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: por qué el greedy es ÓPTIMO aquí (el argumento de intercambio / por qué la elección local no se arrepiente), tu veredicto + tiempo, y un caso donde un greedy ingenuo FALLARÍA. El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000005",
        "title": "CP5 · DSU (union-find) — componentes y conectividad casi-O(1) · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/gold/dsu",
          "https://cses.fi/problemset/",
          "https://cses.fi/book/book.pdf"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón: DSU / union-find (con path compression + union by rank/size). Resuelve un problema de conectividad/componentes. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: qué señal del enunciado gritaba DSU (uniones + consultas '¿están conectados?'), tu veredicto + tiempo, y por qué con las dos optimizaciones el costo amortizado es casi constante (α inversa de Ackermann). El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000006",
        "title": "CP6 · Grafos competitivos — BFS/DFS/shortest-path APLICADOS bajo reloj · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/silver/graph-traversal",
          "https://usaco.guide/silver/dfs",
          "https://cses.fi/problemset/"
        ],
        "interrogationMode": "pattern",
        "related": [
          "ca000000-0000-4000-8000-000000000007"
        ],
        "mission": {
          "assignment": "Patrón: modelar el problema COMO un grafo y aplicar BFS/DFS/shortest-path. (Relacionado con ITC C6, pero OTRA naturaleza: aquí es reconocer-y-aplicar bajo reloj, no derivar la teoría.) Resuelve un problema donde lo difícil es VER el grafo. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: cómo modelaste el problema como grafo (qué son los nodos/aristas), por qué BFS vs DFS vs Dijkstra, tu veredicto + tiempo, y la complejidad O(V+E) o O(E log V). El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000007",
        "title": "CP7 · DP competitivo — reconocer el estado y la transición clásicos · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/gold/intro-dp",
          "https://cses.fi/book/book.pdf",
          "https://cses.fi/problemset/"
        ],
        "interrogationMode": "pattern",
        "related": [
          "ca000000-0000-4000-8000-000000000009"
        ],
        "mission": {
          "assignment": "Patrón: DP competitiva (knapsack, LIS, DP en grids, bitmask). (Relacionado con ITC C8, pero OTRA naturaleza: reconocer el PATRÓN de estado/transición rápido, no derivar la teoría.) Resuelve un problema DP clásico. El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: cuál era el ESTADO y la TRANSICIÓN (la recurrencia), qué señal del enunciado lo delató como DP, tu veredicto + tiempo, y la complejidad (estados × transición). El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      },
      {
        "id": "cd000000-0000-4000-8000-000000000008",
        "title": "CP8 · Segment tree / sweep line — la cima (estructuras de rango) · MISIÓN (reloj)",
        "sourceUrls": [
          "https://usaco.guide/gold/PURS",
          "https://usaco.guide/plat/sweep-line",
          "https://cses.fi/book/book.pdf"
        ],
        "interrogationMode": "pattern",
        "mission": {
          "assignment": "Patrón cima: segment tree (point update / range query) y sweep line. Resuelve un problema que necesite consultas/updates de rango en O(log n). El juez REAL es la plataforma (Codeforces/AtCoder/CSES), NO Arcanum: resuélvelo ALLÁ y trae tu VEREDICTO real (accepted/TLE/WA) + tu solución + el tiempo que tardaste.",
          "deliverable": "Trae: por qué un prefix sum NO bastaba (updates + queries intercalados), tu veredicto + tiempo, y por qué el segment tree da O(log n) por operación. El interrogatorio NO pide primer principio: prueba si RECONOCISTE el patrón y entiendes la EFICIENCIA (un accepted copiado sin explicar el patrón NO pasa)."
        }
      }
    ]
  }
];

const CELL_BY_ID = new Map<string, SpineCell>(SPINES.flatMap((s) => s.cells.map((c) => [c.id, c] as const)));
export function cellById(id: string): SpineCell | null {
  return CELL_BY_ID.get(id) ?? null;
}

// The ALLOWLIST for the server-side source fetcher — only the curated, verified spine URLs may be
// fetched (never an arbitrary client-supplied URL → no SSRF). Exact-match against every source/video.
const SOURCE_ALLOWLIST = new Set<string>(
  SPINES.flatMap((s) => s.cells.flatMap((c) => [...(c.sourceUrls ?? []), ...(c.videoUrls ?? [])])),
);
export function isAllowedSource(url: string): boolean {
  return SOURCE_ALLOWLIST.has(url);
}

// The set of allowed HOSTS (derived from the same curated URLs). The entry URL must be an exact
// allowlist match; redirect HOPS are validated against this host set so a redirect can't escape the
// closed set of trusted domains (no IP hosts are present → private/internal targets are refused too).
const SOURCE_HOSTS = new Set<string>(
  [...SOURCE_ALLOWLIST].map((u) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  }).filter(Boolean),
);
export function isAllowedSourceHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && SOURCE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}
