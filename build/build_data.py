#!/usr/bin/env python3
"""Word (source/word/NN.docx) -> docs/data/plenums.js. Запуск: python build/build_data.py"""
import docx, re, glob, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MONTHS = {m: i + 1 for i, m in enumerate(
    "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split())}
ABBR = ["УК РФ", "УК РСФСР", "УПК РФ", "УПК РСФСР", "ГК РФ", "ТК РФ", "КоАП РФ", "РФ", "РСФСР", "СССР", "УК", "УПК", "ГК", "КоАП"]
CODE = re.compile(r"(УК\s+РСФСР|УК\s+РФ|Уголовного\s+кодекса\s+РСФСР|Уголовного\s+кодекса|УПК|Уголовно-процессуального|"
                  r"КоАП|Кодекса\s+Российской\s+Федерации\s+об\s+административных|ГК\s+РФ|Гражданского|ТК\s+РФ|Трудового|"
                  r"НК\s+РФ|Налогового|Конституци|Федеральн|Закон)", re.I)
START = re.compile(r"\b(?:ст\.\s*ст\.|ст\.|статьи|статья|статьей|статьёй|статью|статей|статьях|статьям)\s*(?=\d)", re.I)
NUM = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d{1,2})?)(?![\d])")
PARTS = re.compile(r"(?:ч\.|чч\.|п\.|пп\.|части|частей|пункта?|подпункта?)\s*[\d\"«»а-яё,\s\-–]*?(?=ст\.|статьи|$)", re.I)


def sentence_case(t):
    t = t.lower().capitalize()
    t = re.sub(r"(российск\w+) (федерац\w+)", lambda m: m.group(1).capitalize() + " " + m.group(2).capitalize(), t)
    t = re.sub(r"\b(конституци\w+|верховн\w+ суд\w*)", lambda m: " ".join(w.capitalize() for w in m.group(1).split()), t)
    t = re.sub(r"\b(уголовн\w+(?:-процессуальн\w+)?|гражданск\w+|трудов\w+|налогов\w+) (кодекс)", lambda m: m.group(1).capitalize() + " " + m.group(2), t)
    for a in sorted(ABBR, key=len, reverse=True):
        t = re.sub(r"\b" + re.escape(a.lower()) + r"\b", a, t, flags=re.I)
    return t


def uk_articles(text):
    """Статьи УК РФ и УК РСФСР, упомянутые в тексте (статьи других кодексов не берём)."""
    uk, ukr = set(), set()
    for m in START.finditer(text):
        window = text[m.end(): m.end() + 110]
        c = CODE.search(window)
        if not c:
            continue
        code = re.sub(r"\s+", " ", c.group(1)).upper()
        if code.startswith("УК РСФСР") or code.startswith("УГОЛОВНОГО КОДЕКСА РСФСР"):
            target = ukr
        elif code.startswith("УК РФ") or code.startswith("УГОЛОВНОГО КОДЕКСА"):
            target = uk
        else:
            continue
        seg = PARTS.sub(" ", window[:c.start()])
        target.update(NUM.findall(seg))
    key = lambda s: (float(s), s)
    return sorted(uk, key=key), sorted(ukr, key=key)


def parse(path):
    d = docx.Document(path)
    paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    head = " ".join(paras[:4])
    organ_raw = re.search(r"ПЛЕНУМ ВЕРХОВНОГО СУДА (СССР|РОССИЙСКОЙ ФЕДЕРАЦИИ|РСФСР)", head, re.I).group(1).upper()
    organ = "РФ" if organ_raw.startswith("РОСС") else organ_raw
    dm = re.search(r"от\s+(\d{1,2})\s+([а-я]+)\s+(\d{4})\s*г\.?\s*[N№]\s*(\d+)", head, re.I)
    day, mon, year, num = int(dm.group(1)), MONTHS[dm.group(2).lower()], int(dm.group(3)), dm.group(4)
    i = next(k for k, p in enumerate(paras[:6]) if re.search(r"от\s+\d{1,2}\s+[а-я]+\s+\d{4}", p, re.I))
    t, k = [], i + 1
    while k < len(paras) and len(t) < 3:
        p = paras[k]
        letters = [ch for ch in p if ch.isalpha()]
        if letters and sum(ch.isupper() for ch in letters) / len(letters) > .75 and len(p) < 500:
            t.append(p)
            k += 1
        else:
            break
    title = sentence_case(" ".join(t)) if t else "Без названия"
    body = paras[k:]
    uk, ukr = uk_articles(" ".join(t) + " " + " ".join(body))
    return dict(id=int(os.path.basename(path)[:2]), organ=organ, date=f"{year:04d}-{mon:02d}-{day:02d}",
                num=num, title=title, uk=uk, ukr=ukr, paras=body)


def main():
    items = [parse(f) for f in sorted(glob.glob(os.path.join(ROOT, "source", "word", "*.docx")))]
    items.sort(key=lambda x: x["date"])
    out = os.path.join(ROOT, "docs", "data", "plenums.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("window.PLENUMS=" + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";")
    print(f"{len(items)} пленумов -> {out} ({os.path.getsize(out) // 1024} КБ)")


if __name__ == "__main__":
    main()
