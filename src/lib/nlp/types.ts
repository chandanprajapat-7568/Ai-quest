/** Response shape of POST /api/nlp/analyze (safe to import from client code). */
export interface NlpAnalysis {
  language: "english";
  operations: string[];
  /** Always present: NLTK-style word tokens (punctuation and contractions such as "n't" are separate tokens). */
  tokens: string[];
  /** Present only when "remove_stopwords" was requested. */
  filtered_tokens?: string[];
  removed_stopwords?: string[];
  /** Present only when "stemming" was requested. */
  stems?: Array<{ token: string; stem: string }>;
  /** Present only when "pos_tag" was requested. */
  pos_tags?: Array<{ token: string; tag: string; description: string }>;
  engine: { nltk_data_version: string; notes: string };
}
