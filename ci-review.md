# My CI workflow and review (week 4, project P4)

Repository: the P4 folder · Workflow: `.github/workflows/playwright.yml` · Date: 2026-11-22

## 1. What my project needs
- **Node.js on my laptop (`node -v`):** v24.11.0
- **My whole suite on my laptop:** `npx playwright test` → 23 passed, 0 failed (2 `test.fail()` tests count as passed)
- **What the GitHub computer needs (my words):**
  - Node.js 24, the same major version as my laptop (v24.11.0). It also fits engines ">=22.13" in package.json. In the workflow: actions/setup-node with node-version: 24. Then the GitHub run uses the same Node.js as my green run on my laptop.
  - npm ci. It installs exactly the versions in package-lock.json, the same ones my laptop used, so the GitHub run tests the same thing as my green run. npm install could choose newer versions.
  - Chromium only (from the example)

## 2. My prompt to Claude
```text
Task: Write a GitHub Actions workflow that runs this Playwright suite on every push and keeps the HTML report. My GitHub repository is the P4 folder, so save it as P4/.github/workflows/playwright.yml. After the file, write one line for each step: what it does.
Material: @P4/package.json @P4/playwright.config.ts @P4/README.md
Rules: Use actions/checkout@v6, actions/setup-node@v6 and actions/upload-artifact@v6. Do not run anything. Do not commit or push. Use node-version 24 like my laptop, install with npm ci, install only Chromium with npx playwright install --with-deps chromium, and upload the playwright-report folder even when tests fail (if: always()).
```

## 3. What Claude's workflow got wrong for my project
My rule gave Claude the Node.js fact, so my own workflow already had `node-version: 24`. The developer's question was about a workflow from another run:
- **Claude's workflow (another run):** `node-version: 22` in the Set up Node.js step
- **Claude said:** "ASSUMPTION: `node-version: 22` gets the newest Node 22, which is 22.13 or later. You could use 24 instead. Nothing in the material asks for a specific version."
- **My project needs:** Node.js 24, the same major version as my laptop (v24.11.0).
- **My answer to the developer:** Not yet. Node 22 fits package.json (">=22.13"), so it would probably work, but it's an ASSUMPTION Claude made itself, not a fact from our project: my laptop runs v24.11.0, and that's where the suite is green. If CI uses a different Node version than the laptop, a green or red run on GitHub doesn't prove the same thing. Change line 16 to node-version: 24 first. Then merge.
- **My line to Claude:** In @P4/.github/workflows/playwright.yml, add a comment above the node-version: 24 line on line 17 that says: Node 24, the same major version as my laptop (v24.11.0), where the suite is green; it also fits engines ">=22.13" in package.json. Change nothing else. Do not run anything.

## 4. My reading of the workflow
- **When, where, the code and Node.js (lines 1–19):** Line 1 gives the workflow its name. Lines 3-4: it runs on every push, to any branch. Line 8: on a fresh Linux computer at GitHub. Line 9: GitHub stops the job after 30 minutes. Lines 11-12 copy my repository onto that computer. Lines 14-19 install Node.js 24, the same major version as my laptop (line 17 says why), and keep the npm packages between runs so later runs are faster.
- **Packages, browser, tests and the report (lines 20–36):** Lines 21-22 install exactly the package versions from package-lock.json with npm ci. Lines 24-25 install only Chromium, with the Linux system libraries it needs (--with-deps). Lines 27-28 run the whole suite, which starts the app first. Lines 30-36 upload the playwright-report folder as a file called playwright-report, even when tests fail (if: always()), and GitHub keeps it for 30 days.

## 5. The first run on GitHub
- **Run:** Add the CI workflow · **Result:** green tick · **Tests:** 23 passed (4.6s)
- **The report (artifact):** Yes, playwright-report is under Artifacts.

## 6. A red run on purpose
- **The change:** `tests/example.spec.ts` line 6, `toBe(200)` → `toBe(201)`
- **My prediction:** The step "Run Playwright tests" will turn red, because the test "the API lists the popular tags" fails on line 6: Expected: 201, Received: 200. A GET of /api/tags answers 200, so the test asks for the wrong status. All earlier steps stay green, and "Upload HTML report" still runs because of if: always(), so the report is kept.
- **What GitHub showed:** Expected: 201 · Received: 200

## 7. Fixed, and green again
- **The fix:** line 6 back to `toBe(200)` · **Run:** Fix the expected status · **Result:** 23 passed (4.9s)

## 8. Review notes for my other AI-written tests (written while CI ran)
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.
Monday's and Tuesday's tests that I did not review in depth on those days. Each one: kept, changed or removed, and why.

### Monday: `tests/api.spec.ts`
- "anyone can read an article by its slug": **kept**, because it is a read, it checks exact values, and it makes its own user and article. Nothing changes, so there is nothing to read again.
- "the author can delete an article and it is gone": **kept**, because it checks 204 and then reads the article again (404 "not found").
- "creating an article without a token gives 401": **changed**, because it checks 401 and the error, but never reads the data again. It must read the user's articles with a GET and check that nothing was saved.
- "reading an article that does not exist gives 404": **kept**, because it is a read of a slug that doesn't exist, with the exact status and error. Nothing changes.
- "changing someone else's article gives 403 and the article stays the same": **changed**, because it reads the article again but checks only the body. It must check that title, description, body and tagList are all unchanged.
- "deleting someone else's article gives 403 and the article is still there": **changed**, because it reads the article again but checks only status 200. It must also check the article is the same one (same title and body), not only that something answers.

### Tuesday: `tests/contract.spec.ts`
- "GET /api/user answers with the User shape": **kept**, because it checks 200, the kind of each field, the exact username and email, and the exact key list, with its own user. That is status, body and shape.
- "changing an article with no token gives 401 "token is missing"": **kept**, because it checks 401 and the exact error, then reads the article again and checks all 6 fields are unchanged, so the refused request is proven to change nothing.
- "changing an article with a wrong token gives 401 "token is invalid"": **kept**, because the same as test 2, for a wrong token: 401, the exact error, and the same 6 fields unchanged.
- "changing someone else's article gives 403 "article forbidden"": **kept**, because 403 and the exact error, the same 6 fields unchanged after the GET, and 2 own users, so no shared practice user is changed.
