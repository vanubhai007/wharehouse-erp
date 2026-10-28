const zlib = require('zlib');

// Minimal PDF reader for tests (no dependencies). It only needs to understand
// PDFKit's own output, so it parses with regular expressions.
// Decompresses page content and returns the text of every BT..ET block (one
// block per drawn line) per page, decoding the built-in fonts' WinAnsi codes.
// `items` also gives each block's x and its baseline y measured from the top
// of the page (from the block's "1 0 0 1 x y Tm" operator), and its font size
// (from the "/F1 8.5 Tf" operator PDFKit writes inside every block).

const WIN_ANSI = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

function parsePdf(buffer) {
  const raw = buffer.toString('latin1');
  const objects = new Map();
  const objRe = /(\d+) 0 obj\s*([\s\S]*?)\nendobj/g;
  let m;
  while ((m = objRe.exec(raw))) {
    const body = m[2];
    const at = body.indexOf('stream\n');
    let dict = body;
    let stream = null;
    if (at !== -1) {
      dict = body.slice(0, at);
      stream = Buffer.from(body.slice(at + 'stream\n'.length, body.lastIndexOf('\nendstream')), 'latin1');
      if (/\/FlateDecode/.test(dict)) stream = zlib.inflateSync(stream);
    }
    objects.set(Number(m[1]), { dict, stream });
  }
  const ref = (dict, key) => {
    const r = new RegExp(`/${key} (\\d+) 0 R`).exec(dict);
    return r ? objects.get(Number(r[1])) : null;
  };
  const baseFonts = [...objects.values()].map((o) => (/\/Type \/Font[\s\S]*?\/BaseFont \/(\S+)/.exec(o.dict) || [])[1]).filter(Boolean);
  const embeddedFontFiles = [...objects.values()].filter((o) => /\/FontFile/.test(o.dict)).length;

  const pagesRoot = [...objects.values()].find((o) => /\/Type \/Pages/.test(o.dict));
  const kids = [.../\/Kids \[([^\]]*)\]/.exec(pagesRoot.dict)[1].matchAll(/(\d+) 0 R/g)].map((k) => objects.get(Number(k[1])));

  const pages = kids.map((page) => {
    const mediaBox = /\/MediaBox \[([^\]]*)\]/.exec(page.dict)[1].trim().split(/\s+/).map(Number);
    const content = ref(page.dict, 'Contents').stream.toString('latin1');
    const blocks = [];
    const items = [];
    for (const bt of content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
      const tm = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/.exec(bt[1]);
      const tf = /\/F\d+ ([\d.]+) Tf/.exec(bt[1]);
      let text = '';
      for (const op of bt[1].matchAll(/\[((?:[^\]])*)\]\s*TJ|<([0-9a-f]*)>\s*Tj/gi)) {
        const hexes = op[1] !== undefined ? [...op[1].matchAll(/<([0-9a-f]*)>/gi)].map((h) => h[1]) : [op[2]];
        for (const hex of hexes) {
          for (let i = 0; i < hex.length; i += 2) {
            const code = parseInt(hex.slice(i, i + 2), 16);
            text += WIN_ANSI[code] || String.fromCharCode(code);
          }
        }
      }
      blocks.push(text);
      items.push({ text, x: tm ? Number(tm[1]) : NaN, y: tm ? mediaBox[3] - Number(tm[2]) : NaN, size: tf ? Number(tf[1]) : NaN });
    }
    return { mediaBox, texts: blocks, items };
  });
  return { pages, allTexts: pages.flatMap((p) => p.texts), baseFonts, embeddedFontFiles };
}

module.exports = { parsePdf };
