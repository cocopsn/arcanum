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
   *  (the real judge is Codeforces/AtCoder); 'exam' = FAANG-interview bar (OA Amazon): pattern
   *  recognition + clean execution with edge cases + first-principle defence — ALL three or no pass,
   *  with the failure mode named; default/absent = first-principle (FrED/ITC). */
  interrogationMode?: "pattern" | "exam";
  /** who the REAL judge of this cell is (the arena HUD line). Absent on a 'pattern' cell → the
   *  Codeforces/AtCoder default (Competitiva). Lets another timed spine (e.g. an exam OA) name its
   *  own judge honestly instead of inheriting a foreign one. */
  judge?: { label: string; sub?: string };
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
  },
  {
    // OA AMAZON — the assault path for the Amazon SDE Intern 2026 Online Assessment. A sibling world
    // of ITC (the user's call: "path completo nuevo adyacente a ITC"), with its OWN judge: the clock
    // of the real OA. Structure mirrors the REAL exam: a main pattern ladder (coding challenge) plus
    // three branches — SQL and repo-debug hang off OA-1, Work Simulation off OA-0 — because the exam's
    // three sections are parallel fronts, not a single chain. Missions are anchored to the user's own
    // Plan de Asalto + Cuaderno (+40% calibration) and to curl-verified 200 canonical sources.
    // NOTE for the seed-freeze test: every cell id lives under the `ce000000-` prefix.
    "goalId": "a0000000-0000-4000-8000-000000000005",
    "goalTitle": "OA Amazon",
    "color": "#ff9900",
    "sigil": "oa",
    "paths": [
      { "id": "a1000000-0000-4000-8000-000000000006", "slug": "asalto", "name": "Plan de asalto", "description": "Preparación dirigida del OA de Amazon SDE Intern 2026: reconocimiento de patrón + ejecución limpia bajo reloj, repo-debug con IA, y Work Simulation contra los 16 Leadership Principles." }
    ],
    "cells": [
      {
        "id": "ce000000-0000-4000-8000-000000000001",
        "title": "OA-0 · Fundamentos — leer las restricciones, inferir el algoritmo, Big-O operativo · MISIÓN",
        "concept": "restricciones",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + la tabla de oro de memoria" },
        "related": ["ca000000-0000-4000-8000-000000000002"],
        "sourceUrls": [
          "https://wiki.python.org/moin/TimeComplexity",
          "https://usaco.guide/bronze/time-comp",
          "https://docs.python.org/3/tutorial/datastructures.html",
          "https://www.amazon.jobs/content/en/how-we-hire/assessments"
        ],
        "mission": {
          "assignment": "El fundamento operativo del OA: las restricciones del enunciado te DICEN qué algoritmo espera el examinador (~10^8 operaciones/segundo: n≤20 → exponencial ok; n≤3,000 → O(n²); n≤10^5 → O(n log n) u O(n); sumas grandes → enteros de 64 bits). Lee el libro de la celda, corre el DEMO OFICIAL de la plataforma que Amazon te mandó por correo (en Node/MERN — es la única forma de no perder minutos entendiendo la interfaz el día real), y fija por escrito los dos lenguajes: Problema 1 en Python 3, Problema 2 en Node/MERN. Resuelve el banco de la celda cronometrado.",
          "deliverable": "Trae: (1) tu tabla restricciones→algoritmo DE MEMORIA con el porqué (de dónde sale el presupuesto de ~10^8 operaciones), (2) constancia de que corriste el demo oficial y qué aprendiste de la interfaz/panel de IA, (3) los dos lenguajes fijados y la razón de cada uno. Defiende de primer principio: ¿por qué n=10^5 mata una O(n²) pero n=3,000 la perdona? ¿Qué edge cases pruebas SIEMPRE antes de enviar (vacío, un elemento, duplicados, negativos, overflow)?"
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000002",
        "title": "OA-1 · Arrays + HashMap — Counter, dict, set: la columna vertebral · MISIÓN",
        "concept": "hashmap",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["ca000000-0000-4000-8000-000000000004"],
        "sourceUrls": [
          "https://docs.python.org/3/library/collections.html",
          "https://leetcode.com/problems/two-sum/",
          "https://leetcode.com/problems/product-of-array-except-self/",
          "https://leetcode.com/problems/group-anagrams/"
        ],
        "mission": {
          "assignment": "El patrón #1 por frecuencia: conteo de frecuencias, búsqueda de complemento, mapeo de relaciones. Trabaja el libro de la celda y resuelve CRONOMETRADO (meta ≤25 min c/u, regla del Plan: si pasas de 25, mira la solución, entiéndela y márcala para repetir): Two Sum, Contains Duplicate, Product of Array Except Self y Group Anagrams — en Python, con dict/set/Counter sin dudar. Después de cada problema hazte LA pregunta del Plan §3.1: «¿qué patrón probó esto, y lo reconocería si cambiaran la redacción?». Remata con el banco de la celda (incluye el par-de-productos-más-frecuente del Cuaderno A3).",
          "deliverable": "Por cada problema: el patrón, POR QUÉ un dict/set convierte O(n²) en O(n) (qué trabajo se ahorra exactamente), tu tiempo real, y los edge cases que probaste. Defiende de primer principio: por qué el lookup de un dict es O(1) ESPERADO y qué lo degrada; por qué la llave canónica de Group Anagrams (sorted o conteo) agrupa correctamente; y en A3, por qué generar los pares por orden O(k²) es la decisión CORRECTA con k≤50 (no sobre-optimices: ese juicio también se examina)."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000003",
        "title": "OA-2 · Prefix sum + reinicio de estado — el patrón más reportado del OA 2026 · MISIÓN (reloj)",
        "concept": "prefix-sum",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["cd000000-0000-4000-8000-000000000003"],
        "sourceUrls": [
          "https://usaco.guide/silver/prefix-sums",
          "https://leetcode.com/problems/subarray-sum-equals-k/",
          "https://leetcode.com/problems/maximum-subarray/"
        ],
        "mission": {
          "assignment": "Patrón: prefix sum + reinicio de estado (greedy de acumulador) — el primer problema más reportado del OA 2026. Señales: «suma de un subarreglo/rango», «cuántos subarreglos cumplen», «flujo acumulado que cruza una frontera». Trabaja el libro y resuelve cronometrado: Subarray Sum Equals K y Maximum Subarray (LeetCode, Python), y los problemas A1 (reabastecimiento: flujo acumulado por frontera) y A2 (operaciones mínimas: reinicio de acumulador, reportado directo en OA 2026) del Cuaderno. Banco de la celda cronometrado.",
          "deliverable": "Trae: la señal exacta que delata el patrón; por qué prefix[j]−prefix[i] responde un rango en O(1) tras O(n) de precómputo; tu solución de A2 con el argumento de por qué REINICIAR el acumulador es siempre óptimo (puedes poner un valor suficientemente alto); y tus tiempos reales contra las metas. Un «lo resolví» sin explicar la señal y el porqué NO pasa."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000004",
        "title": "OA-3 · Two pointers + sliding window — la ventana que no retrocede · MISIÓN (reloj)",
        "concept": "ventana",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["cd000000-0000-4000-8000-000000000001"],
        "sourceUrls": [
          "https://usaco.guide/silver/two-pointers",
          "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
          "https://leetcode.com/problems/minimum-window-substring/",
          "https://leetcode.com/problems/container-with-most-water/"
        ],
        "mission": {
          "assignment": "Patrón: two pointers y sliding window. Señales: «el subarreglo/substring MÁS LARGO/CORTO que cumple…», pares en un arreglo ordenado, manipulación in-place. Trabaja el libro y resuelve cronometrado en Python: Longest Substring Without Repeating Characters, Container With Most Water y Minimum Window Substring. Después enfréntate a E1 del Cuaderno (substring con frecuencia mínima K): la TRAMPA es que su condición NO es monótona y el sliding window directo falla — la salida es iterar el parámetro (número de caracteres distintos) y aplicar la ventana con el parámetro FIJO. Banco cronometrado.",
          "deliverable": "Trae: por qué los dos punteros no retroceden y eso da O(n) amortizado (cada índice entra y sale a lo más una vez); CÓMO detectas que una condición no es monótona (el criterio para NO aplicar la ventana a ciegas — E1); qué hiciste en E1 y por qué fijar el parámetro restaura la monotonía; y tus tiempos. Aplicar la plantilla sin poder justificar la monotonía NO pasa."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000005",
        "title": "OA-4 · Binary search — y sobre el ESPACIO DE RESPUESTA, el patrón disfrazado · MISIÓN (reloj)",
        "concept": "binary-search-answer",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["cd000000-0000-4000-8000-000000000002"],
        "sourceUrls": [
          "https://usaco.guide/silver/binary-search",
          "https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/",
          "https://leetcode.com/problems/koko-eating-bananas/"
        ],
        "mission": {
          "assignment": "El patrón MÁS SUBESTIMADO del OA: «capacidad mínima para enviar paquetes» ES binary search disfrazado. Dos variantes: clásico (posición en arreglo ordenado, plantilla lower_bound) y SOBRE LA RESPUESTA (binarizar un candidato X verificando un predicado monótono feasible(X)). Trabaja el libro y resuelve cronometrado en Python: Capacity To Ship Packages Within D Days y Koko Eating Bananas (los dos aparecen literalmente en OAs de Amazon). Después B1 del Cuaderno (capacidad con carga frágil: feasible greedy con límite efectivo C−p) y B2 (mitad inferior de almacenes — la dificultad es entender el OBJETIVO antes de codear). Banco cronometrado.",
          "deliverable": "Trae: qué predicado monótono feasible(X) construiste en cada problema y POR QUÉ es monótono (si X sirve, X+1 sirve); los checks de imposibilidad de B1 que van ANTES de binarizar (orders[i] > C efectivo → -1); la complejidad O(n log R) y sobre QUÉ se toma el log (el rango de la respuesta, no n); y tus tiempos. Un accepted sin poder derivar el feasible NO pasa."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000006",
        "title": "OA-5 · Greedy con observación — el diseño anti-LLM 2026 · MISIÓN (reloj)",
        "concept": "greedy-observacion",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + la observación que dedujiste" },
        "related": ["cd000000-0000-4000-8000-000000000004"],
        "sourceUrls": [
          "https://usaco.guide/bronze/intro-greedy",
          "https://usaco.guide/silver/greedy-sorting",
          "https://leetcode.com/problems/gas-station/",
          "https://leetcode.com/problems/jump-game/"
        ],
        "mission": {
          "assignment": "El estilo que Amazon reforzó en 2026 contra los LLM: problemas que exigen DEDUCIR una regla/observación matemática antes de codear — no aplicar plantillas. Trabaja el libro y resuelve cronometrado: Jump Game y Gas Station (Python), y del Cuaderno: B3 (proveedores mínimos: greedy descendente — tu calibración de velocidad base) y C1 (secuencia lexicográficamente mínima: LA observación es que cambiar el signo de k reduce la suma en 2k → paridad; el más duro de observación del Cuaderno). Regla de las 7: dibuja las restricciones y organízalas en ramas lógicas ANTES de escribir código. Banco cronometrado.",
          "deliverable": "Trae: para C1, la observación de paridad ESCRITA ANTES del código (target alcanzable ⇔ misma paridad que S=n(n+1)/2 y |target|≤S) y cómo construiste la secuencia lexicográficamente mínima; el argumento de intercambio de por qué tu greedy no se arrepiente; UN caso concreto donde un greedy ingenuo falla; y tus tiempos. Código sin la observación deducida primero NO pasa."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000007",
        "title": "OA-6 · Heap / Top-K — los K más frecuentes, los K más grandes · MISIÓN (reloj)",
        "concept": "heap-topk",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["ca000000-0000-4000-8000-000000000006"],
        "sourceUrls": [
          "https://docs.python.org/3/library/heapq.html",
          "https://leetcode.com/problems/top-k-frequent-elements/",
          "https://leetcode.com/problems/kth-largest-element-in-an-array/"
        ],
        "mission": {
          "assignment": "Patrón: heap / priority queue. Señales: «los K más frecuentes/grandes/cercanos», «procesa siempre el mayor disponible», asignación con costo que cambia tras cada operación. En Python heapq es MIN-heap: para max-heap insertas valores negados — que salga de memoria muscular. Trabaja el libro y resuelve cronometrado: Top K Frequent Elements y Kth Largest Element (Python), y C4 del Cuaderno (asignación de servidores con costo acumulado: max-heap con actualización, la búsqueda lineal del máximo se agota por tiempo con n,m≤2·10^5). Banco cronometrado.",
          "deliverable": "Trae: por qué un heap de tamaño k da O(n log k) y cuándo eso le gana al sort completo O(n log n); la mecánica exacta de negar para max-heap en Python (y el tuple-trick para desempates); en C4, por qué re-insertar la capacidad reducida mantiene el invariante del heap; y tus tiempos reales."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000008",
        "title": "OA-7 · Árboles binarios — DFS/BFS, los 4 recorridos, LCA, validar BST · MISIÓN (reloj)",
        "concept": "arboles",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el patrón que reconociste" },
        "related": ["ca000000-0000-4000-8000-000000000005"],
        "sourceUrls": [
          "https://leetcode.com/problems/binary-tree-level-order-traversal/",
          "https://leetcode.com/problems/validate-binary-search-tree/",
          "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/",
          "https://leetcode.com/problems/all-nodes-distance-k-in-binary-tree/"
        ],
        "mission": {
          "assignment": "El filtro más consistente de Amazon. Los cuatro recorridos (inorder, preorder, postorder, level-order) de MEMORIA MUSCULAR — el Plan lo pide literal. Trabaja el libro y resuelve cronometrado en Python: Level Order Traversal, Validate BST (con cotas heredadas, no comparación local — el error clásico), Lowest Common Ancestor, y del Cuaderno: D3 (nodos a distancia K SIN mapa de padres, O(n): la recursión devuelve la distancia al objetivo y desciende al otro subárbol) y D4 (subárbol de mayor suma sin adyacentes: DP en árbol con par de estados — puente a OA-10). Banco cronometrado.",
          "deliverable": "Trae: por qué validar un BST exige COTAS heredadas (min,max) y el contraejemplo exacto donde comparar solo con el padre acepta un árbol inválido; cómo D3 logra O(n) sin construir el mapa de padres (qué devuelve la recursión y cómo desciende con k−dist); el par (incluyo, no incluyo) de D4; y tus tiempos contra las metas."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000009",
        "title": "OA-8 · Grafos y grid — islas, propagación, Kahn, BFS sobre estados · MISIÓN (reloj)",
        "concept": "grafos-grid",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el modelado que viste" },
        "related": ["ca000000-0000-4000-8000-000000000007", "cd000000-0000-4000-8000-000000000006"],
        "sourceUrls": [
          "https://usaco.guide/silver/graph-traversal",
          "https://usaco.guide/silver/flood-fill",
          "https://leetcode.com/problems/number-of-islands/",
          "https://leetcode.com/problems/rotting-oranges/",
          "https://leetcode.com/problems/course-schedule/"
        ],
        "mission": {
          "assignment": "Amazon casi nunca dice «esto es un grafo»: describe un almacén-cuadrícula, dependencias de instalación, un robot repartidor — y tú tienes que VER los nodos y aristas (temas del mundo real reportados: logística/pathfinding, calendarización, resolución de dependencias). Trabaja el libro y resuelve cronometrado en Python: Number of Islands (flood fill + visitados), Rotting Oranges (BFS MULTI-FUENTE con cola inicial múltiple), Course Schedule (Kahn: el orden con menos de n elementos delata el ciclo), y del Cuaderno: D1 (robot con batería: el nodo NO es la casilla — es el estado (fila, columna, batería), BFS 3D con visitados 3D) y D2 (orden de instalación con incompatibilidades: Kahn + restricción posterior). Banco cronometrado.",
          "deliverable": "Trae: el MODELADO de cada problema (qué es nodo, qué es arista, por qué BFS vs DFS); cuándo el estado deja de ser la posición y se vuelve (posición + algo más) y qué le hace eso al arreglo de visitados; cómo Kahn detecta el ciclo sin buscarlo explícitamente; la complejidad O(V+E) con V y E del GRID (m·n y 4·m·n); y tus tiempos."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000010",
        "title": "OA-9 · Intervals — ordenar, fusionar, y el greedy por fin · MISIÓN (reloj)",
        "concept": "intervalos",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + el criterio de orden que elegiste" },
        "sourceUrls": [
          "https://leetcode.com/problems/merge-intervals/",
          "https://leetcode.com/problems/insert-interval/",
          "https://leetcode.com/problems/non-overlapping-intervals/"
        ],
        "mission": {
          "assignment": "Patrón: intervalos. Señales: «reuniones que se traslapan», «fusiona los rangos», «mínimo de remociones para que no se crucen» (calendarización de recursos es tema reportado del mundo real). Trabaja el libro y resuelve cronometrado en Python: Merge Intervals (ordena por INICIO, fusiona extendiendo el fin), Insert Interval (tres fases: antes/traslape/después, sin re-ordenar) y Non-overlapping Intervals (greedy por FIN — quedarte con el que termina antes deja máximo espacio). Banco cronometrado.",
          "deliverable": "Trae: POR QUÉ fusionar ordena por INICIO pero maximizar no-traslapados ordena por FIN (dos objetivos, dos criterios — el argumento de intercambio del segundo); cómo manejaste los bordes que se TOCAN (¿[1,4] y [4,5] se fusionan? — la decisión y su porqué según el enunciado); la complejidad O(n log n) dominada por el sort; y tus tiempos."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000011",
        "title": "OA-10 · DP 1D + DP en árbol — estado, transición, caso base · MISIÓN (reloj)",
        "concept": "dp-1d",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez real es el OA de Amazon — el reloj", "sub": "drill cronometrado aquí · trae tu tiempo + estado y transición" },
        "related": ["ca000000-0000-4000-8000-000000000009", "cd000000-0000-4000-8000-000000000007"],
        "sourceUrls": [
          "https://usaco.guide/gold/intro-dp",
          "https://leetcode.com/problems/coin-change/",
          "https://leetcode.com/problems/word-break/",
          "https://leetcode.com/problems/house-robber/",
          "https://leetcode.com/problems/longest-increasing-subsequence/"
        ],
        "mission": {
          "assignment": "El Plan lo dice: Coin Change, House Robber, Word Break y LIS cubren la mayoría de las variantes de DP que Amazon pregunta. Para cada uno, lo que se examina es que puedas NOMBRAR el estado y la transición — no recitar código. Trabaja el libro y resuelve cronometrado en Python los cuatro, más del Cuaderno: E2 (segmentación con costo: Word Break donde dp[i] guarda costo mínimo, no bool) y D4 si no lo cerraste en OA-7 (House Robber III: DP en árbol, el par (incluyo, no incluyo) por nodo). Banco cronometrado.",
          "deliverable": "Trae: para CADA problema la tripleta ESTADO / TRANSICIÓN / CASO BASE y la complejidad como estados × costo-de-transición; por qué Coin Change usa monedas ilimitadas (unbounded: el loop interno recorre monedas por cada monto) y qué cambiaría con una moneda por tipo; por qué House Robber es dp[i]=max(dp[i−1], dp[i−2]+v[i]) y cómo el MISMO par se vuelve el estado del DP en árbol; y tus tiempos contra las metas."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000012",
        "title": "OA-11 · SQL — agregación condicional: GROUP BY + SUM(CASE WHEN) · MISIÓN",
        "concept": "sql-agregacion",
        "nature": "a_mano",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el juez compara tu consulta carácter por carácter", "sub": "formato estricto: decimales con ceros, ORDER BY explícito, COALESCE" },
        "branchFrom": "ce000000-0000-4000-8000-000000000002",
        "sourceUrls": [
          "https://sqlbolt.com/lesson/select_queries_with_aggregates",
          "https://www.postgresql.org/docs/current/tutorial-agg.html",
          "https://mode.com/sql-tutorial/sql-case"
        ],
        "mission": {
          "assignment": "Algunas variantes del OA traen SQL, y tu Postgres diario es ventaja directa — no lo saltes (Cuaderno A4). El patrón: transformar filas en columnas en UNA pasada con GROUP BY + SUM(CASE WHEN status = '…' THEN weight ELSE 0 END) por cada estado. Escribe A MANO la consulta del reporte de peso por estado del Cuaderno (customers/packages, columnas por estado, orden por email, decimales con ceros finales tipo 5.00) y las variantes del banco de la celda.",
          "deliverable": "Trae la consulta completa de A4 escrita a mano y DEFENDIDA: por qué CASE WHEN dentro de SUM pivotea (qué suma cada rama y por qué las filas de otros estados aportan 0); qué cambia si omites el ELSE 0 (SUM ignora NULL — cuándo eso da igual y cuándo no); por qué necesitas LEFT JOIN si un cliente sin paquetes debe aparecer (y qué le hace el INNER); y cómo garantizas el formato 5.00 (cast a numeric con escala / to_char). Sin poder explicar cada rama, NO pasa."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000013",
        "title": "OA-12 · Repo-debug — Node/Express/Mongoose con asistente de IA (el Problema 2) · MISIÓN",
        "concept": "repo-debug",
        "nature": "mixto",
        "interrogationMode": "exam",
        "judge": { "label": "La arena · el Problema 2 — localizar y parchar bajo reloj", "sub": "10 min de exploración máx · prueba por prueba · parche mínimo, nunca regenerar" },
        "parts": [
          { "name": "Dirigir al asistente de IA a LOCALIZAR (prueba fallida → archivo → función → líneas)", "nature": "delegable" },
          { "name": "Leer el código localizado y decidir el PARCHE MÍNIMO (y su porqué)", "nature": "a_mano" }
        ],
        "branchFrom": "ce000000-0000-4000-8000-000000000002",
        "sourceUrls": [
          "https://expressjs.com/en/guide/routing.html",
          "https://mongoosejs.com/docs/documents.html",
          "https://mongoosejs.com/docs/tutorials/findoneandupdate.html"
        ],
        "mission": {
          "assignment": "EL PROBLEMA 2 — lo que casi nadie prepara y donde tienes ventaja estructural (meses dirigiendo a Claude Code). Mecánica real: app pequeña con bugs sembrados + suite que falla + panel de IA que LOCALIZA pero no arregla. Los tests verifican STATUS CODE y MENSAJE de la API, no el frontend → el fix toca handler Y service. Bugs típicos: comparación invertida, save() faltante, off-by-one, objeto guardado que nunca se escribe de vuelta o nunca se vincula. Dedica 1h a Mongoose específicamente: save(), findByIdAndUpdate con {new:true}, populate, markModified. Y EJECUTA el ejercicio del Cuaderno §8 que nadie hace: clona un CRUD de Express+Mongoose ajeno, siembra 3 bugs (comparación invertida en auth, save() faltante, off-by-one), cierra el editor 1 hora, y arréglalos usando SOLO las pruebas fallidas + la IA en modo localización («Here is the failing test output and the relevant file; identify the bug and propose the smallest patch»). Protocolo del examen: 10 min máximo de exploración, prueba por prueba, cambios quirúrgicos, correr tras cada fix, >15 min atorado → siguiente (4/6 verdes ha avanzado candidatos). Banco de la celda: localizar el bug en snippets reales y PARCHEAR funciones puras con el bug sembrado.",
          "deliverable": "Trae: la constancia del ejercicio del repo (los 3 bugs sembrados: cuál te costó más y por qué, y si caíste en pedir regeneración en vez de localización); el protocolo de tiempo DE MEMORIA; y para cada bug del banco: la LÍNEA exacta, el parche mínimo, y por qué un cambio más grande sería peor. En la parte delegable se te juzga por cómo DIRIGES y AUDITAS al asistente (detectar cuándo alucina); en la parte a mano, por el parche y su porqué."
        }
      },
      {
        "id": "ce000000-0000-4000-8000-000000000014",
        "title": "OA-13 · Work Simulation + Work Style — los 16 Leadership Principles · MISIÓN",
        "concept": "leadership-principles",
        "nature": "delegable",
        "interrogationMode": "exam",
        "judge": { "label": "La prueba · Work Simulation — consistencia contra los 16 LPs", "sub": "most/least effective + el principio que lo justifica, comparado contra el patrón documentado" },
        "branchFrom": "ce000000-0000-4000-8000-000000000001",
        "sourceUrls": [
          "https://www.amazon.jobs/content/en/our-workplace/leadership-principles",
          "https://www.amazon.jobs/content/en/how-we-hire/assessments"
        ],
        "mission": {
          "assignment": "Donde se pierde el examen: el resultado no se revela hasta completar las TRES secciones — un coding perfecto con Work Simulation mediocre no pasa. 45 min de escenarios SDE evaluados contra los Leadership Principles + 15 min de Work Style. Lee los 16 LPs de la fuente oficial — NO para memorizarlos: para extraer el PATRÓN DE DECISIÓN de cada uno. Escribe tu hoja con las 6 reglas del Plan §4.1 (Customer Obsession: gana el cliente · Ownership: nunca «escalar y esperar» · Dive Deep: causa raíz antes del parche · Bias for Action: lo reversible se actúa · Earn Trust: escuchar y buscar datos · Deliver Results: se recorta alcance con transparencia) — esa hoja se relee el día del examen. El patrón de la respuesta correcta: investiga antes de actuar, comunica proactivamente, prioriza impacto en el cliente, asume el resultado completo. Las trampas: culpar, esperar pasivo, comodidad del equipo sobre el cliente, actuar sin comunicar. Trabaja los 8 escenarios del Cuaderno §9 y el banco de la celda (most/least effective con crédito parcial; las encuestas tienen preguntas de CONTROL — la inconsistencia penaliza más que una preferencia legítima).",
          "deliverable": "Trae: tu hoja de las 6 reglas ESCRITA; para cada uno de los 8 escenarios del Cuaderno, tu most/least effective y el LP que lo justifica en una línea; UNA tensión entre dos principios explicada (p.ej. Bias for Action vs Dive Deep: cuándo gana cada uno y qué dato lo decide); y por qué responder consistente y honesto le gana a adivinar la respuesta «perfecta». Este gate juzga COMPRENSIÓN auditable del marco de decisión, no que recites los 16 nombres."
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
