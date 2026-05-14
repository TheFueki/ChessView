FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY admin-frontend/package.json ./
RUN yarn install --non-interactive

COPY admin-frontend ./
COPY frontend /frontend
RUN ln -s /app/node_modules /frontend/node_modules

EXPOSE 5174

CMD ["yarn", "dev"]
