# Part B — Playwright TypeScript Framework Skeleton

## Purpose

This document defines the intended framework skeleton for Part B of the Celonis AI Engineer – Quality take-home challenge.

The goal is to demonstrate a small, genuinely modular Playwright framework that is easy to understand, extend, and defend in a live review. The framework should remain intentionally lightweight because the challenge is time-boxed.

## Core Design Decisions

- Language: TypeScript
- Test runner: `@playwright/test`
- Architecture: Layered framework
- UI pattern: Page Object Model
- Dependency creation: Custom Playwright fixtures
- Authentication: Playwright `storageState` with a reusable 12-hour local session cache
- Test data: Typed JSON data
- Test data abstraction: Provider interface + JSON provider + factory
- Configuration: Environment-driven
- Local reporting: Playwright HTML report
- CI reporting: Allure results/report
- Failure evidence: Screenshot on failure, trace on first retry, video retained on failure
- Retries: CI only
- Test grouping: `@smoke` and `@regression`
- AI-assisted implementation: GitHub Copilot + Playwright MCP
- Locator policy: zero locator literals in test specs; locators are owned and centralized by Page Objects
- Credential policy: valid login credentials come only from `.env` through typed centralized configuration
- Session policy: normal business UI tests run authenticated; fixtures reuse a valid local storage state for up to 12 hours and regenerate it when stale or invalid

## Architecture

```text
Tests
  ↓
Custom Fixtures
  ↓
Page Objects / API Clients
  ↓
Interfaces + Types
  ↓
Test Data Provider
  ↓
Factory
  ↓
JSON Test Data
```

Authentication is managed through a reusable session lifecycle:

```text
.env credentials
        ↓
Typed environment configuration
        ↓
SessionManager
        ↓
Check storageState age (< configured TTL, default 12h)
        +
Validate that the session is still authenticated
        ↓
VALID → reuse storageState
STALE / INVALID / MISSING → LoginPage authenticates and saves fresh state
        ↓
Custom authenticated fixture
        ↓
Normal business UI tests start already logged in
```

## Recommended Folder Structure

```text
playwright/
├── auth/
│   ├── auth.setup.ts
│   ├── session-manager.ts
│   └── .auth/
│       ├── user.json                 # generated locally, never committed
│       └── session-meta.json         # generated locally, never committed
│
├── config/
│   └── environment.ts
│
├── core/
│   ├── interfaces/
│   │   ├── test-data-provider.interface.ts
│   │   └── api-client.interface.ts
│   │
│   └── types/
│       ├── environment.types.ts
│       ├── test-data.types.ts
│       └── api.types.ts
│
├── data/
│   ├── valid/
│   │   ├── users.json
│   │   ├── products.json
│   │   └── checkout.json
│   │
│   ├── providers/
│   │   └── json-data.provider.ts
│   │
│   └── factory/
│       └── test-data-provider.factory.ts
│
├── pages/
│   ├── base.page.ts
│   └── <demo-site-page-objects>.ts
│
├── api/
│   └── <api-client>.ts
│
├── fixtures/
│   └── app.fixture.ts
│
├── tests/
│   ├── ui/
│   │   └── <ui-tests>.spec.ts
│   └── api/
│       └── <api-tests>.spec.ts
│
├── utils/
│   └── <small-focused-helpers>.ts
│
└── README.md

playwright.config.ts
```

## Interfaces and Types

### Test Data Provider Interface

Tests should not read JSON files directly. They should request typed domain data through a provider contract.

Example shape:

```ts
export interface TestDataProvider<T> {
  getData(): T;
}
```

Current implementation:

```text
TestDataProvider
      ↑
JsonDataProvider
```

The factory currently selects JSON, but the design can later support another source without rewriting tests:

```text
TestDataProviderFactory
        ├── JSON
        ├── CSV
        ├── API
        └── Database
```

Only JSON needs to be implemented for this challenge.

### Typed Domain Data

Avoid `any` for test data.

Example types can be introduced after the demo site is inspected:

```ts
export interface UserCredentials {
  username: string;
  password: string;
}

export interface ProductData {
  name: string;
  quantity: number;
}

export interface CheckoutData {
  firstName: string;
  lastName: string;
  postalCode: string;
}
```

Use separate JSON files by domain when practical, such as:

```text
users.json
products.json
checkout.json
```

## Page Object Model

Use a small `BasePage` only for genuinely shared project-specific behavior.

Good responsibilities:

- navigation helpers
- small common synchronization behavior if required
- shared page-level utilities that add project value

Avoid wrapping every native Playwright action such as `click`, `fill`, `hover`, or `selectOption` just for abstraction.

Domain-specific pages should model the demo application, for example:

```text
LoginPage
ProductsPage
CartPage
CheckoutPage
```

Exact page objects must be decided only after the application is inspected with Playwright MCP.

## Locator Policy — Zero Hard-Coded Locators in Tests

Test specifications must contain **zero hard-coded locators**. A test should express business intent and must not directly construct selectors or call page-level locator APIs for application elements.

Not allowed in test files:

```ts
await page.locator('#login-button').click();
await page.getByRole('button', { name: 'Login' }).click();
await page.getByText('Checkout').click();
```

Instead, tests call Page Object methods:

```ts
await loginPage.login(credentials);
await productsPage.addProductToCart(product.name);
await cartPage.proceedToCheckout();
```

Page Objects own all application locators. Define locators once as `private readonly` or `readonly Locator` properties rather than repeating locator expressions inside methods.

Example shape:

```ts
export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Login' });
  }
}
```

Locator rules:

- Playwright MCP must inspect the real application before locators are created.
- Prefer `getByRole`, `getByLabel`, `getByTestId`, and other stable user-facing locators.
- Avoid brittle XPath and long CSS chains.
- Do not duplicate the same locator across tests or multiple Page Objects.
- Do not place raw locator strings inside test data JSON.
- If a CSS/XPath locator is unavoidable, keep it in the owning Page Object and document why.
- Tests must never know the selector implementation.

The phrase **zero hard-coded locators** in this framework means zero locator definitions inside test specifications. Locator definitions are centralized in Page Objects because they must exist somewhere and Page Objects are the framework layer responsible for UI structure.

## Fixtures

Use custom fixtures to create reusable dependencies.

Conceptually:

```text
test
 ↓
authenticated fixture
 ├── sessionManager
 ├── loginPage
 ├── productsPage
 ├── cartPage
 ├── checkoutPage
 ├── apiClient
 └── testData
```

Tests should focus on business intent rather than repeated object construction.

For applications that require authentication, the fixture should also ensure a valid authenticated session exists before providing Page Objects to the test. It must delegate cache age/validity decisions to `SessionManager` rather than placing session logic directly in every test.

## Authentication, Session Management, and Storage State

Authentication must be separated from normal business tests. All normal UI business tests should begin in an authenticated session and should not repeat the login flow.

The framework uses a small `SessionManager` together with custom fixtures. The fixture owns how tests consume authentication; the SessionManager owns the lifecycle of the cached local authentication state.

Generated files:

```text
playwright/auth/.auth/user.json
playwright/auth/.auth/session-meta.json
```

`user.json` contains Playwright storage state and may contain cookies/tokens. `session-meta.json` contains non-secret metadata such as the UTC time when the cached auth state was created. Both files are generated and must never be committed.

Add this to `.gitignore`:

```gitignore
playwright/auth/.auth/
```

### Local session lifecycle

Use a configurable TTL with a default of 12 hours. Do not hard-code `12` throughout the TypeScript implementation. Expose it through centralized environment configuration.

```text
Test run starts
      ↓
SessionManager checks cached auth state
      ↓
Does user.json exist?
      ↓
Is its metadata younger than AUTH_STATE_TTL_HOURS?
      ↓
Can the application still confirm that the session is authenticated?
      ↓
YES → reuse the existing storageState
NO  → perform fresh login → replace storageState + metadata
      ↓
Authenticated fixture creates/uses authenticated context
      ↓
Normal UI tests execute already logged in
```

Age alone is not sufficient. A state file can be younger than 12 hours while the server-side session has already expired or been revoked, so the framework must also validate that the session is still authenticated before reuse.

### Fixture responsibility

Normal UI tests import the project's custom fixture rather than creating authentication themselves. The fixture should ensure a usable authenticated state is available before exposing Page Objects to the test.

Tests should therefore contain:

```text
No login steps
No email/password values
No storageState file handling
No auth TTL calculations
No application locators
```

Authentication-specific tests are the exception. A test that explicitly validates login/logout/invalid credentials must use an unauthenticated context and perform the login flow intentionally through `LoginPage`. Valid credentials still come from centralized environment configuration.

### CI behavior

Do not persist authentication state across independent CI pipeline runs. In CI, generate a fresh authenticated state at the beginning of the pipeline/test run, then reuse that state only within the current run. This avoids treating session cookies/tokens as long-lived CI artifacts.

Recommended behavior:

```text
LOCAL
valid cached state + age < configured TTL → reuse
otherwise → fresh login

CI
always create fresh auth state for the pipeline run
then reuse within that run
```

If the chosen demo application does not require authentication, keep this structure documented but do not fabricate authentication behavior.

## Environment Configuration and Credentials

Keep configuration centralized, typed, and environment-driven.

The framework can support lightweight environment selection such as:

```text
demo
qa
staging
```

Valid authentication credentials must never be hard-coded in tests, Page Objects, fixtures, JSON test data, auth setup, or Playwright config. They must come from `.env` through the centralized framework configuration layer.

Recommended flow:

```text
.env
  ↓
environment.ts
  ↓
EnvironmentConfig
  ↓
SessionManager + auth.setup.ts
  ↓
LoginPage only when fresh authentication is required
  ↓
storageState + session metadata
  ↓
authenticated fixture
  ↓
normal business UI tests
```

Example `.env.example` keys:

```text
BASE_URL=
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
AUTH_STATE_TTL_HOURS=12
```

`environment.ts` should load and validate required values once and expose a typed configuration object. Tests and Page Objects should not scatter direct `process.env` access.

Requirements:

- `.env` must be ignored by Git.
- `playwright/auth/.auth/` must be ignored by Git.
- Missing required environment variables must fail fast with a clear error.
- `AUTH_STATE_TTL_HOURS` must be parsed and exposed through typed configuration; default/local example value is 12 hours.
- Never print passwords, tokens, or session state to logs/reports.
- Do not silently fall back to fake/default credentials.
- Valid secrets must not be stored in JSON test data.
- Negative, intentionally invalid login values may live in test data because they are not real secrets.

Do not scatter environment-specific `if/else` statements across tests.

## Reporting and Failure Evidence

### Local Runs

Use Playwright's built-in HTML reporter.

### CI Runs

Also emit Allure results so CI can publish an Allure report/artifact.

Recommended evidence settings:

```ts
use: {
  screenshot: 'only-on-failure',
  trace: 'on-first-retry',
  video: 'retain-on-failure'
}
```

Recommended retry policy:

```ts
retries: process.env.CI ? 2 : 0
```

Rationale:

- Local failures remain visible during development.
- CI gets limited retry protection for transient failures.
- Retry evidence is available through trace/screenshots/video.

## Tags

Use Playwright tags through test titles or supported test metadata.

Examples:

```text
@smoke
@regression
```

Typical commands:

```bash
npx playwright test --grep @smoke
npx playwright test --grep @regression
```

Recommended npm aliases:

```json
{
  "test:ui": "playwright test playwright/tests/ui",
  "test:api": "playwright test playwright/tests/api",
  "test:smoke": "playwright test --grep @smoke",
  "test:regression": "playwright test --grep @regression",
  "report:html": "playwright show-report",
  "report:allure": "allure generate allure-results --clean -o allure-report"
}
```

Exact paths should be adjusted to match the final repository layout.

## AI-First Implementation Workflow

The framework should use AI as an implementation assistant, not as an unverified one-shot generator.

Recommended workflow:

```text
Human defines business scenario
        ↓
Playwright MCP inspects the live demo application
        ↓
Stable locators and behavior are gathered
        ↓
Copilot proposes Page Object / test implementation
        ↓
Human reviews selectors, assertions, types, and architecture
        ↓
Test is executed
        ↓
Failure evidence is reviewed
        ↓
Code is corrected and verified
```

Important rules:

- Do not invent selectors without inspecting the application.
- Prefer stable accessible locators such as `getByRole`, `getByLabel`, and `getByTestId` when available.
- Keep selectors and page actions in Page Objects.
- Keep assertions meaningful and close to the test intent.
- Use typed JSON data through the provider/factory layer.
- Do not generate an entire suite in one step.
- Generate one scenario at a time and verify it.
- Ask AI to explain generated code before accepting it.

## Initial Test Scope

Keep the implemented Part B slice intentionally small.

Target approximately:

- 3 meaningful UI tests
- 1 API test

Possible UI categories after the demo site is inspected:

- happy-path e-commerce flow
- negative/validation flow
- cart/order-related flow

Prefer using the same demo application's API if it exposes a stable API. Otherwise, use a small public API or mock.

## Trade-Offs

This is a take-home challenge with a strict timebox, so the framework intentionally does not attempt to implement every enterprise feature.

Priorities are:

1. Clear architecture
2. Typed and reusable code
3. Working tests
4. Good failure evidence
5. AI-assisted but human-verified implementation
6. Easy live-review explanation

Avoid unnecessary abstractions, large inheritance trees, agent frameworks, or framework features that are not required by the implemented scenarios.

## Live Review Summary

A concise explanation of the framework should be:

> I used a layered Playwright TypeScript framework with typed domain models, custom fixtures, Page Objects, centralized environment configuration, reusable authentication through storageState with a validated 12-hour local cache, and a provider/factory abstraction for JSON test data. Test specs contain zero locator definitions; all UI locators are owned by Page Objects and are grounded using Playwright MCP before implementation. Valid credentials come only from `.env` through typed configuration. Playwright HTML is used locally, Allure is produced for CI, and failures retain screenshots, traces, and video. Playwright MCP grounds AI-assisted generation in the actual application, while I review and execute every generated test before accepting it.
