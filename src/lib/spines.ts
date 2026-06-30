// CURRICULUM SPINES (WHITE ROOM) — REAL structure extracted via Playwright/WebFetch
// from canonical sources (CS50, MIT 6.006 OCW, Berkeley CS61B, Stanford CS231n, DW
// Nico's Weg, Goethe-Institut). Generated, not hand-invented: titles + sourceUrls are
// EXTRACTED. Bodies fill on demand (tutor); the 3 demo cells carry a first-principle
// exit-gate rubric anchored to the source (CLRS for CS, etc.). Where a source was
// JS-rendered / blocked (DW chapters, ResearchGate) the course URL is anchored honestly.
// Regenerate via scratchpad/gen-spines.mjs from the extraction output.

export interface SpineCell {
  id: string;
  title: string;
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
}

export interface Spine {
  goalId: string;
  goalTitle: string;
  color: string;
  sigil: string;
  /** ordered cells — course order IS the DAG dependency (linear chain) */
  cells: SpineCell[];
}

export const SPINES: Spine[] = [
  {
    "goalId": "a0000000-0000-4000-8000-000000000001",
    "goalTitle": "ITC",
    "color": "#25B0C9",
    "sigil": "itc",
    "cells": [
      {
        "id": "ca000000-0000-4000-8000-000000000001",
        "title": "CS50 Week 0 — Scratch (computational thinking, the zero/ramp node)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/0/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000002",
        "title": "CS50 Lecture 1 — C (variables, types, conditionals, loops) · MISIÓN DIRIGIDA",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/1/"
        ],
        "mission": {
          "assignment": "Trabaja CS50 Lecture 1 (C) COMPLETA en cs50.harvard.edu/x/weeks/1/: mira la lecture entera y lee las notas. Luego ESCRIBE y COMPILA en C al menos un programa propio que use una variable tipada, una condicional y un bucle — por ejemplo resuelve 'Mario (less)' o 'Cash' del Problem Set 1. No la veas en diagonal: el interrogatorio asume que la viviste y que compilaste código real.",
          "deliverable": "Tus PROPIAS notas de la lecture (no el subtitulado copiado) + una reflexión corta que responda: ¿qué hace clang cuando compilas tu .c y cuáles son las fases?, ¿por qué un int de 32 bits puede desbordarse y qué viste si lo provocaste?, y ¿qué error de compilación encontraste al escribir tu programa y cómo lo resolviste? Pega un fragmento del código que compilaste."
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000003",
        "title": "CS50 Week 2 — Arrays (compilation, debugging, strings)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/2/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000004",
        "title": "CS50 Week 3 — Algorithms (linear/binary search, selection/bubble sort, big-O first exposure)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/3/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000005",
        "title": "CS50 Week 4 — Memory (pointers, dynamic allocation, the heap/stack)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/4/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000006",
        "title": "CS50 Week 5 — Data Structures (linked lists, hash tables, tries, stacks/queues — first pass)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/5/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000007",
        "title": "6.006 L1 — Introduction (computation, asymptotic notation, model of computation)",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/calendar/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000008",
        "title": "6.006 L2 — Data Structures (arrays, linked lists, dynamic arrays) + CS61B Lists/ADTs depth",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/3.-references-recursion-and-lists",
          "https://cs61b-2.gitbook.io/cs61b-textbook/4.-sllists"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000009",
        "title": "6.006 L4 — Hashing (hash functions, chaining, the comparison/decision-tree model) + CS61B Hashing I/II",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-4-hashing/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/19.-hashing-i",
          "https://cs61b-2.gitbook.io/cs61b-textbook/20.-hashing-ii"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000010",
        "title": "6.006 L3 + L5 — Sorting & Linear Sorting (merge/insertion sort, counting/radix) + CS61B Sorting suite",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/29.-basic-sorts",
          "https://cs61b-2.gitbook.io/cs61b-textbook/32.-more-quick-sort-sorting-summary"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000011",
        "title": "6.006 L6 — Binary Trees Part 1 (BST invariant, traversal, set/sequence ops) + CS61B BSTs",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/16.-adts-and-bsts"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000012",
        "title": "6.006 L7 — Binary Trees Part 2: AVL (balanced search trees) + CS61B B-trees & Red-Black trees",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-7-binary-trees-part-2-avl/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/17.-b-trees",
          "https://cs61b-2.gitbook.io/cs61b-textbook/18.-red-black-trees"
        ],
        "videoUrls": [
          "https://www.youtube.com/watch?v=U1JYwHcFfso",
          "https://archive.org/download/MIT6.006S20/MIT6_006S20_02_27_Lecture_7_300k.mp4"
        ],
        "gate": {
          "question": "Suppose a colleague proposes dropping AVL's height-balance invariant and instead rebalancing a BST only when its height exceeds 3*log2(n), claiming this is 'good enough' and saves rotations. Justify from first principles whether this scheme still guarantees O(log n) worst-case search, and identify exactly which property of the AVL invariant their relaxed rule would and would not preserve — do not appeal to 'AVL is the standard' or recognition of a named algorithm; argue from the height recurrence and the cost of rebalancing.",
          "rubric": [
            "Must DERIVE why an AVL tree's height is O(log n) from the height-balance invariant (|height(left) - height(right)| <= 1 at every node), not merely assert it: set up the recurrence N(h) = 1 + N(h-1) + N(h-2) for the minimum number of nodes in a height-h AVL tree, show it is bounded below by Fibonacci growth (N(h) >= F(h+...)) and therefore h = O(log n). Reference: CLRS treatment of balanced-tree height bounds (do not quote CLRS text).",
            "Must explain WHY a single rotation restores the invariant after an insertion/deletion in the left-left (or right-right) case but FAILS in the left-right (or right-left) case, requiring a double rotation — argued from how each rotation changes subtree heights, not from a memorized case table.",
            "Must justify that rebalancing costs O(log n) per operation because at most O(height) ancestors can become unbalanced and each rotation is O(1) — connecting the rotation count to the path length back to the root, rather than stating 'rotations are cheap'.",
            "Must show rotations preserve the BST in-order ordering invariant (the reason a rotation is a legal transformation at all), e.g. by demonstrating the in-order traversal is unchanged before and after rotation.",
            "Must contrast AVL with at least one alternative balanced scheme (red-black / 2-3 / B-tree, per CS61B) and state the concrete tradeoff (AVL's tighter height bound and more rotations on update vs red-black's looser balance and fewer rotations), reasoning from the invariants of each rather than reciting 'red-black is faster'."
          ]
        }
      },
      {
        "id": "ca000000-0000-4000-8000-000000000013",
        "title": "6.006 L8 — Binary Heaps & Priority Queues (heapsort, heapify) + CS61B Heaps and Priority Queues",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/21.-heaps-and-priority-queues"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000014",
        "title": "6.006 L9–L10 — Graph Search: BFS & DFS (reachability, topological sort) + CS61B Graph Traversals",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/22.-tree-traversals-and-graphs",
          "https://cs61b-2.gitbook.io/cs61b-textbook/23.-graph-traversals-and-implementations"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000015",
        "title": "6.006 L11–L14 — Shortest Paths (weighted, Bellman-Ford, Dijkstra, Johnson) + CS61B Shortest Paths & MST",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/24.-shortest-paths",
          "https://cs61b-2.gitbook.io/cs61b-textbook/25.-minimum-spanning-trees"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000016",
        "title": "6.006 L15–L18 — Dynamic Programming (subproblems, SRBOT, LCS/LIS, pseudopolynomial)",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000017",
        "title": "6.006 L19 — Complexity (P, NP, NP-completeness, reductions) + CS61B Complexity & P=NP",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/39.-compression-complexity-p-np"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000018",
        "title": "CS50 Week 6–10 — Python, SQL, Web (HTML/CSS/JS, Flask) — applied capstone track",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/6/",
          "https://cs50.harvard.edu/x/weeks/7/",
          "https://cs50.harvard.edu/x/weeks/8/",
          "https://cs50.harvard.edu/x/weeks/9/",
          "https://cs50.harvard.edu/x/weeks/10/"
        ]
      }
    ]
  },
  {
    "goalId": "a0000000-0000-4000-8000-000000000002",
    "goalTitle": "FrED Factory",
    "color": "#1F9E84",
    "sigil": "fred",
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
    "cells": [
      {
        "id": "cc000000-0000-4000-8000-000000000001",
        "title": "A1.1 — Hallo! Begrüßung, Alphabet & sein (greetings, the verb sein, W-/yes-no questions)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789"
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
          "https://learngerman.dw.com/en/beginners/c-36519789"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000004",
        "title": "A1.4 — Lebensmittel & Akkusativ: bestimmter/unbestimmter Artikel im Akkusativ, Plural",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000005",
        "title": "A1.5 — Im Büro & Alltag: regelmäßige Verben, Zahlen/Uhrzeit, Modalverben (können/müssen)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/beginners/c-36519789"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000006",
        "title": "A2.1 — Perfekt (Vergangenheit) & trennbare Verben: über Erlebnisse berichten",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000007",
        "title": "A2.2 — Dativ: Präpositionen, indirektes Objekt, Wechselpräpositionen (Akk./Dat.)",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000008",
        "title": "A2.3 — Konnektoren & einfacher zusammenhängender Text: weil/dass, Komparativ/Superlativ",
        "sourceUrls": [
          "https://learngerman.dw.com/en/intermediate/c-37328690"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000009",
        "title": "B1.1 — Nebensätze & Meinung äußern: wenn/obwohl, Argumentation, Genitiv",
        "sourceUrls": [
          "https://learngerman.dw.com/en/advanced/c-39756769"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000010",
        "title": "B1.2 — Konjunktiv II & Passiv: höfliche Bitten, Hypothesen, formelle Register",
        "sourceUrls": [
          "https://learngerman.dw.com/en/advanced/c-39756769"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000011",
        "title": "B2.1 — Komplexe Argumentation: Relativsätze, Nominalstil, abstrakte Themen (Goethe B2 gate)",
        "sourceUrls": [
          "https://www.goethe.de/en/spr/kup/prf/prf/gb2.html"
        ]
      },
      {
        "id": "cc000000-0000-4000-8000-000000000012",
        "title": "B2.2 — Fließende Interaktion & Standpunkt: detaillierter Text, Pro/Contra, Konnektoren-Vielfalt",
        "sourceUrls": [
          "https://www.goethe.de/en/spr/kup/prf/prf/gb2.html"
        ]
      }
    ]
  },
  {
    "goalId": "a0000000-0000-4000-8000-000000000004",
    "goalTitle": "Competitiva (ICPC)",
    "color": "#C9952F",
    "sigil": "icpc",
    "cells": [
      {
        "id": "cd000000-0000-4000-8000-000000000001",
        "title": "Fundamentos competitivos — complejidad, I/O rápido, el CP-Handbook",
        "sourceUrls": [
          "https://cses.fi/book/book.pdf",
          "https://usaco.guide/general/resources-cp"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000002",
        "title": "Two pointers & sliding window — reconocer el patrón",
        "sourceUrls": [
          "https://usaco.guide/silver/two-pointers",
          "https://cp-algorithms.com/"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000003",
        "title": "Binary search on the answer",
        "sourceUrls": [
          "https://usaco.guide/silver/binary-search"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000004",
        "title": "DSU / Union-Find",
        "sourceUrls": [
          "https://cp-algorithms.com/data_structures/disjoint_set_union.html",
          "https://usaco.guide/gold/dsu"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000005",
        "title": "Grafos competitivos — BFS/DFS, componentes, orden topológico",
        "sourceUrls": [
          "https://usaco.guide/silver/graph-traversal",
          "https://cp-algorithms.com/graph/breadth-first-search.html"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000006",
        "title": "Programación dinámica — patrones competitivos",
        "sourceUrls": [
          "https://usaco.guide/gold/intro-dp"
        ]
      },
      {
        "id": "cd000000-0000-4000-8000-000000000007",
        "title": "Sprints cronometrados — Codeforces problemset por rating",
        "sourceUrls": [
          "https://codeforces.com/problemset",
          "https://atcoder.jp/"
        ]
      }
    ]
  }
];

const CELL_BY_ID = new Map<string, SpineCell>(SPINES.flatMap((s) => s.cells.map((c) => [c.id, c] as const)));
export function cellById(id: string): SpineCell | null {
  return CELL_BY_ID.get(id) ?? null;
}
