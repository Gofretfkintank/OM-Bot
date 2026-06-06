FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN pip3 install py-aternos --break-system-packages

COPY . .

CMD ["node", "index.js"]