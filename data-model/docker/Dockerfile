FROM postgres:16-alpine

COPY scripts/ /scripts/
COPY docker/init/00-load-model.sh /docker-entrypoint-initdb.d/00-load-model.sh

RUN sed -i 's/\r$//' /docker-entrypoint-initdb.d/00-load-model.sh \
  && chmod +x /docker-entrypoint-initdb.d/00-load-model.sh
