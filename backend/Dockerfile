FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copier d'abord les package*.json permet de garder le cache de "npm ci"
# tant que les dépendances ne changent pas.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ne pas faire tourner l'application en root dans le conteneur
USER node

EXPOSE 5000
CMD ["node", "server.js"]
