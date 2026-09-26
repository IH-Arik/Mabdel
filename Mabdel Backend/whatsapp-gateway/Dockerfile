FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
# npm ci installs exactly what package-lock.json pins - a rebuild never picks up a
# different Baileys (WhatsApp protocol) version on its own.
RUN npm ci --omit=dev

COPY gateway.js ./

RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "gateway.js"]
