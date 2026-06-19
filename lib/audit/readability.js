'use strict';

/**
 * Lightweight readability calculator (Flesch Reading Ease + Flesch-Kincaid
 * grade level -> approximate reading age). No external dependencies.
 */

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  // Strip silent endings.
  const trimmed = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");

  const matches = trimmed.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

function calculateReadability(text) {
  if (!text || text.trim().length < 50) {
    return { age: null, easeScore: null, grammarErrors: null };
  }

  // Sentences: split on terminal punctuation; require at least 3 words.
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);

  if (sentences.length === 0) {
    return { age: null, easeScore: null, grammarErrors: null };
  }

  const words = (text.match(/\b[a-z][a-z']*\b/gi) || []).map((w) => w.toLowerCase());
  if (words.length < 30) {
    return { age: null, easeScore: null, grammarErrors: null };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = totalSyllables / words.length;

  // Flesch Reading Ease: 0-100, higher = easier.
  const ease = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  // Flesch-Kincaid grade level -> approximate reading age (US grade + 5).
  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const age = Math.max(5, Math.round(grade + 5));

  return {
    age,
    easeScore: Math.max(0, Math.min(100, Math.round(ease))),
    grammarErrors: null, // We don't run a grammar checker yet.
  };
}

module.exports = { calculateReadability };
