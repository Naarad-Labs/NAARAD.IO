"""Mock Cultural Graph DB: entity matching, prompt context and offline retrieval.

Matching is deterministic and runs without the network, so the publish gate
and the Q&A fallback still work when Sarvam cannot be reached.
"""

import json
import re

# Split on whitespace and punctuation only. Python's \w does not treat Indic
# vowel signs as word characters, so \w+ would cut Tamil words apart.
_TOKEN_SPLIT = re.compile(r"[\s.,!?;:\"'()\[\]{}।॥\-–—/]+")
_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "it", "its", "this", "that", "of", "in", "on",
    "to", "and", "or", "for", "with", "by", "at", "as", "be", "do", "does", "did", "why", "how",
    "what", "who", "when", "where", "which", "true", "there", "they", "you", "i", "me", "my",
}


class CulturalGraph:
    def __init__(self, data):
        self.stops = {stop["id"]: stop for stop in data["stops"]}

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as fh:
            return cls(json.load(fh))

    def stop(self, stop_id=None):
        if stop_id is None:
            return next(iter(self.stops.values()))
        if stop_id not in self.stops:
            raise KeyError(f"Unknown stop '{stop_id}'")
        return self.stops[stop_id]


def _alias_pattern(alias):
    if alias.isascii():
        return re.compile(r"(?<![A-Za-z])" + re.escape(alias) + r"(?![A-Za-z])", re.IGNORECASE)
    return re.compile(re.escape(alias))


def find_entities(stop, text):
    """Return graph entities mentioned in text, with the aliases that matched."""
    found = []
    for entity in stop["entities"]:
        matched = []
        for aliases in entity["aliases"].values():
            for alias in aliases:
                if alias not in matched and _alias_pattern(alias).search(text):
                    matched.append(alias)
        if matched:
            found.append({"id": entity["id"], "type": entity["type"], "matched": matched})
    return found


def entity_label(entity, language="en-IN"):
    aliases = entity["aliases"]
    return (aliases.get(language) or aliases["en-IN"])[0]


def fact_text(fact, language="en-IN"):
    return fact["text"].get(language) or fact["text"]["en-IN"]


def prompt_context(stop):
    """Compact English context block for Sarvam prompts (~1.5K tokens at most)."""
    lines = [f"Stop: {stop['title']['en-IN']}, {stop['place']}", "Facts:"]
    for fact in stop["facts"]:
        lines.append(f"[{fact['id']}] ({fact['confidence']}) {fact['text']['en-IN']}")
    lines.append("Entities:")
    for entity in stop["entities"]:
        names = [a for aliases in entity["aliases"].values() for a in aliases[:2]]
        lines.append(f"- {entity['id']} ({entity['type']}): {', '.join(names)}")
    return "\n".join(lines)


def _tokens(text):
    return {t for t in _TOKEN_SPLIT.split(text.lower()) if len(t) > 2 and t not in _STOPWORDS}


def retrieve_facts(stop, question, k=2):
    """Rank facts by entity mentions and word overlap with the question."""
    question_entities = {e["id"] for e in find_entities(stop, question)}
    question_tokens = _tokens(question)
    scored = []
    for fact in stop["facts"]:
        score = 3 * len(question_entities & set(fact["entities"]))
        fact_tokens = set()
        for text in fact["text"].values():
            fact_tokens |= _tokens(text)
        score += len(question_tokens & fact_tokens)
        if fact["confidence"] == "myth" and question_entities & set(fact["entities"]):
            score += 1  # myth-busting facts answer the "is it true…" questions
        if score > 0:
            scored.append((score, fact))
    scored.sort(key=lambda pair: -pair[0])
    return [fact for _, fact in scored[:k]]
