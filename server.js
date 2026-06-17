const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();

// ⚠️ limite JSON (Base64)
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
// LIMITES
// --------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

function getBase64Size(base64String) {
  return Buffer.byteLength(base64String, 'utf8');
}

// --------------------
// UPLOAD
// --------------------
app.post('/upload', async (req, res) => {
  try {
    const { content, uploader, type = 'photo' } = req.body;

    if (!content) {
      return res.status(400).send({
        error: 'content manquant'
      });
    }

    // Retire le prefix data:image/...;base64,
    const base64Data = content.replace(/^data:.*;base64,/, '');

    // Taille réelle Base64
    const size = getBase64Size(base64Data);

    // Vérification 10 Mo (avec marge Base64)
    const MAX_SIZE_BASE64 = MAX_FILE_SIZE * 1.37; // marge encoding

    if (size > MAX_SIZE_BASE64) {
      return res.status(400).send({
        error: `${type} trop lourd (max 10 Mo)`
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

    res.send({
      status: 'ok'
    });

    // EMAIL ASYNC
    (async () => {
      try {
        const extension = type === 'video' ? 'webm' : 'png';

        await resend.emails.send({
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

        console.log('EMAIL OK');
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
// LAST CAPTURE
// --------------------
app.get('/last', async (req, res) => {
  try {
    const last = await Capture.findOne().sort({ createdAt: -1 });

    res.send(last);
  } catch (err) {
    console.error(err);

    res.status(500).send({
      error: 'Erreur serveur'
    });
  }
});

// --------------------
// START
// --------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur port ${PORT}`);
});