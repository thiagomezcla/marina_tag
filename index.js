import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { v4 as uuidv4 } from "uuid";

const app = express();

app.use(express.json());

// Libera acesso para testes externos
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

let db;

// Iniciar banco
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

await initDB();

// Rota principal
app.get("/", (req, res) => {
  res.send("API SOS rodando 🚀");
});

// Cadastrar embarcação
app.post("/boats", async (req, res) => {
  const { name, owner, phone, emergency_contact } = req.body;

  if (!name || !owner || !phone || !emergency_contact) {
    return res.status(400).json({
      error: "Preencha name, owner, phone e emergency_contact",
    });
  }

  const id = uuidv4();

  await db.run(
    `
    INSERT INTO boats (id, name, owner, phone, emergency_contact)
    VALUES (?, ?, ?, ?, ?)
    `,
    [id, name, owner, phone, emergency_contact]
  );

  res.json({
    message: "Embarcação cadastrada com sucesso 🚤",
    id,
  });
});

// Listar embarcações
app.get("/boats", async (req, res) => {
  const boats = await db.all(`
    SELECT * FROM boats
  `);

  res.json(boats);
});

// Buscar embarcação por ID
app.get("/boats/:id", async (req, res) => {
  const boat = await db.get(
    `
    SELECT * FROM boats WHERE id = ?
    `,
    [req.params.id]
  );

  if (!boat) {
    return res.status(404).json({
      error: "Embarcação não encontrada",
    });
  }

  res.json(boat);
});

// Enviar SOS com localização
app.post("/sos/:id", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      error: "Envie latitude e longitude",
    });
  }

  const boat = await db.get(
    `
    SELECT * FROM boats WHERE id = ?
    `,
    [req.params.id]
  );

  if (!boat) {
    return res.status(404).json({
      error: "Embarcação não encontrada",
    });
  }

  const sosId = uuidv4();

  await db.run(
    `
    INSERT INTO sos (id, boat_id, latitude, longitude)
    VALUES (?, ?, ?, ?)
    `,
    [sosId, req.params.id, latitude, longitude]
  );

  res.json({
    message: "SOS enviado com localização 🚨",
    sos_id: sosId,
    location: {
      latitude,
      longitude,
    },
    boat,
  });
});

// Listar todos os SOS
app.get("/sos", async (req, res) => {
  const alerts = await db.all(`
    SELECT sos.*, boats.name, boats.owner, boats.phone, boats.emergency_contact
    FROM sos
    JOIN boats ON sos.boat_id = boats.id
    ORDER BY sos.timestamp DESC
  `);

  res.json(alerts);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});