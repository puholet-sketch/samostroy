import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx'
import type { ClientCard } from './clients'
import { CONTRACTOR, DESIGN_RATE_PER_M2 } from './contractor'
import { formatDateRu, formatMoney, rublesInWords, splitPassport } from './moneyRu'

const FONT = 'Times New Roman'
const PAGE_W = 11906
const MARGIN = 850
const CONTENT_W = PAGE_W - MARGIN * 2

/** Шапки всех таблиц — едва заметный пастельный зелёный (как штриховка) */
const BRAND = 'C00000' // только подчёркивание разделов в тексте
const TABLE_HEAD = 'F8FCF6'
const TABLE_HEAD_TEXT = '1A1A1A'
const ZEBRA = 'FAFDF9'
const LABEL_BG = 'F7F7F7'

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' }
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function run(
  text: string,
  opts?: { bold?: boolean; size?: number; italics?: boolean; color?: string },
): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: opts?.size ?? 22,
    bold: opts?.bold,
    italics: opts?.italics,
    color: opts?.color,
  })
}

function para(
  text: string,
  opts?: {
    bold?: boolean
    center?: boolean
    size?: number
    after?: number
    before?: number
    italics?: boolean
  },
): Paragraph {
  return new Paragraph({
    alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.BOTH,
    spacing: { after: opts?.after ?? 140, before: opts?.before ?? 0, line: 276 },
    children: [
      run(text, {
        bold: opts?.bold,
        size: opts?.size ?? 22,
        italics: opts?.italics,
      }),
    ],
  })
}

function title(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, before: 0, line: 276 },
    children: [run(text, { bold: true, size: 28 })],
  })
}

function sectionHead(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160, before: 280, line: 276 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND, space: 4 },
    },
    children: [run(text, { bold: true, size: 24 })],
  })
}

function clause(text: string): Paragraph {
  return para(text, { after: 120 })
}

function metaLine(city: string, dateFull: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 280, before: 40 },
    children: [
      run(`г. ${city || 'Москва'}`, { size: 22 }),
      run('   ·   ', { size: 22, color: '888888' }),
      run(dateFull, { size: 22 }),
    ],
  })
}

function cell(
  text: string,
  width: number,
  opts?: {
    bold?: boolean
    center?: boolean
    fill?: string
    header?: boolean
    size?: number
  },
): TableCell {
  const fill = opts?.fill ?? (opts?.header ? TABLE_HEAD : undefined)
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill } : undefined,
    borders: {
      top: thin,
      bottom: thin,
      left: thin,
      right: thin,
    },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          run(text, {
            bold: opts?.bold || opts?.header,
            size: opts?.size ?? 18,
            color: opts?.header ? TABLE_HEAD_TEXT : undefined,
          }),
        ],
      }),
    ],
  })
}

function kvRow(label: string, value: string, labelW = 2800, valueW = CONTENT_W - 2800): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: labelW, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LABEL_BG },
        borders: { top: thin, bottom: thin, left: thin, right: thin },
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        children: [
          new Paragraph({
            children: [run(label, { bold: true, size: 18, color: '555555' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: valueW, type: WidthType.DXA },
        borders: { top: thin, bottom: thin, left: thin, right: thin },
        margins: { top: 50, bottom: 50, left: 80, right: 80 },
        children: [new Paragraph({ children: [run(value || '—', { size: 20 })] })],
      }),
    ],
  })
}

function partyTable(titleText: string, rows: [string, string][]): Table {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: TABLE_HEAD },
            borders: { top: thin, bottom: thin, left: thin, right: thin },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [run(titleText, { bold: true, size: 20, color: TABLE_HEAD_TEXT })],
              }),
            ],
          }),
        ],
      }),
      ...rows.map(([k, v]) => kvRow(k, v)),
    ],
  })
}

function signatureBlock(role: string, fio: string): Table {
  const half = Math.floor(CONTENT_W / 2) - 80
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: half, type: WidthType.DXA },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              para(role, { bold: true, size: 20, after: 200 }),
              para('_________________ / ' + fio + ' /', { size: 20, after: 40 }),
              para('подпись                    расшифровка', {
                size: 16,
                italics: true,
                after: 0,
              }),
            ],
          }),
          new TableCell({
            width: { size: half, type: WidthType.DXA },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: [
              para('М.П.', { size: 18, after: 200, center: true }),
              para('«___» ______________ 20___ г.', { size: 18, center: true, after: 0 }),
            ],
          }),
        ],
      }),
    ],
  })
}

function shortFio(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 3) return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`
  return full || CONTRACTOR.short
}

function clientPartyRows(c: ClientCard): [string, string][] {
  const pass = splitPassport(c.passport_number)
  if (c.fizurlico === 'ur') {
    return [
      ['Наименование', c.name || '—'],
      ['В лице', c.lico || '—'],
      ['На основании', c.osnovanie || '—'],
      ['Подписант', c.podpisant || '—'],
      ['Юр. адрес', c.address_ur || '—'],
      ['ИНН / КПП', `${c.inn || '—'} / ${c.kpp || '—'}`],
      ['Банк', c.bank || '—'],
      ['БИК', c.bik || '—'],
      ['Р/с', c.rs || '—'],
      ['К/с', c.ks || '—'],
      ['Телефон', c.mobile || '—'],
      ['Email', c.email || '—'],
    ]
  }
  return [
    ['ФИО', c.name || '—'],
    ['Паспорт', `серия ${pass.series || '________'} № ${pass.number || '______'}`],
    ['Выдан', c.passport_issued || '—'],
    ['Дата выдачи', c.passport_date_issued || '—'],
    ['Код подразделения', c.passport_code || '—'],
    ['Адрес регистрации', c.address || '—'],
    ['Телефон', c.mobile || '—'],
    ['Email', c.email || '—'],
  ]
}

function contractorPartyRows(executorName: string): [string, string][] {
  const name = executorName.trim() || CONTRACTOR.name
  return [
    ['ФИО', name],
    ['Паспорт', `серия ${CONTRACTOR.passportSeries} № ${CONTRACTOR.passportNumber}`],
    ['Выдан', CONTRACTOR.passportIssued],
    ['Дата выдачи', CONTRACTOR.passportDate],
    ['Код подразделения', CONTRACTOR.passportCode],
    ['Адрес регистрации', CONTRACTOR.address],
    ['Телефон', CONTRACTOR.phone],
    ['Email', CONTRACTOR.email],
  ]
}

function moneyTable(
  lines: { name: string; unit: string; qty: number; price: number }[],
): Table {
  const cols = [700, 3800, 900, 900, 1400, 1600]
  const header = new TableRow({
    children: ['№', 'Наименование работ', 'Ед.', 'Кол-во', 'Цена, ₽', 'Стоимость, ₽'].map(
      (t, i) => cell(t, cols[i], { header: true, center: true }),
    ),
  })
  const body = lines.map((l, i) => {
    const zebra = i % 2 === 1 ? ZEBRA : undefined
    return new TableRow({
      children: [
        cell(String(i + 1), cols[0], { center: true, fill: zebra }),
        cell(l.name, cols[1], { fill: zebra }),
        cell(l.unit || 'ед.', cols[2], { center: true, fill: zebra }),
        cell(String(l.qty), cols[3], { center: true, fill: zebra }),
        cell(formatMoney(l.price), cols[4], { center: true, fill: zebra }),
        cell(formatMoney(l.qty * l.price), cols[5], { center: true, fill: zebra, bold: true }),
      ],
    })
  })
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...body],
  })
}

function docShell(children: FileChild[], headerHint: string): Document {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E8E4E1', space: 8 },
                },
                children: [
                  run('СамоСтрой  ·  ', { size: 16, color: '888888' }),
                  run(headerHint, { size: 16, color: '888888' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  run('стр. ', { size: 16, color: '888888' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
}

async function downloadDoc(doc: Document, filename: string) {
  const blob = await Packer.toBlob(doc)
  const { saveAs } = await import('file-saver')
  saveAs(blob, filename)
}

export type RemontSmetaLine = {
  name: string
  unit: string
  qty: number
  price: number
  section?: string
}

export type RemontForm = {
  number: string
  date: string
  city: string
  objectAddress: string
  /** Площадь объекта (с карточки); для текста договора */
  areaM2?: number
  totalSum: number
  workDays: number
  executorName: string
  /** Скидка % из калькулятора; 0 = без скидки */
  discountPct?: number
  /** База до скидки (если задана скидка) */
  baseTotal?: number
  smetaLines?: RemontSmetaLine[]
}

export type DesignForm = {
  number: string
  date: string
  city: string
  objectAddress: string
  areaM2: number
  executorName: string
}

export type AktLine = {
  name: string
  unit: string
  qty: number
  price: number
}

export type AktForm = {
  number: string
  date: string
  city: string
  objectAddress: string
  stageName: string
  lines: AktLine[]
  paid: number
  executorName: string
}

/** Сборка без скачивания — для превью / тестов */
export async function buildRemontDocument(client: ClientCard, form: RemontForm): Promise<Document> {
  const d = formatDateRu(form.date)
  const discountPct = Math.max(0, Math.min(100, Number(form.discountPct) || 0))
  const baseTotal =
    form.baseTotal != null && form.baseTotal > 0
      ? form.baseTotal
      : discountPct > 0
        ? Math.round((form.totalSum / (1 - discountPct / 100)) * 100) / 100
        : form.totalSum
  const sumWords = rublesInWords(form.totalSum)
  const executor = form.executorName.trim() || CONTRACTOR.name
  const clientFio = shortFio(client.fizurlico === 'ur' ? client.podpisant || client.name : client.name)
  const execFio = shortFio(executor)
  const addr = form.objectAddress || '_______________________________________________'
  const smeta = (form.smetaLines ?? []).filter((l) => l.name.trim() && l.qty > 0)

  const costClause =
    discountPct > 0
      ? `4.1. Стоимость работ по смете составляет ${formatMoney(baseTotal)} ₽. Скидка — ${discountPct}%. Итого к оплате по настоящему договору: ${formatMoney(form.totalSum)} (${sumWords}). Стоимость определяется на основании видов работ согласно Приложению №1 и прилагаемой сметы.`
      : `4.1. Общая стоимость работ по настоящему договору составляет ${formatMoney(form.totalSum)} (${sumWords}) и определяется на основании видов работ согласно Приложению №1 и прилагаемой сметы.`

  const children: FileChild[] = [
    title(`ДОГОВОР ПОДРЯДА НА РЕМОНТ КВАРТИРЫ`),
    para(`№ ${form.number || '___'}`, { bold: true, center: true, size: 24, after: 80 }),
    metaLine(form.city, d.full),
    clause(
      `${client.name || '___________________________'}, именуемый в дальнейшем «Заказчик», с одной стороны, и ${executor}, именуемый в дальнейшем «Исполнитель» («Подрядчик»), с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:`,
    ),

    sectionHead('1. ПРЕДМЕТ ДОГОВОРА'),
    clause(
      `1.1. Подрядчик обязуется самостоятельно или с привлечением контрагентов выполнить работы по ремонту жилого помещения по адресу: ${addr}${
        form.areaM2 ? ` (площадь объекта ${form.areaM2} кв.м)` : ''
      }, именуемом в дальнейшем Объектом, с соблюдением строительных норм и правил, технических условий застройщика (УК), требований Заказчика (описанных в приложении №1 настоящего договора) и сметной документации, а Заказчик — принять выполненные работы и оплатить их в соответствии с условиями настоящего договора.`,
    ),
    clause(
      '1.2. Объем, характер и стоимость работ, предусмотренных в п. 1.1, определяются сметой, утверждённой Заказчиком и согласованной Подрядчиком.',
    ),
    clause(
      '1.3. Работы выполняются согласно дизайн-проекту, с соблюдением границ, высот электрооборудования и других элементов.',
    ),

    sectionHead('2. СРОК ВЫПОЛНЕНИЯ РАБОТ'),
    clause(
      `2.1. Срок выполнения работ по данному договору составляет ${form.workDays || 80} рабочих дней с момента заключения настоящего договора с Приложениями.`,
    ),
    clause(
      '2.2. График оплаты выполненных работ определяется Заказчиком и Подрядчиком в приложении №1 настоящего договора и прилагаемой сметы.',
    ),

    sectionHead('3. СРОК ДЕЙСТВИЯ ДОГОВОРА'),
    clause(
      '3.1. Договор вступает в силу с момента подписания и действует до полного исполнения Сторонами своих обязательств.',
    ),

    sectionHead('4. СТОИМОСТЬ РАБОТ И ПОРЯДОК РАСЧЁТА'),
    clause(costClause),
    clause(
      '4.2. Выплаты по данному договору определяются по факту выполненных работ в процентном соотношении по договорённости Сторон.',
    ),

    sectionHead('5. ПРИЁМКА И СДАЧА РАБОТ'),
    clause(
      '5.1. Сдача-приёмка выполненных работ оформляется актами приёмки с обязательным подписанием Сторонами и является основанием для денежных расчётов.',
    ),
    clause(
      '5.2. В течение пяти рабочих дней после представления Подрядчиком акта сдачи-приёма выполненных работ Заказчик обязан либо принять работы, либо представить мотивированный письменный отказ. В последнем случае составляется перечень доработок со сроками исполнения.',
    ),

    sectionHead('6. ОБЯЗАТЕЛЬСТВА СТОРОН'),
    clause('6.1. Заказчик обязуется:'),
    clause('6.1.1. Обеспечить беспрепятственный доступ Подрядчика для производства работ.'),
    clause('6.1.2. Принять выполненную работу и оплатить её в течение трёх банковских дней.'),
    clause('6.1.3. Своевременно предоставлять строительные и расходные материалы.'),
    clause('6.2. Подрядчик обязуется:'),
    clause('6.2.1. Своевременно и качественно, в строгом соответствии со СНиП выполнить работы.'),
    clause(
      '6.2.2. Обеспечить соблюдение правил пожарной безопасности, производственной санитарии и безопасности труда.',
    ),
    clause(
      '6.2.3. Нести риск случайного повреждения материалов, оборудования и результата работ до их приёмки Заказчиком.',
    ),

    sectionHead('7. ОСОБЫЕ УСЛОВИЯ'),
    clause(
      '7.1. Стороны не несут ответственности за неисполнение договора вследствие форс-мажорных обстоятельств (пожары, землетрясения, наводнения и иные стихийные бедствия), наступивших после подписания договора.',
    ),
    clause(
      '7.2. За задержку оплаты более трёх банковских дней после приёмки работ Заказчик выплачивает пеню в размере 0,1% от суммы окончательного расчёта за каждый день просрочки, но не более 0,5% от стоимости договора.',
    ),
    clause(
      '7.3. Споры подлежат урегулированию по договорённости Сторон; при необходимости — в претензионном порядке (срок ответа — семь календарных дней). При отсутствии договорённости споры рассматриваются в районном суде по месту исполнения договора.',
    ),
    clause(
      '7.4. Подрядчик гарантирует устранение за свой счёт дефектов отделочных работ в течение 24 месяцев с момента подписания акта сдачи-приёмки при условии правильной эксплуатации.',
    ),
    clause(
      '7.5. Одностороннее изменение договора не допускается. Во всём остальном Стороны руководствуются законодательством РФ.',
    ),
    clause(
      '7.6. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из Сторон.',
    ),
    clause(
      '7.7. Дополнительные работы, не учтённые в смете, оформляются дополнительными соглашениями и сметами.',
    ),
    clause(
      '7.8. При изменении реквизитов Стороны извещают друг друга в течение трёх банковских дней.',
    ),
    clause(
      '7.9. Стороны обязуются не разглашать условия договора и информацию, полученную в процессе работ.',
    ),
    clause(
      '7.10. За задержку сроков работ по вине Подрядчика (п. 2.1) Подрядчик выплачивает пеню 0,1% от суммы окончательного расчёта за каждый день просрочки, но не более 0,5% от стоимости договора.',
    ),

    sectionHead('8. ГАРАНТИИ'),
    clause(
      '8.1. Подрядчик гарантирует соответствие качества работ, материалов и оборудования условиям договора, проектной документации, СНиП и СанПиН, а также своевременное устранение недостатков в гарантийный период.',
    ),
    clause(
      '8.2. Гарантийный срок на результат работ — 24 месяца с момента подписания окончательного акта приёмки.',
    ),
    clause(
      '8.3. Материалы, инженерные системы и оборудование обеспечиваются гарантиями их изготовителей.',
    ),
    clause(
      '8.4. Гарантии не распространяются на повреждения Объекта третьими лицами или действиями Заказчика.',
    ),

    sectionHead('9. ЛИЦЕНЗИИ И СЕРТИФИКАТЫ'),
    clause(
      '9.1. Сторона, предоставившая материалы и оборудование, несёт расходы по их сертифицированию и лицензированию.',
    ),

    sectionHead('10. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН'),
    para(''),
    partyTable('ЗАКАЗЧИК', clientPartyRows(client)),
    para(''),
    signatureBlock('Заказчик', clientFio),
    para(''),
    partyTable('ПОДРЯДЧИК / ИСПОЛНИТЕЛЬ', contractorPartyRows(executor)),
    para(''),
    signatureBlock('Подрядчик', execFio),
    para(''),

    title('ПРИЛОЖЕНИЕ №1'),
    para(
      `к договору подряда на ремонт квартиры № ${form.number || '__'} от ${d.full}`,
      { center: true, bold: true, after: 80 },
    ),
    para(`Адрес объекта: ${addr}`, { center: true, after: 200 }),
    clause(
      discountPct > 0
        ? `Стоимость видов работ по смете: ${formatMoney(baseTotal)} ₽. Скидка — ${discountPct}%. Итого к оплате: ${formatMoney(form.totalSum)} (${sumWords}). Выплаты определяются по мере выполнения работ по договорённости Сторон.`
        : `Стоимость видов работ по договору составляет ${formatMoney(form.totalSum)} (${sumWords}). Выплаты определяются по мере выполнения работ по договорённости Сторон.`,
    ),
  ]

  if (smeta.length > 0) {
    children.push(para('Детализация сметы', { bold: true, after: 120, before: 120 }))
    const asSmeta: SmetaLine[] = smeta.map((l) => ({
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      price: l.price,
      section: l.section || 'Прочее',
    }))
    const groups = groupSmetaLines(asSmeta)
    let nextNo = 1
    for (const g of groups) {
      children.push(
        para(`Раздел: ${prettySectionTitle(g.section)}`, {
          bold: true,
          after: 80,
          before: 120,
        }),
      )
      const built = smetaSectionTable(nextNo, g.rows)
      nextNo = built.nextNo
      children.push(built.table)
      children.push(
        para(`Итого по разделу «${prettySectionTitle(g.section)}»: ${formatMoney(built.subtotal)} ₽`, {
          bold: true,
          after: 60,
          before: 60,
        }),
      )
    }
    if (discountPct > 0) {
      children.push(
        para(`Итого по смете (без скидки): ${formatMoney(baseTotal)} ₽`, {
          bold: true,
          after: 40,
          before: 120,
        }),
      )
      children.push(
        para(`Скидка — ${discountPct}%: −${formatMoney(baseTotal - form.totalSum)} ₽`, {
          after: 40,
        }),
      )
    }
    children.push(
      para(`Итого к оплате: ${formatMoney(form.totalSum)} ₽`, {
        bold: true,
        after: 80,
        before: discountPct > 0 ? 40 : 120,
      }),
    )
  } else {
    children.push(
      para(
        'Детализация позиций сметы не приложена — указана итоговая сумма. При необходимости сформируйте детализацию в калькуляторе с опцией переноса.',
        { italics: true },
      ),
    )
  }

  children.push(para(''))
  children.push(signatureBlock('Заказчик', clientFio))
  children.push(para(''))
  children.push(signatureBlock('Подрядчик', execFio))

  return docShell(children, `Договор ремонта № ${form.number || '—'}`)
}

export async function buildDesignDocument(client: ClientCard, form: DesignForm): Promise<Document> {
  const d = formatDateRu(form.date)
  const area = form.areaM2 || 0
  const total = area * DESIGN_RATE_PER_M2
  const quarter = total / 4
  const sumWords = rublesInWords(total)
  const qWords = rublesInWords(quarter)
  const rate = DESIGN_RATE_PER_M2.toLocaleString('ru-RU')
  const qRate = (DESIGN_RATE_PER_M2 / 4).toLocaleString('ru-RU')
  const executor = form.executorName.trim() || CONTRACTOR.name
  const clientFio = shortFio(client.fizurlico === 'ur' ? client.podpisant || client.name : client.name)
  const execFio = shortFio(executor)
  const addr = form.objectAddress || '___________________________________________________'

  const children: FileChild[] = [
    title('ДОГОВОР О СОЗДАНИИ ДИЗАЙН-ПРОЕКТА'),
    para(`№ ${form.number || '__'}`, { bold: true, center: true, size: 24, after: 80 }),
    metaLine(form.city, d.full),
    clause(
      `${client.name || '____________________________________'}, именуемый в дальнейшем «Заказчик», с одной стороны, и ${executor}, именуемый в дальнейшем «Исполнитель», с другой стороны, заключили настоящий договор о нижеследующем:`,
    ),

    sectionHead('1. ПРЕДМЕТ ДОГОВОРА'),
    clause(
      `1.1. Исполнитель обязуется разработать дизайн-проект интерьера помещения по адресу: ${addr}, в соответствии с условиями настоящего договора и Техническим заданием (Приложение 1), а Заказчик обязуется создать необходимые условия, принять и оплатить результат работ.`,
    ),

    sectionHead('2. ПРАВА И ОБЯЗАННОСТИ СТОРОН'),
    clause('2.1. Обязанности Исполнителя:'),
    clause(
      '2.1.1. Выполнить работы качественно, в объёме и сроки, предусмотренные договором, и сдать работу по акту.',
    ),
    clause(
      '2.1.2. Обеспечить соответствие решений Техническому заданию и исходным данным Заказчика.',
    ),
    clause('2.2. Обязанности Заказчика:'),
    clause('2.2.1. Предоставить ТЗ и исходные данные.'),
    clause('2.2.2. Обеспечить свободный доступ Исполнителя на Объект.'),
    clause('2.2.3. Своевременно принимать этапы работ и производить оплату согласно разделу 4.'),
    clause('2.2.4. Соблюдать авторские и иные исключительные права Исполнителя на дизайн-проект.'),
    clause(
      '2.3. Исполнитель вправе самостоятельно определять способ выполнения работ, привлекать третьих лиц, приостанавливать работы при неподписании промежуточных актов или неоплате.',
    ),
    clause(
      '2.4. Заказчик вправе утверждать промежуточные этапы и давать указания, не противоречащие договору и не вмешивающиеся в оперативно-хозяйственную деятельность Исполнителя.',
    ),

    sectionHead('3. СРОКИ ВЫПОЛНЕНИЯ РАБОТ'),
    clause(
      '3.1.1. Начало работ — в течение 5 рабочих дней с момента выполнения Заказчиком п. 2.2.1, 2.2.2 и 4.4.1.',
    ),
    clause('3.1.2. Окончание работ — в течение 60 рабочих дней с даты начала.'),
    clause('3.2. Промежуточные этапы:'),
    clause('3.2.1. Обмерный план и планировочное решение — 10 рабочих дней;'),
    clause('3.2.2. Визуализация интерьера — 20 рабочих дней;'),
    clause('3.2.3. Рабочие чертежи — 15 рабочих дней;'),
    clause('3.2.4. Ведомость чистового материала — 15 рабочих дней.'),
    clause(
      '3.3. Срок каждого последующего этапа начинается с подписания промежуточного акта по предыдущему этапу.',
    ),

    sectionHead('4. ПОРЯДОК РАСЧЁТОВ'),
    clause(
      `4.1. Стоимость работ составляет ${rate} ₽ за 1 кв.м фактической площади объекта и складывается из этапов (по ${qRate} ₽/кв.м каждый): обмерный план и планировочное решение; визуализация; рабочие чертежи; ведомость чистовых материалов.`,
    ),
    clause(
      `4.2. Договор подписывается на основании заявленной площади Объекта ${area || '____'} кв.м. После обмеров площадь корректируется дополнительным соглашением.`,
    ),
    clause(`4.3. Общая стоимость работ: ${formatMoney(total)} (${sumWords}).`),
    clause('4.4. Оплата этапов:'),
    clause(
      `4.4.1. ${formatMoney(quarter)} (${qWords}) — в течение 3 рабочих дней с момента подписания договора (обмерный план и планировочные решения).`,
    ),
    clause(
      `4.4.2. ${formatMoney(quarter)} (${qWords}) — в течение 3 рабочих дней перед первым вариантом визуализации.`,
    ),
    clause(
      `4.4.3. ${formatMoney(quarter)} (${qWords}) — в течение 3 рабочих дней перед разработкой рабочих чертежей.`,
    ),
    clause(
      `4.4.4. ${formatMoney(quarter)} (${qWords}) — в течение 3 рабочих дней перед ведомостью чистовых материалов.`,
    ),
    clause(
      '4.5. При расторжении оплате подлежит часть стоимости, пропорциональная выполненной работе. Выезд на замер и обмерный план составляют 20% стоимости первого этапа.',
    ),

    sectionHead('5. ПОРЯДОК ОСУЩЕСТВЛЕНИЯ И ПРИЁМКИ РАБОТ'),
    clause(
      '5.1. Работы выполняются этапами с подписанием актов. Состав документов по этапам — обмерный план и планировки; фотореалистичные 3D-визуализации (до 2 корректировок); комплект рабочих чертежей и ведомости; ведомость чистовых материалов.',
    ),
    clause(
      '5.2. К следующему этапу Исполнитель приступает после согласования предыдущего и оплаты.',
    ),
    clause(
      '5.3. Если в течение 5 рабочих дней Заказчик не подписывает акт и не направляет мотивированный отказ, работы считаются принятыми без замечаний.',
    ),

    sectionHead('6. ОТВЕТСТВЕННОСТЬ СТОРОН'),
    clause(
      '6.1–6.2. За просрочку обязательств Сторона уплачивает штраф 1% от суммы несвоевременно исполненных обязательств за каждый рабочий день просрочки.',
    ),
    clause(
      '6.3. Исполнитель не отвечает за строительно-отделочные работы сторонних лиц, привлечённых Заказчиком.',
    ),

    sectionHead('7. РАЗРЕШЕНИЕ СПОРОВ'),
    clause(
      '7.1. Споры разрешаются путём переговоров. Неурегулированные споры рассматриваются в Тверском районном суде г. Москвы (договорная подсудность, ст. 32 ГПК РФ).',
    ),

    sectionHead('8. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ'),
    clause(
      '8.1. Договор действует с момента подписания до полного исполнения обязательств. Изменения — в простой письменной форме.',
    ),
    clause(
      '8.2. Допускаются электронная переписка, мессенджеры и факсимиле при согласовании материалов. НДС не облагается (УСН Исполнителя).',
    ),
    clause('8.3. Договор составлен в двух экземплярах равной юридической силы.'),

    sectionHead('9. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН'),
    para(''),
    partyTable('ЗАКАЗЧИК', clientPartyRows(client)),
    para(''),
    signatureBlock('Заказчик', clientFio),
    para(''),
    partyTable('ИСПОЛНИТЕЛЬ', contractorPartyRows(executor)),
    para(''),
    signatureBlock('Исполнитель', execFio),
  ]

  return docShell(children, `Договор дизайна № ${form.number || '—'}`)
}

export async function buildAktDocument(client: ClientCard, form: AktForm): Promise<Document> {
  const d = formatDateRu(form.date)
  const lines = form.lines.filter((l) => l.name.trim())
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const paid = form.paid || 0
  const rest = Math.max(0, total - paid)
  const executor = form.executorName.trim() || CONTRACTOR.name
  const clientFio = shortFio(client.fizurlico === 'ur' ? client.podpisant || client.name : client.name)
  const execFio = shortFio(executor)

  const summaryRows: [string, string][] = [
    ['Стоимость работ по акту', `${formatMoney(total)} ₽`],
    ['Оплачено', `${formatMoney(paid)} ₽`],
    ['Остаток к оплате', `${formatMoney(rest)} ₽`],
    ['Сумма прописью', rublesInWords(total)],
  ]

  const children: FileChild[] = [
    title('АКТ ВЫПОЛНЕННЫХ РАБОТ'),
    para(`№ ${form.number || '___'}`, { bold: true, center: true, size: 24, after: 60 }),
    para(`по этапу «${form.stageName || '________________'}»`, {
      center: true,
      bold: true,
      size: 22,
      after: 80,
    }),
    metaLine(form.city, d.full),
    clause(
      `Мы, нижеподписавшиеся: ${client.name || '________________'}, именуемый в дальнейшем «Заказчик», с одной стороны, и ${executor}, именуемый в дальнейшем «Исполнитель», с другой стороны, составили настоящий Акт о том, что Исполнитель выполнил, а Заказчик принял следующие работы на объекте:`,
    ),
    para(`Адрес объекта: ${form.objectAddress || '—'}`, { bold: true, after: 200 }),

    sectionHead('1. ПЕРЕЧЕНЬ ВЫПОЛНЕННЫХ РАБОТ'),
    moneyTable(
      lines.length
        ? lines
        : [{ name: '—', unit: 'ед.', qty: 0, price: 0 }],
    ),
    para(''),
    partyTable('ИТОГО ПО АКТУ', summaryRows),

    sectionHead('2. КАЧЕСТВО РАБОТ'),
    clause(
      'Работы по Договору, указанные в Акте, выполнены в соответствии с условиями Договора и приложений к нему (смета, график, ТЗ).',
    ),
    clause(
      'Заказчик к выполненным работам по Договору, указанным в Акте, не имеет замечаний и возражений.',
    ),

    sectionHead('3. РАСЧЁТЫ'),
    clause(
      `Стоимость работ по акту: ${formatMoney(total)} ₽. Оплачено: ${formatMoney(paid)} ₽. Остаток к оплате: ${formatMoney(rest)} ₽.`,
    ),

    sectionHead('4. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН'),
    para(''),
    partyTable('ЗАКАЗЧИК', clientPartyRows(client)),
    para(''),
    signatureBlock('Заказчик', clientFio),
    para(''),
    partyTable('ИСПОЛНИТЕЛЬ', contractorPartyRows(executor)),
    para(''),
    signatureBlock('Исполнитель', execFio),
  ]

  return docShell(children, `Акт № ${form.number || '—'}`)
}

export type SmetaLine = {
  name: string
  unit: string
  qty: number
  price: number
  section?: string
}

export type SmetaForm = {
  number: string
  date: string
  city: string
  objectAddress: string
  objectTitle: string
  areaM2: number
  workDays: number
  /** Скидка, % (из калькулятора / эталон Sky Garden); 0 = без скидки */
  discountPct: number
  /** Свёртка: только итоги по разделам, без построчной детализации */
  rolledUp: boolean
  lines: SmetaLine[]
  executorName: string
}

/** Порядок разделов как в смете Sky Garden / прайсе (полы до стен); неизвестные — в конец */
const SMETA_SECTION_ORDER = [
  'ДЕМОНТАЖНЫЕ РАБОТЫ',
  'Демонтажные работы',
  'Демонтаж',
  'ПОЛЫ',
  'Полы',
  'СТЕНЫ',
  'Стены',
  'ПОТОЛКИ',
  'Потолки',
  'ЭЛЕКТРИКА',
  'Электрика',
  'САНТЕХНИКА',
  'Сантехника',
  'Завершающие работы',
  'Подготовительные работы',
  'ПРОЧЕЕ',
  'Прочее',
]

function prettySectionTitle(name: string): string {
  const map: Record<string, string> = {
    'ДЕМОНТАЖНЫЕ РАБОТЫ': 'Демонтажные работы',
    ПОЛЫ: 'Полы',
    СТЕНЫ: 'Стены',
    ПОТОЛКИ: 'Потолки',
    ЭЛЕКТРИКА: 'Электрика',
    САНТЕХНИКА: 'Сантехника',
    ПРОЧЕЕ: 'Прочее',
  }
  const key = name.trim().toUpperCase()
  return map[key] || name.trim() || 'Прочее'
}

function sectionSortKey(name: string): number {
  const n = name.trim().toLowerCase()
  const idx = SMETA_SECTION_ORDER.findIndex(
    (s) => s.toLowerCase() === n || n.includes(s.toLowerCase()) || s.toLowerCase().includes(n),
  )
  return idx >= 0 ? idx : 100 + (name.charCodeAt(0) || 0)
}

function groupSmetaLines(lines: SmetaLine[]): { section: string; rows: SmetaLine[] }[] {
  const map = new Map<string, SmetaLine[]>()
  for (const l of lines) {
    const sec = (l.section || 'Прочее').trim() || 'Прочее'
    const list = map.get(sec) ?? []
    list.push(l)
    map.set(sec, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => sectionSortKey(a) - sectionSortKey(b))
    .map(([section, rows]) => ({ section, rows }))
}

function smetaSectionTable(
  startNo: number,
  rows: SmetaLine[],
): { table: Table; nextNo: number; subtotal: number } {
  const cols = [700, 3800, 900, 900, 1400, 1600]
  const header = new TableRow({
    children: ['№', 'Наименование работ', 'Ед.', 'Кол-во', 'Цена, ₽', 'Стоимость, ₽'].map(
      (t, i) => cell(t, cols[i], { header: true, center: true }),
    ),
  })
  let no = startNo
  let subtotal = 0
  const body = rows.map((l, i) => {
    const sum = l.qty * l.price
    subtotal += sum
    const zebra = i % 2 === 1 ? ZEBRA : undefined
    const rowNo = no++
    return new TableRow({
      children: [
        cell(String(rowNo), cols[0], { center: true, fill: zebra }),
        cell(l.name, cols[1], { fill: zebra }),
        cell(l.unit || 'ед.', cols[2], { center: true, fill: zebra }),
        cell(String(l.qty), cols[3], { center: true, fill: zebra }),
        cell(formatMoney(l.price), cols[4], { center: true, fill: zebra }),
        cell(formatMoney(sum), cols[5], { center: true, fill: zebra, bold: true }),
      ],
    })
  })
  return {
    table: new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: cols,
      rows: [header, ...body],
    }),
    nextNo: no,
    subtotal,
  }
}

/** Свёртка: одна строка на раздел */
function smetaRollupTable(
  groups: { section: string; rows: SmetaLine[]; subtotal: number }[],
): Table {
  const cols = [700, 6200, 2400]
  const header = new TableRow({
    children: ['№', 'Раздел / этап', 'Стоимость, ₽'].map((t, i) =>
      cell(t, cols[i], { header: true, center: true }),
    ),
  })
  const body = groups.map((g, i) => {
    const zebra = i % 2 === 1 ? ZEBRA : undefined
    return new TableRow({
      children: [
        cell(String(i + 1), cols[0], { center: true, fill: zebra }),
        cell(prettySectionTitle(g.section), cols[1], { fill: zebra, bold: true }),
        cell(formatMoney(g.subtotal), cols[2], { center: true, fill: zebra, bold: true }),
      ],
    })
  })
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [header, ...body],
  })
}

function smetaBanner(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120, before: 0 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: 'A8C9A0', space: 6 },
    },
    children: [run(text, { bold: true, size: 32, color: '1A1A1A' })],
  })
}

/** Отдельный документ «Смета» (эталон: приложение к договору / Sky Garden PDF) */
export async function buildSmetaDocument(client: ClientCard, form: SmetaForm): Promise<Document> {
  const d = formatDateRu(form.date)
  const executor = form.executorName.trim() || CONTRACTOR.name
  const clientFio = shortFio(client.fizurlico === 'ur' ? client.podpisant || client.name : client.name)
  const execFio = shortFio(executor)
  const addr = form.objectAddress || '—'
  const objectLabel = form.objectTitle.trim() || addr
  const lines = form.lines.filter((l) => l.name.trim() && l.qty > 0)
  const groups = groupSmetaLines(lines)
  const groupsWithSum = groups.map((g) => ({
    ...g,
    subtotal: g.rows.reduce((s, l) => s + l.qty * l.price, 0),
  }))
  const baseTotal = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const discountPct = Math.max(0, Math.min(100, Number(form.discountPct) || 0))
  const discountSum = Math.round(baseTotal * (discountPct / 100) * 100) / 100
  const grandTotal = Math.round((baseTotal - discountSum) * 100) / 100
  const rolledUp = Boolean(form.rolledUp)

  const children: FileChild[] = [
    smetaBanner(`СМЕТА № ${form.number || '___'}`),
    para(`от ${d.full}`, { center: true, bold: true, size: 22, after: 40 }),
    para('Приложение №1 к договору', { center: true, italics: true, after: 80 }),
    metaLine(form.city, d.full),
    partyTable('РЕКВИЗИТЫ СМЕТЫ', [
      ['Заказчик', client.name || '—'],
      ['Объект', objectLabel],
      ['Адрес', addr],
      ['Площадь', form.areaM2 ? `${form.areaM2} м²` : '—'],
      ['Срок исполнения', form.workDays ? `${form.workDays} раб. дней` : '—'],
      ['Исполнитель', executor],
      ...(discountPct > 0 ? ([['Скидка', `${discountPct} %`]] as [string, string][]) : []),
      ...(rolledUp
        ? ([['Форма', 'Сводная (по разделам)']] as [string, string][])
        : []),
    ]),
    para(''),
  ]

  if (groupsWithSum.length === 0) {
    children.push(
      para('Позиции сметы не заполнены — добавьте строки или перенесите объёмы из калькулятора.', {
        italics: true,
      }),
    )
  } else if (rolledUp) {
    children.push(sectionHead('СВОДКА ПО РАЗДЕЛАМ'))
    children.push(smetaRollupTable(groupsWithSum))
  } else {
    let nextNo = 1
    groupsWithSum.forEach((g, gi) => {
      children.push(sectionHead(`Раздел ${gi + 1}. ${prettySectionTitle(g.section)}`))
      const built = smetaSectionTable(nextNo, g.rows)
      nextNo = built.nextNo
      children.push(built.table)
      children.push(
        para(
          `Итого по разделу «${prettySectionTitle(g.section)}»: ${formatMoney(built.subtotal)} ₽`,
          {
            bold: true,
            after: 100,
            before: 80,
          },
        ),
      )
    })
  }

  const summaryRows: [string, string][] = [
    ['Итого по всем разделам', `${formatMoney(baseTotal)} ₽`],
  ]
  if (discountPct > 0) {
    summaryRows.push([`Скидка — ${discountPct}%`, `−${formatMoney(discountSum)} ₽`])
  }
  summaryRows.push(['Итого к оплате', `${formatMoney(grandTotal)} ₽`])
  summaryRows.push(['Сумма прописью', rublesInWords(grandTotal)])

  children.push(sectionHead('ИТОГО'))
  children.push(partyTable('СВОДКА', summaryRows))
  children.push(para(''))
  children.push(
    clause(
      'Настоящая смета определяет перечень, объёмы и стоимость работ. Дополнительные работы, не учтённые в смете, оформляются отдельным соглашением.',
    ),
  )
  children.push(para(''))
  children.push(partyTable('ЗАКАЗЧИК', clientPartyRows(client)))
  children.push(para(''))
  children.push(signatureBlock('Заказчик', clientFio))
  children.push(para(''))
  children.push(partyTable('ИСПОЛНИТЕЛЬ', contractorPartyRows(executor)))
  children.push(para(''))
  children.push(signatureBlock('Исполнитель', execFio))

  return docShell(children, `Смета № ${form.number || '—'}`)
}

export async function generateRemontDoc(client: ClientCard, form: RemontForm) {
  const doc = await buildRemontDocument(client, form)
  await downloadDoc(doc, `Dogovor_remont_${form.number || client.id}.docx`)
}

export async function generateDesignDoc(client: ClientCard, form: DesignForm) {
  const doc = await buildDesignDocument(client, form)
  await downloadDoc(doc, `Dogovor_design_${form.number || client.id}.docx`)
}

export async function generateAktDoc(client: ClientCard, form: AktForm) {
  const doc = await buildAktDocument(client, form)
  await downloadDoc(doc, `Akt_${form.number || client.id}.docx`)
}

export async function generateSmetaDoc(client: ClientCard, form: SmetaForm) {
  const doc = await buildSmetaDocument(client, form)
  await downloadDoc(doc, `Smeta_${form.number || client.id}.docx`)
}
