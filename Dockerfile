FROM node:18-buster-slim

# Install Python, pip, FFmpeg, and libmp3lame
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libmp3lame0 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install gTTS
RUN python3 -m pip install --no-cache-dir --upgrade pip \
    && python3 -m pip install --no-cache-dir gTTS

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install

# Copy application code
COPY server.js .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]