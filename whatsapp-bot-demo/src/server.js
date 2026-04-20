require("dotenv").config();

const express = require("express");
const path = require("path");
const { processMessage } = require("./botEngine");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = Number(process.env.PORT || 8090);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "ilgc-demo-verify-token";

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "whatsapp-bot-demo" });
});

// WhatsApp webhook verification shape (Meta style)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge || "verified");
  }
  return res.sendStatus(403);
});

// WhatsApp webhook receive (Meta style) - simplified parser for demo payloads
app.post("/webhook", (req, res) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const from = message?.from;
    const text = message?.text?.body || "";

    if (!from || !text) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const bot = processMessage(from, text);
    return res.status(200).json({ ok: true, inbound: { from, text }, bot });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Local test endpoint (no WhatsApp needed)
app.post("/simulate", (req, res) => {
  const { from, text } = req.body || {};
  if (!from || !text) {
    return res.status(400).json({ ok: false, error: "Provide from and text" });
  }

  const bot = processMessage(String(from), String(text));
  return res.json({ ok: true, inbound: { from, text }, bot });
});

app.listen(PORT, () => {
  console.log(`WhatsApp demo bot running on http://localhost:${PORT}`);
  console.log("Try POST /simulate with JSON: { \"from\": \"+911000000004\", \"text\": \"menu\" }");
});
