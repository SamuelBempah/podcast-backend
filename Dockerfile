FROM node:18-slim

# Install Python, pip, and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and install Node.js dependencies
COPY package.json .
RUN npm install

# Install Python dependencies
RUN pip3 install gTTS --no-cache-dir

# Copy application code
COPY server.js .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]