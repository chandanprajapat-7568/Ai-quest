"""
Generate tests/fixtures/nltk_reference.json from a real NLTK installation.

The Node.js test-suite (tests/verify.ts) compares AI Quest's TypeScript NLP pipeline
against these reference outputs, so we can prove the port matches NLTK.

Usage (needs Python 3 + NLTK + resources downloaded by export_nltk_data.py):
    python scripts/make_nltk_reference.py
"""

import json
import os
import sys

try:
    import nltk
    from nltk.stem import PorterStemmer
except ImportError:
    sys.exit("NLTK is not installed. Run:  pip install nltk")

for resource in ("punkt_tab", "averaged_perceptron_tagger_eng", "stopwords"):
    nltk.download(resource, quiet=True)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

SENTENCES = [
    "The cats are running quickly.",
    "She didn't like the loud music, but he did!",
    "Dogs bark and birds sing in the beautiful garden.",
    "Time flies like an arrow",
    "I can't believe it's already 2024; we've got so much to do.",
    "Dr. Smith went to Washington. He arrived on Monday.",
    "\"Where are you going?\" she asked. \"Home,\" he said.",
    "The quick brown fox jumps over the lazy dog.",
    "Students are studying artificial intelligence and machine learning algorithms.",
    "Well-known researchers (like Turing) wrote about thinking machines.",
    "It costs $3.88, roughly 3,36 euros in New York.",
    "They cannot gonna wanna stop; gimme more!",
    "Breadth-first search explores the shallowest nodes first.",
    "A* search uses the heuristic function h(n) plus the path cost g(n).",
    "He said: 'I'm happy', and they're leaving.",
    "Running, jumping, and swimming are healthy activities.",
    "Wait... what happened to the 3 apples?",
    "",
]

tagdict = json.load(
    open(os.path.join(ROOT, "data", "nltk", "averaged_perceptron_tagger_eng.tagdict.json"), encoding="utf-8")
)

ps = PorterStemmer()
stem_words = sorted(tagdict.keys())
extra = ["running", "quickly", "studies", "happily", "generalization", "caresses", "ponies", "flies",
         "beautiful", "algorithms", "intelligence", "learning", "explores", "shallowest", "cannot"]
stem_words = sorted(set(stem_words + extra))

cases = []
for text in SENTENCES:
    tokens = nltk.word_tokenize(text)
    cases.append({"text": text, "tokens": tokens, "pos": [list(t) for t in nltk.pos_tag(tokens)]})

out = {
    "nltk_version": nltk.__version__,
    "cases": cases,
    "stems": {w: ps.stem(w) for w in stem_words},
}
os.makedirs(os.path.join(ROOT, "tests", "fixtures"), exist_ok=True)
with open(os.path.join(ROOT, "tests", "fixtures", "nltk_reference.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote reference for {len(cases)} sentences and {len(stem_words)} stems (NLTK {nltk.__version__}).")
