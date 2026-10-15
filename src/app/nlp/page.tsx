import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import NlpAnalyzer from "@/components/nlp/NlpAnalyzer";

export const metadata: Metadata = { title: "NLP Analyzer" };

export default function NlpPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module 4 · Natural language processing"
        title="NLP Analyzer"
        description="Classic text pre-processing for English: tokenization, stop-word removal, Porter stemming and part-of-speech tagging, using NLTK's word tokenizer, English stop-word list, PorterStemmer algorithm and trained POS tagger."
        badges={["Stop words", "Stemming", "POS tagging"]}
      />
      <NlpAnalyzer />
    </>
  );
}
