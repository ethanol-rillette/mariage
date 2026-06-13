const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Resend } = require('resend');
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
// Resend
// --------------------
const resend = new Resend(process.env.RESEND_API_KEY);

// --------------------
// Schema
// --------------------
const captureSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'photo'
  },
  content: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  uploader: String
});

const Capture = mongoose.model('Capture', captureSchema);

// --------------------
// Upload
// --------------------
app.post('/upload', async (req, res) => {
  try {
    const { content, uploader, type = 'photo' } = req.body;

    if (!content) {
      return res.status(400).send({
        error: 'content manquant'
      });
    }

    // Sauvegarde Mongo
    const capture = new Capture({
      content,
      uploader,
      type
    });

    await capture.save();

    console.log('✔ Sauvegarde Mongo OK');

    // Réponse immédiate
    res.send({
      status: 'ok'
    });

    // Email en arrière-plan
    (async () => {
      try {
        const base64Data = content.replace(/^data:.*;base64,/, '');

        const extension =
          type === 'video'
            ? 'webm'
            : 'png';

        const result = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: process.env.EMAIL_TO,
          subject: `Nouvelle ${type} 📸`,
          text: `Upload par ${uploader || 'invité'}`,
          attachments: [
            {
              filename: `${type}_${Date.now()}.${extension}`,
              content: base64Data
            }
          ]
        });

        console.log('EMAIL RESULT:', result);
      } catch (err) {
        console.error('RESEND ERROR:', err);
      }
    })();

  } catch (err) {
    console.error('UPLOAD ERROR:', err);

    res.status(500).send({
      error: err.message
    });
  }
});

// --------------------
// Dernière capture
// --------------------
app.get('/last', async (req, res) => {
  try {
    const last = await Capture.findOne().sort({
      createdAt: -1
    });

    res.send(last);
  } catch (err) {
    console.error(err);

    res.status(500).send({
      error: 'Erreur serveur'
    });
  }
});

// --------------------
// Start
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur port ${PORT}`);
});