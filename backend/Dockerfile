FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Après l'installation, npm et corepack ne servent plus (l'app se lance avec "node") :
# on les retire pour réduire la surface d'attaque (10 vulnérabilités HIGH selon Trivy) (E28)
RUN npm ci --omit=dev \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY . .

USER node

EXPOSE 5000
CMD ["node", "server.js"]
