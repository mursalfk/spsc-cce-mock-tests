# SPSC CCE-2026 Screening Test: Mock Test Pack

21 full-length mock tests, 200 MCQs each (4,200 different questions), written to the SPSC marking scheme. Companion to the 21-day plan.

## No repeated questions (version 2 of this pack)

The first version of this pack reused the same facts across tests. This version fixes that. Every test has its own 200 questions, and no fact is asked twice anywhere in the 21 tests, not even re-worded or reversed (for example, "capital of X" in one test and "which country has the capital Y" in another).

- **Delete the old files.** Do not mix old and new tests. Test numbers are the same, but the questions are different.
- **Progress from the old files does not carry over.** Scores now live under your account, so old browser-only scores will not appear.
- **How it was checked:** exact repeats are zero. A fuzzy check for re-worded repeats also ran across all 4,200 questions. The checker may still miss an unusual re-wording, and it flags look-alike template questions (two countries and their continents, say) that are in fact different facts. Spelling and grammar stems such as "Choose the correctly spelled word" recur by design, with different words each time.
- If you spot the same fact twice, tell me the two test and question numbers and I will replace one.

## Open and run

1. Open the website: <https://mursalfk.github.io/spsc-cce-mock-tests/>. Anyone can browse the test list.
2. **Log in or create an account** to attempt a test (email and password, or Google). Verify your email once.
3. Pick a test. After every finished test a PDF report is emailed to you.

Site owner: see `instructions.md` for the one-time setup (Firebase, email sender, GitHub Pages).

## Marking (same as the advertisement)

| Rule | Value |
|---|---|
| Questions | 200 MCQs, one mark each |
| Wrong answer | −0.25 |
| Unanswered | 0 |
| Pass mark | 66 net (33% of 200) |
| Time | 200 minutes |
| Net score | correct − 0.25 × wrong |

A blind guess among 4 options is worth +0.06 on average, so guessing pays only after you eliminate at least one option. A random guess on all 200 questions will not get you near 66.

## Paper blueprint (identical in every test)

| Section | Qs |
|---|---|
| English | 40 |
| Pakistan Affairs and Sindh | 26 |
| Islamic Studies | 26 |
| Current Affairs | 24 |
| Everyday Science | 32 |
| World Geography and Celestial Bodies | 14 |
| Mathematics | 14 |
| Reasoning | 12 |
| Digital Literacy and IT | 12 |

## How a test works

- **One question per screen**, like the computer-based test. Use the question list (grid icon) to jump anywhere, **Mark for later** to flag a question, **Skip** to move on and come back.
- **Instant feedback**: tap an answer and it shows green (right, +1) or red (wrong, −0.25) at once, with the correct answer. The answer then **locks**, so decide before you tap. Skipped questions score 0.
- **Explanation button**: optional and hidden until you press it (or press **E**). Factual questions give the fact in one sentence; Maths and Reasoning show the working.
- **Clock**: counts up by default. Tick "Use the 200-minute countdown" on the start screen for exam conditions; the test then finishes by itself at zero. Time counts only while the page is open and visible.
- **Finish** any time. You get the net score, a pass or fail line, a section table, a guess audit and a full review (wrong, skipped, marked, right, all). The result is saved to your account and a **detailed PDF report is emailed to you**. You can also download the PDF or email it again from the result page.
- **Flashcards**: question on the front, answer and note on the back. After a test, "Flashcards: missed + skipped" builds a deck from your errors.
- **Display**: the **Aa** button picks a style (Swiss, Blueprint, Glass, Deco, Vapor) and the text size. Swiss suits daylight; Glass and Deco are easiest on the eyes at night.
- **Keyboard**: 1 to 4 or A to D answer, arrows or N / P move, E explanation, M mark.

## How to use it with the 21-day plan

1. One test per day, in one sitting. For the real thing, switch on the 200-minute countdown: no phone, no looking things up.
2. Straight after: read the section table, then review every wrong and skipped item. Run the missed-and-skipped flashcards once.
3. Next morning: 15 minutes of flashcards on yesterday's misses before the new test.
4. Watch the guess audit. If wrong answers cost you more than 10 marks, you are guessing too freely.
5. Target a rising net score, not one lucky day. Aim for 90 or more net before 28 Nov to leave a margin over 66.

## Your progress

Every user has a separate record. Finished **tests** are saved to your account (score, right, wrong, skipped, section split, time used), so they follow you across phone and laptop. The home page shows your attempts, best and average net, and the last score on each test card. Flashcards are not scored. In-progress answers are kept in the browser under your account, so a second user on the same device does not see yours. "Reset this test" wipes only your copy of that test.

## Caveats you should know about

- **Option count**: I assumed 4 options (A to D) per question. The exact 2026 paper layout is not confirmed. If the real paper shows 5 options, the arithmetic of guessing changes slightly; the marking rule does not.
- **Section split is an estimate**: it is based on recalled past papers and third-party reports, not an official SPSC blueprint. Treat the proportions as a guide.
- **Original questions**: all questions were written for this pack. None are copied from past papers or books.
- **"None of these" options**: from Test 4 onward, about 10% of items replace an option with "None of these" (sometimes it is the right answer, which the explanation then states). Real papers do this. Tests 1 to 3 have none, so the format starts gentle.
- **Current Affairs is dated**: facts are as of about 7 Nov 2026. Office-holders, sports results and anything with "currently" in the stem can change. Re-check the current-affairs sections of your notes in the last week before 28 Nov 2026. Facts on which sources disagreed were left out.
- **Errors**: with 4,200 questions, a few will be wrong or arguable. Tell me the test number and question number and I will fix it and re-issue the file.

## Files

- `index.html`: public test list; shows your progress after login
- `about.html`: the About page
- `SPSC_CCE_Mock_01.html` to `SPSC_CCE_Mock_21.html`: the tests
- `assets/`: login, PDF report and Firebase config
- `backend/Code.gs`: the email sender (Google Apps Script)
- `firestore.rules`: database rules
- `instructions.md`: setup guide for the site owner
- `STUDY_GUIDE.md`: this file
