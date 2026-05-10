import express from "express";
import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const { Pool } = pg;

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

// Conexão com PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Criar tabelas
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boats (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sos (
      id TEXT PRIMARY KEY,
      boat_id TEXT NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Banco PostgreSQL conectado ✅");
}

await initDB();

// Rota principal
app.get("/", (req, res) => {
  res.send("API SOS rodando com PostgreSQL 🚀");
});

// Cadastrar embarcação
app.post("/boats", async (req, res) => {
  try {
    const { name, owner, phone, emergency_contact } = req.body;

    if (!name || !owner || !phone || !emergency_contact) {
      return res.status(400).json({
        error: "Preencha name, owner, phone e emergency_contact",
      });
    }

    const id = uuidv4();

    await pool.query(
      `
      INSERT INTO boats (id, name, owner, phone, emergency_contact)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [id, name, owner, phone, emergency_contact]
    );

    res.json({
      message: "Embarcação cadastrada com sucesso 🚤",
      id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao cadastrar embarcação",
    });
  }
});

// Listar embarcações
app.get("/boats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM boats
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao listar embarcações",
    });
  }
});

// Buscar embarcação por ID
app.get("/boats/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT * FROM boats WHERE id = $1
      `,
      [req.params.id]
    );

    const boat = result.rows[0];

    if (!boat) {
      return res.status(404).json({
        error: "Embarcação não encontrada",
      });
    }

    res.json(boat);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao buscar embarcação",
    });
  }
});

// Enviar SOS com localização
app.post("/sos/:id", async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: "Envie latitude e longitude",
      });
    }

    const boatResult = await pool.query(
      `
      SELECT * FROM boats WHERE id = $1
      `,
      [req.params.id]
    );

    const boat = boatResult.rows[0];

    if (!boat) {
      return res.status(404).json({
        error: "Embarcação não encontrada",
      });
    }

    const sosId = uuidv4();

    await pool.query(
      `
      INSERT INTO sos (id, boat_id, latitude, longitude)
      VALUES ($1, $2, $3, $4)
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
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao enviar SOS",
    });
  }
});

// Listar SOS em JSON
app.get("/sos", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sos.id,
        sos.boat_id,
        sos.latitude,
        sos.longitude,
        sos.timestamp,
        boats.name,
        boats.owner,
        boats.phone,
        boats.emergency_contact
      FROM sos
      JOIN boats ON sos.boat_id = boats.id
      ORDER BY sos.timestamp DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao listar SOS",
    });
  }
});

// Página visual dos SOS
app.get("/sos-page", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        sos.id,
        sos.boat_id,
        sos.latitude,
        sos.longitude,
        sos.timestamp,
        boats.name,
        boats.owner,
        boats.phone,
        boats.emergency_contact
      FROM sos
      JOIN boats ON sos.boat_id = boats.id
      ORDER BY sos.timestamp DESC
    `);

    const alerts = result.rows;

    const cards = alerts.length === 0
      ? `<div class="empty">Nenhum SOS registrado até o momento.</div>`
      : alerts.map(alert => `
          <div class="card">
            <h2>SOS recebido</h2>
            <p><strong>Embarcação:</strong> ${alert.name}</p>
            <p><strong>Responsável:</strong> ${alert.owner}</p>
            <p><strong>Telefone:</strong> ${alert.phone}</p>
            <p><strong>Contato de emergência:</strong> ${alert.emergency_contact}</p>
            <p><strong>Latitude:</strong> ${alert.latitude}</p>
            <p><strong>Longitude:</strong> ${alert.longitude}</p>
            <p><strong>Data/Hora:</strong> ${alert.timestamp}</p>
            <a class="button" target="_blank" href="https://www.google.com/maps?q=${alert.latitude},${alert.longitude}">
              Abrir localização no Google Maps
            </a>
          </div>
        `).join("");

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Alertas SOS - Marina Tag</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f2f6f9;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }

          .container {
            max-width: 900px;
            margin: 0 auto;
          }

          h1 {
            text-align: center;
            color: #0f172a;
          }

          .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border-left: 6px solid #dc2626;
          }

          .card h2 {
            color: #dc2626;
            margin-top: 0;
          }

          .button {
            display: inline-block;
            margin-top: 12px;
            padding: 12px 16px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          }

          .empty {
            text-align: center;
            background: white;
            padding: 30px;
            border-radius: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚨 Alertas SOS - Marina Tag</h1>
          ${cards}
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao carregar página de SOS");
  }
});

// Página da embarcação para NFC
app.get("/boat-page/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT * FROM boats WHERE id = $1
      `,
      [req.params.id]
    );

    const boat = result.rows[0];

    if (!boat) {
      return res.status(404).send(`
        <h1>Embarcação não encontrada</h1>
        <p>O ID informado não existe no sistema.</p>
      `);
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${boat.name} - Marina Tag</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #eef6fb;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }

          .container {
            max-width: 520px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.10);
          }

          h1 {
            text-align: center;
            color: #0f172a;
          }

          .tag {
            text-align: center;
            color: #2563eb;
            font-weight: bold;
            margin-bottom: 20px;
          }

          .info {
            margin: 12px 0;
            font-size: 16px;
          }

          button {
            width: 100%;
            padding: 16px;
            margin-top: 20px;
            border: none;
            border-radius: 10px;
            background: #dc2626;
            color: white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
          }

          .message {
            margin-top: 18px;
            padding: 12px;
            border-radius: 8px;
            background: #f3f4f6;
            text-align: center;
          }

          .map {
            display: block;
            text-align: center;
            margin-top: 16px;
            padding: 12px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${boat.name}</h1>
          <div class="tag">Marina Tag NFC</div>

          <div class="info"><strong>Responsável:</strong> ${boat.owner}</div>
          <div class="info"><strong>Telefone:</strong> ${boat.phone}</div>
          <div class="info"><strong>Contato de emergência:</strong> ${boat.emergency_contact}</div>

          <button onclick="sendSOS()">🚨 ENVIAR SOS COM LOCALIZAÇÃO</button>

          <div id="message" class="message">
            Toque no botão acima para enviar um alerta.
          </div>
        </div>

        <script>
          function sendSOS() {
            const message = document.getElementById("message");

            if (!navigator.geolocation) {
              message.innerHTML = "Este celular não permite capturar localização.";
              return;
            }

            message.innerHTML = "Obtendo localização...";

            navigator.geolocation.getCurrentPosition(
              async function(position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                const response = await fetch("/sos/${boat.id}", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    latitude: latitude,
                    longitude: longitude
                  })
                });

                const data = await response.json();

                if (response.ok) {
                  message.innerHTML =
                    "SOS enviado com sucesso!<br><br>" +
                    "Latitude: " + latitude + "<br>" +
                    "Longitude: " + longitude + "<br>" +
                    '<a class="map" target="_blank" href="https://www.google.com/maps?q=' + latitude + ',' + longitude + '">' +
                    "Abrir localização no Google Maps" +
                    "</a>";
                } else {
                  message.innerHTML = data.error || "Erro ao enviar SOS.";
                }
              },
              function() {
                message.innerHTML = "Não foi possível obter a localização. Autorize o acesso à localização no celular.";
              }
            );
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao carregar página da embarcação");
  }
});

// Página administrativa
app.get("/admin/boats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM boats
      ORDER BY created_at DESC
    `);

    const boats = result.rows;

    const boatsHtml = boats.length === 0
      ? `<p class="empty">Nenhuma embarcação cadastrada ainda.</p>`
      : boats.map(boat => {
          const nfcLink = `${req.protocol}://${req.get("host")}/boat-page/${boat.id}`;

          return `
            <div class="boat-card">
              <h3>${boat.name}</h3>
              <p><strong>Responsável:</strong> ${boat.owner}</p>
              <p><strong>Telefone:</strong> ${boat.phone}</p>
              <p><strong>Contato de emergência:</strong> ${boat.emergency_contact}</p>
              <p><strong>ID:</strong> ${boat.id}</p>

              <label>Link NFC:</label>
              <input class="link-input" value="${nfcLink}" readonly />

              <a class="open-link" href="${nfcLink}" target="_blank">
                Abrir página da embarcação
              </a>
            </div>
          `;
        }).join("");

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cadastro de Embarcações - Marina Tag</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #eef6fb;
            margin: 0;
            padding: 20px;
            color: #1f2937;
          }

          .container {
            max-width: 900px;
            margin: 0 auto;
          }

          .header {
            text-align: center;
            margin-bottom: 24px;
          }

          .card, .boat-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.08);
            margin-bottom: 20px;
          }

          .boat-card {
            border-left: 6px solid #2563eb;
          }

          label {
            display: block;
            font-weight: bold;
            margin-top: 14px;
            margin-bottom: 6px;
          }

          input {
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            font-size: 15px;
            box-sizing: border-box;
          }

          button {
            width: 100%;
            margin-top: 20px;
            padding: 14px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
          }

          .success {
            margin-top: 18px;
            padding: 16px;
            background: #dcfce7;
            border: 1px solid #86efac;
            border-radius: 10px;
          }

          .error {
            margin-top: 18px;
            padding: 16px;
            background: #fee2e2;
            border: 1px solid #fca5a5;
            border-radius: 10px;
          }

          .link-input {
            background: #f8fafc;
            font-size: 14px;
          }

          .open-link, .menu a {
            display: inline-block;
            margin-top: 12px;
            padding: 10px 14px;
            background: #0f766e;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          }

          .menu {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            justify-content: center;
          }

          .menu a {
            background: #0f172a;
          }

          .empty {
            background: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚤 Cadastro de Embarcações</h1>
            <p>Marina Tag NFC</p>
          </div>

          <div class="menu">
            <a href="/sos-page" target="_blank">Ver Alertas SOS</a>
            <a href="/boats" target="_blank">Ver JSON das Embarcações</a>
          </div>

          <div class="card">
            <h2>Nova embarcação</h2>

            <form id="boatForm">
              <label>Nome da embarcação</label>
              <input id="name" type="text" placeholder="Ex: Lancha Azul" required />

              <label>Nome do responsável</label>
              <input id="owner" type="text" placeholder="Ex: Thiago" required />

              <label>Telefone</label>
              <input id="phone" type="text" placeholder="Ex: 43999999999" required />

              <label>Contato de emergência</label>
              <input id="emergency_contact" type="text" placeholder="Ex: 43988888888" required />

              <button type="submit">Cadastrar embarcação</button>
            </form>

            <div id="result"></div>
          </div>

          <h2>Embarcações cadastradas</h2>
          ${boatsHtml}
        </div>

        <script>
          const form = document.getElementById("boatForm");
          const resultBox = document.getElementById("result");

          form.addEventListener("submit", async function(event) {
            event.preventDefault();

            const data = {
              name: document.getElementById("name").value,
              owner: document.getElementById("owner").value,
              phone: document.getElementById("phone").value,
              emergency_contact: document.getElementById("emergency_contact").value
            };

            try {
              const response = await fetch("/boats", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
              });

              const result = await response.json();

              if (response.ok) {
                const link = window.location.origin + "/boat-page/" + result.id;

                resultBox.innerHTML =
                  '<div class="success">' +
                  '<strong>Embarcação cadastrada com sucesso!</strong><br><br>' +
                  '<strong>ID:</strong><br>' + result.id + '<br><br>' +
                  '<strong>Link NFC:</strong><br>' +
                  '<input class="link-input" value="' + link + '" readonly />' +
                  '<br><br>' +
                  '<a class="open-link" target="_blank" href="' + link + '">Abrir página da embarcação</a>' +
                  '<br><br>' +
                  '<button onclick="location.reload()" type="button">Atualizar lista</button>' +
                  '</div>';

                form.reset();
              } else {
                resultBox.innerHTML =
                  '<div class="error">' +
                  (result.error || "Erro ao cadastrar embarcação.") +
                  '</div>';
              }
            } catch (error) {
              resultBox.innerHTML =
                '<div class="error">Erro de conexão com o servidor.</div>';
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao carregar página administrativa");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});