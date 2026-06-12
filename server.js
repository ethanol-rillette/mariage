const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --------------------
// MongoDB
// --------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur MongoDB :', err));

// --------------------
// Schema
// --------------------
const captureSchema = new mongoose.Schema({
  type: { type: String, default: 'photo' },
  content: String,
  createdAt: { type: Date, default: Date.now },
  uploader: String
});

const Capture = mongoose.model('Capture', captureSchema);

// --------------------
// Nodemailer transporter (réutilisé)
// --------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
  greetingTimeout: 10000
});

// --------------------
// Upload route
// --------------------
app.post('/upload', async (req, res) => {
  try {
    const { content, uploader, type } = req.body;

    if (!content) {
      return res.status(400).send({ error: "content manquant" });
    }

    // 1. Sauvegarde Mongo (OBLIGATOIRE)
    const capture = new Capture({ content, uploader, type });
    await capture.save();

    console.log("✔ Sauvegarde Mongo OK");

    // 2. Conversion base64 → buffer
    const base64Data = content.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const MAX_EMAIL_SIZE = 3 * 1024 * 1024;

    let emailSent = false;

    if (buffer.length <= MAX_EMAIL_SIZE) {
      emailSent = true;

      // FIRE AND FORGET (NE BLOQUE PAS LA RÉPONSE HTTP)
      (async () => {
        try {
          const extension = type === 'photo' ? 'png' : 'webm';

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO,
            subject: `Nouvelle ${type} 📸`,
            text: `Upload par ${uploader || 'invité'}`,
            attachments: [
              {
                filename: `${type}_${Date.now()}.${extension}`,
                content: buffer
              }
            ]
          });

          console.log("✔ Email envoyé");
        } catch (err) {
          console.warn("⚠️ Email non envoyé :", err.message);
        }
      })();
    } else {
      console.log("⚠️ Email ignoré (fichier trop volumineux)");
    }

    // 3. Réponse IMMÉDIATE au client
    res.send({
      status: 'ok',
      emailSent
    });

    console.log("UPLOAD HIT");
    console.log(req.body);

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).send({ error: err.message });
  }
});

// --------------------
// Get last capture
// --------------------
app.get('/last', async (req, res) => {
  try {
    const last = await Capture.findOne().sort({ createdAt: -1 });
    res.send(last);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur port ${PORT}`);
});