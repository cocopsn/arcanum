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
        "title": "CS50 Week 1 — C (variables, types, conditionals, loops)",
        "sourceUrls": [
          "https://cs50.harvard.edu/x/weeks/1/"
        ]
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
          "https://cs61b-2.gitbook.io/cs61b-textbook/3.-introduction-to-lists",
          "https://cs61b-2.gitbook.io/cs61b-textbook/4.-sllists"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000009",
        "title": "6.006 L4 — Hashing (hash functions, chaining, the comparison/decision-tree model) + CS61B Hashing I/II",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-4-hashing/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/19.-hashing",
          "https://cs61b-2.gitbook.io/cs61b-textbook/20.-hashing-ii"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000010",
        "title": "6.006 L3 + L5 — Sorting & Linear Sorting (merge/insertion sort, counting/radix) + CS61B Sorting suite",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/29.-basic-sorts",
          "https://cs61b-2.gitbook.io/cs61b-textbook/32.-quicksort"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000011",
        "title": "6.006 L6 — Binary Trees Part 1 (BST invariant, traversal, set/sequence ops) + CS61B BSTs",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/lecture-notes/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/16.-adts-bsts"
        ]
      },
      {
        "id": "ca000000-0000-4000-8000-000000000012",
        "title": "6.006 L7 — Binary Trees Part 2: AVL (balanced search trees) + CS61B B-trees & Red-Black trees",
        "sourceUrls": [
          "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/resources/lecture-7-binary-trees-part-2-avl/",
          "https://cs61b-2.gitbook.io/cs61b-textbook/17.-b-trees-2-3-2-3-4-trees",
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
          "https://cs61b-2.gitbook.io/cs61b-textbook/22.-tree-and-graph-traversals",
          "https://cs61b-2.gitbook.io/cs61b-textbook/23.-graph-traversals-implementations"
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
          "https://cs61b-2.gitbook.io/cs61b-textbook/39.-compression-complexity-and-p-np"
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
        "title": "Environment setup: Python, NumPy, Jupyter/Colab",
        "sourceUrls": [
          "https://cs231n.github.io/setup-instructions/",
          "https://cs231n.github.io/python-numpy-tutorial/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000002",
        "title": "Classical vision I — image filtering & smoothing (OpenCV)",
        "sourceUrls": [
          "https://docs.opencv.org/4.13.0/d4/d13/tutorial_py_filtering.html"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000003",
        "title": "Classical vision II — image gradients (Sobel / Laplacian / Scharr)",
        "sourceUrls": [
          "https://docs.opencv.org/4.13.0/d5/d0f/tutorial_py_gradients.html"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000004",
        "title": "Classical vision III — Canny edge detection",
        "sourceUrls": [
          "https://docs.opencv.org/4.13.0/da/d22/tutorial_py_canny.html"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000005",
        "title": "Classical vision IV — contours (detection & analysis)",
        "sourceUrls": [
          "https://docs.opencv.org/4.13.0/d3/d05/tutorial_py_table_of_contents_contours.html",
          "https://docs.opencv.org/4.13.0/d4/d73/tutorial_py_contours_begin.html"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000006",
        "title": "Image classification: data-driven approach, kNN, train/val/test",
        "sourceUrls": [
          "https://cs231n.github.io/classification/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000007",
        "title": "Linear classification: SVM & Softmax",
        "sourceUrls": [
          "https://cs231n.github.io/linear-classify/",
          "https://cs231n.stanford.edu/slides/2026/lecture_2.pdf"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000008",
        "title": "Optimization: loss landscapes & stochastic gradient descent",
        "sourceUrls": [
          "https://cs231n.github.io/optimization-1/",
          "https://cs231n.stanford.edu/slides/2026/lecture_3.pdf"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000009",
        "title": "Backpropagation from scratch (NumPy)",
        "sourceUrls": [
          "https://cs231n.github.io/optimization-2/",
          "https://cs231n.stanford.edu/slides/2026/lecture_4.pdf"
        ],
        "videoUrls": [
          "https://cs231n.stanford.edu/slides/2026/lecture_4.pdf",
          "https://www.youtube.com/playlist?list=PLoROMvodv4rOmsNzYBMe0gJY2XS8AQg16"
        ],
        "gate": {
          "question": "You train the network and the loss curve goes DOWN smoothly, then suddenly spikes to NaN at epoch 40. Don't just name a cause — justify from first principles why each of (a) the learning rate, (b) the weight initialization, and (c) the gradient computation could each independently produce this exact NaN spike, and describe the single experiment that would let you discriminate which one it actually was.",
          "rubric": [
            "Derives the gradient of the loss via the chain rule on a small computational graph (the local-gradient x upstream-gradient pattern from the optimization-2 note), not from a memorized formula.",
            "Explains WHY the loss decreases: gradient descent steps the parameters along -grad(L), the direction of steepest local decrease; a small enough step is guaranteed to lower L (first-order Taylor argument).",
            "Articulates the effect of LEARNING RATE: too small -> slow convergence / stuck; too large -> overshoot, oscillation, or divergence (loss goes up / NaN). Connects this to the step-size in the update rule.",
            "Articulates the effect of WEIGHT INITIALIZATION: all-zeros -> symmetry, every neuron gets identical gradients and never differentiates; too-large -> saturated activations and vanishing/exploding gradients. Justifies a calibrated scheme (e.g. small random / variance-preserving).",
            "Distinguishes the FORWARD pass (compute activations + cache intermediates) from the BACKWARD pass (reuse cached values to propagate gradients), and explains why caching is necessary rather than recomputing.",
            "Demonstrates empirically: shows the loss curve actually descending on a real run and ties at least one observed behavior (plateau, oscillation, divergence) back to a specific hyperparameter choice."
          ]
        }
      },
      {
        "id": "cb000000-0000-4000-8000-000000000010",
        "title": "Neural networks I — architecture (neurons, layers, activations)",
        "sourceUrls": [
          "https://cs231n.github.io/neural-networks-1/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000011",
        "title": "Neural networks II — data preprocessing, init, loss functions",
        "sourceUrls": [
          "https://cs231n.github.io/neural-networks-2/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000012",
        "title": "Neural networks III — learning dynamics, LR schedules, evaluation",
        "sourceUrls": [
          "https://cs231n.github.io/neural-networks-3/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000013",
        "title": "Putting it together — minimal 2-layer net case study",
        "sourceUrls": [
          "https://cs231n.github.io/neural-networks-case-study/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000014",
        "title": "Convolutional neural networks: conv & pooling layers",
        "sourceUrls": [
          "https://cs231n.github.io/convolutional-networks/",
          "https://cs231n.stanford.edu/slides/2026/lecture_5.pdf"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000015",
        "title": "Understanding & visualizing CNNs",
        "sourceUrls": [
          "https://cs231n.github.io/understanding-cnn/"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000016",
        "title": "CNN architectures (AlexNet -> ResNet) & transfer learning",
        "sourceUrls": [
          "https://cs231n.github.io/transfer-learning/",
          "https://cs231n.stanford.edu/slides/2026/lecture_6.pdf"
        ]
      },
      {
        "id": "cb000000-0000-4000-8000-000000000017",
        "title": "Domain capstone — FrED Factory closed-loop vision (Dr. Erick Ramirez-Cedillo)",
        "sourceUrls": [
          "https://www.researchgate.net/profile/Erick-Ramirez-Cedillo"
        ]
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
  }
];

const CELL_BY_ID = new Map<string, SpineCell>(SPINES.flatMap((s) => s.cells.map((c) => [c.id, c] as const)));
export function cellById(id: string): SpineCell | null {
  return CELL_BY_ID.get(id) ?? null;
}
