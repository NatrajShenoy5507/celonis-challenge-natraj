# Playwright Framework

This folder is an isolated TypeScript Playwright project for Part B. The inspected demo application is `https://shop.qaautomationlabs.com/index.php`. Its dependencies and lockfile are managed here and do not change the reconciliation/AI project's root npm dependencies.

## Setup

From the repository root:

```bash
npm install --prefix playwright
npx --prefix playwright playwright install chromium
```

Copy `.env.example` to `.env` and provide the valid test account credentials. The typed config supports `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`; existing local `EMAIL` / `PASSWORD` keys are accepted for compatibility. Set `AUTH_STATE_TTL_HOURS` to adjust the local session-cache lifetime. Do not store credentials or tokens in source control.

## Commands

Run commands from the repository root:

```bash
npm test --prefix playwright
npm run test:ui --prefix playwright
npm run test:api --prefix playwright
npm run test:smoke --prefix playwright
npm run test:regression --prefix playwright
npm run test:list --prefix playwright
npm run typecheck --prefix playwright
npm run report:html --prefix playwright
npm run report:allure --prefix playwright
```

Set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `playwright/.env` before running browser tests. Existing local files using `EMAIL` and `PASSWORD` are also supported. Values are read through typed centralized configuration; missing credentials fail fast. No credential values are stored in code or test-data JSON.

The setup project uses `SessionManager` to reuse a local authenticated storage state only when its metadata is younger than the configured `AUTH_STATE_TTL_HOURS` (12 hours by default) and a protected shop page confirms the session remains valid. Stale, missing, invalid, and CI sessions are freshly authenticated. Credentials and generated storage-state files are never logged or committed.

Normal UI tests use the authenticated custom fixture and contain no application locator definitions. Page Objects own centralized locators and expose business actions/assertions. The shop links to a separate API playground that publishes an OpenAPI document; the API test uses its documented, read-only `GET /products` operation and checks the response contract.

Local runs use Playwright's HTML reporter. CI runs also emit Allure results and use up to two retries; generate an Allure report from those results with `npm run report:allure --prefix playwright` (requires Java and a valid `JAVA_HOME`). Screenshots are retained on failure, traces on the first retry, and video on failure in CI. Local video is disabled because the Windows application-control policy blocks Playwright's bundled FFmpeg executable. Tests run serially because the demo account's cart is stateful. Generated reports, test results, local environment files, and authentication state are ignored by Git.
