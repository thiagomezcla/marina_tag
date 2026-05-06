import express from "express";

const app = express();

// Rota teste
app.get("/", (req, res) => {
  res.send("SaaS rodando 🚀");
});

// ⚠️ ESSA PARTE É CRÍTICA
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});