# Builder image
FROM node:23-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN npm run build

# Runner image
FROM nginx:alpine

## Install curl for health check
RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

COPY custom-entrypoint.sh /custom-entrypoint.sh
RUN chmod +x /custom-entrypoint.sh

EXPOSE 80
CMD ["/custom-entrypoint.sh"]