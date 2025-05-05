FROM node:18-buster-slim

# Install Python, pip, and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install static FFmpeg binary with libmp3lame
RUN curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o ffmpeg.tar.xz \
    && tar -xf ffmpeg.tar.xz \
    && mv ffmpeg-*-static/ffmpeg /usr/local/bin/ffmpeg \
    && mv ffmpeg-*-static/ffprobe /usr/local/bin/ffprobe \
    && rm -rf ffmpeg.tar.xz ffmpeg-*-static

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