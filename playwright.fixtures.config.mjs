import { defineConfig } from '@playwright/test';

// QUAL-008: captures what the legacy page sends to and receives from the real
// Ktor backend on PokemonGen1 into fixtures/legacy/. Run it through
// `npm run fixtures:legacy`, which removes stale fixtures first. Offline: no
// external endpoint is contacted.
const PORT = 18091;

export default defineConfig({
  testDir: 'frontend-tests/fixtures-capture',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    browserName: 'firefox',
    headless: true,
    serviceWorkers: 'block',
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1400, height: 900 },
  },
  webServer: {
    command: `GRADLE_USER_HOME=/tmp/sparql-query-easy-gradle ./gradlew installDist --no-daemon -q && ./build/install/sparql-query-easy-kotlin/bin/sparql-query-easy-kotlin -P:ktor.deployment.host=127.0.0.1 -P:ktor.deployment.port=${PORT}`,
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
