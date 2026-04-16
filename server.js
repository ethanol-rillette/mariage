// server.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Connexion MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur MongoDB :', err));

// --- Schéma capture ---
const captureSchema = new mongoose.Schema({
  type: { type: String, default: 'photo' },
  content: String,
  createdAt: { type: Date, default: Date.now },
  uploader: String
});

const Capture = mongoose.model('Capture', captureSchema);

// --- Upload capture ---
const nodemailer = require('nodemailer');

app.post('/upload', async (req, res) => {
  try {
    const { content, uploader, type } = req.body;

    if (!content) {
      return res.status(400).send({ error: "content manquant" });
    }

    // -------------------------
    // 1. SAUVEGARDE MONGO (OBLIGATOIRE)
    // -------------------------
    const capture = new Capture({ content, uploader, type });
    await capture.save();

    console.log("✔ Sauvegarde Mongo OK");

    // -------------------------
    // 2. ENVOI EMAIL (OPTIONNEL)
    // -------------------------
    const MAX_EMAIL_SIZE = 3 * 1024 * 1024; // ~3MB base64 (ajustable)

    const base64Data = content.replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length <= MAX_EMAIL_SIZE) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

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

      } catch (mailErr) {
        // ⚠️ IMPORTANT : on ne bloque pas l'app
        console.warn("⚠️ Email non envoyé :", mailErr.message);
      }
    } else {
      console.log("⚠️ Email ignoré (fichier trop volumineux)");
    }

    // -------------------------
    // 3. REPONSE CLIENT TOUJOURS OK
    // -------------------------
    res.send({
      status: 'ok',
      emailSent: buffer.length <= MAX_EMAIL_SIZE
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).send({ error: err.message });
  }
});

// --- Récupérer la dernière capture ---
app.get('/last', async (req, res) => {
  try {
    const last = await Capture.findOne().sort({ createdAt: -1 });
    res.send(last);
  } catch(err) {
    console.error(err);
    res.status(500).send({ error: "Erreur serveur" });
  }
});

// --- Démarrage serveur ---
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Serveur lancé sur port ${PORT}`));