const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, getDownloadURL } = require('firebase/storage');

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

// Set FFmpeg and FFprobe paths
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

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
  const musicFile = path.join(tempDir, `music-${Date.now()}.mp3`);
  const outputFile = path.join(tempDir, `output-${Date.now()}.mp3`);

  try {
    console.log('Generating text-to-speech with gTTS...');
    // Run generate_tts.py
    await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['generate_tts.py', text, ttsFile]);
      let errorData = '';
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script failed: ${errorData}`));
        }
      });
    });

    // Verify TTS file exists
    if (!fs.existsSync(ttsFile)) {
      throw new Error('TTS file was not created');
    }

    console.log('Downloading background music...');
    const backgroundMusicRef = ref(firebaseStorage, 'background_music/track1.mp3');
    const backgroundMusicUrl = await getDownloadURL(backgroundMusicRef);
    const musicResponse = await axios.get(backgroundMusicUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(musicFile, Buffer.from(musicResponse.data));

    console.log('Processing audio with FFmpeg...');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(ttsFile)
        .input(musicFile)
        .inputOptions(['-stream_loop -1']) // Loop background music
        .complexFilter([
          '[1:a]volume=0.4[a1]', // Reduce music volume to 40%
          '[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[out]' // Mix TTS and music
        ])
        .outputOptions(['-map [out]', '-metadata:s:a:0 title="Generated Podcast"'])
        .audioCodec('libmp3lame')
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
    [ttsFile, musicFile, outputFile].forEach(file => {
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});