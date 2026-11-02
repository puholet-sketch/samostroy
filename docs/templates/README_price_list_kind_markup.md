# Разметка прайса: черновые / чистовые

Файл для заказчика: `price_list_kind_markup.xlsx` (или Numbers-экспорт того же шаблона).

## Как заполнять

1. Лист **Прайс** (или лист раздела).
2. Зелёный столбец **«вид_работ (заполняет клиент)»**: `черновые` | `чистовые` | `оба`.
3. Жёлтый **kind_системы** — черновик эвристики, не эталон.
4. Не менять id / раздел / наименование / ед. изм. / цену.

## Импорт на сайт

```bash
python docs/scripts/import_price_list_kind_markup.py "path/to/filled.numbers"
# или
python docs/scripts/import_price_list_kind_markup.py "path/to/filled.xlsx"
```

Скрипт обновляет `data/price_list.json`, пишет CSV/отчёт в `docs/templates/`.

Перегенерация пустого шаблона из текущего JSON:

```bash
python docs/scripts/export_price_list_kind_xlsx.py
```

## Замечание по возврату 2026-11-02

В файле `price_list_kind_markup 3.numbers` зелёный столбец был пуст; метки стояли в жёлтом `kind_системы` на листе «Прайс». Импорт взял их оттуда. 10 строк с текстом «Отдельный раздел - подготовительный» не меняли `kind` — ждут уточнения.
