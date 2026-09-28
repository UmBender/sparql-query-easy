import { defineConfig } from '@playwright/test';

// Offline end-to-end suite: the real page against the built Ktor distribution
// and uploaded local Turtle fixtures. No live SPARQL endpoint is contacted.
const PORT = 18090;

export default defineConfig({
  testDir: 'frontend-tests/e2e',
  fullyParallel: false,
  use: {
    browserName: 'firefox',
    headless: true,
    serviceWorkers: 'block',
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist --no-daemon -q && ./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin -P:ktor.deployment.host=127.0.0.1 -P:ktor.deployment.port=${PORT}`,
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
