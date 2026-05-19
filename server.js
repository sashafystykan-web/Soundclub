require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────────────────────
// SoundCloud client_id
//
// HOW TO GET A FRESH client_id:
//   1. Open soundcloud.com in Chrome, open DevTools → Network tab
//   2. Search for any track
//   3. Filter requests by "client_id" in the search bar
//   4. Copy the client_id value from any API request URL
//   5. Replace the value below
// ─────────────────────────────────────────────────────────────────────────────
const CLIENT_ID = process.env.SC_CLIENT_ID || "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX";

const SC_BASE = "https://api-v2.soundcloud.com";

async function scFetch(url) {
  const { default: fetch } = await import("node-fetch");
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}client_id=${CLIENT_ID}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`SC API error ${res.status}: ${url}`);
  return res.json();
}

// GET /search?q=...&limit=20
app.get("/search", async (req, res) => {
  const q = req.query.q;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (!q) return res.status(400).json({ error: "q is required" });

  try {
    const data = await scFetch(
      `${SC_BASE}/search/tracks?q=${encodeURIComponent(q)}&limit=${limit}`
    );

    const tracks = (data.collection || []).map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.user?.username || "Unknown",
      duration: t.duration, // ms
      artwork: (t.artwork_url || t.user?.avatar_url || "").replace(
        "-large",
        "-t300x300"
      ),
      permalink: t.permalink_url,
      transcodings: t.media?.transcodings || [],
    }));

    res.json({ tracks });
  } catch (err) {
    console.error("/search error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /stream?url=<transcoding_url>
// Resolves the actual mp3/hls stream URL
app.get("/stream", async (req, res) => {
  const transcodingUrl = req.query.url;
  if (!transcodingUrl) return res.status(400).json({ error: "url is required" });

  try {
    const data = await scFetch(transcodingUrl);
    res.json({ url: data.url });
  } catch (err) {
    console.error("/stream error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`SoundClub server running on port ${PORT}`));
