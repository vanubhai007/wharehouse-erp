const request = require('supertest');
const multer = require('multer');
const { startTestDb, stopTestDb } = require('./testUtils');
const { ROLES, ALL_ROLES } = require('../config/constants');
const { detectFileType } = require('../utils/fileSignature');
const { errorHandler } = require('../middleware/errorHandler');

// Cloudinary is replaced by an in-memory fake: no network calls, no
// credentials. mockUploads records every byte that would have been sent to
// Cloudinary; mockDestroys records every delete.
const mockUploads = [];
const mockDestroys = [];
jest.mock('../config/cloudinary', () => {
  const { Writable } = require('stream');
  let counter = 0;
  return {
    isConfigured: true,
    cloudinary: {
      uploader: {
        upload_stream: (options, callback) => {
          const chunks = [];
          return new Writable({
            write(chunk, encoding, next) {
              chunks.push(chunk);
              next();
            },
            final(next) {
              counter += 1;
              const publicId = `${options.folder}/mock${counter}`;
              const bytes = Buffer.concat(chunks);
              mockUploads.push({ publicId, resourceType: options.resource_type, bytes });
              next();
              callback(null, { secure_url: `https://res.cloudinary.com/mock/${options.resource_type}/upload/${publicId}`, public_id: publicId, bytes: bytes.length });
            },
          });
        },
        upload: async (data, options) => ({
          secure_url: `https://res.cloudinary.com/mock/image/upload/${options.folder}/${options.public_id}`,
          public_id: `${options.folder}/${options.public_id}`,
        }),
        destroy: (publicId, options, callback) => {
          mockDestroys.push({ publicId, resourceType: options.resource_type });
          if (callback) callback(null, { result: 'ok' });
          return Promise.resolve({ result: 'ok' });
        },
      },
    },
  };
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(64, 1)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const HTML = Buffer.from('<html><body><script>alert(1)</script></body></html>');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const OVERSIZED = 11 * 1024 * 1024;

let app;
const tokens = {};

beforeAll(async () => {
  await startTestDb();
  app = require('../app');

  await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@uploads.com', password: 'AdminPass123', role: ROLES.ADMIN });
  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@uploads.com', password: 'AdminPass123' });
  tokens[ROLES.ADMIN] = adminLogin.body.data.token;

  for (const role of ALL_ROLES.filter((r) => r !== ROLES.ADMIN)) {
    const email = `${role.replace(/[^a-z]/gi, '').toLowerCase()}@uploads.com`;
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`)
      .send({ name: role, email, password: 'RolePass123', role });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'RolePass123' });
    tokens[role] = login.body.data.token;
  }
}, 60000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(() => {
  mockUploads.length = 0;
  mockDestroys.length = 0;
});

function uploadAs(role, folderName) {
  const req = request(app).post(`/api/uploads/${folderName}`);
  return role ? req.set('Authorization', `Bearer ${tokens[role]}`) : req;
}

describe('file signature detection', () => {
  test('recognises each allowed type from its content', () => {
    expect(detectFileType(JPEG)).toBe('image/jpeg');
    expect(detectFileType(PNG)).toBe('image/png');
    expect(detectFileType(GIF)).toBe('image/gif');
    expect(detectFileType(WEBP)).toBe('image/webp');
    expect(detectFileType(PDF)).toBe('application/pdf');
  });

  test('accepts a PDF header within the first 1024 bytes', () => {
    expect(detectFileType(Buffer.concat([Buffer.alloc(100, 0x20), PDF]))).toBe('application/pdf');
  });

  test('does not recognise HTML, SVG or empty content', () => {
    expect(detectFileType(HTML)).toBeNull();
    expect(detectFileType(SVG)).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe('valid uploads keep working', () => {
  test.each([
    ['photo.jpg', 'image/jpeg', JPEG, 'image'],
    ['photo.png', 'image/png', PNG, 'image'],
    ['anim.gif', 'image/gif', GIF, 'image'],
    ['photo.webp', 'image/webp', WEBP, 'image'],
    ['bill.pdf', 'application/pdf', PDF, 'raw'],
  ])('%s (%s) uploads to items with the existing response format', async (filename, contentType, bytes, resourceType) => {
    const res = await uploadAs(ROLES.WAREHOUSE_STAFF, 'items').field('label', 'Front').attach('files', bytes, { filename, contentType });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['label', 'originalName', 'publicId', 'uploadedBy', 'url']);
    expect(res.body.data[0]).toMatchObject({ originalName: filename, label: 'Front' });
    expect(res.body.data[0].publicId).toMatch(/^hrwarehouse\/items\//);

    expect(mockUploads).toHaveLength(1);
    expect(mockUploads[0].resourceType).toBe(resourceType);
    expect(mockUploads[0].bytes.equals(bytes)).toBe(true);
  });

  test('a file larger than the signature window is uploaded intact', async () => {
    const bytes = Buffer.concat([PNG, Buffer.alloc(200 * 1024, 7)]);
    const res = await uploadAs(ROLES.ADMIN, 'items').attach('files', bytes, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(mockUploads[0].bytes.equals(bytes)).toBe(true);
  });

  test('several files in one request upload together', async () => {
    const res = await uploadAs(ROLES.ACCOUNTS, 'payments')
      .attach('files', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('files', PDF, { filename: 'b.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(mockUploads).toHaveLength(2);
  });

  test('each folder accepts uploads from the roles that manage its module', async () => {
    const cases = [
      ['customers', [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS]],
      ['items', [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF]],
      ['expenses', [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.ACCOUNTS]],
      ['payments', [ROLES.ADMIN, ROLES.ACCOUNTS]],
      ['refurbishment', [ROLES.ADMIN, ROLES.WAREHOUSE_MANAGER, ROLES.WAREHOUSE_STAFF]],
    ];
    for (const [folderName, allowed] of cases) {
      for (const role of ALL_ROLES) {
        const res = await uploadAs(role, folderName).attach('files', PNG, { filename: 'a.png', contentType: 'image/png' });
        expect([folderName, role, res.status]).toEqual([folderName, role, allowed.includes(role) ? 201 : 403]);
      }
    }
  });

  test('module upload route (item media) accepts a valid image and stores it on the item', async () => {
    const customer = await request(app).post('/api/customers').set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`).send({ name: 'Owner', phone: '9000000001' });
    const item = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${tokens[ROLES.WAREHOUSE_STAFF]}`)
      .send({ name: 'Chair', category: 'Furniture', owner: customer.body.data._id, purchaseCost: 1000 });
    expect(item.status).toBe(201);

    const res = await request(app)
      .post(`/api/items/${item.body.data._id}/media`)
      .set('Authorization', `Bearer ${tokens[ROLES.WAREHOUSE_STAFF]}`)
      .attach('files', PNG, { filename: 'chair.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.photos).toHaveLength(1);
    expect(res.body.data.photos[0].publicId).toMatch(/^hrwarehouse\/items\//);
  });
});

describe('disallowed file types', () => {
  test.each([
    ['HTML disguised as PNG', 'page.png', 'image/png', HTML],
    ['PNG declared as PDF', 'doc.pdf', 'application/pdf', PNG],
    ['JPEG declared as PNG', 'photo.png', 'image/png', JPEG],
    ['empty file', 'empty.png', 'image/png', Buffer.alloc(0)],
  ])('%s is rejected and nothing reaches Cloudinary', async (label, filename, contentType, bytes) => {
    const res = await uploadAs(ROLES.ADMIN, 'items').attach('files', bytes, { filename, contentType });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match its declared type/);
    expect(mockUploads).toHaveLength(0);
  });

  test('SVG and other non-allowed MIME types are rejected', async () => {
    const res = await uploadAs(ROLES.ADMIN, 'items').attach('files', SVG, { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported file type/);
    expect(mockUploads).toHaveLength(0);
  });

  test('module upload routes apply the same content check', async () => {
    const customer = await request(app).post('/api/customers').set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`).send({ name: 'Owner 2', phone: '9000000002' });
    const res = await request(app)
      .post(`/api/customers/${customer.body.data._id}/documents`)
      .set('Authorization', `Bearer ${tokens[ROLES.ADMIN]}`)
      .attach('files', HTML, { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(mockUploads).toHaveLength(0);
  });

  test('a bad file in a multi-file request rolls back the files already stored', async () => {
    const res = await uploadAs(ROLES.ADMIN, 'items')
      .attach('files', PNG, { filename: 'good.png', contentType: 'image/png' })
      .attach('files', HTML, { filename: 'bad.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(mockUploads).toHaveLength(1);
    expect(mockDestroys).toEqual([{ publicId: mockUploads[0].publicId, resourceType: 'image' }]);
  });
});

describe('size and count limits', () => {
  test('an oversized image returns 413 and the partial image upload is removed', async () => {
    const bytes = Buffer.concat([PNG, Buffer.alloc(OVERSIZED, 1)]);
    const res = await uploadAs(ROLES.ADMIN, 'items').attach('files', bytes, { filename: 'huge.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/File too large \(max 10 MB/);
    expect(res.body.stack).toBeUndefined();
    expect(mockUploads).toHaveLength(1);
    expect(mockUploads[0].bytes.length).toBeLessThanOrEqual(10 * 1024 * 1024);
    expect(mockDestroys).toEqual([{ publicId: mockUploads[0].publicId, resourceType: 'image' }]);
  });

  test('an oversized PDF returns 413 and the partial raw upload is removed', async () => {
    const bytes = Buffer.concat([PDF, Buffer.alloc(OVERSIZED, 0x20)]);
    const res = await uploadAs(ROLES.ADMIN, 'items').attach('files', bytes, { filename: 'huge.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(mockUploads).toHaveLength(1);
    expect(mockDestroys).toEqual([{ publicId: mockUploads[0].publicId, resourceType: 'raw' }]);
  });

  test('more than 10 files returns 400 and stored files are removed', async () => {
    let req = uploadAs(ROLES.ADMIN, 'items');
    for (let i = 0; i < 11; i += 1) req = req.attach('files', PNG, { filename: `p${i}.png`, contentType: 'image/png' });
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Too many files/);
    expect(mockDestroys).toHaveLength(mockUploads.length);
  });

  test('error handler maps multer errors to client errors without a stack trace', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new multer.MulterError('LIMIT_FILE_SIZE', 'files'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(413);
    errorHandler(new multer.MulterError('LIMIT_FILE_COUNT', 'files'), {}, res, () => {});
    expect(res.status).toHaveBeenLastCalledWith(400);
    expect(res.json.mock.calls.every(([body]) => body.stack === undefined)).toBe(true);
  });
});

describe('upload authorization', () => {
  test('unauthenticated uploads are rejected', async () => {
    const res = await uploadAs(null, 'items').attach('files', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
    expect(mockUploads).toHaveLength(0);
  });

  test('roles outside a folder are rejected before any file is read', async () => {
    const sales = await uploadAs(ROLES.SALES_MANAGER, 'items').attach('files', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(sales.status).toBe(403);
    const staff = await uploadAs(ROLES.WAREHOUSE_STAFF, 'payments').attach('files', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(staff.status).toBe(403);
    expect(mockUploads).toHaveLength(0);
  });

  test.each(['qrcodes', 'dispatch', 'misc', '..', 'Items'])('unknown folder "%s" is rejected', async (folderName) => {
    const res = await uploadAs(ROLES.ADMIN, encodeURIComponent(folderName)).attach('files', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect([400, 404]).toContain(res.status);
    expect(mockUploads).toHaveLength(0);
  });
});

describe('delete authorization', () => {
  function deleteAs(role, publicId) {
    const req = request(app).delete(`/api/uploads/${encodeURIComponent(publicId)}`);
    return role ? req.set('Authorization', `Bearer ${tokens[role]}`) : req;
  }

  test('unauthenticated deletes are rejected', async () => {
    const res = await deleteAs(null, 'hrwarehouse/items/abc123');
    expect(res.status).toBe(401);
    expect(mockDestroys).toHaveLength(0);
  });

  test('a role outside the folder cannot delete', async () => {
    const res = await deleteAs(ROLES.WAREHOUSE_STAFF, 'hrwarehouse/payments/abc123');
    expect(res.status).toBe(403);
    expect(mockDestroys).toHaveLength(0);
  });

  test.each(['hrwarehouse/qrcodes/ITM-00001', 'hrwarehouse/dispatch/abc', 'other-app/photo', 'hrwarehouse/items/../payments/x', 'hrwarehouse/items/a%2Fb', 'sample'])(
    'file reference "%s" cannot be deleted by anyone',
    async (publicId) => {
      const res = await deleteAs(ROLES.ADMIN, publicId);
      expect(res.status).toBe(400);
      expect(mockDestroys).toHaveLength(0);
    }
  );

  test('an allowed role can delete a file in its folder (image and raw)', async () => {
    const res = await deleteAs(ROLES.ACCOUNTS, 'hrwarehouse/payments/abc123');
    expect(res.status).toBe(200);
    expect(mockDestroys).toEqual([
      { publicId: 'hrwarehouse/payments/abc123', resourceType: 'image' },
      { publicId: 'hrwarehouse/payments/abc123', resourceType: 'raw' },
    ]);
  });

  test('Admin can delete in every approved folder', async () => {
    for (const folderName of ['customers', 'items', 'expenses', 'payments', 'refurbishment']) {
      const res = await deleteAs(ROLES.ADMIN, `hrwarehouse/${folderName}/abc123`);
      expect(res.status).toBe(200);
    }
  });
});
