import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Chat API
  if (req.method === "POST" && req.url === "/api/chat") {
    if (!API_KEY) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }));
      return;
    }

    try {
      let body = "";

      req.on("data", chunk => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const message = data.message || "";

          if (!message.trim()) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Message is required" }));
            return;
          }

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: message
                      }
                    ]
                  }
                ]
              })
            }
          );

          const result = await response.json();

          if (!response.ok) {
            res.writeHead(response.status, {
              "Content-Type": "application/json"
            });
            res.end(JSON.stringify({
              error: result?.error?.message || "Gemini API error"
            }));
            return;
          }

          const reply =
            result?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Sorry, I couldn't generate a response.";

          res.writeHead(200, {
            "Content-Type": "application/json"
          });

          res.end(JSON.stringify({ reply }));
        } catch (error) {
          res.writeHead(500, {
            "Content-Type": "application/json"
          });

          res.end(JSON.stringify({
            error: error.message
          }));
        }
      });

      return;
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  // Serve frontend
  let filePath = req.url === "/"
    ? path.join(__dirname, "index.html")
    : path.join(__dirname, req.url);

  // Security: prevent path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath);

    const contentTypes = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    };

    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });

    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Sudarshana Chat AI running on port ${PORT}`);
});
