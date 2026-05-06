import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});

let db;

// 🔥 iniciar banco
async function initDB() {
  db = await open({
    filename: "./database.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS boats (
      id TEXT PRIMARY KEY,
      name TEXT,
      owner TEXT,
      phone TEXT,
      emergency_contact TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sos (
      id TEXT PRIMARY KEY,
      boat_id TEXT,
      latitude REAL,
      longitude REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Banco conectado ✅");
}

initDB();

// 🧪 rota teste
app.get("/", (req, res) => {
  res.send("API SOS rodando 🚀");
});

// 🚤 cadastrar embarcação
app.post("/boats", async (req, res) => {
  const { name, owner, phone, emergency_contact } = req.body;

  const id = uuidv4();

  await db.run(
    `INSERT INTO boats (id, name, owner, phone, emergency_contact)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, owner, phone, emergency_contact]
  );

  res.json({ id });
});

// 🔎 buscar embarcação
app.get("/boats/:id", async (req, res) => {
  const boat = await db.get(
    `SELECT * FROM boats WHERE id = ?`,
    [req.params.id]
  );

  if (!boat) {
    return res.status(404).json({ error: "Não encontrado" });
  }

  res.json(boat);
});

// 🚨 SOS com localização
app.post("/sos/:id", async (req, res) => {
  const { latitude, longitude } = req.body;

  const boat = await db.get(
    `SELECT * FROM boats WHERE id = ?`,
    [req.params.id]
  );

  if (!boat) {
    return res.status(404).json({ error: "Embarcação não encontrada" });
  }

  const sosId = uuidv4();

  await db.run(
    `INSERT INTO sos (id, boat_id, latitude, longitude)
     VALUES (?, ?, ?, ?)`,
    [sosId, req.params.id, latitude, longitude]
  );

  res.json({
    message: "SOS enviado com localização 🚨",
    location: { latitude, longitude },
    boat,
  });
});

// 📍 listar todos os SOS (para mapa)
app.get("/sos", async (req, res) => {
  const alerts = await db.all(`
    SELECT sos.*, boats.name
    FROM sos
    JOIN boats ON sos.boat_id = boats.id
    ORDER BY timestamp DESC
  `);

  res.json(alerts);
});

// 🚀 iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});