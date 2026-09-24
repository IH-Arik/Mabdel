FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY gateway.js ./

RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "gateway.js"]
