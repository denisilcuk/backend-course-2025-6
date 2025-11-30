const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { randomUUID } = require("crypto");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT || 3000;
const CACHE_DIR = process.env.CACHE || "./cache";
const DB_FILE = path.join(CACHE_DIR, "inventory.json");

// ---------- Load Swagger YAML ----------
const swaggerDocument = YAML.load("./swagger.yaml");

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ---------- Multer ----------
const upload = multer({ dest: path.join(CACHE_DIR, "tmp") });

// ---------- Ensure cache & DB ----------
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

async function ensureDb() {
  try {
    await fsp.access(DB_FILE);
  } catch {
    await fsp.writeFile(DB_FILE, "[]", "utf8");
  }
}
async function readDb() {
  return JSON.parse(await fsp.readFile(DB_FILE, "utf8"));
}
async function writeDb(data) {
  await fsp.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// ---------- ROUTES (чистий код, без Swagger-коментарів) ----------

// POST /register
app.post("/register", upload.single("photo"), async (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) return res.status(400).json({ error: "inventory_name is required" });

  const id = randomUUID();
  let photo = null;

  if (req.file) {
    const dest = path.join(CACHE_DIR, `${id}.jpg`);
    await fsp.rename(req.file.path, dest);
    photo = `/inventory/${id}/photo`;
  }

  const db = await readDb();
  const item = {
    id,
    name: inventory_name,
    description: description || "",
    photo,
    created_at: new Date().toISOString(),
  };

  db.push(item);
  await writeDb(db);

  res.status(201).json(item);
});

// GET /inventory
app.get("/inventory", async (req, res) => {
  res.json(await readDb());
});

// POST /search
app.post("/search", async (req, res) => {
  const { id, has_photo } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });

  const db = await readDb();
  const item = db.find(x => x.id === id);

  if (!item) return res.status(404).send("Not Found");

  const result = { ...item };
  if (!has_photo) delete result.photo;

  res.json(result);
});

// GET /inventory/:id
app.get("/inventory/:id", async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);
  if (!item) return res.status(404).send("Not Found");
  res.json(item);
});

// PUT /inventory/:id
app.put("/inventory/:id", async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);
  if (!item) return res.status(404).send("Not Found");

  if (req.body.name) item.name = req.body.name;
  if (req.body.description !== undefined) item.description = req.body.description;

  item.updated_at = new Date().toISOString();
  await writeDb(db);

  res.json(item);
});

// DELETE /inventory/:id
app.delete("/inventory/:id", async (req, res) => {
  const db = await readDb();
  const index = db.findIndex(x => x.id === req.params.id);
  if (index === -1) return res.status(404).send("Not Found");

  const [removed] = db.splice(index, 1);
  await writeDb(db);

  try { await fsp.unlink(path.join(CACHE_DIR, `${req.params.id}.jpg`)); } catch {}

  res.json({ deleted: true, id: removed.id });
});

// GET /inventory/:id/photo
app.get("/inventory/:id/photo", (req, res) => {
  const filePath = path.resolve(CACHE_DIR, `${req.params.id}.jpg`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Not Found");
  }

  res.sendFile(filePath);
});

// PUT /inventory/:id/photo
app.put("/inventory/:id/photo", upload.single("photo"), async (req, res) => {
  const db = await readDb();
  const item = db.find(x => x.id === req.params.id);
  if (!item) return res.status(404).send("Not Found");

  const dest = path.join(CACHE_DIR, `${req.params.id}.jpg`);
  await fsp.rename(req.file.path, dest);

  if (!item.photo) item.photo = `/inventory/${item.id}/photo`;
  await writeDb(db);

  res.json(item);
});

// ---------- START SERVER ----------
ensureDb().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log("Swagger docs available at /docs");
  });
});
