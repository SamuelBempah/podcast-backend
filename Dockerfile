FROM node:18-slim

# Install Python, pip, FFmpeg, and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Fix pip if broken
RUN python3 -m ensurepip --upgrade \
    && python3 -m pip install --no-cache-dir --upgrade pip

# Install gTTS
RUN python3 -m pip install --no-cache-dir gTTS

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