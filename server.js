require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const path     = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const YT_API_KEY = process.env.YT_API_KEY || "";
const YT_BASE    = "https://www.googleapis.com/youtube/v3";

async function ytFetch(url) {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YT API ${res.status}`);
  return res.json();
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return ((+m[1]||0)*3600 + (+m[2]||0)*60 + (+m[3]||0)) * 1000;
}

const BLOCK_KEYWORDS = [
  "podcast","подкаст","gameplay","game play","playthrough","walkthrough",
  "news","новости","lecture","лекция","tutorial","урок","interview","интервью",
  "reaction","реакция","unboxing","review","обзор","vlog","влог","commentary"
];
function looksLikeMusic(title, channelTitle, categoryId) {
  const text = (title + " " + channelTitle).toLowerCase();
  if (BLOCK_KEYWORDS.some(k => text.includes(k))) return false;
  return String(categoryId) === "10";
}

// GET /search?q=...&limit=20
app.get("/search", async (req, res) => {
  const q     = req.query.q;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  if (!q)          return res.status(400).json({ error: "q is required" });
  if (!YT_API_KEY) return res.status(500).json({ error: "YT_API_KEY not set" });

  try {
    const searchUrl = `${YT_BASE}/search?part=snippet&type=video&videoCategoryId=10&q=${encodeURIComponent(q)}&maxResults=50&key=${YT_API_KEY}`;
    const searchData = await ytFetch(searchUrl);
    const ids = (searchData.items || []).map(i => i.id.videoId).join(",");
    if (!ids) return res.json({ tracks: [] });

    const detailUrl = `${YT_BASE}/videos?part=contentDetails,snippet&id=${ids}&key=${YT_API_KEY}`;
    const detailData = await ytFetch(detailUrl);

    const tracks = (detailData.items || [])
      .filter(v => {
        const dur = parseDuration(v.contentDetails.duration);
        if (dur < 60000 || dur > 720000) return false;
        return looksLikeMusic(v.snippet.title, v.snippet.channelTitle, v.snippet.categoryId);
      })
      .slice(0, limit)
      .map(v => ({
        id:       v.id,
        title:    v.snippet.title,
        artist:   v.snippet.channelTitle,
        duration: parseDuration(v.contentDetails.duration),
        artwork:  v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || "",
        videoId:  v.id,
      }));

    res.json({ tracks });
  } catch (err) {
    console.error("/search error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`SoundClub running on port ${PORT}`));
