---
name: india-compliance
description: >-
  Checks Naarad's eligibility and sequencing for Startup India Seed Fund and
  TANSEED, with each rule tied to the official text or marked unverified. Use
  when the user asks "are we eligible", "which grant first", "will TANSEED
  break the Seed Fund cap", or before any compliance check for gate G1.
---

# india-compliance

Scope today: **funding eligibility and stacking only.** DPDP duties, ASI and site
permissions, and GST/TDS are not covered yet; do not answer them from this file.

**Rules change. Read the official page before acting, and put the date you read
it in the decision log.** Nothing below replaces asking DPIIT, the incubator and
StartupTN.

## Startup India Seed Fund Scheme (SISFS)

Source read in full on 2026-10-26: *Guidelines for Startup India Seed Fund
Scheme*, Ministry of Commerce and Industry, DPIIT (14 pages),
https://www.startupindia.gov.in/content/dam/invest-india/Templates/public/Guidelines%20for%20Startup%20India%20Seed%20Fund%20Scheme.pdf

| Rule (paraphrased from the guidelines) | Where |
|---|---|
| The startup must be recognised by DPIIT and incorporated not more than 2 years before it applies | para 3.1, item 1 |
| It must not have received more than Rs 10 lakh of monetary support under any other Central or State Government scheme. Prize money from competitions and grand challenges, subsidised workspace, founder monthly allowance, and access to labs or prototyping facilities do not count | para 3.1, item 5 |
| Indian promoters must hold at least 51% when applying to the incubator | para 3.1, item 6 |
| A startup receives each kind of seed support at most once | para 3.1, item 7 |
| Money goes to the startup through a selected incubator: up to Rs 20 lakh as a milestone-based grant for proof of concept, prototype or product trials, and up to Rs 50 lakh of investment through convertible debentures or debt-linked instruments | para 8.1 |
| Seed fund must not be used to create facilities | para 8.1, item 3 |

The guidelines I read do not state whether the scheme is open to new applicants
today. Check the Startup India portal for the current window.

## TANSEED (StartupTN)

**Unverified.** I found only secondary sources (news and grant-aggregator pages),
not StartupTN's own page. Read as: round 8.0 offered a support equity-linked
grant of up to Rs 15 lakh for green technology, rural impact and women-led
startups and up to Rs 10 lakh for other sectors, took a 3% stake, and needed a
Tamil Nadu registered, StartupTN-enrolled, DPIIT-recognised startup; applications
ran 6 to 20 December 2025, so that round is closed. Confirm all of it, and the
rules of the next round, at https://startuptn.in before relying on any figure.

## Stacking: what follows from the text

1. A TANSEED award is monetary support under a State Government scheme, so it
   counts toward the SISFS limit of Rs 10 lakh from other schemes (item 5).
2. If TANSEED is received first and is **above Rs 10 lakh**, the startup fails
   that SISFS test. At exactly Rs 10 lakh or below it does not, by the wording
   "not more than". This is why the order matters.
3. SISFS first, then TANSEED, avoids the SISFS test. It does **not** settle
   whether TANSEED has its own limit on prior government funding. **Open
   question for StartupTN:** does an SISFS grant disqualify, reduce or delay a
   TANSEED award?
4. Whether equity-linked support such as TANSEED's counts as "monetary support"
   in the same way as a grant is a question for DPIIT and the incubator, not
   for this file.

## Before you call it "passed" for G1

Set `compliance.status: "passed"` on an opportunity only when you have, for the
specific activity it needs: the official text read and dated, the open questions
above answered in writing by the body concerned, and the decision logged with
`gate: "G1"`. A search result or this file is not a pass.
