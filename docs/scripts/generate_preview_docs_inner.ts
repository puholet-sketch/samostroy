import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Packer } from 'docx'
import { emptyClient } from '../../src/lib/clients'
import { CONTRACTOR } from '../../src/lib/contractor'
import {
  buildAktDocument,
  buildDesignDocument,
  buildRemontDocument,
} from '../../src/lib/generateDocs'

const outDir = process.argv[2] || join(process.cwd(), 'docs/preview')
mkdirSync(outDir, { recursive: true })

const client = emptyClient({
  id: 'preview',
  name: 'Иванов Пётр Сергеевич',
  email: 'ivanov@example.com',
  mobile: '+7 916 000-11-22',
  city: 'Москва',
  passport_number: '4500 123456',
  passport_issued: 'ОВД Тверского района г. Москвы',
  passport_date_issued: '20.05.2010',
  passport_code: '770-001',
  address: 'г. Москва, ул. Тверская, д. 1, кв. 10',
})

async function save(name: string, doc: Awaited<ReturnType<typeof buildRemontDocument>>) {
  const buf = await Packer.toBuffer(doc)
  const path = join(outDir, name)
  writeFileSync(path, buf)
  console.log(path)
}

await save(
  '01_Dogovor_remont_preview.docx',
  await buildRemontDocument(client, {
    number: '13',
    date: '2026-10-21',
    city: 'Москва',
    objectAddress: '119501, г. Москва, ул. Веерная, д. 7, к. 1',
    totalSum: 28020,
    workDays: 80,
    executorName: CONTRACTOR.name,
    smetaLines: [
      { name: 'Демонтаж перегородок', unit: 'м²', qty: 12, price: 850 },
      { name: 'Штукатурка стен', unit: 'м²', qty: 40, price: 420 },
      { name: 'Электромонтаж', unit: 'точка', qty: 18, price: 650 },
    ],
  }),
)

await save(
  '02_Dogovor_design_preview.docx',
  await buildDesignDocument(client, {
    number: '7',
    date: '2026-10-21',
    city: 'Москва',
    objectAddress: '119501, г. Москва, ул. Веерная, д. 7, к. 1',
    areaM2: 62,
    executorName: CONTRACTOR.name,
  }),
)

await save(
  '03_Akt_preview.docx',
  await buildAktDocument(client, {
    number: '5',
    date: '2026-09-16',
    city: 'Москва',
    objectAddress: 'г. Москва, ул. Марка Шагала, д. 11, к. 3, кв. 32',
    stageName: 'Монтаж керамогранита и предчистовая подготовка стен',
    paid: 200000,
    executorName: CONTRACTOR.name,
    lines: [
      { name: 'Монтаж керамогранита', unit: 'ед.', qty: 1, price: 250000 },
      { name: 'Предчистовая подготовка стен', unit: 'ед.', qty: 1, price: 120000 },
      { name: 'Возведение и оштукатуривание', unit: 'ед.', qty: 1, price: 30000 },
      { name: 'Монтаж настенного радиатора', unit: 'ед.', qty: 1, price: 15000 },
      { name: 'Подготовка откосов для двери скрытого монтажа', unit: 'ед.', qty: 1, price: 10000 },
    ],
  }),
)

console.log('OK →', outDir)
