import { SEED_MODULE_IDS } from "@/lib/seed";

// Authorable rich content per topic (Bloque 4) — the map skeleton + curated static
// resources. HONESTY RULE: no fabricated academic "facts" presented as fixed truth,
// and NO invented video URLs. Where content isn't curated yet, the field is EMPTY and
// the UI says so ("por generar") — AI-generated content arrives via Bloque 6 as an
// editable draft. Quizzes here are textbook-standard basics only.

export interface TopicVideo {
  title: string;
  /** real URL only — leave the list empty rather than inventing one */
  url: string;
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  /** index into options */
  answer: number;
  rationale: string;
}

export interface TopicContent {
  /** brief, accurate orientation — the reto comes FIRST; this is the on-demand resource */
  summary: string;
  /** curated external resources (names/URLs). Empty = not curated yet (honest). */
  videos: TopicVideo[];
  /** tools worth knowing (names, not links) */
  tools: string[];
  /** built-in quiz — verifiable basics; empty where deferred to the tutor (Bloque 6) */
  quiz: QuizQuestion[];
}

const M = SEED_MODULE_IDS;

export const TOPIC_CONTENT: Record<string, TopicContent> = {
  [M.edd]: {
    summary:
      "Arreglos, listas, pilas, colas, tablas hash y árboles. Cada operación (acceso, búsqueda, inserción, borrado) tiene un costo; elegir la estructura ES elegir ese costo. Domina Big-O y el trade-off tiempo/espacio antes de tocar árboles balanceados.",
    videos: [],
    tools: ["VisuAlgo", "Big-O Cheat Sheet", "Python collections / deque"],
    quiz: [
      {
        prompt: "¿Complejidad promedio de búsqueda por clave en una tabla hash bien dimensionada?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        answer: 0,
        rationale: "Con hash uniforme y factor de carga acotado, el acceso por clave es O(1) amortizado.",
      },
      {
        prompt: "¿Qué estructura impone orden LIFO (último en entrar, primero en salir)?",
        options: ["Cola", "Pila", "Árbol", "Grafo"],
        answer: 1,
        rationale: "Una pila (stack) saca siempre el último elemento insertado.",
      },
      {
        prompt: "Acceso por índice en un arreglo contiguo es:",
        options: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
        answer: 0,
        rationale: "Dirección = base + i·tamaño_elemento → cálculo en tiempo constante.",
      },
    ],
  },
  [M.arboles]: {
    summary:
      "Un árbol binario de búsqueda degenera a O(n) si se desbalancea. AVL y rojo-negro mantienen altura O(log n) con rotaciones. Entiende la invariante de balance y qué rotación aplica cada caso.",
    videos: [],
    tools: ["VisuAlgo (BST / AVL)", "graphviz"],
    quiz: [
      {
        prompt: "Altura de un árbol binario balanceado con n nodos:",
        options: ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
        answer: 0,
        rationale: "Mantener el balance acota la altura a logaritmo de n.",
      },
      {
        prompt: "Una rotación en un AVL sirve para:",
        options: ["restaurar el balance", "ordenar el arreglo", "liberar memoria", "calcular el hash"],
        answer: 0,
        rationale: "Las rotaciones reacomodan subárboles para recuperar la invariante de balance.",
      },
    ],
  },
  [M.grafos]: {
    summary:
      "Vértices y aristas modelan redes, rutas y dependencias. BFS explora por capas (rutas mínimas sin peso); DFS profundiza (ciclos, topológico). Con pesos: Dijkstra. Reconoce qué recorrido pide el problema.",
    videos: [],
    tools: ["VisuAlgo (grafos)", "NetworkX"],
    quiz: [
      {
        prompt: "Para la ruta más corta en un grafo SIN pesos, el recorrido natural es:",
        options: ["BFS", "DFS", "Dijkstra", "ordenamiento por mezcla"],
        answer: 0,
        rationale: "BFS visita por capas, así que la primera vez que llega a un nodo es por la ruta de menos aristas.",
      },
    ],
  },
  [M.a1]: {
    summary:
      "Saludos, artículos definidos (der/die/das), números, presente de verbos regulares y la regla V2 (el verbo conjugado va en segunda posición). La base sobre la que se apoya todo el alemán.",
    videos: [],
    tools: ["Anki (mazo A1)", "DW – Nico's Weg (A1)", "DWDS (diccionario)"],
    quiz: [
      {
        prompt: "El artículo definido NEUTRO singular en alemán es:",
        options: ["der", "die", "das", "den"],
        answer: 2,
        rationale: "das = neutro (das Kind). der = masculino, die = femenino/plural.",
      },
      {
        prompt: "En una oración afirmativa alemana, el verbo conjugado ocupa:",
        options: ["la posición 1", "la posición 2 (regla V2)", "el final", "la posición 3"],
        answer: 1,
        rationale: "Regla V2: el verbo finito siempre va en la segunda posición de la cláusula principal.",
      },
      {
        prompt: "'Guten Morgen' significa:",
        options: ["buenas noches", "buenos días", "por favor", "adiós"],
        answer: 1,
        rationale: "Guten Morgen = buenos días (saludo matutino).",
      },
    ],
  },
  // Topics below: skeleton + tools curated; deep summary/quiz left for the tutor
  // (Bloque 6) so nothing academic is invented here as fixed truth.
  [M.proto]: {
    summary: "Del boceto al prototipo funcional rápido: iteración corta, materiales accesibles, validar la idea antes de invertir en la versión final.",
    videos: [],
    tools: ["Fusion 360", "cartón / foamboard", "Arduino"],
    quiz: [],
  },
  [M.aditiva]: {
    summary: "Manufactura aditiva (impresión 3D): construir capa por capa. Variables clave: material, altura de capa, relleno, soportes y tolerancias.",
    videos: [],
    tools: ["FDM / SLA", "PrusaSlicer", "Cura"],
    quiz: [],
  },
  [M.a2]: {
    summary: "Conversación cotidiana: pasado (Perfekt), casos (Akkusativ/Dativ) y conectores. Pasar de frases sueltas a intercambios reales.",
    videos: [],
    tools: ["DW – Nico's Weg (A2)", "Tandem (intercambio)"],
    quiz: [],
  },
};

export function contentForModule(moduleId: string): TopicContent | null {
  return TOPIC_CONTENT[moduleId] ?? null;
}
