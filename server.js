const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// BUG FIX: "cors" tha require kiya hua tha, par kabhi app.use(cors()) call
// nahi hua tha. Agar tumhara frontend kisi aur domain (jaise GitHub Pages)
// se backend ko call karta hai, to browser silently request block kar deta
// hai. Yahi ek wajah thi jisse AI reply "fail" hota dikh raha tha.
app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const PRIMARY_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!PRIMARY_API_KEY) {
  console.error("⚠️  GEMINI_API_KEY set nahi hai. Railway → Variables me isse add karo.");
}

// Quick way to check from the browser/console whether the server has the key
// and is alive: GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: MODEL_NAME, hasKey: !!PRIMARY_API_KEY });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, superAI } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }
    if (!PRIMARY_API_KEY) {
      return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Set it in Railway → Variables.' });
    }

    const systemInstruction = superAI
      ? "You are Sudarshana Super AI, an elite multi-model synthesized expert assistant. Provide accurate, highly structured, and direct professional answers."
      : "You are Sudarshana AI, a friendly, precise, and direct conversational assistant.";

    // BUG FIX: Pehle system instruction ko ek fake "user" turn ki tarah
    // contents array me daala jaa raha tha, aur uske turant baad user ka
    // asli message bhi "user" role se aata tha. Gemini ko contents me
    // STRICTLY alternating user/model turns chahiye — do "user" turns
    // ek ke baad ek aane par API 400 error deta hai ya candidates empty
    // aata hai. Isi wajah se "Sudarshana couldn't complete that response"
    // wala error baar baar aa raha tha.
    //
    // Fix: system prompt ab apne dedicated `systemInstruction` field me
    // jaata hai, contents me nahi.
    const rawContents = messages
      .filter(m => m && typeof m.content === 'string' && m.content.trim() !== '')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Extra safety: agar kahin bhi do same-role turns consecutively aa
    // jaayein (duplicate clicks, retry, etc.), unhe merge kar do — warna
    // Gemini phir se reject kar dega.
    const contents = [];
    for (const turn of rawContents) {
      const last = contents[contents.length - 1];
      if (last && last.role === turn.role) {
        last.parts[0].text += "\n" + turn.parts[0].text;
      } else {
        contents.push(turn);
      }
    }
    // Gemini ka pehla turn hamesha "user" hona chahiye.
    if (contents.length && contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: '.' }] });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${PRIMARY_API_KEY}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.8 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));
      return res.status(502).json({ error: data.error?.message || "AI service returned an error." });
    }

    // BUG FIX: purana code `data.candidates[0].content` ko direct access
    // karta tha bina yeh check kiye ki candidates[0] exist bhi karta hai
    // ya nahi. Agar Gemini ne safety-block ki wajah se candidates: []
    // bheja, to yahi line crash karke "network issue" error dikha deti thi.
    const candidate = data.candidates && data.candidates[0];
    if (!candidate) {
      console.error("No candidates in Gemini response:", JSON.stringify(data));
      return res.status(502).json({ error: "AI returned no response (possibly blocked by safety filters)." });
    }
    if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      return res.json({ reply: "Main is specific request me help nahi kar sakta — thoda rephrase karke try karo." });
    }

    const replyText = candidate.content?.parts?.[0]?.text;
    if (!replyText) {
      return res.status(502).json({ error: "AI response was empty." });
    }

    res.json({ reply: replyText });

  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: "Sudarshana AI encountered a network issue. Please try again." });
  }
});

// Phase 6: Real Image Generation Route
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Image prompt is required' });
    }
    const cleanPrompt = prompt.replace(/(generate image of:?|create image of:?|image of|picture of)/gi, '').trim();
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt || prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    res.json({ imageUrl });
  } catch (err) {
    console.error("Image API Error:", err);
    res.status(500).json({ error: "Failed to generate image." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sudarshana AI Server running on port ${PORT}`);
});
