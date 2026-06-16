import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
let officialPlayersCache = null;

function getOfficialPlayers() {
  if (!officialPlayersCache) {
    officialPlayersCache = JSON.parse(
      fs.readFileSync(path.join(__dirname, "official_players.json"), "utf8")
    );
  }
  return officialPlayersCache;
}

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/import-official-squads", (_, res) => {
  try {
    const players = getOfficialPlayers();
    const teams = new Set(players.map((p) => p.team)).size;
    res.json({
      ok: true,
      source: "Local embedded squad database",
      extraction: "local-json",
      players,
      teams
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`FG World Cup AI Easy V9.2 Clean Engine on ${PORT}`);
});
