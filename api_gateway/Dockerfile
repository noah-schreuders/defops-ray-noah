FROM node:18

WORKDIR /app

COPY . .

COPY package.json ./

RUN npm i

EXPOSE 3010

CMD ["node", "index.js", "rabbitmq"]