FROM node:22-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

CMD [ "node", "index.js" ]
