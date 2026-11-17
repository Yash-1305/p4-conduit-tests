# My schema, auth and contract checks (week 4, project P4)

App: Conduit practice app on my laptop · Date: 2026-11-17

## 1. My first look
How I would check that an article answer has the right shape: The test would check the shape, not the exact values. It reads the article, then checks that it has exactly the keys API.md lists (slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, author), no more and no fewer, and that each key has the right type: text for slug, title, description and body; a list of text for tagList; a date text for createdAt and updatedAt; true/false for favorited; a number for favoritesCount; and an author object with username, bio, image and following. Then a new app version that renames, removes or changes the type of a field makes the test fail, even when the values look fine.

## 2. Practice: the key list check
File: `P4/materials/contract-example.spec.ts` (the sign-up answer).
Three changes: `bio` is missing · a new field `password` is added · `token` becomes a number.
- **The toMatchObject check (worked example):** missing: passes · new field: passes · number: fails
- **The key list check (my answer):** missing: fails (bio is no longer in the keys, so the list is one shorter than API.md's list) · new field: fails (password is an extra key, so the list is one longer) · number: passes (the key token is still there; the key list only checks the names, not the kind of value). So the two checks catch different problems, and a good contract test uses both.

## 3. My prompt for Claude
```text
Task: Write Playwright API tests in P4/tests/contract.spec.ts. Schema checks: the answers of GET /api/articles/:slug and GET /api/user have the shape that API.md gives, checked with toMatchObject and expect.any. Auth tests: no token, a wrong token, and changing someone else's article. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Every schema check uses both toMatchObject with expect.any for the kind of each field and an exact sorted key list from API.md, and every auth test checks the exact status and error text and then reads the article again with a GET to prove nothing changed.
```

## 4. Claude's tests and my run
- **Run:** `npx playwright test tests/contract.spec.ts` · **Result:** 5 passed, 0 failed
- **A red test, and who was wrong:** No test failed.

## 5. The teammate's question
- **Claude's test:** "GET /api/articles/:slug answers with the Article shape" (from another run; my own test already had exact key lists on lines 95–96)
- **Claude said:** "an anonymous reader gets 200 and the full Article shape."
- **My answer:** No, it stays green. toMatchObject only checks the fields it lists, so an extra field like password is never looked at, even inside author. The test only proves the listed fields are there with the right values, not that the answer has exactly the Article shape. To catch an extra field, the test also needs an exact key list, like our test's lines 95-96: expect(Object.keys(json.article).sort()).toEqual(ARTICLE_KEYS), and the same for author with PROFILE_KEYS.

## 6. My change
- **What I asked Claude:** My own file already had exact key lists (article line 95, author line 96, user line 119), so no change was sent. The line I would send for the test from the other run: "In @P4/tests/contract.spec.ts, the test 'GET /api/articles/:slug answers with the Article shape' uses only toMatchObject, so extra fields in the article or in its author still pass. Add a check that the article has exactly the keys API.md lists for Article, and that the author has exactly the keys API.md lists for a profile (sort both key lists and compare with toEqual). Keep the toMatchObject check. Do not run the tests."
- **The run after it:** 5 passed, 0 failed (the file did not change)

## 7. Proof: the contract test fails when the answer changes
- **My prediction before the run:** The article shape test, 'GET /api/articles/:slug answers with the Article shape', will fail. Its exact key list (line 95) compares the article's keys with API.md, so one missing field makes the list one key shorter, and toEqual fails. If the missing field is one that toMatchObject lists, that check fails too. The 'GET /api/user' shape test will pass, because F2 changes only the article answer. The 3 auth tests may also fail, if they read the article again with a GET and compare the field that is gone. If they only compare other fields, they pass.
- **Run with the practice fault F2 on:** `export CONDUIT_FAULT=F2`, then `npx playwright test tests/contract.spec.ts` · **Result:** 1 passed, 4 failed (a first run passed, because an app from Monday was still running; after closing it, the fault reached the tests)
- **What Playwright showed:** the article shape test failed at its toMatchObject (line 75): `-     "body": Any<String>,`. The 3 auth tests failed on line 44: Expected "The article body", Received undefined. The user shape test passed.
- **My answer about a red test:** It didn't fail because of the token. It failed on line 44, in the shared check that reads the article again after the refused change: expect(article.body).toBe(before.body). F2 removes the body field from the article answer, so the GET gives undefined instead of "The article body". The 401 and "token is missing" checks come before that line, so they probably passed. All four red tests have one cause, the missing body field, so this is one problem, not four. That's why I read Expected and Received before I judge a red test.
- **Run with the fault off again:** `unset CONDUIT_FAULT`, then the same run · **Result:** 5 passed, 0 failed
