# --- Étape 1 : compilation de l'application React ---
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# Pas de source maps en production : elles exposeraient tout le code source (E28)
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# --- Étape 2 : fichiers statiques servis par nginx ---
# nginx 1.27 comptait 70 vulnérabilités (Trivy) : dernière version stable corrigée (E28)
FROM nginx:1.30.8-alpine
# Correctifs de sécurité des paquets Alpine publiés depuis la création de l'image de base
RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
