// main.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { program } = require('commander');
const { randomUUID } = require('crypto');

// ---------- CLI ----------
program
  .requiredOption('-h, --host <string>', 'Адреса сервера')
  .requiredOption('-p, --port <number>', 'Порт сервера')
  .requiredOption('-c, --cache <path>', 'Шлях до кеш директорії');

program.parse(process.argv);
const { host, port, cache } = program.opts();

const HOST = host;
const PORT = parseInt(port, 10);
const CACHE_DIR = path.resolve(cache);
const DB_FILE = path.join(CACHE_DIR, 'inventory.json');

// ---------- Ensure cache directory ----------
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ---------- Ensure DB ----------
async function ensureDb() {
  try {
    await fsp.access(DB_FILE);
  } catch {
    await fsp.writeFile(DB_FILE, '[]', 'utf8');
  }
}

async function readDb() {
  return JSON.parse(await fsp.readFile(DB_FILE, 'utf8'));
}

async function writeDb(data) {
  await fsp.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Express app ----------
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve static html
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

// ---------- Multer config ----------
const upload = multer({
  dest: path.join(CACHE_DIR, 'tmp')
});

// ---------- POST /register ----------
app.post('/register', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name || inventory_name.trim() === '') {
    return res.status(400).json({ error: 'inventory_name is required' });
  }

  const id = randomUUID();

  let photoPath = null;

  if (req.file) {
    const dest = path.join(CACHE_DIR, `${id}.jpg`);
    await fsp.rename(req.file.path, dest);
    photoPath = `/inventory/${id}/photo`;
  }

  const db = await readDb();
  const item = {
    id,
    name: inventory_name,
    description: description || '',
    photo: photoPath,
    created_at: new Date().toISOString()
  };
  db.push(item);
  await writeDb(db);

  res.status(201).json(item);
});

// ---------- GET /inventory ----------
app.get('/inventory', async (req, res) => {
  const db = await readDb();
  res.json(db);
});

// ---------- GET /inventory/:id ----------
app.get('/inventory/:id', async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);

  if (!item) return res.status(404).send('Not Found');
  res.json(item);
});

// ---------- PUT /inventory/:id (update JSON) ----------
app.put('/inventory/:id', async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);

  if (!item) return res.status(404).send('Not Found');

  const { name, description } = req.body;

  if (name) item.name = name;
  if (description !== undefined) item.description = description;

  item.updated_at = new Date().toISOString();

  await writeDb(db);
  res.json(item);
});

// ---------- GET /inventory/:id/photo ----------
app.get('/inventory/:id/photo', async (req, res) => {
  const imgPath = path.join(CACHE_DIR, `${req.params.id}.jpg`);

  try {
    await fsp.access(imgPath);
    res.sendFile(imgPath);
  } catch {
    res.status(404).send('Not Found');
  }
});

// ---------- PUT /inventory/:id/photo ----------
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);

  if (!item) return res.status(404).send('Not Found');

  if (!req.file) {
    return res.status(400).json({ error: 'photo is required' });
  }

  const dest = path.join(CACHE_DIR, `${req.params.id}.jpg`);
  await fsp.rename(req.file.path, dest);

  if (!item.photo) item.photo = `/inventory/${req.params.id}/photo`;

  await writeDb(db);
  res.json(item);
});

// ---------- DELETE /inventory/:id ----------
app.delete('/inventory/:id', async (req, res) => {
  const db = await readDb();
  const idx = db.findIndex(x => x.id === req.params.id);

  if (idx === -1) return res.status(404).send('Not Found');

  const removed = db.splice(idx, 1)[0];
  await writeDb(db);

  try {
    await fsp.unlink(path.join(CACHE_DIR, `${req.params.id}.jpg`));
  } catch {}

  res.json({ deleted: true, id: removed.id });
});

// ---------- POST /search ----------
app.post('/search', async (req, res) => {
  const { id, has_photo } = req.body;

  if (!id || id.trim() === '') {
    return res.status(400).json({ error: 'id is required' });
  }

  const db = await readDb();
  const item = db.find(x => x.id === id);

  if (!item) return res.status(404).send('Not Found');

  const result = { ...item };

  if (!(has_photo === 'on' || has_photo === 'true' || has_photo === '1')) {
    delete result.photo;
  }

  res.json(result);
});

// ---------- Start server ----------
ensureDb().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Express сервер запущено: http://${HOST}:${PORT}`);
    console.log(`Кеш директорія: ${CACHE_DIR}`);
  });
});
