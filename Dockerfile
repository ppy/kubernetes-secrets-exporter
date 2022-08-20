FROM node:16-alpine

COPY ./src/ /srv/src/
COPY package.json package-lock.json /srv/

WORKDIR /srv

RUN npm ci

CMD [ "/usr/local/bin/node", "/srv/src/index.js"]
