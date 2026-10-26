#!/usr/bin/env python3
"""Import Aquarius March price PDF → data/price_list.json (+ refresh txt).

Fixes multiline names (PDF wraps) and section headers (ПОЛЫ/СТЕНЫ/…).
Optional --pdf path; default: docs/templates/price_list_march.pdf
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = ROOT / "docs" / "templates" / "price_list_march.pdf"
OUT_JSON = ROOT / "data" / "price_list.json"
OUT_TXT = ROOT / "docs" / "templates" / "price_list_march.txt"

SECTIONS = [
    "ДЕМОНТАЖНЫЕ РАБОТЫ",
    "ПОЛЫ",
    "СТЕНЫ",
    "ПОТОЛКИ",
    "ЭЛЕКТРИКА",
    "САНТЕХНИКА",
    "ПРОЧЕЕ",
]
SECTION_SET = set(SECTIONS)

UNIT_RE = re.compile(
    r"^(м2\+м\.п\.|м2|м\.п\.|ед\.|компл\.|шт\.|м3|кг|л|набор)$",
    re.IGNORECASE,
)
PRICE_RE = re.compile(r"^\d{1,3}(?:[ \u00a0]\d{3})*(?:[.,]\d+)?$|^\d+[.,]\d+$|^\d+$")
PAGE_RE = re.compile(r"^=== PAGE \d+ ===$")
SKIP_LINES = {
    "ПРАЙС-ЛИСТ НА ОТДЕЛОЧНЫЕ РАБОТЫ",
    "для клиента",
    "НАИМЕНОВАНИЕ РАБОТ",
    "Ед. изм.",
    "Цена / руб",
}


def extract_text(pdf: Path) -> str:
    import fitz

    doc = fitz.open(pdf)
    parts: list[str] = []
    for i, page in enumerate(doc):
        parts.append(f"=== PAGE {i + 1} ===\n{page.get_text('text')}")
    return "\n".join(parts)


def normalize_price(raw: str) -> float:
    s = raw.replace("\u00a0", " ").replace(" ", "").replace(",", ".")
    return round(float(s), 2)


def is_section(line: str) -> bool:
    return line.strip().upper() in SECTION_SET


def is_unit(line: str) -> bool:
    return bool(UNIT_RE.match(line.strip()))


def is_price(line: str) -> bool:
    return bool(PRICE_RE.match(line.strip().replace("\u00a0", " ")))


def is_noise(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if PAGE_RE.match(s):
        return True
    if s in SKIP_LINES:
        return True
    if s.startswith("Москва, по состоянию"):
        return True
    return False


def classify_kind(section: str, name: str) -> str:
    """chernovye | chistovye | both — for per-section draft/finish filter."""
    n = name.lower()
    sec = section.upper()

    if sec == "ДЕМОНТАЖНЫЕ РАБОТЫ":
        return "chernovye"
    if sec == "ПРОЧЕЕ":
        return "both"

    finish_kw = (
        "облицовк",
        "укладк",
        "покраск",
        "окрашив",
        "поклейк",
        "затирк",
        "плинтус",
        "обои",
        "ламинат",
        "паркет",
        "кварцвинил",
        "чистовая",
        "чистый рез",
        "мозаик",
        "силиконов",
        "установк",
        "подключен",
        "монтаж рамки",
        "монтаж трека",
        "монтаж шинотрека",
        "натяжно",
        "декоратив",
        "финишн",
        "стеклохолст",
        "флизелин",
        "кабанчик",
        "запил",
        "формовани",
    )
    draft_kw = (
        "демонтаж",
        "стяжк",
        "штукатур",
        "маяк",
        "каркас",
        "штроб",
        "гидроизол",
        "шумоизол",
        "теплоизол",
        "наливн",
        "выравниван",
        "черновая",
        "грунтован",
        "шпатлев",
        "шпаклев",
        "перегород",
        "закладн",
        "пеноплекс",
        "обрешетк",
        "временн",
        "организация времен",
        "прокладк",
        "вывод кабел",
        "вывод труб",
        "коллектор",
        "заделка",
        "расшивка",
        "отбивк",
        "очистк",
        "подготовк",
    )

    fin = any(k in n for k in finish_kw)
    dr = any(k in n for k in draft_kw)
    if fin and not dr:
        return "chistovye"
    if dr and not fin:
        return "chernovye"
    if fin and dr:
        # e.g. «Грунтование … перед окрашиванием» — prep → draft
        if any(k in n for k in ("грунтован", "подготовк", "шпатлев", "шпаклев", "черновая")):
            return "chernovye"
        return "chistovye"
    # section defaults for ambiguous short names
    if sec in ("ЭЛЕКТРИКА", "САНТЕХНИКА"):
        return "both"
    return "both"


def parse_items(text: str) -> list[dict]:
    lines = [ln.rstrip() for ln in text.splitlines()]
    items: list[dict] = []
    section = "ПРОЧЕЕ"
    i = 0
    name_buf: list[str] = []

    def flush_incomplete():
        nonlocal name_buf
        name_buf = []

    while i < len(lines):
        raw = lines[i]
        if is_noise(raw):
            i += 1
            continue
        s = raw.strip()

        if is_section(s):
            flush_incomplete()
            section = s.strip().upper()
            # normalize known titles
            for canon in SECTIONS:
                if canon == section:
                    section = canon
                    break
            i += 1
            continue

        # Try: name(+continuation) / unit / price
        if is_unit(s) or is_price(s):
            # orphan unit/price — skip
            i += 1
            continue

        # Accumulate name lines until unit
        name_buf = [s]
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if is_noise(nxt):
                j += 1
                continue
            ns = nxt.strip()
            if is_section(ns):
                break
            if is_unit(ns):
                # need price after unit
                k = j + 1
                while k < len(lines) and is_noise(lines[k]):
                    k += 1
                if k < len(lines) and is_price(lines[k].strip()):
                    name = " ".join(name_buf)
                    name = re.sub(r"\s+", " ", name).strip()
                    unit = ns
                    price = normalize_price(lines[k].strip())
                    kind = classify_kind(section, name)
                    items.append(
                        {
                            "section": section,
                            "name": name,
                            "unit": unit,
                            "price": price,
                            "kind": kind,
                        }
                    )
                    i = k + 1
                    name_buf = []
                    break
                # unit without price — treat as name continuation
                name_buf.append(ns)
                j += 1
                continue
            if is_price(ns) and name_buf:
                # missing unit — skip malformed
                flush_incomplete()
                i = j + 1
                break
            # continuation of name
            name_buf.append(ns)
            j += 1
        else:
            # exhausted
            i = j
            flush_incomplete()
            continue

        if name_buf:
            # failed to parse — advance one line
            i += 1
            flush_incomplete()

    return items


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument(
        "--from-downloads",
        action="store_true",
        help="Copy from Downloads «Прайс Лист на март .pdf» first",
    )
    args = ap.parse_args()

    if args.from_downloads:
        src = Path.home() / "Downloads" / "Прайс Лист на март .pdf"
        if not src.exists():
            raise SystemExit(f"Not found: {src}")
        shutil.copy2(src, DEFAULT_PDF)
        print(f"Copied -> {DEFAULT_PDF}")

    pdf = args.pdf
    if not pdf.exists():
        raise SystemExit(f"PDF not found: {pdf}")

    text = extract_text(pdf)
    OUT_TXT.write_text(text, encoding="utf-8")
    items = parse_items(text)

    # sanity
    by_sec: dict[str, int] = {}
    for it in items:
        by_sec[it["section"]] = by_sec.get(it["section"], 0) + 1
    short = [it for it in items if len(it["name"]) < 12]
    print(f"items={len(items)} sections={by_sec}")
    if short:
        print(f"short names ({len(short)}):")
        for it in short[:20]:
            print(f"  [{it['section']}] {it['name']!r}")

    payload = {
        "source": "price_list_march.pdf",
        "updated": "2026-03-14",
        "imported_at": "2026-10-26",
        "section_order": SECTIONS,
        "items": items,
    }
    OUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT_JSON}")


if __name__ == "__main__":
    main()
