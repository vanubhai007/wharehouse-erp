const { PassThrough } = require('stream');
const pdfService = require('../services/pdfService');
const { parsePdf } = require('./helpers/pdfText');

const { generateTablePdf, formatINR, formatDateTimeIST, MAX_REPORT_ROWS } = pdfService;

// 20:00 UTC on 21 Oct is 01:30 IST on 22 Oct - proves the IST conversion.
const FIXED_TIME = new Date('2026-10-21T20:00:00Z');
const SETTINGS = {
  companyName: 'HR Warehouse',
  companyAddress: '12 Ring Road, Ahmedabad',
  companyGstin: '24ABCDE1234F1Z5',
  companyPhone: '+91 98765 43210',
  companyEmail: 'accounts@hrwarehouse.test',
};
const COLUMNS = [
  { key: 'itemId', label: 'Item ID', weight: 1, minWidth: 60 },
  { key: 'name', label: 'Name', weight: 3, minWidth: 120 },
  { key: 'status', label: 'Status', weight: 1, minWidth: 70 },
  { key: 'cost', label: 'Cost', weight: 1, minWidth: 70, align: 'right' },
];
const itemRows = (n) => Array.from({ length: n }, (_, i) => ({
  itemId: `ITM-${String(i).padStart(5, '0')}`,
  name: `Item ${i}`,
  status: 'In Warehouse',
  cost: formatINR(100 + i),
}));

// Renders a report through a fake response and returns { buffer, headers, layout }.
async function render(options) {
  const res = new PassThrough();
  const headers = {};
  res.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  const ended = new Promise((resolve, reject) => {
    res.on('end', resolve);
    res.on('error', reject);
  });
  const layout = await generateTablePdf(res, { title: 'Test Report', settings: SETTINGS, columns: COLUMNS, generatedAt: FIXED_TIME, ...options });
  await ended;
  return { buffer: Buffer.concat(chunks), headers, layout };
}

// -----------------------------------------------------------------------------

describe('generateTablePdf - document basics', () => {
  test('1. produces a valid PDF download with the expected headers and filename', async () => {
    const { buffer, headers } = await render({ title: 'Expense Report', filenameBase: 'expense-report', rows: itemRows(3) });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['content-disposition']).toBe('attachment; filename="expense-report-2026-10-22.pdf"');
  });

  test('2. shows the generation time in IST (Asia/Kolkata), including the date rollover', async () => {
    expect(formatDateTimeIST(FIXED_TIME)).toBe('22 Oct 2026, 01:30 am IST');
    const { buffer, headers } = await render({ rows: itemRows(1) });
    expect(parsePdf(buffer).pages[0].texts).toContain('Generated: 22 Oct 2026, 01:30 am IST');
    expect(headers['content-disposition']).toContain('2026-10-22.pdf');
  });

  test('3. prints company branding, title and active filters (and no filter line when there are none)', async () => {
    const withFilters = parsePdf((await render({ title: 'Expense Report', rows: itemRows(1), filters: [{ label: 'Category', value: 'Refurbishment' }, { label: 'From', value: '01 Oct 2026' }] })).buffer);
    const page1 = withFilters.pages[0].texts.join('\n');
    for (const text of ['HR Warehouse', 'Expense Report', '12 Ring Road, Ahmedabad', 'GSTIN: 24ABCDE1234F1Z5', 'Phone: +91 98765 43210', 'Email: accounts@hrwarehouse.test']) {
      expect(page1).toContain(text);
    }
    expect(page1).toContain('Filters: Category = Refurbishment; From = 01 Oct 2026');

    const noFilters = parsePdf((await render({ rows: itemRows(1) })).buffer);
    expect(noFilters.pages[0].texts.join('\n')).not.toContain('Filters:');
  });
});

describe('generateTablePdf - multi-page tables', () => {
  let parsed;
  let layout;
  beforeAll(async () => {
    const out = await render({ title: 'Inventory Report', rows: itemRows(300) });
    parsed = parsePdf(out.buffer);
    layout = out.layout;
  });

  test('4. spans several pages with "Page k of N" once per page, headers repeated and "(continued)" titles', () => {
    const n = parsed.pages.length;
    expect(n).toBeGreaterThan(1);
    expect(layout.pages).toBe(n);
    parsed.pages.forEach((page, i) => {
      expect(page.texts.filter((t) => t === `Page ${i + 1} of ${n}`)).toHaveLength(1);
      expect(page.texts.filter((t) => t === 'Item ID')).toHaveLength(1);
      expect(page.texts.filter((t) => t === 'Cost')).toHaveLength(1);
      if (i > 0) expect(page.texts).toContain('Inventory Report (continued)');
    });
    expect(parsed.allTexts.filter((t) => /^Page \d+ of \d+$/.test(t))).toHaveLength(n);
  });

  test('5. renders every row exactly once and in order', () => {
    const ids = parsed.allTexts.filter((t) => /^ITM-\d{5}$/.test(t));
    expect(ids).toEqual(itemRows(300).map((r) => r.itemId));
  });

  test('6. never draws table text into the footer area', () => {
    expect(layout.maxTextBottom).toBeLessThanOrEqual(layout.contentBottomLimit);
  });
});

describe('generateTablePdf - wrapping and layout', () => {
  test('7. wraps long text inside a cell without losing any words', async () => {
    const words = Array.from({ length: 70 }, (_, i) => `w${String(i).padStart(3, '0')}`);
    const rows = [{ itemId: 'ITM-00001', name: words.join(' '), status: 'Received', cost: formatINR(1) }];
    const { buffer } = await render({ rows });
    const nameLines = parsePdf(buffer).pages[0].texts.filter((t) => /w\d{3}/.test(t));
    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.join(' ').split(/\s+/).filter(Boolean)).toEqual(words);
  });

  test('8. splits a cell taller than a page across pages, repeating the header, with nothing lost', async () => {
    const words = Array.from({ length: 900 }, (_, i) => `L${String(i).padStart(3, '0')}`);
    const rows = [...itemRows(2), { itemId: 'ITM-TALL', name: words.join(' '), status: 'Received', cost: formatINR(1) }];
    const parsed = parsePdf((await render({ rows })).buffer);
    expect(parsed.pages.length).toBeGreaterThan(1);
    const found = parsed.allTexts.filter((t) => /L\d{3}/.test(t)).join(' ').split(/\s+/).filter(Boolean);
    expect(found).toEqual(words);
    const page2 = parsed.pages[1].texts;
    expect(page2).toContain('Item ID');
    expect(page2.indexOf('Item ID')).toBeLessThan(page2.findIndex((t) => /L\d{3}/.test(t)));
  });

  test('9. picks portrait or landscape automatically and never drops a column', async () => {
    const narrow = parsePdf((await render({ rows: itemRows(2) })).buffer);
    expect(narrow.pages[0].mediaBox.slice(2)).toEqual([595.28, 841.89]);

    const tenCols = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, label: `Col ${i}`, minWidth: 60 }));
    const wide = parsePdf((await render({ columns: tenCols, rows: [Object.fromEntries(tenCols.map((c) => [c.key, `v-${c.key}`]))] })).buffer);
    expect(wide.pages[0].mediaBox.slice(2)).toEqual([841.89, 595.28]);

    const manyCols = Array.from({ length: 16 }, (_, i) => ({ key: `c${i}`, label: `Col ${i}`, minWidth: 60 }));
    const veryWide = parsePdf((await render({ columns: manyCols, rows: [Object.fromEntries(manyCols.map((c) => [c.key, `value-${c.key}`]))] })).buffer);
    expect(veryWide.pages[0].mediaBox.slice(2)).toEqual([841.89, 595.28]);
    const headerText = veryWide.pages[0].texts.join(' ');
    manyCols.forEach((c) => expect(headerText).toContain(`Col ${c.key.slice(1)}`));
    const values = veryWide.pages[0].texts.join('');
    manyCols.forEach((c) => expect(values).toContain(`value-${c.key}`));
  });

  test('10. draws the totals row and summary after the last row, together on the last page', async () => {
    const { buffer } = await render({
      rows: itemRows(120),
      totalsRow: { itemId: 'Total', cost: formatINR(98765.25) },
      summary: [{ label: 'Items', value: '120' }, { label: 'Grand Total', value: formatINR(98765.25) }],
    });
    const parsed = parsePdf(buffer);
    const last = parsed.pages[parsed.pages.length - 1].texts;
    const lastRow = last.lastIndexOf('ITM-00119');
    const totalAt = last.indexOf('Total');
    expect(totalAt).toBeGreaterThan(-1);
    if (lastRow !== -1) expect(totalAt).toBeGreaterThan(lastRow);
    expect(last).toContain('Grand Total');
    expect(last.filter((t) => t === 'Rs. 98,765.25')).toHaveLength(2);
  });

  test('11. shows a clear message (and the column headers) when there are no rows', async () => {
    const { buffer, layout } = await render({ rows: [] });
    const parsed = parsePdf(buffer);
    expect(parsed.pages).toHaveLength(1);
    expect(layout.rowsRendered).toBe(0);
    expect(parsed.pages[0].texts).toContain('No records match the selected filters.');
    expect(parsed.pages[0].texts).toEqual(expect.arrayContaining(['Item ID', 'Name', 'Status', 'Cost']));
  });

  test('12. refuses a report over the row limit (413) instead of cutting rows; 2,000 by default', async () => {
    expect(MAX_REPORT_ROWS).toBe(2000);
    const res = new PassThrough();
    res.setHeader = jest.fn();
    await expect(generateTablePdf(res, { title: 'Big', settings: SETTINGS, columns: COLUMNS, rows: itemRows(51), maxRows: 50 }))
      .rejects.toMatchObject({ statusCode: 413, message: expect.stringContaining('This report has 51 matching records, more than the 50') });
    expect(res.setHeader).not.toHaveBeenCalled();
    const { buffer, layout } = await render({ rows: itemRows(50), maxRows: 50 });
    expect(layout).toMatchObject({ rowsRendered: 50, totalRows: 50 });
    expect(layout).not.toHaveProperty('truncated');
    expect(parsePdf(buffer).allTexts).toContain('ITM-00049');
  });
});

describe('generateTablePdf - English-only text', () => {
  test('13. writes amounts as "Rs." with Indian grouping and never prints the ₹ sign', async () => {
    expect(formatINR(123456.5)).toBe('Rs. 1,23,456.50');
    expect(formatINR(0)).toBe('Rs. 0.00');
    const rows = [
      { itemId: 'A1', name: 'Formatted', status: 'ok', cost: formatINR(123456.5) },
      { itemId: 'A2', name: 'Raw rupee sign in data', status: 'ok', cost: '₹500' },
    ];
    const parsed = parsePdf((await render({ rows })).buffer);
    expect(parsed.allTexts).toContain('Rs. 1,23,456.50');
    expect(parsed.allTexts).toContain('Rs. 500');
    expect(parsed.allTexts.join('')).not.toContain('₹');
  });

  test('14. keeps English punctuation and shows unsupported scripts as "?" (input left unchanged)', async () => {
    const row = { itemId: 'C1', name: 'Café – O’Brien “Ltd” €5', status: 'રમેશ Patel', cost: 'राजेश' };
    const original = { ...row };
    const parsed = parsePdf((await render({ rows: [row] })).buffer);
    expect(parsed.allTexts).toContain('Café – O’Brien “Ltd” €5');
    expect(parsed.allTexts).toContain('???? Patel');
    expect(parsed.allTexts).toContain('?????');
    expect(row).toEqual(original); // the caller's data is not modified
  });

  test('15. uses only the built-in Helvetica fonts and embeds no font files', async () => {
    const parsed = parsePdf((await render({ rows: itemRows(5), totalsRow: { itemId: 'Total' } })).buffer);
    expect([...new Set(parsed.baseFonts)].sort()).toEqual(['Helvetica', 'Helvetica-Bold']);
    expect(parsed.embeddedFontFiles).toBe(0);
  });
});

describe('generateTablePdf - amount columns stay on one line', () => {
  const loneRs = (texts) => texts.filter((t) => t.trim() === 'Rs.');

  test('18. crore-sized totals and amounts fit on one line in a narrow portrait amount column', async () => {
    const rows = [
      { itemId: 'A1', name: 'Diesel generator', status: 'In Warehouse', cost: formatINR(18600250.5) },
      { itemId: 'A2', name: 'Pallet truck', status: 'In Warehouse', cost: formatINR(186002) },
    ];
    const columns = COLUMNS.map((c) => (c.key === 'cost' ? { ...c, minWidth: 50, weight: 0.5 } : c));
    const { buffer } = await render({ columns, rows, totalsRow: { itemId: 'Total', cost: formatINR(123456789) } });
    const texts = parsePdf(buffer).allTexts;
    expect(texts).toContain('Rs. 12,34,56,789.00');
    expect(texts).toContain('Rs. 1,86,00,250.50');
    expect(texts).toContain('Rs. 1,86,002.00');
    expect(loneRs(texts)).toEqual([]);
  });

  test('19. a wide landscape table keeps every crore total on one line (cost-sheet shape)', async () => {
    const money = ['base', 'rental', 'refurb', 'marketing', 'logistics', 'other', 'total'];
    const columns = [
      { key: 'itemId', label: 'Item ID', minWidth: 55 },
      { key: 'name', label: 'Item Name', weight: 2, minWidth: 90 },
      ...money.map((key) => ({ key, label: key, weight: 1, minWidth: 62, align: 'right' })),
    ];
    const totalsRow = { itemId: 'Total', ...Object.fromEntries(money.map((key, i) => [key, formatINR(98765432.1 + i)])) };
    const rows = [{ itemId: 'ITM-1', name: 'Industrial air compressor with spare parts kit', ...Object.fromEntries(money.map((key) => [key, formatINR(4567890.25)])) }];
    const parsed = parsePdf((await render({ columns, rows, totalsRow })).buffer);
    expect(parsed.pages[0].mediaBox.slice(2)).toEqual([841.89, 595.28]);
    money.forEach((key, i) => expect(parsed.allTexts).toContain(formatINR(98765432.1 + i)));
    expect(parsed.allTexts.filter((t) => t === 'Rs. 45,67,890.25')).toHaveLength(7);
    expect(loneRs(parsed.allTexts)).toEqual([]);
  });

  test('20. text columns still wrap normally next to fitted amount columns', async () => {
    const words = Array.from({ length: 40 }, (_, i) => `w${String(i).padStart(2, '0')}`);
    const rows = [{ itemId: 'W1', name: words.join(' '), status: 'Received', cost: formatINR(123456789) }];
    const texts = parsePdf((await render({ rows })).buffer).allTexts;
    const nameLines = texts.filter((t) => /w\d{2}/.test(t));
    expect(nameLines.length).toBeGreaterThan(1);
    expect(nameLines.join(' ').split(/\s+/)).toEqual(words);
    expect(texts).toContain('Rs. 12,34,56,789.00');
  });

  test('21. when amounts cannot all fit, columns shrink instead of being dropped (values still complete)', async () => {
    const columns = Array.from({ length: 9 }, (_, i) => ({ key: `m${i}`, label: `Amount ${i}`, minWidth: 40, align: 'right' }));
    const row = Object.fromEntries(columns.map((c) => [c.key, formatINR(123456789012.34)]));
    const { buffer, layout } = await render({ columns, rows: [row] });
    const parsed = parsePdf(buffer);
    expect(parsed.pages[0].mediaBox.slice(2)).toEqual([595.28, 841.89]);
    expect(layout.tableFontSize).toBe(8.5); // no smaller size would fit them all, so the default is kept
    columns.forEach((c) => expect(parsed.allTexts.join(' ')).toContain(c.label.split(' ')[0]));
    // Each cell's lines are drawn consecutively, so joining them restores every amount in full.
    const digits = formatINR(123456789012.34).replace('Rs. ', '');
    expect(parsed.allTexts.join('').split(digits)).toHaveLength(10); // 9 occurrences
  });

  test('22. noWrap: false opts a right-aligned column out of fitting', async () => {
    const columns = COLUMNS.map((c) => (c.key === 'cost' ? { ...c, minWidth: 50, weight: 0.3, noWrap: false } : c));
    const texts = parsePdf((await render({ columns, rows: [{ itemId: 'N1', name: 'x', status: 'y', cost: formatINR(123456789) }] })).buffer).allTexts;
    expect(loneRs(texts)).toHaveLength(1); // wraps as before: "Rs." on its own line
    expect(texts.join('')).toContain('12,34,56,789.00'); // amount still complete across its lines
  });
});

describe('generateTablePdf - async rendering and error safety', () => {
  test('23. rendering yields to the event loop, so other work runs during a large render', async () => {
    let finished = false;
    let ticks = 0;
    const tick = () => {
      if (finished) return;
      ticks += 1;
      setImmediate(tick);
    };
    const rendering = render({ rows: itemRows(1000) }).then((out) => {
      finished = true;
      return out;
    });
    setImmediate(tick);
    const { layout } = await rendering;
    expect(layout.rowsRendered).toBe(1000);
    expect(ticks).toBeGreaterThan(5);
  });

  test('24. a rendering error rejects before any header is set or any byte is written', async () => {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    const written = [];
    res.on('data', (c) => written.push(c));
    const badValue = { toString() { throw new Error('bad cell value'); } };
    await expect(generateTablePdf(res, {
      title: 'Broken', settings: SETTINGS, columns: COLUMNS, rows: [{ itemId: 'X1', name: badValue, status: 'ok', cost: '1' }],
    })).rejects.toThrow('bad cell value');
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(written).toHaveLength(0);
    expect(res.writableEnded).toBe(false);
  });

  test('25. sends Content-Length with the unchanged Content-Type and Content-Disposition', async () => {
    const { buffer, headers } = await render({ title: 'Expense Report', filenameBase: 'expense-report', rows: itemRows(3) });
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['content-disposition']).toBe('attachment; filename="expense-report-2026-10-22.pdf"');
    expect(Number(headers['content-length'])).toBe(buffer.length);
    const rendered = await pdfService.renderTablePdf({ title: 'Expense Report', filenameBase: 'expense-report', settings: SETTINGS, columns: COLUMNS, rows: itemRows(3), generatedAt: FIXED_TIME });
    expect(rendered.filename).toBe('expense-report-2026-10-22.pdf');
    expect(rendered.buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('generateTablePdf - summary and header layout', () => {
  const LINE = 8.5 * 1.25;

  test('26. a long summary continues across pages without overlapping or reaching the footer', async () => {
    const summary = Array.from({ length: 80 }, (_, i) => ({ label: `Summary line ${i}`, value: formatINR(i) }));
    const { buffer, layout } = await render({ rows: itemRows(5), summary });
    const parsed = parsePdf(buffer);
    expect(parsed.pages.length).toBeGreaterThan(1);
    expect(parsed.allTexts.filter((t) => /^Summary line \d+$/.test(t))).toEqual(summary.map((s) => s.label));
    expect(layout.maxTextBottom).toBeLessThanOrEqual(layout.contentBottomLimit);
    parsed.pages.forEach((page) => {
      const ys = page.items.filter((it) => /^Summary line \d+$/.test(it.text)).map((it) => it.y);
      for (let i = 1; i < ys.length; i += 1) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LINE - 0.01);
      ys.forEach((y) => expect(y).toBeLessThanOrEqual(layout.contentBottomLimit));
    });
    // Pages holding only the rest of the summary get the "(continued)" title but no table header.
    const lastPage = parsed.pages[parsed.pages.length - 1];
    expect(lastPage.texts).toContain('Test Report (continued)');
    expect(lastPage.texts).not.toContain('Item ID');
  });

  test('27. a wrapping summary label does not overlap the next summary line', async () => {
    const longLabel = Array.from({ length: 40 }, (_, i) => `label${i}`).join(' ');
    const { buffer } = await render({ rows: itemRows(2), summary: [{ label: longLabel, value: formatINR(5) }, { label: 'Next line', value: formatINR(6) }] });
    const items = parsePdf(buffer).pages[0].items;
    const labelLines = items.filter((it) => /label\d+/.test(it.text));
    expect(labelLines.length).toBeGreaterThan(1);
    expect(labelLines.map((it) => it.text).join(' ')).toBe(longLabel);
    const next = items.find((it) => it.text === 'Next line');
    expect(next.y - Math.max(...labelLines.map((it) => it.y))).toBeGreaterThanOrEqual(LINE - 0.01);
  });

  test('28. a very long filter value is shortened for display and the page stays within bounds', async () => {
    const { buffer, layout } = await render({ rows: itemRows(3), filters: [{ label: 'Search', value: 'x'.repeat(2000) }] });
    const parsed = parsePdf(buffer);
    const joined = parsed.allTexts.join(''); // wrapped lines lose the space at the break
    expect(joined).toContain(`Filters: Search =${'x'.repeat(120)}…`);
    expect(joined).not.toContain('x'.repeat(121));
    expect(parsed.allTexts).toContain('Item ID');
    expect(layout.maxTextBottom).toBeLessThanOrEqual(layout.contentBottomLimit);
  });

  test('29. a very tall page-1 header moves the table to page 2 without losing rows', async () => {
    const filters = Array.from({ length: 40 }, (_, i) => ({ label: `Filter ${i}`, value: `value ${'y'.repeat(90)} ${i}` }));
    const { buffer, layout } = await render({ rows: itemRows(3), filters });
    const parsed = parsePdf(buffer);
    expect(parsed.pages[0].texts).not.toContain('Item ID');
    expect(parsed.pages[1].texts).toContain('Test Report (continued)');
    expect(parsed.pages[1].texts).toContain('Item ID');
    expect(parsed.allTexts.filter((t) => /^ITM-\d{5}$/.test(t))).toEqual(['ITM-00000', 'ITM-00001', 'ITM-00002']);
    expect(layout.maxTextBottom).toBeLessThanOrEqual(layout.contentBottomLimit);
  });
});

describe('generateTablePdf - text cleanup and footer', () => {
  test('30. carriage returns become line breaks and tabs become spaces (no "?")', async () => {
    const { buffer } = await render({ rows: [{ itemId: 'R1', name: 'line1\r\nline2\tend\rline3', status: 'ok', cost: '1' }] });
    const texts = parsePdf(buffer).allTexts;
    expect(texts).toContain('line1');
    expect(texts).toContain('line2 end');
    expect(texts).toContain('line3');
    expect(texts.join('')).not.toContain('?');
  });

  test('31. a long company name is shortened in the footer and never reaches the page number', async () => {
    const PDFDocument = require('pdfkit');
    const measurer = new PDFDocument();
    const companyName = Array.from({ length: 15 }, (_, i) => `Company${i}`).join(' '); // under the 200-character header limit
    const { buffer } = await render({ settings: { ...SETTINGS, companyName }, rows: itemRows(80) });
    const parsed = parsePdf(buffer);
    expect(parsed.pages.length).toBeGreaterThan(1);
    expect(parsed.pages[0].texts.join(' ')).toContain(companyName); // full name in the header
    parsed.pages.forEach((page, i) => {
      const pageLabel = page.items.find((it) => it.text === `Page ${i + 1} of ${parsed.pages.length}`);
      const footer = page.items.find((it) => it.text.startsWith('Company0') && it.y === pageLabel.y);
      expect(footer.text.endsWith('…')).toBe(true);
      const footerWidth = measurer.font('Helvetica').fontSize(7.5).widthOfString(footer.text);
      expect(footer.x + footerWidth).toBeLessThan(pageLabel.x);
    });
  });
});

describe('generateTablePdf - smaller table font for wide amount tables', () => {
  const money = ['base', 'rental', 'refurb', 'marketing', 'logistics', 'commission', 'other', 'total'];
  const wideColumns = [
    { key: 'itemId', label: 'Item ID', minWidth: 55 },
    { key: 'name', label: 'Item Name', weight: 2, minWidth: 90 },
    ...money.map((key) => ({ key, label: key, weight: 1, minWidth: 62, align: 'right' })),
  ];

  test('32. eight crore-sized amount columns step the table font down so every total stays on one line', async () => {
    const totalsRow = { itemId: 'Total', ...Object.fromEntries(money.map((key, i) => [key, formatINR(98765432.1 + i)])) };
    const rows = [{ itemId: 'ITM-1', name: 'Gas turbine unit', ...Object.fromEntries(money.map((key) => [key, formatINR(4567890.25)])) }];
    const { buffer, layout } = await render({ columns: wideColumns, rows, totalsRow });
    const texts = parsePdf(buffer).allTexts;
    expect(layout.orientation).toBe('landscape');
    expect(layout.tableFontSize).toBeLessThan(8.5);
    expect(layout.tableFontSize).toBeGreaterThanOrEqual(7.5);
    money.forEach((key, i) => expect(texts).toContain(formatINR(98765432.1 + i))); // exact amounts, one line each
    expect(texts.filter((t) => t === 'Rs. 45,67,890.25')).toHaveLength(8);
    expect(texts.filter((t) => t.trim() === 'Rs.')).toEqual([]);
  });

  test('33. tables whose amounts already fit keep the normal 8.5 pt font', async () => {
    const { layout } = await render({ rows: itemRows(20), totalsRow: { itemId: 'Total', cost: formatINR(12345) } });
    expect(layout.tableFontSize).toBe(8.5);
    const wide = await render({ columns: wideColumns, rows: [{ itemId: 'ITM-1', name: 'x', ...Object.fromEntries(money.map((key) => [key, formatINR(12.5)])) }] });
    expect(wide.layout.tableFontSize).toBe(8.5);
  });
});

describe('generateTablePdf - safety and compatibility', () => {
  test('16. builds a safe ASCII filename from an unsafe title', async () => {
    const { headers } = await render({ title: 'Exp/ense "Report"', rows: [] });
    expect(headers['content-disposition']).toBe('attachment; filename="exp-ense-report-2026-10-22.pdf"');
  });

  test('17. leaves the existing invoice, receipt and dispatch-note generators in place', () => {
    expect(typeof pdfService.generateInvoicePdf).toBe('function');
    expect(typeof pdfService.generateReceiptPdf).toBe('function');
    expect(typeof pdfService.generateDispatchNotePdf).toBe('function');
    expect(typeof pdfService.money).toBe('function');
    expect(pdfService.money(123456.5)).toBe('Rs. 123456.50'); // invoice formatting unchanged
  });
});
