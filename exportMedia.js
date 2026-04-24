// exportMedia.js
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

// Modèle identique à celui du serveur
const captureSchema = new mongoose.Schema({
  type: String,      // photo ou video
  content: String,   // base64
  createdAt: Date,
  uploader: String
});

const Capture = mongoose.model('Capture', captureSchema);

async function exportMedia() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connecté, récupération des médias...');

    const captures = await Capture.find().sort({ createdAt: 1 });

    if (captures.length === 0) {
      console.log('Aucun média trouvé.');
      return;
    }

    // Crée le dossier export si nécessaire
    if (!fs.existsSync('export')) {
      fs.mkdirSync('export');
    }

    let photoCount = 0;
    let videoCount = 0;

    captures.forEach((c) => {
      if (c.type === 'photo') {
        photoCount++;
        const base64Data = c.content.replace(/^data:image\/png;base64,/, '');
        const filename = `export/photo_${photoCount}.png`;
        fs.writeFileSync(filename, base64Data, 'base64');
        console.log(`Photo exportée : ${filename}`);
      } else if (c.type === 'video') {
        videoCount++;
        const base64Data = c.content.replace(/^data:video\/webm;base64,/, '');
        const filename = `export/video_${videoCount}.webm`;
        fs.writeFileSync(filename, base64Data, 'base64');
        console.log(`Vidéo exportée : ${filename}`);
      }
    });

    console.log(`Export terminé : ${photoCount} photos, ${videoCount} vidéos`);
    mongoose.disconnect();
  } catch (err) {
    console.error('Erreur :', err);
  }
}

// Lancer la fonction
exportMedia();