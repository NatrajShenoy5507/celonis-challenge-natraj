---
name: playwright-test-generation
description: Generate, update, execute, or debug individual Playwright TypeScript UI/API tests in this Celonis quality-engineering repository using Playwright MCP inspection and the existing layered framework. Use when asked to build a Playwright test, inspect a demo flow, correct flaky selectors, or review smoke/regression results.
argument-hint: "<create|debug|run|review> <scenario, test path, or smoke/regression>"
user-invocable: true
disable-model-invocation: true
---

# Playwright test generation and verification — GitHub Copilot Agent Skill

## Purpose

This is a **repeatable, on-demand Agent Skill** for building and verifying **one meaningful test/scenario at a time** using the repository's existing TypeScript Playwright framework. **This is not a framework-rebuild instruction** or a blanket request to generate a suite.

Before changing code, **read the entire [framework rules reference](./references/FRAMEWORK_RULES.md)** and relevant existing source files. The reference is derived from the project's previous `playwright.instructions.md` and is authoritative for architecture, types, locator ownership, fixtures, test data, session management, reporting, retries, tagging and AI work-log requirements. If current working code differs from old examples, preserve working behavior and report the discrepancy rather than rewriting unrelated code.

## How to invoke in VS Code Copilot Chat (Agent mode)

- `/playwright-test-generation create verify cart item removal @regression`
- `/playwright-test-generation create verify a valid customer can filter laptops @smoke`
- `/playwright-test-generation debug playwright/tests/ui/cart.spec.ts`
- `/playwright-test-generation run smoke`
- `/playwright-test-generation run regression`
- `/playwright-test-generation review playwright/tests/api/products.spec.ts`

If an instruction does not specify an operation, infer **create** for a new scenario, **debug** for a failing test, **run** for executing tests, or **review** for a code review. Ask a short question only when a missing scenario/target makes proceeding impossible.

Do not generate new tests or run browsers simply because a file containing Playwright is mentioned; wait until the user invokes the skill and specifies an action.

## 1. Inspect the existing repo before acting

1. Read `PLAYWRIGHT_FRAMEWORK_SKELETON.md` if present, `playwright/package.json`, `playwright/playwright.config.ts` or the actual config, existing `playwright/fixtures/`, `pages/`, `api/`, `auth/`, `data/`, and nearby tests relevant to the request. Verify actual paths; **do not assume every example file exists**.
2. Locate the source of test imports (the custom fixture), existing test data providers, page objects, `storageState` flow and tagged npm scripts. Reuse them.
3. Check whether the request applies to UI, API, or authentication-specific tests. UI business tests use the authenticated fixture; login/logout tests deliberately use an unauthenticated context.
4. Do not modify `reconciliation/`, `ai/`, `performance/`, or the Part A strategy unless specifically requested. Avoid architecture rewrites and unrelated dependency changes.
5. Never print, copy into prompts, commit, or expose `.env`, credentials, cookies, auth states or tokens. Load valid secrets only through the framework's typed environment config.

## 2. Generate a UI test — inspection is mandatory

**Never invent selectors, UI labels, elements, routes or behaviors.**

1. Have a concrete business scenario, user expectations, and authorized demo site URL or established repository config. Ask for a missing URL if no known app/config exists.
2. Use the configured **Playwright MCP** to open the live application, inspect the relevant screens and **perform the scenario**. Discover actual controls, accessibility names and attributes. Do not use example selector strings as if they were observed facts.
3. If Playwright MCP is unavailable, report that blocker. Do not claim MCP inspection occurred. You may inspect with another explicitly available browser tool only when permitted, documenting that it is not MCP; otherwise pause UI test generation until the application can be inspected.
4. Choose stable locators, preferring `getByRole` → `getByLabel` → `getByTestId` → `getByPlaceholder` → uniquely stable `getByText` → stable CSS; XPath only as a documented last resort. Favor test IDs when accessibility labels are not stable. Avoid brittle positional selectors and long chains.
5. Put all selector construction **in the owning Page Object**, preferably private readonly `Locator` fields initialized in its constructor. Dynamic targets may use a well-encapsulated Page Object method and documented parameterization. Never define application locators in spec files, data JSON, fixtures, or unrelated utility modules.
6. Define typed domain inputs and obtain reusable non-secret valid data from the existing JSON provider/factory. Do not create new factories if existing types/providers work.
7. Implement or extend **only** the Page Objects, fixture connections, JSON/type definitions and single test needed for this scenario. Tests express business intent with Arrange → Act → Assert and use fixture-provided business methods, not raw `page.getByRole()` or `page.locator()` calls.
8. Keep assertions meaningful and observable. The test owns expected **business outcomes**; expose Page Object verification/data-read methods rather than leaking raw `Locator` objects into test specs. Follow existing project assertion conventions.
9. Apply `@smoke` and/or `@regression` when meaningful. Avoid excessive waits, brittle sleeps or test-order dependencies. If a test changes shared demo data, clean up safely when possible.

## 3. Generate or update an API test

1. Inspect the actual documented or observed API contract and existing API client code. Do not invent endpoints or response fields. The shop's published API documentation or an explicit local mock may be used if authorized/available.
2. Reuse typed API models, project/API fixtures and the existing API client; keep raw request setup out of tests when an abstraction exists.
3. Assert status, schema/body contract, relevant data behavior and a meaningful negative case if requested. API acceptance is not automatically proof of asynchronous downstream delivery; test it separately where observable.
4. Do not perform load/stress traffic in this skill; that belongs to the k6 performance skill.

## 4. Authentication, data and security invariants

- No valid credentials or secrets in tests, JSON files, Page Objects, auth setup, fixtures, logs, reports or generated examples. `.env`/CI secret values enter only through centrally validated, typed `EnvironmentConfig`.
- Normal UI scenarios run already authenticated through the project's fixture; **never repeat login in every test**.
- Preserve the existing `SessionManager`: local cached `storageState` may be reused only if the file and metadata exist, age is less than configured `AUTH_STATE_TTL_HOURS` (default/example 12) **and** an authenticated application check passes. Otherwise regenerate and save fresh auth state; create missing auth directories first. Do not print or commit state.
- In CI, create fresh auth once per independent pipeline run; reuse only within that run; never publish state/cookies as CI artifacts.
- Login-specific cases use a separate unauthenticated context. Invalid credentials can be intentionally fake test data; valid credentials still come from config.
- Do not use the application's UI demo-credential autofill as the real framework credential source.

## 5. Run the requested test and evaluate evidence

1. Follow the actual npm scripts/config, running from the correct package directory (this repository has a **separate `playwright/` package**). Do not incorrectly run `npx playwright` from the repo root when the project is isolated.
2. For a new/changed spec, run the focused test first; run `npm run typecheck` if available. After the focused test passes, run the related tagged subset if appropriate. On `run smoke`, `run regression`, or `run all`, use the existing tag scripts, not guessed CLI aliases; underlying Playwright filters are `--grep @smoke` and `--grep @regression`.
3. Read **real** exit status, executed counts and failure messages. Review Playwright HTML results, screenshot, trace and video evidence if generated. Allure should be emitted for CI according to actual config; do not assert report generation succeeded without verifying it.
4. Preserve existing policy: Playwright HTML locally; Allure results in CI; screenshots on failure; trace on first retry; CI-only retries. Do not force local video if the Windows/FFmpeg policy of this environment blocks it; preserve the existing working workaround and document it.
5. On failure, diagnose test bug versus real app behavior. Reinspect with MCP where needed; prefer web-first assertions/auto-waiting. **Do not** weaken assertions, add arbitrary sleeps, or increase retries to fabricate a pass.
6. If execution is blocked (MCP missing, login unavailable, app down, dependency issue), stop, explain the blocker, and never fabricate a passed test. Separate code review from runtime verification.

## 6. Review/debug workflow

1. Read the failing spec, fixture, relevant Page Object/API client, failure output and trace/screenshot as available.
2. Check selector ownership, actual MCP-observed behavior, auth state validity, typed data, test isolation and correct assertions.
3. Make the smallest targeted fix. If a real app regression is indicated, document the actual-versus-expected behavior and preserve failure evidence instead of force-passing the test.
4. Rerun the targeted test and related suite. Report exactly which commands ran and their results.

## 7. AI-first audit trail and completion report

Where material code generation, selector exploration or debugging occurred, append an accurate entry to `AI_WORKLOG.md` recording Copilot/Playwright MCP usage, prompt/scenario, generated/observed facts, human-reviewed evidence, actual mistakes and fixes. Never invent AI mistakes or claim tests ran if they did not.

At the end, summarize:

- Scenario and purpose; UI/API/auth type; applied tags.
- Actual changed files and locator ownership.
- Where test data and credentials are sourced (without showing secrets).
- MCP pages/controls inspected (or explicit inability to inspect).
- Commands executed and **actual** test/typecheck results.
- Screenshots/traces or limitations, and whether `AI_WORKLOG.md` was updated.
- Remaining issues, with a concrete next action.

A generated test is complete only when its scenario, selectors, assertions and types are grounded; the test and typecheck were verified or a genuine failure is honestly documented; and the test has zero application locators or secrets in its specification.

## Additional mandatory framework rules

For naming conventions, BasePage boundaries, provider/factory API, Page Object behavior, hook usage, reporting, tagging, and the full original rule set, **read and follow [FRAMEWORK_RULES.md](./references/FRAMEWORK_RULES.md)** before implementation.
