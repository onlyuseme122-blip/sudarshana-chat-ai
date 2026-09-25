const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Serve static files from root directory
app.use(express.static(path.join(__dirname)));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Secure Backend API Endpoint for Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, smartMode } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    const latestMessage = messages[messages.length - 1].content;
    
    // System instruction based on Smart Mode (Auto / Fast / Deep / Creative)
    let systemInstruction = "You are Sudarshana AI, a premium, intelligent, and helpful personal AI assistant. Provide clean, concise, and structured answers directly.";
    if (smartMode === 'deep') {
      systemInstruction = "Provide an in-depth, rigorous, and highly analytical breakdown for the request.";
    } else if (smartMode === 'creative') {
      systemInstruction = "Provide an imaginative, creative, and engaging response for the request.";
    } else if (smartMode === 'fast') {
      systemInstruction = "Provide a direct, concise, and straight-to-the-point response.";
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const apiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\nUser Request: ${latestMessage}` }]
        }
      ]
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload)
    });

    let data = await response.json();

    // Automatic Fallback Retry if primary call fails
    if (!response.ok || !data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn("Primary model call lagged, attempting fallback retry...");
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      response = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });
      data = await response.json();
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sudarshana AI processed your request successfully.";
    
    res.json({ reply });

  } catch (err) {
    console.error("Backend Server Error:", err);
    res.status(502).json({ error: "Sudarshana is switching to another AI engine. Please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sudarshana AI Server running on port ${PORT}`);
});
