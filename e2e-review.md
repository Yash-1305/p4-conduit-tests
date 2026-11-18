# My end-to-end tests and review (week 4, project P4)

App: Conduit practice app · Test file: `P4/tests/e2e.spec.ts` · Date: 2026-11-18

## 1. My first look
- **After I published an article by hand, I would check:** At the end I would check that the Global Feed shows my article: the exact title and description I typed, with author practice-author. I would also open the article and check that the title and body are exactly what I wrote. And through the API (GET /api/articles/<slug>), I would check that the article was really saved with the same title, description and body. A unique title (for example with the date and time) makes sure I find my article, not an old one.
- **Where the page keeps my sign-in:** localStorage, key `jwtToken`

## 2. Practice
- **Worked example (the like test):** it signs in through the form as a practice user, so other tests can change its data.
- **Does its check at the end prove the journey?** No. The heading "Why tests become flaky" is already visible as soon as the article page opens, before the click. So line 19 is true before the journey and after it, and it would pass even if the like did nothing. A good check is false before the click and true after it. For example, through the API read the article as this user and check favorited is true and favoritesCount went up by exactly 1, or on the page check that the button now says Unfavorite Article with the new count.

## 3. My prompt
```text
Task: Write 2 end-to-end tests in P4/tests/e2e.spec.ts. Test 1: a signed-in user publishes a new article in the editor. Test 2: a signed-in user posts a comment on an article. Make a new user with the API, give the page its token, do the journey in the page, and check the result with the API at the end. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/app/public/app.js app.js is the page's code: take the labels and button names from it. The page keeps the sign-in token in localStorage, key jwtToken.
Rules: Use app.js only for the labels and button names. Do not change the app. Do not run the tests. The check at the end must be false before the journey and true after it: read the result with the API and compare the exact values typed in the page (the article's title, description and body with a unique title, or the comment's exact text by this new user), never only that a heading or the page is visible.
```

## 4. The run
- **Claude's 2 tests:** 2 passed, 0 failed.

## 5. The teammate's question
- **Claude said:** "Each test makes a new user with the API and puts that user's token in localStorage (`jwtToken`) before the page loads."
- **My answer:** No. Own data keeps the tests apart, but it doesn't clean up. Each run signs up new users and leaves their article and comment in the app, because no test deletes them at the end. So after every run there is more data in the app running in the APP terminal: more users, and more articles in the Global Feed. That can confuse other tests and manual checks, like a feed test that counts articles. Green only shows the checks passed, not that the app is clean. To clean up, a test can delete its own article with the API at the end (DELETE /api/articles/:slug, for example in afterEach), or we restart the app, which gives fresh data.

## 6. What I saw on the home page
- At the top I see "E2E article ..." titles with a number after each, by new e2eauthor users. They are the articles from Claude's tests. They are still in the app, because no test deleted them.

## 7. My change
- **My line to Claude:** In @P4/tests/e2e.spec.ts, each run leaves 2 articles in the app: the "E2E article" from the publish test, and the "E2E comment target" with its comment from the comment test. Add a test.afterEach that deletes what each test made, with the API and that test's own token: first the comment (DELETE /api/articles/:slug/comments/:id), then the article (DELETE /api/articles/:slug). It must run even when a check fails, and must not fail if the article was never made. Do not change the checks. Do not run the tests.
- **The clean-up Claude added:** `test.afterEach` deletes the comment each test made, then the article, with the API and that test's own token.

## 8. Proof
- **Each test twice, on an app that keeps its data:** `npx playwright test tests/e2e.spec.ts --repeat-each=2` → 4 passed, 0 failed.
- **The newest article on the home page after the run:** "Your first end-to-end test". No "E2E article" or "E2E comment target" is left in the feed, so the teardown deleted everything the 4 runs made.
