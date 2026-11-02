#!/usr/bin/env python3
"""Export data/price_list.json → Excel for customer kind markup (черновые/чистовые/оба).

Regenerate after price list import:

  python docs/scripts/export_price_list_kind_xlsx.py
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_JSON = ROOT / "data" / "price_list.json"
DEFAULT_XLSX = ROOT / "docs" / "templates" / "price_list_kind_markup.xlsx"

KIND_RU = {"chernovye": "черновые", "chistovye": "чистовые", "both": "оба"}
HEADERS = [
    "id",
    "раздел",
    "наименование",
    "ед. изм.",
    "цена",
    "kind_системы (черновик, не эталон)",
    "вид_работ (заполняет клиент)",
    "примечание",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON)
    ap.add_argument("--out", type=Path, default=DEFAULT_XLSX)
    args = ap.parse_args()

    with args.json.open(encoding="utf-8") as f:
        pl = json.load(f)
    items = pl["items"]
    order = pl.get("section_order") or []

    wb = Workbook()
    thin = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )
    green = PatternFill("solid", fgColor="C6EFCE")
    yellow = PatternFill("solid", fgColor="FFF2CC")
    header_font = Font(bold=True)

    ws_i = wb.active
    ws_i.title = "Инструкция"
    lines = [
        "Разметка прайса: черновые / чистовые / оба",
        "",
        "1. Откройте лист «Прайс» (или лист раздела).",
        "2. В зелёном столбце «вид_работ (заполняет клиент)» выберите: черновые | чистовые | оба.",
        "3. Жёлтый «kind_системы» — черновик системы, не эталон; можно не трогать.",
        "4. Не меняйте id / раздел / наименование / ед. изм. / цену.",
        "5. Верните файл (xlsx или Numbers) — мы импортируем зелёный столбец.",
        "",
        "Импорт: python docs/scripts/import_price_list_kind_markup.py <файл>",
    ]
    for i, line in enumerate(lines, 1):
        ws_i.cell(i, 1, line)
    ws_i.column_dimensions["A"].width = 100

    def fill_sheet(ws, subset, id_start: int) -> None:
        for c, h in enumerate(HEADERS, 1):
            cell = ws.cell(1, c, h)
            cell.font = header_font
            cell.border = thin
            if c == 6:
                cell.fill = yellow
            if c == 7:
                cell.fill = green
        for i, it in enumerate(subset):
            rid = f"PL-{id_start + i:04d}"
            vals = [
                rid,
                it["section"],
                it["name"],
                it.get("unit"),
                it.get("price"),
                KIND_RU.get(it.get("kind", "both"), it.get("kind")),
                "",
                "",
            ]
            for c, v in enumerate(vals, 1):
                cell = ws.cell(i + 2, c, v)
                cell.border = thin
                cell.alignment = Alignment(wrap_text=c == 3, vertical="top")
                if c == 6:
                    cell.fill = yellow
                if c == 7:
                    cell.fill = green
        dv = DataValidation(
            type="list",
            formula1='"черновые,чистовые,оба"',
            allow_blank=True,
        )
        ws.add_data_validation(dv)
        if subset:
            dv.add(f"G2:G{len(subset) + 1}")
        widths = [10, 22, 55, 12, 10, 28, 28, 24]
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w

    # Full sheet — ids match global index order
    ws_all = wb.create_sheet("Прайс", 1)
    fill_sheet(ws_all, items, 1)

    # Per-section sheets
    by_sec: dict[str, list] = {}
    for it in items:
        by_sec.setdefault(it["section"], []).append(it)
    for sec in order or list(by_sec.keys()):
        subset = by_sec.get(sec) or []
        if not subset:
            continue
        # find first global index of this section
        start = next(i for i, it in enumerate(items) if it["section"] == sec) + 1
        title = sec[:31]
        ws = wb.create_sheet(title)
        fill_sheet(ws, subset, start)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(args.out)
    print(f"Wrote {args.out} ({len(items)} rows)")


if __name__ == "__main__":
    main()
