FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace
COPY gradlew build.gradle.kts settings.gradle.kts gradle.properties ./
COPY gradle/ gradle/
COPY config/ config/
COPY src/main/ src/main/
COPY sparql/ sparql/
RUN ./gradlew installDist --no-daemon

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/build/install/sparql-query-easy-kotlin/ /opt/sparql-query-easy/

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent --show-error http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/opt/sparql-query-easy/bin/sparql-query-easy-kotlin"]
