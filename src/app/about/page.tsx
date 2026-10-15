import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Help & About" };

const TOC = [
  ["overview", "What is AI Quest?"],
  ["syllabus", "Syllabus mapping"],
  ["maze", "Maze search algorithms"],
  ["metrics", "What the maze numbers mean"],
  ["jug", "Water Jug problem"],
  ["ttt", "Tic-Tac-Toe and Minimax"],
  ["nlp", "NLP: stop words, stemming, POS tags"],
  ["limits", "Assumptions and limitations"],
  ["api", "API quick reference"],
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Help & About"
        description="Student-friendly explanations of every algorithm in AI Quest, what the numbers mean, and where the limits are."
      />

      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="field-label">On this page</p>
          <ul className="space-y-1 text-sm">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/[0.07] hover:text-white">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="doc min-w-0 max-w-4xl">
          <h2 id="overview">What is AI Quest?</h2>
          <p>
            AI Quest is an interactive AI lab simulator. It combines the search, game-playing and basic NLP experiments from the AI
            Lab syllabus in one app. Each algorithm makes its states, decisions, result and measured work visible, so you can compare
            how the methods behave.
          </p>
          <p>
            It is <strong>classical AI</strong>: search algorithms, a game tree and rule-based text processing that you can trace by
            hand. It is not a chatbot or a large language model. (The POS tagger is a small statistical model trained by the NLTK
            project; everything else is hand-written algorithms.)
          </p>
          <p>
            The app runs locally, needs no login, stores nothing about you and has no database. The algorithms live in plain
            TypeScript modules on the server; the browser only draws the grid, sends requests and animates the answers.
          </p>

          <h2 id="syllabus">Syllabus mapping</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Syllabus concept</th>
                  <th scope="col">AI Quest feature</th>
                  <th scope="col">What the demo shows</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>BFS</td><td>Maze and Water Jug</td><td>Queue-based exploration; shortest path on an unweighted grid</td></tr>
                <tr><td>DFS</td><td>Maze and Water Jug</td><td>Stack-based exploration; finds a path, maybe not the shortest</td></tr>
                <tr><td>Best-First Search</td><td>Maze (Greedy)</td><td>Expands the frontier node with the smallest heuristic h(n)</td></tr>
                <tr><td>A*</td><td>Maze</td><td>f(n) = g(n) + h(n); optimal with Manhattan distance on this grid</td></tr>
                <tr><td>Water Jug problem</td><td>Water Jug module</td><td>States, legal operators, goal test, solution sequence</td></tr>
                <tr><td>Tic-Tac-Toe</td><td>Tic-Tac-Toe module</td><td>Game tree and Minimax decision making</td></tr>
                <tr><td>Remove stop words</td><td>NLP Analyzer</td><td>Tokenization and stop-word filtering</td></tr>
                <tr><td>Stemming</td><td>NLP Analyzer</td><td>Porter stemming, before and after</td></tr>
                <tr><td>POS tagging</td><td>NLP Analyzer</td><td>Part-of-speech tags with readable descriptions</td></tr>
              </tbody>
            </table>
          </div>

          <h2 id="maze">Maze search algorithms</h2>
          <p>
            The maze is a grid of open cells and walls. You can move up, right, down or left (no diagonals), and every move costs 1.
            When several neighbours are available the code always looks at them in the order <strong>up, right, down, left</strong>,
            which is why results are repeatable.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Algorithm</th>
                  <th scope="col">Frontier</th>
                  <th scope="col">Picks next</th>
                  <th scope="col">Shortest path?</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>BFS</td><td>FIFO queue</td><td>The oldest waiting cell</td><td>Yes: every move costs 1 and BFS goes level by level</td></tr>
                <tr><td>DFS</td><td>LIFO stack</td><td>The newest waiting cell</td><td>No. It finds a path but can wander a long way</td></tr>
                <tr><td>Greedy Best-First</td><td>Priority queue on h(n)</td><td>Smallest distance-to-goal estimate</td><td>No. It ignores the cost already paid</td></tr>
                <tr><td>A*</td><td>Priority queue on f(n)</td><td>Smallest g(n) + h(n)</td><td>Yes. Manhattan distance is admissible and consistent here</td></tr>
              </tbody>
            </table>
          </div>
          <h3>Details worth knowing</h3>
          <ul>
            <li><strong>BFS</strong> marks a cell as discovered the moment it is put in the queue, so no cell is queued twice. Parent links rebuild the path.</li>
            <li><strong>DFS</strong> may push the same cell more than once, but only expands it once. It prefers up, then right, down, left. Change that order and you would get a different path.</li>
            <li><strong>Greedy</strong> uses only h(n) = |row − goal row| + |col − goal col|. It can walk into a dead end that <em>looks</em> close to the goal.</li>
            <li>
              <strong>A*</strong> keeps g(n) (moves so far). If a cheaper route to a waiting cell appears, it updates the cell and adds a new queue entry; the older entry is
              skipped when it comes up (&quot;lazy deletion&quot;). Because Manhattan distance is consistent, a cell that has been expanded never needs to be reopened.
            </li>
            <li>All four check for the goal when a cell is <em>expanded</em>, so the goal is always the last cell in the expansion order.</li>
          </ul>

          <h2 id="metrics">What the maze numbers mean</h2>
          <ul>
            <li><strong>Path length</strong>: number of moves on the final path. Start = goal gives 0 moves.</li>
            <li><strong>Expanded nodes</strong>: cells removed from the frontier and processed. The purple cells, in replay order.</li>
            <li><strong>Discovered nodes</strong>: unique open cells that were ever added to the frontier, including the start. The cyan cells left over at the end were discovered but never expanded.</li>
            <li><strong>Algorithm time</strong>: measured on the server with <code>performance.now()</code> around the search and path rebuild only. It excludes network and drawing. For small mazes it is a fraction of a millisecond and changes between runs, so do not treat it as a benchmark.</li>
          </ul>
          <p>
            The animation replays the expansion order returned by the server. Only after that does the yellow final path appear on
            top. The path is never confused with the traversal.
          </p>

          <h2 id="jug">Water Jug problem</h2>
          <p>
            A <strong>state</strong> is the pair (A, B): litres in each jug, starting from (0, 0). The <strong>operators</strong> are
            fill A, fill B, empty A, empty B, pour A into B and pour B into A. States are the nodes of a graph and legal operators are
            its edges. The <strong>goal test</strong> is: either jug holds exactly the goal amount.
          </p>
          <ul>
            <li>BFS returns a solution with the fewest actions. DFS returns some solution, often longer.</li>
            <li>Capacities are limited to 1–20 L, and the goal cannot exceed the larger jug.</li>
            <li>If the goal is not a multiple of gcd(A, B), no solution exists (for example 4 L and 6 L can only measure even amounts). The solver proves this by exhausting every reachable state.</li>
          </ul>

          <h2 id="ttt">Tic-Tac-Toe and Minimax</h2>
          <p>
            You play X and move first; the computer plays O. The server checks every move, rejects illegal ones and decides the
            outcome; the browser never claims a winner.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th scope="col">Level</th><th scope="col">What the computer really does</th></tr>
              </thead>
              <tbody>
                <tr><td>Easy</td><td>Plays a random legal square.</td></tr>
                <tr><td>Normal</td><td>Takes a winning square if available, otherwise blocks yours, otherwise plays a random legal square. Only looks one move ahead, so a fork beats it.</td></tr>
                <tr><td>Hard</td><td>Full Minimax over the whole game tree (no pruning, no depth limit). You cannot beat it; the best result is a draw.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            <strong>Minimax</strong> imagines all future move sequences. It assumes O picks the highest score and X picks the lowest.
            Terminal scores are O wins = 10 − depth, X wins = depth − 10, draw = 0, so faster wins and slower losses are preferred.
            After each Hard move the app shows the score of every candidate square and how many positions were evaluated.
          </p>

          <h2 id="nlp">NLP: stop words, stemming, POS tags</h2>
          <ul>
            <li><strong>Tokenization</strong> splits text into words and punctuation. Contractions split like NLTK does: <code>didn&apos;t</code> → <code>did</code>, <code>n&apos;t</code>.</li>
            <li><strong>Stop words</strong> are very frequent words (the, are, and) that are often filtered out. Whether to remove them depends on the task. AI Quest uses NLTK&apos;s English list (198 words in NLTK 3.10.3), matched case-insensitively.</li>
            <li><strong>Stemming</strong> reduces a word to a stem by rules (Porter algorithm). Stems need not be real words: <em>quickly → quickli</em>, <em>studies → studi</em>. This is <strong>not lemmatization</strong>, which uses a dictionary.</li>
            <li><strong>POS tagging</strong> labels each token as noun, verb, adjective and so on (Penn Treebank tags such as NN, VBZ, JJ). It is done on the full token list because a tagger needs surrounding words as context; that is why tagging happens before stop words are removed.</li>
          </ul>
          <h3>How NLTK is used</h3>
          <p>
            This version of AI Quest runs on Node.js, which cannot import Python&apos;s NLTK directly. So it uses NLTK&apos;s own data (the English stop-word list and
            the trained <code>averaged_perceptron_tagger_eng</code> model, exported to <code>data/nltk/</code>) together with TypeScript ports of NLTK&apos;s
            tokenizer, PorterStemmer and perceptron tagger. The ports were checked against real NLTK 3.10.3: identical stems on 12,201 words, and identical tokens and
            POS tags on the sample sentences in <code>tests/verify.ts</code>. If a data file is missing, the app shows an error naming the resource and the exact fix; it never invents results.
          </p>

          <h2 id="limits">Assumptions and limitations</h2>
          <ul>
            <li>Mazes are limited to 30 × 30 cells (the editor offers 5–30). Movement is 4-directional with cost 1.</li>
            <li>Water Jug capacities are limited to 1–20 L.</li>
            <li>NLP is English only and limited to 5,000 characters. Sentence splitting is a simplified rule-based splitter, not NLTK&apos;s trained Punkt model, so unusual abbreviations may split differently.</li>
            <li>Timings are for teaching, not for scientific benchmarking.</li>
            <li>Nothing is saved: reloading the page clears the maze, the game score and all results.</li>
          </ul>

          <h2 id="api">API quick reference</h2>
          <p>All endpoints accept and return JSON. Bad input returns HTTP 400 with <code>{`{"error":{"code":"INVALID_REQUEST","message":"..."}}`}</code>. Full details are in the README.</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th scope="col">Endpoint</th><th scope="col">Purpose</th></tr>
              </thead>
              <tbody>
                <tr><td><code>GET /api/health</code></td><td>Returns <code>{`{"ok":true,"app":"AI Quest"}`}</code></td></tr>
                <tr><td><code>POST /api/maze/solve</code></td><td>Run BFS, DFS, Greedy or A* on a grid</td></tr>
                <tr><td><code>POST /api/water-jug/solve</code></td><td>Solve a Water Jug instance with BFS or DFS</td></tr>
                <tr><td><code>POST /api/tictactoe/move</code></td><td>Apply the human move, then the computer reply</td></tr>
                <tr><td><code>POST /api/nlp/analyze</code></td><td>Tokens plus the requested NLP operations</td></tr>
              </tbody>
            </table>
          </div>

          <p className="mt-10">
            <Link href="/" className="btn btn-primary">
              Back to the dashboard
            </Link>
          </p>
        </article>
      </div>
    </>
  );
}
