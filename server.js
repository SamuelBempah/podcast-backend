const express = require('express');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, getDownloadURL } = require('firebase/storage');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize Firebase
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
const firebaseStorage = getStorage(firebaseApp);

// Set FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

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
  let musicFile;

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

    // Fetch background music from Firebase Storage
    const backgroundMusicRef = ref(firebaseStorage, 'background_music/track1.mp3');
    const backgroundMusicUrl = await getDownloadURL(backgroundMusicRef);
    console.log('Background music URL:', backgroundMusicUrl);

    // Download background music
    const musicResponse = await axios.get(backgroundMusicUrl, { responseType: 'arraybuffer' });
    musicFile = path.join(tempDir, `music-${Date.now()}.mp3`);
    fs.writeFileSync(musicFile, musicResponse.data);

    // Process audio with FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(ttsFile)
        .input(musicFile)
        .inputOptions(['-stream_loop -1']) // Loop background music
        .complexFilter([
          '[1:a]volume=0.4[a1]', // Reduce music volume to 40%
          '[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2'
        ])
        .audioCodec('mp3')
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
    [ttsFile, outputFile, path.join(tempDir, 'tts.py'), musicFile].forEach(file => {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});