
# Playwright TypeScript Framework Rules — Reference

These rules are part of the `playwright-test-generation` GitHub Copilot Agent Skill. Read them whenever the skill is invoked to generate, review, debug or run Playwright tests for Part B of the Celonis challenge.

## Primary Goal

Build a small, modular, interview-defensible Playwright TypeScript framework and a few working tests against the selected public demo application.

Do not optimize for line count. Optimize for correctness, readability, modularity, and clear reasoning.

## Mandatory Technical Choices

- Use TypeScript.
- Use `@playwright/test` as the test runner.
- Use Page Object Model for UI behavior.
- Use custom Playwright fixtures for dependency creation.
- Use typed interfaces and domain models.
- Use JSON for valid test data.
- Tests must consume test data through a `TestDataProvider` abstraction and factory rather than reading JSON directly.
- Use Playwright `storageState` for reusable authenticated state when the selected demo application requires login.
- Normal business UI tests must start authenticated through the custom fixture; locally reuse a valid cached auth state for up to the configured TTL (default 12 hours), then regenerate it.
- Use Playwright HTML reporter for local runs.
- Emit Allure results for CI/report publishing.
- Use screenshot on failure, trace on first retry, and retain video on failure.
- Use CI-only retries unless there is a documented reason to change this.
- Use `@smoke` and `@regression` tags.
- Test specs must contain zero hard-coded locators; all application locators are owned by Page Objects.
- Valid login credentials must come only from `.env` through typed centralized configuration.

## Before Creating Any UI Automation

Do not guess selectors or page structure.

Follow this sequence:

1. Receive the demo application URL and the business scenario from the user.
2. Use Playwright MCP to open and inspect the application.
3. Navigate the exact scenario manually with Playwright MCP.
4. Record the pages/screens involved.
5. Identify stable selectors.
6. Prefer selectors in this order when practical:
   - `getByRole`
   - `getByLabel`
   - `getByTestId`
   - `getByPlaceholder`
   - `getByText` when uniquely stable
   - CSS only when a stable accessible locator is unavailable
7. Do not use brittle generated XPath or long CSS chains unless there is no reasonable alternative.
8. Confirm the expected user-visible behavior before generating the test.
9. Never place the discovered locator directly in a test spec; add it to the owning Page Object.
10. Never duplicate locator expressions across tests or Page Objects.

## Framework Structure

Follow the repository architecture documented in `PLAYWRIGHT_FRAMEWORK_SKELETON.md`.

Keep responsibilities separated:

```text
Tests
  ↓
Fixtures
  ↓
Page Objects / API Clients
  ↓
Interfaces / Types
  ↓
Test Data Provider / Factory
  ↓
JSON
```

Do not put selectors, JSON parsing, environment handling, and business assertions into one test file.

## Zero Hard-Coded Locator Rule

Test files must contain **zero application locator definitions**.

Never generate code like this inside a test:

```ts
await page.locator('#checkout').click();
await page.getByRole('button', { name: 'Login' }).click();
await page.getByText('Add to cart').click();
```

Tests must call business-level Page Object methods instead:

```ts
await loginPage.login(credentials);
await productsPage.addProductToCart(product.name);
await cartPage.proceedToCheckout();
```

All locators must be declared once in the owning Page Object, preferably as `private readonly Locator` fields initialized in the constructor. Do not repeat raw locator expressions inside Page Object methods.

Playwright MCP is the source used to inspect the application and determine stable locators. Do not invent a locator from assumptions about the DOM.

Prefer, in order where practical:

- `getByRole`
- `getByLabel`
- `getByTestId`
- `getByPlaceholder`
- stable `getByText`
- CSS only when necessary

Avoid XPath and long generated CSS chains unless unavoidable. If an exception is necessary, keep it inside the owning Page Object and document why.

Do not store UI locators in test-data JSON. JSON is for business/test data, not selectors.

For this project, “zero hard-coded locators” means zero locator literals in the test specifications. Page Objects remain the centralized locator layer because locator definitions must exist somewhere in the UI automation architecture.

## Page Object Rules

- One Page Object should represent one coherent page/domain responsibility.
- Declare application locators once as private/readonly `Locator` fields; do not inline locator expressions inside action methods.
- Expose business-level actions rather than raw selector details.
- Do not put large assertion suites inside Page Objects unless the assertion represents a stable page-level contract.
- Prefer assertions in the test when they describe the scenario outcome.
- Do not create browser-specific Page Objects for Chromium/Firefox/WebKit unless behavior genuinely differs.
- Do not create a giant Page Object Manager unless it materially simplifies the small challenge suite.

## Base Page Rules

If a `BasePage` is used, keep it small.

Allowed examples:

- common navigation
- small project-specific synchronization helpers
- genuinely shared page-level behavior

Do not wrap every Playwright action (`click`, `fill`, `hover`, etc.) simply to add abstraction.

## TypeScript Rules

- Avoid `any` unless unavoidable and documented.
- Create interfaces/types for test data, configuration, and API payloads/responses.
- Keep types close to their domain.
- Prefer clear, explicit types over unnecessary generics.
- Ensure generated code passes TypeScript checks.

## Test Data Rules

- Valid reusable data belongs in JSON files under the framework data folder.
- Prefer separate domain files such as `users.json`, `products.json`, and `checkout.json` when appropriate.
- Tests must not use `require()` or `fs.readFileSync()` directly to obtain test data.
- Data must be loaded through the JSON provider implementing the `TestDataProvider<T>` contract.
- The provider must be selected through a small factory.
- Only JSON needs to be implemented for this challenge, but the contract should make another provider possible later.
- Never store secrets in committed JSON files.

## Authentication and Session Rules

If the application requires authentication, all normal business UI tests must start already authenticated through the project fixture. Do not repeat UI login inside each business test.

Implement:

```text
playwright/auth/auth.setup.ts
playwright/auth/session-manager.ts
playwright/auth/.auth/user.json
playwright/auth/.auth/session-meta.json
```

Responsibilities:

- `environment.ts` loads typed credentials and session settings.
- `LoginPage` performs UI login but does not know where credentials originated.
- `SessionManager` decides whether the cached local storage state is reusable or must be regenerated.
- the custom fixture ensures normal business tests receive an authenticated browser context and Page Objects.
- tests do not read credentials, auth files, or TTL metadata directly.

### Local 12-hour session cache

Use `AUTH_STATE_TTL_HOURS` from centralized environment configuration. The default/example value is 12 hours. Do not scatter a literal `12` through the framework.

Before reusing a local auth state, SessionManager must check all of the following:

1. `user.json` exists.
2. session metadata exists.
3. cached state age is less than `AUTH_STATE_TTL_HOURS`.
4. the application still confirms that the session is authenticated.

If any check fails, create a fresh session through the supported login flow, overwrite `user.json`, and refresh `session-meta.json`.

Conceptual flow:

```text
Test run
  ↓
SessionManager
  ↓
state exists + age < TTL + session still valid?
  ├── yes → reuse storageState
  └── no  → fresh LoginPage authentication → save new state + metadata
  ↓
Authenticated fixture
  ↓
Normal business tests
```

Do not use file age alone as proof that a session is valid. The server may revoke or expire a session before the local 12-hour TTL.

### CI session behavior

For CI, create a fresh authenticated state for each independent pipeline run and reuse it only within that run. Do not persist `user.json` or session cookies/tokens as a cross-pipeline artifact.

### Authentication-specific tests

A test whose purpose is to validate login/logout/invalid authentication must use an unauthenticated context and execute the login flow intentionally. Valid credentials still come from the typed environment configuration. Invalid test credentials may come from normal test data because they are not secrets.

### Security rules

- Obtain valid credentials only from typed environment configuration.
- `auth.setup.ts` and fixtures must not contain credential literals.
- `LoginPage` accepts typed credentials and contains only page behavior.
- Never commit `.auth/`, session metadata, cookies, tokens, or `.env`.
- Never print credentials or storage state to logs/reports.

If the selected demo application does not require login, do not fabricate authentication. Keep the structure documented but unused.

## Fixture Rules

Custom fixtures should provide dependencies such as:

- Page Objects
- API clients
- typed test data

Tests should not repeatedly instantiate all dependencies manually.

Keep fixtures small and explicit so their lifecycle is easy to explain during review.

## Test Structure, Names and Hook Conventions

- UI tests use Arrange → Act → Assert, with a readable business scenario name. Explanatory comments are optional when code is self-explanatory.
- The test owns expected business behavior; Page Objects own how to interact with the UI or retrieve/verify observable state. Do not expose or define application locators directly in specs just to put `expect(locator)` in the test. Prefer a Page Object business-level query and assert against the returned value, or a narrowly scoped Page Object verification method that uses Playwright web-first assertions.
- Use clear names such as `login.page.ts`, `cart.page.ts`, `cart.spec.ts`, `app.fixture.ts`, `checkout.types.ts`, `orders.api-client.ts`; preserve existing repo naming where it is already established.
- Page Object locator names should describe business meaning (`checkoutButton`, `cartBadge`), not anonymous variables (`locator1`, `btn`).
- Do not hide substantial business flows in `beforeEach` or `beforeAll`. Prefer fixtures for dependency/setup; use hooks only where setup genuinely applies to every test in that scope.
- Reuse working framework architecture, configuration and package scripts; never recreate the whole project when adding one scenario.

## UI Test Rules

Target only a few meaningful UI tests for the challenge.

Recommended total: approximately 3.

Each test should:

1. Have a clear business purpose.
2. Use stable locators gathered from Playwright MCP.
3. Use typed test data where data is required.
4. Use Page Objects and fixtures.
5. Contain meaningful assertions.
6. Be tagged with `@smoke`, `@regression`, or both where appropriate.
7. Be independently runnable.
8. Avoid dependence on another test having run first.
9. Contain zero direct application locators; tests must interact through fixtures and Page Objects.

Do not generate a large UI suite.

## API Test Rules

Target at least one meaningful API test.

Prefer the selected demo application's API if it exposes a stable documented/observable API.

Otherwise, use a small public API or explicit mock.

API tests should use a dedicated API client/service abstraction rather than placing all request construction directly in the test.

Do not invent undocumented endpoints for the demo application.

## Reporting and Evidence

Use Playwright HTML locally and Allure results for CI.

Configure failure evidence similar to:

```ts
use: {
  screenshot: 'only-on-failure',
  trace: 'on-first-retry',
  video: 'retain-on-failure'
}
```

Prefer:

```ts
retries: process.env.CI ? 2 : 0
```

Do not hide failing tests by adding excessive retries.

Retries are diagnostic containment, not a fix for flaky tests.

## Tags and Execution

Use tags such as:

```text
@smoke
@regression
```

Expected commands:

```bash
npx playwright test
npx playwright test --grep @smoke
npx playwright test --grep @regression
npx playwright test playwright/tests/ui
npx playwright test playwright/tests/api
npx playwright show-report
```

If npm scripts exist, prefer them in documentation, but keep the underlying Playwright commands understandable.

## Test Generation Workflow With Playwright MCP

For every new UI test:

1. State the scenario in plain language.
2. Inspect the live application using Playwright MCP.
3. Complete the flow using Playwright MCP.
4. Gather stable locator evidence.
5. Identify which Page Object(s) should own the actions and locators.
6. Identify required test data and its TypeScript type.
7. Add discovered locators only to the owning Page Object, then generate or update only the necessary framework files.
8. Explain the generated implementation.
9. Run the specific test first.
10. If it fails, inspect the actual error, screenshot, and/or trace.
11. Fix the real cause rather than weakening assertions.
12. Run the test again.
13. Run the related smoke/regression subset after the individual test passes.

Do not generate the entire framework or all tests from one prompt.

## Debugging Rules

When a test fails:

- Read the Playwright error first.
- Inspect screenshot/trace when available.
- Re-check the live application with Playwright MCP if the DOM or flow is unclear.
- Distinguish application defect from automation defect.
- Do not automatically add waits or retries.
- Prefer Playwright auto-waiting and web-first assertions.
- If an explicit wait is necessary, explain why.
- Never use arbitrary fixed sleeps unless there is no better deterministic synchronization mechanism and the reason is documented.

## Assertions

Assertions must verify meaningful outcomes.

Prefer web-first assertions such as:

```ts
await expect(locator).toBeVisible();
await expect(locator).toHaveText(...);
await expect(page).toHaveURL(...);
```

Do not use weak assertions merely to make a test pass.

## Environment and Secrets

Valid credentials must never be hard-coded anywhere in the automation codebase.

Required flow:

```text
.env
  ↓
environment.ts
  ↓
typed EnvironmentConfig
  ↓
SessionManager + auth.setup.ts
  ↓
LoginPage when fresh auth is required
  ↓
storageState + session metadata
  ↓
authenticated fixture
  ↓
normal business tests
```

Rules:

- Load `.env` centrally, preferably once through `dotenv` if no existing loader is present.
- Expose typed values such as `environment.baseUrl`, `environment.testUserEmail`, `environment.testUserPassword`, and `environment.authStateTtlHours`.
- Fail fast if a required value is missing.
- Do not use fake/default credentials as a fallback.
- Do not scatter `process.env` calls through tests or Page Objects.
- Valid username/email, password, API tokens, and API keys must never be stored in JSON test data.
- Valid credentials must never be read from the UI itself.
- Negative intentionally invalid credentials may be test data because they are not secrets.
- Base URLs and non-secret environment values should come from centralized configuration.
- Support `AUTH_STATE_TTL_HOURS=12` in `.env.example` and parse it as a typed numeric configuration value.
- Secrets must come from environment variables locally and CI secret storage in CI.
- Never commit credentials, tokens, `.env`, or generated auth state.
- Ensure `.env` and `playwright/auth/.auth/` are ignored by Git.
- Do not print passwords, tokens, or session values to logs or reports.

## AI Usage and Work Log

AI-generated automation must be reviewed and understood before acceptance.

For significant Copilot or Playwright MCP usage, update `AI_WORKLOG.md` with:

- tool used
- scenario/purpose
- representative prompt or instruction
- what was generated/discovered
- what was manually verified
- any wrong/misleading output
- how it was corrected

Do not invent AI mistakes. Record only real observations.

## Completion Criteria for a Test

A generated test is not complete until:

- the scenario is understood,
- locators were grounded in the real application,
- code follows the framework structure,
- TypeScript is valid,
- the individual test passes or a genuine application defect is documented,
- assertions are meaningful,
- failure evidence is configured,
- relevant tag(s) are present,
- the test contains zero hard-coded locators,
- valid credentials are sourced through centralized environment configuration,
- normal business UI tests run through the authenticated fixture,
- cached local auth state is reused only when it is younger than the configured TTL and still valid,
- stale/invalid auth state is regenerated automatically,
- and the author can explain the implementation in a live review.

## What Not to Do

Do not:

- guess selectors,
- put `page.locator`, `getByRole`, `getByLabel`, `getByText`, `getByTestId`, CSS, or XPath locator definitions directly in test specs,
- duplicate raw locator expressions inside Page Object methods,
- hardcode environment URLs throughout tests,
- hardcode valid usernames, emails, passwords, tokens, or API keys anywhere in tests/Page Objects/fixtures/JSON,
- read JSON directly from tests,
- use `any` everywhere,
- create giant Page Objects,
- wrap every Playwright method,
- create unnecessary factories/classes,
- add fixed sleeps to hide synchronization issues,
- add retries just to make flaky tests green,
- commit storageState, session metadata, cookies, tokens, or secrets,
- persist authentication state across independent CI pipeline runs,
- repeat UI login in every normal business test,
- generate dozens of tests for the take-home,
- or accept AI-generated code that has not been executed and reviewed.

## Live-Review Principle

The implementation should support this explanation:

> The framework uses TypeScript, Page Objects, custom fixtures, centralized typed environment configuration, typed JSON test data through a provider/factory abstraction, and reusable authentication through storageState with a validated 12-hour local session cache. Test specs contain zero locator definitions; Playwright MCP is used to inspect the real application and all locators are centralized in the owning Page Objects. Valid credentials come only from `.env`/CI secrets through the configuration layer. Playwright HTML is used locally, Allure results are produced for CI, and failures retain screenshots, traces, and video. Every AI-generated test is executed and reviewed before acceptance.
