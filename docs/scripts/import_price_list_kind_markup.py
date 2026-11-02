#!/usr/bin/env python3
"""Import customer kind markup (черновые/чистовые/оба) into data/price_list.json.

Supports:
  - macOS Numbers (.numbers) via numbers-parser
  - Excel (.xlsx) via openpyxl

Customer was asked to fill green column «вид_работ (заполняет клиент)».
In the 2026-11-02 Numbers return that column was empty; marks were in
«kind_системы» on sheet «Прайс». Script prefers customer column, then
falls back to system column.

Ambiguous / non-standard marks are left unchanged and listed in the report.

Usage:
  python docs/scripts/import_price_list_kind_markup.py "path/to/file.numbers"
  python docs/scripts/import_price_list_kind_markup.py "path/to/file.xlsx"
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_JSON = ROOT / "data" / "price_list.json"
OUT_CSV = ROOT / "docs" / "templates" / "price_list_kind_markup_customer.csv"
OUT_XLSX = ROOT / "docs" / "templates" / "price_list_kind_markup.xlsx"
OUT_REPORT = ROOT / "docs" / "templates" / "price_list_kind_import_report.json"

KIND_MAP = {
    "черновые": "chernovye",
    "Черновые": "chernovye",
    "чистовые": "chistovye",
    "Чистовые": "chistovye",
    "оба": "both",
    "Оба": "both",
}
KIND_RU = {"chernovye": "черновые", "chistovye": "чистовые", "both": "оба"}


def load_rows_numbers(path: Path) -> list[dict]:
    from numbers_parser import Document

    doc = Document(str(path))
    sheet = next((s for s in doc.sheets if s.name == "Прайс"), None)
    if sheet is None:
        raise SystemExit(f"Sheet «Прайс» not found in {path}")
    t = sheet.tables[0]
    rows: list[dict] = []
    for r in range(1, t.num_rows):
        rows.append(
            {
                "id": t.cell(r, 0).value,
                "section": t.cell(r, 1).value,
                "name": t.cell(r, 2).value,
                "unit": t.cell(r, 3).value,
                "price": t.cell(r, 4).value,
                "system_kind_raw": t.cell(r, 5).value,
                "customer_kind_raw": t.cell(r, 6).value,
                "note": t.cell(r, 7).value,
            }
        )
    return rows


def load_rows_xlsx(path: Path) -> list[dict]:
    from openpyxl import load_workbook

    wb = load_workbook(path, data_only=True)
    if "Прайс" not in wb.sheetnames:
        raise SystemExit(f"Sheet «Прайс» not found in {path}")
    ws = wb["Прайс"]
    rows: list[dict] = []
    for r in range(2, ws.max_row + 1):
        rows.append(
            {
                "id": ws.cell(r, 1).value,
                "section": ws.cell(r, 2).value,
                "name": ws.cell(r, 3).value,
                "unit": ws.cell(r, 4).value,
                "price": ws.cell(r, 5).value,
                "system_kind_raw": ws.cell(r, 6).value,
                "customer_kind_raw": ws.cell(r, 7).value,
                "note": ws.cell(r, 8).value,
            }
        )
    return rows


def norm(v) -> str:
    if v is None:
        return ""
    return str(v).strip()


def write_csv(rows: list[dict], items: list[dict], statuses: list[str]) -> None:
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(
            [
                "id",
                "раздел",
                "наименование",
                "ед. изм.",
                "цена",
                "kind_системы_raw",
                "вид_работ_raw",
                "примечание",
                "imported_kind",
                "status",
            ]
        )
        for row, it, st in zip(rows, items, statuses):
            w.writerow(
                [
                    row["id"],
                    row["section"],
                    row["name"],
                    row["unit"],
                    row["price"],
                    row["system_kind_raw"],
                    row["customer_kind_raw"],
                    row["note"],
                    it.get("kind"),
                    st,
                ]
            )


def write_xlsx_archive(rows: list[dict], items: list[dict], statuses: list[str]) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws_i = wb.active
    ws_i.title = "Инструкция"
    ws_i["A1"] = (
        "Архив после импорта. Зелёный столбец — фактически применённый вид "
        "(если метка распознана). Нестандартные метки — в примечании."
    )
    ws = wb.create_sheet("Прайс", 1)
    headers = [
        "id",
        "раздел",
        "наименование",
        "ед. изм.",
        "цена",
        "kind_системы (черновик, не эталон)",
        "вид_работ (заполняет клиент)",
        "примечание",
    ]
    green = PatternFill("solid", fgColor="C6EFCE")
    yellow = PatternFill("solid", fgColor="FFF2CC")
    for c, h in enumerate(headers, 1):
        cell = ws.cell(1, c, h)
        cell.font = Font(bold=True)
        if c == 6:
            cell.fill = yellow
        if c == 7:
            cell.fill = green

    for i, (row, it, st) in enumerate(zip(rows, items, statuses)):
        kind = it.get("kind")
        ru = KIND_RU.get(kind, "")
        note = norm(row["note"])
        if st.startswith("ambiguous"):
            raw = norm(row["customer_kind_raw"]) or norm(row["system_kind_raw"])
            note = f"заказчик: {raw!r}; на сайте пока kind={kind}"
            green_val = ""
        else:
            green_val = ru
        vals = [
            row["id"],
            row["section"],
            row["name"],
            row["unit"],
            row["price"],
            row["system_kind_raw"],
            green_val,
            note,
        ]
        for c, v in enumerate(vals, 1):
            ws.cell(i + 2, c, v)
    wb.save(OUT_XLSX)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path, help="Numbers or xlsx markup file")
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON)
    ap.add_argument(
        "--updated",
        default="2026-11-02",
        help="ISO date for price_list.updated / imported_at",
    )
    args = ap.parse_args()
    path: Path = args.input
    if not path.exists():
        raise SystemExit(f"File not found: {path}")

    suffix = path.suffix.lower()
    if suffix == ".numbers":
        rows = load_rows_numbers(path)
    elif suffix in (".xlsx", ".xlsm"):
        rows = load_rows_xlsx(path)
    else:
        raise SystemExit(f"Unsupported format: {suffix}")

    with args.json.open(encoding="utf-8") as f:
        pl = json.load(f)
    items: list[dict] = pl["items"]
    if len(items) != len(rows):
        raise SystemExit(f"Row count mismatch: json={len(items)} file={len(rows)}")

    counts: Counter[str] = Counter()
    source_col: Counter[str] = Counter()
    ambiguous: list[dict] = []
    changed: list[dict] = []
    statuses: list[str] = []

    for i, row in enumerate(rows):
        it = items[i]
        if norm(it.get("name")) != norm(row.get("name")):
            raise SystemExit(
                f"Name mismatch at {row.get('id')}: json={it.get('name')!r} file={row.get('name')!r}"
            )
        g = norm(row.get("customer_kind_raw"))
        fcol = norm(row.get("system_kind_raw"))
        if g:
            raw, src = g, "customer_col"
        elif fcol:
            raw, src = fcol, "system_col_fallback"
        else:
            raw, src = "", "empty"
        source_col[src] += 1
        mapped = KIND_MAP.get(raw) if raw else None
        old = it.get("kind")
        if mapped is None:
            counts["ambiguous"] += 1
            statuses.append("ambiguous_kept_previous")
            ambiguous.append(
                {
                    "id": row["id"],
                    "section": row["section"],
                    "name": row["name"],
                    "raw_mark": raw,
                    "kept_kind": old,
                }
            )
            continue
        counts[mapped] += 1
        statuses.append("ok")
        if old != mapped:
            changed.append(
                {
                    "id": row["id"],
                    "section": row["section"],
                    "name": row["name"],
                    "old": old,
                    "new": mapped,
                }
            )
        it["kind"] = mapped

    pl["source"] = path.name
    pl["updated"] = args.updated
    pl["imported_at"] = args.updated
    pl["kind_source"] = {
        "file": path.name,
        "sheet": "Прайс",
        "customer_col_filled": source_col.get("customer_col", 0),
        "system_col_fallback": source_col.get("system_col_fallback", 0),
        "empty": source_col.get("empty", 0),
        "note": (
            "Предпочтение: столбец «вид_работ». Если пуст — fallback на «kind_системы». "
            "Нестандартные метки не меняют kind (см. ambiguous в отчёте)."
        ),
    }

    with args.json.open("w", encoding="utf-8") as f:
        json.dump(pl, f, ensure_ascii=False, indent=2)
        f.write("\n")

    write_csv(rows, items, statuses)
    write_xlsx_archive(rows, items, statuses)

    report = {
        "input": str(path),
        "rows": len(rows),
        "source_col_stats": dict(source_col),
        "counts_imported": {
            "chernovye": counts["chernovye"],
            "chistovye": counts["chistovye"],
            "both": counts["both"],
            "ambiguous_unchanged": counts["ambiguous"],
        },
        "final_json_counts": dict(Counter(it.get("kind") for it in items)),
        "kind_changes": len(changed),
        "ambiguous": ambiguous,
        "sample_changes": changed[:30],
        "artifacts": {
            "csv": str(OUT_CSV.relative_to(ROOT)),
            "xlsx": str(OUT_XLSX.relative_to(ROOT)),
            "report": str(OUT_REPORT.relative_to(ROOT)),
        },
    }
    with OUT_REPORT.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(json.dumps(report["counts_imported"], ensure_ascii=False))
    print("kind_changes:", len(changed))
    print("final_json_counts:", report["final_json_counts"])
    print("ambiguous:", len(ambiguous))
    for a in ambiguous:
        print(f"  {a['id']}: {a['raw_mark']!r} -> kept {a['kept_kind']} | {a['name'][:70]}")
    print("wrote", args.json)
    print("wrote", OUT_CSV)
    print("wrote", OUT_XLSX)
    print("wrote", OUT_REPORT)


if __name__ == "__main__":
    main()
