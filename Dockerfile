FROM node:16-alpine

COPY ./src/ /srv/src/
COPY package.json package-lock.json /srv/

WORKDIR /srv

RUN npm ci

USER 1000:1000

CMD [ "/usr/local/bin/node", "/srv/src/index.js"]
