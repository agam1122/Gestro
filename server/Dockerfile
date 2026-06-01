# Base Image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install packages
RUN npm install

# Copy application files
COPY . .

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "server.js"]
