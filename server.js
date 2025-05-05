const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');
const ffmpeg = require('fluent-ffmpeg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize Firebase (kept for consistency, though storage is unused)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "leumas-decipher-softwares.firebaseapp.com",
  databaseURL: "https://leumas-decipher-softwares-default-rtdb.firebaseio.com",
  projectId: "leumas-decipher-softwares",
  storageBucket: "leumas-decipher-softwares.appspot.com",
  messagingSenderId: "375335626697",
  appId: "1:375335626697:web:da9ee4c9dac8931f7caa18",
  measurementId: "G-0T6TTDN6K8"
};
const firebaseApp = initializeApp(firebaseConfig);
getStorage(firebaseApp); // Initialize storage, though unused

// Set FFmpeg path to system binary
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/generate-tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const tempDir = os.tmpdir();
  const ttsFile = path.join(tempDir, `tts-${Date.now()}.mp3`);
  const outputFile = path.join(tempDir, `output-${Date.now()}.mp3`);

  try {
    console.log('Generating text-to-speech with gTTS...');
    // Use gTTS via Python script
    const pythonScript = `
from gtts import gTTS
import sys
text = sys.stdin.read()
tts = gTTS(text=text, lang='en')
tts.save('${ttsFile}')
    `;
    fs.writeFileSync(path.join(tempDir, 'tts.py'), pythonScript);
    execSync(`echo "${text.replace(/"/g, '\\"')}" | python3 ${path.join(tempDir, 'tts.py')}`);

    // Process TTS audio with FFmpeg (no background music)
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(ttsFile)
        .audioCodec('libmp3lame')
        .outputOptions(['-metadata:s:a:0 title="Generated Podcast"'])
        .save(outputFile)
        .on('end', () => {
          console.log('Audio processing completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err.message);
          reject(err);
        });
    });

    // Read and send the output file
    const outputBuffer = fs.readFileSync(outputFile);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': outputBuffer.length
    });
    res.send(outputBuffer);
  } catch (err) {
    console.error('Generate TTS error:', err.message);
    res.status(500).json({ error: `Failed to generate podcast: ${err.message}` });
  } finally {
    // Clean up temporary files
    [ttsFile, outputFile, path.join(tempDir, 'tts.py')].forEach(file => {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});