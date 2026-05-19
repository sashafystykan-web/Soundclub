require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────────────────────
// YouTube Data API v3 key
//
// КАК ПОЛУЧИТЬ БЕСПЛАТНО:
//   1. Зайди на console.cloud.google.com
//   2. Создай проект (New Project)
//   3. APIs & Services → Enable APIs → найди "YouTube Data API v3" → Enable
//   4. APIs & Services → Credentials → Create Credentials → API Key
//   5. Скопируй ключ и вставь в .env как YT_API_KEY
//   Лимит: 10 000 запросов в день бесплатно
// ─────────────────────────────────────────────────────────────────────────────
const YT_API_KEY = process.env.YT_API_KEY || "";
const YT_BASE    = "https://www.googleapis.com/youtube/v3";

async function ytFetch(url) {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YT API ${res.status}: ${err}`);
  }
  return res.json();
}

function fmtDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || 0);
  const min = parseInt(m[2] || 0);
  const s = parseInt(m[3] || 0);
  return (h * 3600 + min * 60 + s) * 1000;
}

// GET /search?q=...&limit=20
app.get("/search", async (req, res) => {
  const q     = req.query.q;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (!q) return res.status(400).json({ error: "q is required" });
  if (!YT_API_KEY) return res.status(500).json({ error: "YT_API_KEY not set. Add it in Render → Environment" });

  try {
    const searchUrl = `${YT_BASE}/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(q)}&maxResults=${limit}&key=${YT_API_KEY}`;
    const searchData = await ytFetch(searchUrl);

    const ids = (searchData.items || []).map(i => i.id.videoId).join(",");
    if (!ids) return res.json({ tracks: [] });

    const detailUrl = `${YT_BASE}/videos?part=contentDetails,snippet&id=${ids}&key=${YT_API_KEY}`;
    const detailData = await ytFetch(detailUrl);

    const tracks = (detailData.items || []).map(v => ({
      id:       v.id,
      title:    v.snippet.title,
      artist:   v.snippet.channelTitle,
      duration: fmtDuration(v.contentDetails.duration),
      artwork:  v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
      videoId:  v.id,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error("/search error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /stream?id=<videoId>
app.get("/stream", async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "id is required" });
  res.json({ embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&controls=1` });
});

app.listen(PORT, () => console.log(`SoundClub server running on port ${PORT}`));
