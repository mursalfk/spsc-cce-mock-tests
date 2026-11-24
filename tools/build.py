#!/usr/bin/env python3
"""Compile data/questions.csv into the JSON the site loads.

    python tools/build.py            validate + write data/catalog.json, data/topics.json and data/tests/*.json
    python tools/build.py --check    validate only (writes nothing)
    python tools/build.py --xlsx     also write data/questions.xlsx (needs: pip install openpyxl)

A test is built only when it has exactly 200 valid questions. Anything else is reported and skipped.
"""
import csv, json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
PER_TEST = 200
HEAD = ['qid', 'level', 'test', 'section', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'explanation', 'topic', 'subtopic']


def norm(s):
    return re.sub(r'\s+', ' ', s.lower()).strip()


def load():
    cfg = json.load(open(os.path.join(DATA, 'config.json'), encoding='utf-8'))
    with open(os.path.join(DATA, 'questions.csv'), encoding='utf-8-sig', newline='') as fh:
        rd = csv.DictReader(fh)
        missing = [h for h in HEAD if h not in (rd.fieldnames or [])]
        if missing:
            sys.exit(f'questions.csv is missing columns: {missing}')
        rows = [{k: (v or '').strip() for k, v in r.items()} for r in rd]
    return cfg, rows


def validate(cfg, rows):
    errs, secs = [], [s['k'] for s in cfg['sections']]
    seen_id, seen_q = set(), {}
    for n, r in enumerate(rows, 2):                       # n = line number in the CSV
        where = f"line {n} ({r['qid'] or 'no qid'})"
        if not r['qid'] or r['qid'] in seen_id: errs.append(f'{where}: qid empty or duplicated')
        seen_id.add(r['qid'])
        if r['level'] not in cfg['levels']: errs.append(f"{where}: unknown level '{r['level']}'")
        if not r['test'].isdigit() or not 1 <= int(r['test']) <= cfg['levels'].get(r['level'], {}).get('tests', 0):
            errs.append(f"{where}: test must be 1..{cfg['levels'].get(r['level'], {}).get('tests', '?')}")
        if r['section'] not in secs: errs.append(f"{where}: unknown section '{r['section']}'")
        if not r['question']: errs.append(f'{where}: empty question')
        if not r['topic'] or not r['subtopic']: errs.append(f'{where}: topic and subtopic are required')
        opts = [r[f'option_{c}'] for c in 'abcd']
        if any(not o for o in opts): errs.append(f'{where}: an option is empty')
        if len({norm(o) for o in opts}) != 4: errs.append(f'{where}: duplicate options')
        if r['answer'] not in list('ABCD'): errs.append(f"{where}: answer must be A, B, C or D (got '{r['answer']}')")
        elif 'none of these' in norm(opts['ABCD'.index(r['answer'])]) and not r['explanation']: errs.append(f'{where}: a None-of-these answer needs an explanation')
        ans = opts['ABCD'.index(r['answer'])] if r['answer'] in list('ABCD') else ''
        # a "None of these" answer says nothing by itself: key on the options shown instead
        k = (r['level'], norm(r['question']), norm(ans) if 'none of these' not in norm(ans) else '|'.join(sorted(norm(o) for o in opts)))
        if k in seen_q: errs.append(f"{where}: same question and answer as {seen_q[k]}")
        seen_q.setdefault(k, r['qid'])
    return errs


def build(cfg, rows, write=True):
    secs = [s['k'] for s in cfg['sections']]
    name = {s['k']: s['name'] for s in cfg['sections']}
    groups = collections.defaultdict(list)
    for r in rows: groups[(r['level'], int(r['test']))].append(r)
    catalog, notes = [], []
    for lvl, L in cfg['levels'].items():
        for t in range(1, L['tests'] + 1):
            rs = groups.get((lvl, t), [])
            if len(rs) != PER_TEST:
                if rs: notes.append(f'{lvl} {t:02d}: {len(rs)} of {PER_TEST} questions - skipped')
                continue
            rs.sort(key=lambda r: secs.index(r['section']))     # stable: keeps CSV order inside a section
            sec, q = [], []
            for r in rs:
                if not sec or sec[-1]['k'] != r['section']: sec.append({'k': r['section'], 'name': name[r['section']], 'n': 0, 'i0': len(q)})
                sec[-1]['n'] += 1
                q.append({'s': r['section'], 'q': r['question'], 'o': [r[f'option_{c}'] for c in 'abcd'], 'a': 'ABCD'.index(r['answer']), 'e': r['explanation']})
            tid, key, title = L['idBase'] + t, f'{lvl}-{t:02d}', f"{L['name']} Test {t:02d}"
            assert tid <= 99 and len(title) <= 60
            catalog.append({'id': tid, 'key': key, 'level': lvl, 'n': t, 'title': title, 'count': len(q)})
            if write:
                with open(os.path.join(DATA, 'tests', key + '.json'), 'w', encoding='utf-8') as fh:
                    json.dump({'id': tid, 'key': key, 'level': lvl, 'title': title, 'sec': sec, 'q': q}, fh, ensure_ascii=False, separators=(',', ':'))
    if write:
        keep = {c['key'] + '.json' for c in catalog}
        for f in os.listdir(os.path.join(DATA, 'tests')):
            if f.endswith('.json') and f not in keep: os.remove(os.path.join(DATA, 'tests', f))
        built = {(c['level'], c['n']) for c in catalog}
        with open(os.path.join(DATA, 'topics.json'), 'w', encoding='utf-8') as fh:
            json.dump(topics(cfg, [r for r in rows if (r['level'], int(r['test'])) in built]), fh, ensure_ascii=False, separators=(',', ':'))
        out = {'exam': cfg['exam'], 'marking': cfg['marking'], 'levels': cfg['levels'], 'tests': catalog}
        with open(os.path.join(DATA, 'catalog.json'), 'w', encoding='utf-8') as fh:
            json.dump(out, fh, ensure_ascii=False, indent=1)
    return catalog, notes


def topics(cfg, rows):
    """data/topics.json: section -> topic -> subtopic, with the question count in every test of every level."""
    lv = {l: L['tests'] for l, L in cfg['levels'].items()}
    tree = collections.OrderedDict((s['k'], {'k': s['k'], 'name': s['name'], 't': collections.OrderedDict()}) for s in cfg['sections'])
    for r in rows:
        sub = tree[r['section']]['t'].setdefault(r['topic'], collections.OrderedDict()).setdefault(
            r['subtopic'], {l: [0] * n for l, n in lv.items()})
        sub[r['level']][int(r['test']) - 1] += 1
    out = {'levels': lv, 'sections': []}
    for s in tree.values():
        tops = []
        for tn, subs in sorted(s['t'].items()):
            tops.append({'name': tn, 'subs': [{'name': sn, 'c': c} for sn, c in sorted(subs.items())]})
        out['sections'].append({'k': s['k'], 'name': s['name'], 'topics': tops})
    return out


def to_xlsx(rows):
    try: from openpyxl import Workbook
    except ImportError: sys.exit('pip install openpyxl first')
    wb = Workbook(); ws = wb.active; ws.title = 'questions'
    ws.append(HEAD)
    for r in rows: ws.append([int(r[h]) if h == 'test' else r[h] for h in HEAD])
    ws.freeze_panes = 'A2'
    wb.save(os.path.join(DATA, 'questions.xlsx'))


def main():
    cfg, rows = load()
    errs = validate(cfg, rows)
    if errs:
        print(f'{len(errs)} problem(s) in questions.csv:'); [print('  -', e) for e in errs[:40]]
        if len(errs) > 40: print(f'  ... and {len(errs) - 40} more')
        sys.exit(1)
    catalog, notes = build(cfg, rows, write='--check' not in sys.argv)
    by = collections.Counter(c['level'] for c in catalog)
    print(f'{len(rows)} questions, ' + ', '.join(f"{L}: {by[L]}/{cfg['levels'][L]['tests']} tests" for L in cfg['levels']))
    [print('  note:', n) for n in notes]
    if '--xlsx' in sys.argv: to_xlsx(rows); print('wrote data/questions.xlsx')


if __name__ == '__main__':
    main()
