<!-- path: instructions.md -->
# Install: subject sets + custom test builder

## What is new

- **Practice page** (`practice.html`, linked from the home page nav, hero and two cards):
  - **By subject**: every subject (English, Pak Affairs, Islamic Studies, Current Affairs, Science, Geography, Maths, Reasoning, IT) at each level, in sets of about 50 questions. 84 sets per level, every question used once.
  - **Build your own**: pick the level (or Mixed), the subjects, and the length (5 to 200). Mix is either "like the real paper" or equal per subject. Every start is a fresh random draw. A started custom test can be resumed from the same page.
- Pass mark is 33% of the length (rounded to 0.5), time is 1 minute a question. Full tests are unchanged (66 net, 200 min).
- Results, history, PDF and email work the same. The home "Recent tests" table now shows each row's own pass mark. Level progress on the home page still counts full tests only.
- New generated folder `data/pool/` (27 files). `build.py` writes it.

## Install

1. Unzip over your repo working copy. **Keep your own `assets/firebase-config.js`** (the zip does not contain it).
2. Rebuild:
   ```
   python3 tools/build.py
   ```
   Expect `12600 questions, easy: 21/21 tests, ...` and a `data/pool/` folder with 27 files.
3. Commit and push.
4. **Apps Script mailer (do this or subject and custom reports will not be emailed):**
   open your script, replace the contents of `Code.gs` with `backend/Code.gs`, then Deploy > Manage deployments > edit (pencil) > Version: **New version** > Deploy. The web app URL stays the same.
   Until you do, full tests email as before. Subject sets and custom tests show "needs the updated mailer", the result is still saved and the PDF can still be downloaded. The site checks this by itself, so the old script can never send a wrong "/ 200" email.

## No change needed

- **Firestore rules**: unchanged. Subject sets save as test ids 72 to 98 and custom tests as 99, inside the existing 1 to 99 rule.
- `assets/firebase-config.js`, Firebase Auth, GitHub Pages settings.

## Good to know

- A subject set is the same questions every time (Set 03 of Maths Hard is always the same 49). A custom test is random, but its link keeps the same questions, so reopening it resumes it.
- Set sizes are 49 to 52, not exactly 50, so every question lands in exactly one set.
- History for sets and custom tests is listed under "Recent tests" by title. Custom tests cannot be reopened from history (they are random); build a new one.
- Settings you can change in `data/config.json` (then rerun `build.py`): `practice.setSize`, each section's `short` name and `w` (weight for the "like the real paper" mix).

## Known limits

- Questions are the same bank as before; the earlier notes about review method, heuristic repeat check and rule-assigned topic tags still apply.
- Current affairs: re-check anything dated before Sat 28 Nov 2026.
