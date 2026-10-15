"""
Export the NLTK resources that AI Quest needs into ./data/nltk as plain JSON.

Why does this script exist?
    AI Quest runs on Node.js (Next.js), so it cannot import Python's NLTK directly.
    Instead, we copy NLTK's *trained data* (stop-word list + averaged-perceptron
    POS-tagger model) into JSON files that the TypeScript code loads at runtime.
    The algorithms that use the data are ported to TypeScript (src/lib/nlp/).

When do I need to run it?
    Only if the files in data/nltk/ are missing or you want to refresh them from
    a newer NLTK release. The repository already ships with the exported files.

How to run it (needs Python 3 + NLTK, NOT needed to run the web app):
    pip install nltk
    python scripts/export_nltk_data.py

Resources used (names as in the NLTK downloader):
    stopwords                        -> corpora/stopwords/english
    averaged_perceptron_tagger_eng   -> taggers/averaged_perceptron_tagger_eng
"""

import json
import os
import sys

try:
    import nltk
except ImportError:
    sys.exit("NLTK is not installed. Run:  pip install nltk")

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "nltk")
os.makedirs(OUT_DIR, exist_ok=True)

for resource in ("stopwords", "averaged_perceptron_tagger_eng"):
    if not nltk.download(resource, quiet=True):
        sys.exit(f"Could not download NLTK resource '{resource}'. Check your internet connection.")

from nltk.corpus import stopwords  # noqa: E402  (import after download)
from nltk.tag import PerceptronTagger  # noqa: E402

# 1) Stop words ----------------------------------------------------------------
english_stopwords = list(stopwords.words("english"))
with open(os.path.join(OUT_DIR, "stopwords.english.json"), "w", encoding="utf-8") as f:
    json.dump(english_stopwords, f)

# 2) POS tagger model -----------------------------------------------------------
tagger = PerceptronTagger(load=True, lang="eng")
weights, tagdict, classes = tagger.encode_json_obj()
prefix = "averaged_perceptron_tagger_eng"
with open(os.path.join(OUT_DIR, f"{prefix}.weights.json"), "w", encoding="utf-8") as f:
    json.dump(weights, f, separators=(",", ":"))
with open(os.path.join(OUT_DIR, f"{prefix}.tagdict.json"), "w", encoding="utf-8") as f:
    json.dump(tagdict, f, separators=(",", ":"))
with open(os.path.join(OUT_DIR, f"{prefix}.classes.json"), "w", encoding="utf-8") as f:
    json.dump(sorted(classes), f)

# 3) Manifest (documents where the data came from) ---------------------------------
with open(os.path.join(OUT_DIR, "MANIFEST.json"), "w", encoding="utf-8") as f:
    json.dump(
        {
            "nltk_version": nltk.__version__,
            "resources": {
                "stopwords": {"file": "stopwords.english.json", "count": len(english_stopwords)},
                "averaged_perceptron_tagger_eng": {
                    "files": [
                        f"{prefix}.weights.json",
                        f"{prefix}.tagdict.json",
                        f"{prefix}.classes.json",
                    ],
                    "tagset": "Penn Treebank",
                },
            },
        },
        f,
        indent=2,
    )

print(f"Exported NLTK {nltk.__version__} data to {os.path.abspath(OUT_DIR)}")
print(f"  stop words: {len(english_stopwords)}  |  tagger classes: {len(classes)}  |  tagdict words: {len(tagdict)}")
