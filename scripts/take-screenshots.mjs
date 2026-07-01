import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const screenshotsDir = resolve(rootDir, 'docs', 'screenshots');

const sampleSchema = {
  version: 1,
  name: 'Pet Store',
  tables: [
    {
      id: 'tbl_users',
      name: 'users',
      x: 80,
      y: 100,
      columns: [
        { id: 'col_u1', name: 'id', dataType: 'INT UNSIGNED', isPrimaryKey: true },
        { id: 'col_u2', name: 'email', dataType: 'VARCHAR(255)', isPrimaryKey: false, isNullable: false },
        { id: 'col_u3', name: 'created_at', dataType: 'DATETIME', isPrimaryKey: false, isNullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
    },
    {
      id: 'tbl_pets',
      name: 'pets',
      x: 420,
      y: 80,
      columns: [
        { id: 'col_p1', name: 'id', dataType: 'INT UNSIGNED', isPrimaryKey: true },
        { id: 'col_p2', name: 'name', dataType: 'VARCHAR(255)', isPrimaryKey: false, isNullable: false },
        { id: 'col_p3', name: 'date_of_birth', dataType: 'DATETIME', isPrimaryKey: false, isNullable: false },
        { id: 'col_p4', name: 'species', dataType: 'VARCHAR(255)', isPrimaryKey: false, isNullable: true },
        { id: 'col_p5', name: 'user_id', dataType: 'INT UNSIGNED', isPrimaryKey: false, isNullable: false },
        { id: 'col_p6', name: 'gender', dataType: 'VARCHAR(1)', isPrimaryKey: false, isNullable: false, defaultValue: 'M' },
      ],
    },
  ],
  relationships: [
    {
      id: 'rel_1',
      sourceTableId: 'tbl_pets',
      targetTableId: 'tbl_users',
      mappings: [{ sourceColumnId: 'col_p5', targetColumnId: 'col_u1' }],
    },
  ],
};

const snapshots = [
  { key: 'schema:snapshot:Demo Schema', schema: { ...sampleSchema, name: 'Demo Schema' } },
  { key: 'schema:snapshot:Empty Project', schema: { version: 1, name: 'Empty Project', tables: [], relationships: [] } },
];

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: true,
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('http://localhost:4173')) {
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('http://localhost:4173')) {
        resolve(server);
      }
    });

    setTimeout(() => resolve(server), 3000);

    server.on('error', reject);
  });
}

async function takeScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Empty canvas
  await page.goto('http://localhost:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.toolbar', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotsDir, '01-empty-canvas.png') });

  // Schema loaded
  await page.evaluate((schema) => {
    localStorage.setItem('schema:current', JSON.stringify(schema));
  }, sampleSchema);
  await page.reload();
  await page.waitForSelector('.table-node', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotsDir, '02-schema-canvas.png') });

  // Selected table showing relationship handles
  const petsTable = page.locator('.table-node', { hasText: 'pets' }).first();
  await petsTable.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotsDir, '03-selected-table-handles.png') });

  // Table in edit mode
  const usersTable = page.locator('.table-node', { hasText: 'users' }).first();
  await usersTable.dblclick();
  await page.waitForSelector('.inline-column-editor', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotsDir, '04-edit-table.png') });

  // Saves browser
  await page.evaluate((items) => {
    localStorage.clear();
    items.forEach(({ key, schema }) => localStorage.setItem(key, JSON.stringify(schema)));
  }, snapshots);
  await page.goto('http://localhost:4173/#/saves');
  await page.waitForSelector('.saves-browser', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(screenshotsDir, '05-saves-browser.png') });

  await browser.close();
}

async function main() {
  const fs = await import('fs/promises');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const server = await startPreviewServer();
  try {
    await takeScreenshots();
    console.log('Screenshots saved to', screenshotsDir);
  } finally {
    if (server.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(server.pid), '/t', '/f']);
        } else {
          server.kill('SIGTERM');
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
