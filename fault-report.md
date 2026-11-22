# My practice fault report (week 4, project P4)

App: Conduit practice app on my laptop · Practice faults: `P4/faults/practice.json` (F1 to F6) · Date: 2026-11-22
**How to read it:** a "detect" fault is **caught** when at least one test that passed with no fault fails with it, and **missed** when every test still passes. A "robust" fault (the app is only slower) should **stay green**; if tests fail, it **went red**.

## 1. My guess this morning
- **The developer asked:** "Your suite is green. How many real problems would it catch?"
- **My answer:** I can't tell from green alone: a green suite only shows the checks pass on a working app, not which problems they would catch. My guess is that it catches some, like a missing field (F2 turned 4 tests red), but not all. To find out, I would break the app on purpose, one practice fault at a time from faults/practice.json, run the whole suite each time, and count which faults turn at least one test red and which stay green. Every fault that stays green is a real problem my suite would miss, and shows where I need a new or stronger check.

## 2. Before: my suite against the practice faults
- **Command:** `node materials/faults-run.mjs` (TESTS terminal, in `P4`, with no app running)
- **My test files:** `api.spec.ts`, `contract.spec.ts`, `e2e.spec.ts`, `example.spec.ts`, `seed.spec.ts`, `profile-follow/follow-author.spec.ts`, `profile-follow/unfollow-author.spec.ts`
- **No fault:** 20 passed, 0 failed
- **F1:** caught (11 tests failed)
- **F2:** caught (7 tests failed)
- **F3:** caught (5 tests failed)
- **F4:** caught (1 test failed: e2e.spec.ts › a signed-in user posts a comment on an article)
- **F5:** stayed green (0 tests failed)
- **F6:** caught (1 test failed: the same e2e comment test)

## 3. The weak spot I chose, and why
My suite is weakest on comments. F4 (the comments list is always empty) and F6 (posting a comment is refused with 422 and nothing is saved) were each caught by only 1 test, the same one: the e2e test "a signed-in user posts a comment on an article". If that one test breaks or is removed, nothing catches either fault. A good suite should catch F4 in more than one place: an API test that posts a comment, then reads GET /api/articles/:slug/comments and checks the exact comment text by its own user, plus a contract test for the Comment shape. The articles are well covered (F1, F2, F3 failed 11, 7 and 5 tests), but the profile page has no fault at all, so my two new follow tests were never measured.

## 4. How I made the suite stronger
- **My request for Claude** (the New tests line of `P4/prompts/stronger.md`): Only one test checks comments. Write P4/tests/comments.spec.ts with 3 API tests, each with its own new user and article made by API: (1) the user posts a comment, and the answer is 201 with the exact comment text and author; then a GET of /api/articles/:slug/comments shows exactly that one comment with the same text and author. (2) Posting a comment with an empty body is refused with the status and error text that API.md gives, and a GET of the comments shows the list is still empty. (3) The comment answer has exactly the Comment keys from API.md, checked with toMatchObject and an exact sorted key list. Delete the article and comment in test.afterEach.
- **New or changed test file:** `tests/comments.spec.ts` (new, 3 tests); `tests/profile-follow/follow-author.spec.ts` and `unfollow-author.spec.ts` (changed: own users)

## 5. After: the run again
- **Command:** `node materials/faults-run.mjs F4 F6`
- **First run after the change:** No fault: 22 passed, 1 failed (comments.spec.ts › "a comment with an empty body is refused and nothing is saved": Expected 422, Received 201). My judgement: The app is wrong, and the test is right. API.md line 104 says body is required for POST /api/articles/:slug/comments, and line 33 says a missing or not valid field gives 422 with {"errors":{"body":["can't be blank"]}}. That test now has `test.fail();` with my note: "POST /api/articles/:slug/comments accepts an empty body and saves it (201), but API.md lines 33 and 104 say body is required and give 422."
- **No fault:** 23 passed, 0 failed
- **The fault I chose:** F4: 3 failed (was 1) · F6: 3 failed (was 1)

## 6. What changed
Now I can answer with numbers. The suite is green with no fault (23 passed, 0 failed) and catches every detect fault we tried: F1, F2 and F3 turn 11, 7 and 5 tests red, and the robust fault F5 stays green, as it should. Comments were the weak spot: before, F4 and F6 were each caught by only 1 test. After adding comments.spec.ts, each is caught by 3 tests in 2 files, so one broken test no longer hides them. The new tests also found a real bug: the app saves a comment with an empty body, which API.md says must give 422. That test is marked with test.fail() until the bug is fixed. What the run still can't tell us: no practice fault touches the profile page, so my two follow tests were never measured.
