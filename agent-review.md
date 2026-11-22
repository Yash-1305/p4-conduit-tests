# Tests from Playwright's agents, and my review (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-22

## 1. How I set up the agents
- **Command:** `npx playwright init-agents --loop=claude` (TESTS terminal, in `P4`)
- **What it made:** `.claude/agents/playwright-test-planner.md`, `.claude/agents/playwright-test-generator.md`, `.claude/agents/playwright-test-healer.md`, `.mcp.json`, `specs/README.md`, `tests/seed.spec.ts`
- **Browser hidden:** `"--headless"` added to `P4/.mcp.json`: yes
- **Where I started Claude for the agents:** in `P4`, because Claude finds the agents and their browser only there

## 2. What I asked the agents
- **Area:** the profile page and following an author
- **My prompt** (`P4/prompts/agents.md`):
```text
Task: First use the playwright-test-planner agent to plan tests for the profile page and following an author. Save the plan as specs/profile-follow.md. Then use the playwright-test-generator agent to write one test for each scenario in the plan, in the folder tests/profile-follow/.
Material: Start on the page /profile/practice-author. For steps that need a signed-in user, use a practice user from README.md.
Rules: Plan at most 2 short scenarios, with at most 5 steps each. Do not change any other test file. Do not run the test suite. Each test's final check must be false before the step and true after it, read again after a reload or with the API (for example the author's profile shows following: true and the button says Unfollow), using getByRole locators, no waitForTimeout, and an afterEach that unfollows so the practice user stays clean.
```
- **The plan the planner saved:** `specs/profile-follow.md` (2 scenarios, 5 steps each)
- **The test files the generator wrote:** `tests/profile-follow/follow-author.spec.ts`, `tests/profile-follow/unfollow-author.spec.ts`
- `tests/seed.spec.ts` is the agents' start file. It checks nothing about the app, so it is not reviewed here.

## 3. My review of every generated test
- **The teammate's question:** "Claude says the test starts clean, and the afterEach unfollows. So we can keep this test in our suite as it is, right?"
- **My answer:** Not as it is. The test changes a shared practice user: it signs in as practice-reader and follows or unfollows practice-author. The unfollow test changes the same user, so if both tests run at the same time, one can undo the other and a test fails at random. And "starts clean" isn't really true: in the fresh data practice-reader already follows practice-author, so line 42 and the afterEach (line 36) leave the practice data different from how it started. It also signs in through the form with the email and password typed in the test, and the agents never ran it, so the getByRole locators were never tried. Better: make a new user with the API, give the page its token with jwtToken, follow practice-author on the page, and check following: true with the API. Then the test uses only its own data, and there's nothing to undo on a practice user.
- "Follow practice-author from the profile page" · **changed**, because: The follow test is useful: its check is false before the click and true after it, after a reload and through the API (following: true). But it changes practice-reader, a shared user that other tests and the fresh data depend on. It must sign up its own new user by API and give the page that user's token, so it doesn't need to unfollow first or undo anything on a practice user.
- "Unfollow practice-author from the profile page" · **changed**, because: The journey and the checks are good: following is true before the click (line 31) and false after it, on the page after a reload (lines 48-49) and through the API (line 53), with getByRole locators, exact: true, and no waitForTimeout. But it fails two checklist lines and Wednesday's habit. Line 7: the locators are written in the test file instead of a page object. Line 8: the user and the password are typed in the test (lines 10, 34, 35). And it uses practice-reader, a shared user: it follows and unfollows practice-author, and the afterEach (lines 17-22) leaves practice-reader not following, which is different from the fresh data and can clash with the follow test. It must sign up its own new user by API, follow practice-author by API to start, give the page that user's token, and keep its checks.

## 4. What I asked Claude to change, and the result
- **My change** (the Changes line of `P4/prompts/stronger.md`): In @P4/tests/profile-follow/follow-author.spec.ts: But it changes practice-reader, a shared user that other tests and the fresh data depend on. It must sign up its own new user by API and give the page that user's token, so it doesn't need to unfollow first or undo anything on a practice user. In @P4/tests/profile-follow/unfollow-author.spec.ts: It must sign up its own new user by API, follow practice-author by API to start, give the page that user's token, and keep its checks.
- **Result:** No fault: 23 passed, 0 failed (both follow tests now sign up their own user by API; no practice-reader left)
