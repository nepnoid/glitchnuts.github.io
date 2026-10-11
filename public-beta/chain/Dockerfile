# syntax=docker/dockerfile:1
# Besu 26.9.0 is pinned; refresh both version and checksum together after independent review.
FROM eclipse-temurin:25-jre-jammy AS besu
ARG BESU_VERSION=26.9.0
ARG BESU_SHA256=172b29069837f13436a20bd7c8234aeca67917d8a378e81e2bd4a205c57540ea
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl tar && rm -rf /var/lib/apt/lists/* \
 && curl --fail --location --retry 3 --output /tmp/besu.tar.gz "https://github.com/besu-eth/besu/releases/download/${BESU_VERSION}/besu-${BESU_VERSION}.tar.gz" \
 && echo "${BESU_SHA256}  /tmp/besu.tar.gz" | sha256sum -c - \
 && mkdir -p /opt && tar -xzf /tmp/besu.tar.gz -C /opt \
 && mv "/opt/besu-${BESU_VERSION}" /opt/besu \
 && rm /tmp/besu.tar.gz

FROM eclipse-temurin:25-jre-jammy
RUN groupadd --system --gid 10001 besu && useradd --system --uid 10001 --gid besu --home-dir /var/lib/besu --create-home besu
RUN mkdir -p /var/lib/besu/data && chown besu:besu /var/lib/besu/data
COPY --from=besu /opt/besu /opt/besu
COPY --chmod=0755 entrypoint.sh /usr/local/bin/gnc-besu
USER besu
ENTRYPOINT ["/usr/local/bin/gnc-besu"]
