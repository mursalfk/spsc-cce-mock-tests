<!-- path: instructions.md -->
# Install: questions update (Easy / Medium / Hard shifted, topics page)

## What changed

- **Levels shifted one notch up.**
  - New **Easy** = former Medium content.
  - New **Medium** = former Hard content.
  - New **Hard** = about 4,200 newly written, harder questions.
  - Former Easy content is dropped.
- **Test ids and keys are unchanged** (easy 1–21, medium 22–42, hard 51–71). Saved attempts and history in Firestore therefore point at the *new* content under the same test number. Old scores stay valid as scores but no longer match the questions they were taken on. Wipe attempts if that matters.
- **No repeated questions** inside a level (same question, even reworded). Facts may repeat in different questions.
- **New page `topics.html`**: every topic and subtopic with question counts, per level, all tests or a single test, with a filter. Linked from `about.html` and the home footer.
- `data/questions.csv` has two new columns, `topic` and `subtopic` (required). `data/topics.json` is generated.
- 12,600 questions, 63 tests of 200.

## Install

1. Unzip over your repo working copy. **Keep your own `assets/firebase-config.js`** (the zip does not contain it).
2. Rebuild the data:
   ```
   python3 tools/build.py
   ```
   Expect: `12600 questions, easy: 21/21 tests, medium: 21/21 tests, hard: 21/21 tests`.
3. Commit and push. GitHub Pages redeploys.

No Firestore rule, Apps Script, or Firebase change is needed.

## Editing questions later

Edit `data/questions.csv`, run `python3 tools/build.py --check` to validate, then `python3 tools/build.py`. Columns: `qid, level, test, section, question, option_a..option_d, answer, explanation, topic, subtopic`. `test` must equal the number in `qid`.

## Known limits

- Review was a sampled read plus targeted web checks, not a web search of all 12,600. Maths, reasoning, spelling and calculation families are code-verified.
- The no-repeat check is heuristic (similarity based), not a proof.
- Topic tags on the former Easy/Medium rows are rule-assigned; a few may sit under the wrong subtopic.
- Current affairs: re-check anything dated before Sat 28 Nov 2026.
- Mixed 4/5-option papers are not implemented.
