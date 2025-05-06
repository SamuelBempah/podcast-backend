const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, getDownloadURL } = require('firebase/storage');

// Set FFmpeg and FFprobe paths for fluent-ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcRES5X4RSjWcRGm5crwuSl6qUKx6aG6Y",
  authDomain: "leumas-decipher-softwares.firebaseapp.com",
  databaseURL: "https://leumas-decipher-softwares-default-rtdb.firebaseio.com",
  projectId: "leumas-decipher-softwares",
  storageBucket: "leumas-decipher-softwares.appspot.com",
  messagingSenderId: "375335626697",
  appId: "1:375335626697:web:da9ee4c9dac8931f7caa18",
  measurementId: "G-0T6TTDN6K8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

const server = express();
server.use(cors());
server.use(express.json());

// Get audio duration using ffprobe
const getAudioDuration = (file) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      if (err) {
        console.error(`ffprobe error for ${file}:`, err.message);
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        console.log(`Duration of ${file}: ${duration} seconds`);
        resolve(duration);
      }
    });
  });
};

server.post('/generate-tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    console.error('No text provided in request');
    return res.status(400).json({ error: 'Text is required' });
  }

  const ttsFile = path.join(__dirname, `tts_${Date.now()}.mp3`);
  const musicFile = path.join(__dirname, `music_${Date.now()}.mp3`);
  const mixedFile = path.join(__dirname, `mixed_${Date.now()}.mp3`);

  try {
    // Generate TTS audio
    console.log('Generating TTS audio...');
    await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', ['generate_tts.py', text, ttsFile]);
      let errorOutput = '';
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script failed:', errorOutput);
          reject(new Error(`Python script failed: ${errorOutput}`));
        } else {
          console.log('TTS audio generated:', ttsFile);
          resolve();
        }
      });
    });

    // Get TTS duration
    let ttsDuration;
    try {
      ttsDuration = await getAudioDuration(ttsFile);
    } catch (err) {
      console.error('Failed to get TTS duration, using fallback duration:', err.message);
      ttsDuration = 60; // Fallback to 60 seconds
    }

    // Download background music from Firebase
    console.log('Fetching background music from Firebase...');
    const musicRef = ref(storage, 'background_music/track1.mp3');
    let musicUrl;
    try {
      musicUrl = await getDownloadURL(musicRef);
      console.log('Background music URL:', musicUrl);
    } catch (err) {
      console.error('Failed to get music URL:', err.message);
      console.warn('Returning TTS audio without background music due to music fetch error');
      const outputAudio = fs.readFileSync(ttsFile);
      res.set('Content-Type', 'audio/mp3');
      res.send(outputAudio);
      console.log('TTS audio sent to client:', ttsFile);
      fs.unlinkSync(ttsFile);
      return;
    }
    const musicResponse = await axios.get(musicUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(musicFile, musicResponse.data);
    console.log('Background music downloaded:', musicFile);

    // Get music duration
    let musicDuration;
    try {
      musicDuration = await getAudioDuration(musicFile);
    } catch (err) {
      console.error('Failed to get music duration, using fallback duration:', err.message);
      musicDuration = 30; // Fallback to 30 seconds
    }

    // Mix audio with fluent-ffmpeg, looping background music
    console.log(`Mixing audio with fluent-ffmpeg, looping background music for ${ttsDuration} seconds...`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(ttsFile)
        .input(musicFile)
        .inputOptions(['-stream_loop -1']) // Loop music indefinitely
        .complexFilter([
          '[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.4'
        ])
        .duration(ttsDuration) // Set output duration to TTS duration
        .output(mixedFile)
        .on('end', () => {
          console.log('Audio mixed successfully with looped background music:', mixedFile);
          resolve();
        })
        .on('error', (err) => {
          console.error('Fluent-ffmpeg error:', err.message);
          console.warn('Returning TTS audio without background music due to mixing error');
          resolve(); // Fallback to TTS audio
        })
        .run();
    });

    // Use mixed audio if available, else fall back to TTS audio
    const outputFile = fs.existsSync(mixedFile) && fs.statSync(mixedFile).size > 0 ? mixedFile : ttsFile;
    if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size === 0) {
      throw new Error('Output audio file is missing or empty');
    }

    // Read and send the output audio
    const outputAudio = fs.readFileSync(outputFile);
    res.set('Content-Type', 'audio/mp3');
    res.send(outputAudio);
    console.log('Audio sent to client:', outputFile);

    // Clean up
    [ttsFile, musicFile, mixedFile].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlink(file, (err) => {
          if (err) console.error('Failed to delete:', file, err);
        });
      }
    });
    console.log('Temporary files cleaned up');
  } catch (err) {
    console.error('Error in /generate-tts:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});