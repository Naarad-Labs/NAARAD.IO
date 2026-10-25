---
name: mom-test-script
description: >-
  Writes and checks customer-discovery interview guides that ask about the
  past, not a product that does not exist. Use when the user says "interview
  guide", "write questions for", "Mom Test", "customer discovery script", or
  before the founder talks to a tourism board, temple trust or CSR team.
---

# mom-test-script

Guides live in `ops/interviews/`. `node scripts/ops.mjs lint-guide <file>...`
checks them, and CI runs it on every guide.

## The rule

**Ask about their past and present, never about a product.** "Would you use an
audio guide?" gets a polite yes, which is opinion (T0) and worth nothing. "Tell
me about the last time a visitor couldn't find the entrance" gets a story, and
a story can be a T2.

## What a guide contains

1. **Who this is for** and **Before you start**: listen, write their exact words,
   no names in notes, 30 minutes.
2. **Opening:** say who you are and that you are researching how heritage
   visitor experience is run. Be honest about why you are asking; do not pitch
   or describe a product.
3. **Questions:** 8 or more, numbered, one per line, in this order: their role
   and day; the last time the problem happened; what they did; what it cost;
   who else was involved; how they decided; what they tried before; what got in
   the way; how they pay; how a new supplier is approved; who must say yes.
4. **Commitments to ask for:** a dated follow-up, an introduction to the person
   who decides, sight of a real document (a budget line, a tender), a small paid
   or signed pilot. Ask for at least one before the call ends. A conversation
   with no ask is a compliment, not evidence.
5. **Coding the answers:** how to turn what they said into tiers (see
   `switch-interview`).
6. **Do not:** pitch, ask for opinions, ask about the future, take compliments
   as evidence. This is the one section allowed to quote the bad questions.

## The check

`lint-guide` rejects a question that says "would you", "will you", "do you
think", "do you like/want/need", "how much would", "if we", "what if", "in the
future", or names a product or Naarad. It also needs at least 8 questions, a
"Commitments to ask for" section, and no phone numbers, emails or keys.

A pass means the guide is not leading. It does not mean the guide is good. Read
it as the person on the other end would.

## Drafting with a free model

A guide can be drafted through the FreeLLMAPI gateway: send the lint rules in
the prompt, lint the reply, and send the errors back for a rewrite. Whatever it
returns, read every question yourself before it goes in `ops/interviews/`, and
keep real names, places and numbers out: the repository is public.
