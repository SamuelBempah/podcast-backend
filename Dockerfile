FROM node:18-buster-slim

# Install Python, pip, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install FFmpeg with libmp3lame (static build for Fly.io)
RUN curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.0-latest-linux64-gpl-7.0.tar.xz -o ffmpeg.tar.xz \
    && tar -xf ffmpeg.tar.xz \
    && mv ffmpeg-*-linux64-gpl-7.0/bin/ffmpeg /usr/bin/ffmpeg \
    && mv ffmpeg-*-linux64-gpl-7.0/bin/ffprobe /usr/bin/ffprobe \
    && rm -rf ffmpeg.tar.xz ffmpeg-*-linux64-gpl-7.0 \
    && apt-get remove -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install gTTS
RUN python3 -m pip install --no-cache-dir --upgrade pip \
    && python3 -m pip install --no-cache-dir gTTS==2.3.2

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install --production

# Copy application code
COPY server.js .

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]