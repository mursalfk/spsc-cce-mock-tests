# data/

`questions.csv` is the only file you edit. Everything else here is generated.

## Columns (UTF-8, header row required)

| Column | Meaning |
|--------|---------|
| `qid` | Unique id, for example `H07-123` |
| `level` | `easy`, `medium` or `hard` |
| `test` | Test number inside the level, 1 to 21 |
| `section` | `ENG`, `PA`, `IS`, `CA`, `ES`, `WG`, `MTH`, `RSN` or `IT` |
| `question` | Question text. A line break inside the cell is fine |
| `option_a` to `option_d` | Four distinct, non-empty options |
| `answer` | `A`, `B`, `C` or `D` |
| `explanation` | Required for every question. Shown on request and in the review |
| `topic` | Broad theme inside the section, for example `Constitution and governance`. Required |
| `subtopic` | Specific area, for example `Articles of the 1973 Constitution`. Required. Drives the topics page |

## Rules the build enforces

- A test is built only if it has exactly 200 valid rows. Otherwise it is reported and skipped.
- Per test: ENG 40, PA 26, IS 26, CA 24, ES 32, WG 14, MTH 14, RSN 12, IT 12.
- No duplicate `qid`. No duplicate question with the same correct answer inside a level.
- If the right answer is "None of these", the explanation must say why.
- `topic` and `subtopic` must be filled in. `data/topics.json` (the topics page) is generated from them.

## Workflow

```
# edit questions.csv in Excel, LibreOffice or a text editor (save as CSV UTF-8)
python tools/build.py --check     # validate only
python tools/build.py             # validate and regenerate data/catalog.json, data/topics.json, data/tests/*.json and data/pool/*.json
git add -A
git commit -m "Fix Hard 07 Q123"
git push
```

`python tools/build.py --xlsx` also writes `questions.xlsx` for easier browsing (needs `pip install openpyxl`). Edit the CSV, not the xlsx.

## Settings

`config.json` holds the exam date, marking, level names and notes, test counts per level, and the section order. Change a level's `tests` count and its `idBase` only together with the Firestore and email logic that read the test id.
