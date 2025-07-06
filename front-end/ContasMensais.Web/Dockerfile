# Etapa 1 - Build
FROM node:18 AS build
WORKDIR /app
COPY . .

# Passar a variável VITE_API_URL manualmente para o build do Vite
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm install
RUN npm run build

# Etapa 2 - Servir com Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
