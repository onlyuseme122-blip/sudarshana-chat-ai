const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const PRIMARY_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Phase 1 & 3: Real Chat Endpoint with Full Multi-Turn Context Memory
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, superAI } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const systemInstruction = superAI 
      ? "You are Sudarshana Super AI, an elite multi-model synthesized expert assistant. Provide accurate, highly structured, and direct professional answers."
      : "You are Sudarshana AI, a friendly, precise, and direct conversational assistant.";

    const formattedContents = [];
    formattedContents.push({
      role: "user",
      parts: [{ text: `System Instruction: ${systemInstruction}` }]
    });

    messages.forEach(msg => {
      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      formattedContents.push({
        role: geminiRole,
        parts: [{ text: msg.content }]
      });
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${PRIMARY_API_KEY}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: formattedContents })
    });

    const data = await response.json();

    if (!response.ok || !data.candidates || !data.candidates[0].content) {
      const errorMsg = data.error?.message || "AI service is currently busy.";
      return res.status(502).json({ error: errorMsg });
    }

    const replyText = data.candidates[0].content.parts[0].text;
    res.json({ reply: replyText });

  } catch (error) {
    console.error("Chat API Error:", error.message);
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
    const cleanPrompt = prompt.replace(/(generate image of|create image of|image of|picture of)/gi, '').trim();
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
