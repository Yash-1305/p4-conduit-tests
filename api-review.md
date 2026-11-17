# API review: Claude's first API tests (week 4, project P4)

- **App:** Conduit, the practice app on your own laptop (`http://127.0.0.1:3000`)
- **API description:** `P4/API.md`
- **Test file:** `P4/tests/api.spec.ts`, written by Claude
- **Prompt file:** `P4/prompts/api.md`

## 1. My first look, by hand
The request my comment sent in the app, and the status that came back.
- POST  201 Created

## 2. My predictions and the real answers
One line per request: what I predicted, and what the app really answered.
- **A** (a comment, with the token): I predicted 201, the body has the new comment with "body":"Clear and useful." and author practice-reader (plus an id). The app answered 201, {"comment":{"id":6,...,"body":"Clear and useful.","author":{"username":"practice-reader",...}}}
- **B** (the same comment, with no token): I predicted 401, the body is {"errors":{"token":["is missing"]}}, because the endpoint needs a token and the request sends none. The app answered 401, {"errors":{"token":["is missing"]}}
- **C** (a comment on an article that does not exist): I predicted 404, the body is {"errors":{"article":["not found"]}}, because no article has the slug no-such-article. The app answered 404, {"errors":{"article":["not found"]}}
- **What surprised me:** "The id surprised me most: it is 6, even though Playwright started a fresh copy of the app. I think the fresh data already holds some comments, or an earlier request in the same run made one, and the app gives each new comment the next number. So the id depends on what is already in the database, not on my request. A test should not check the exact id; it should check that there is an id, and check the body and author exactly. The author fields bio: null, image: null and following: false also surprised me a little: the app adds them even though API.md lists only "author"."

## 3. My prompt to Claude
```text
Task: Write at least 6 Playwright API tests for articles in the Conduit API: create, read, change and delete an article. At least 3 positive and at least 3 negative tests. Save them in P4/tests/api.spec.ts. After the file, write one line per test: what it checks.
Material: @P4/API.md @P4/tests/example.spec.ts Send requests with the request fixture, like this example.
Rules: Write the tests from API.md only. Do not read the app's code in P4/app. Do not run the tests. Every test must check the exact status and the exact fields in the body that API.md promises (like the article's title, body and author, or the exact error text), and never check an id or a date by its exact value, only that it is there.
```

## 4. The run
- **Result:** 9 tests: 8 passed, 1 failed ('the author can change the body and the other fields stay the same').
- **A red test, and who is wrong:** 'the author can change the body and the other fields stay the same' (lines 89–108). Line 105: Expected ["testing", "api"], Received []. API.md says: "Updating: every field is optional. A field you do not send stays as it was. tagList: [] removes all tags." My answer: "The app is wrong, and the test is right. The test changes only the body; it doesn't send tagList at all. API.md says that when updating, a field you don't send stays as it was, and only tagList: [] removes all tags. So the tags should still be ["testing", "api"], but the app answered []. The app drops the tags on every update, even when nobody asked it to. The create test checks the same tags and passed, so the tags were saved when the article was made, and the update is what removes them. We keep this test as it is and report the bug: PUT /api/articles/:slug clears tagList when tagList is not sent."
- **My note** (kept with `test.fail()`): Known app bug - PUT /api/articles/:slug clears tagList when tagList is not sent; API.md says unsent fields stay as they were.

## 5. The developer's question
The test I looked at, and my answer to: "So the app saved nothing, right?"
- **Test:** "creating an article without a title gives 422" (lines 137–147)
- **My answer:** No, not yet. The test only checks the answer: 422 and the error text. It never checks what the app saved. The app could answer 422 and still save an article without a title, and this test would stay green. To know that nothing was saved, the test must ask the app afterwards: for example, read the new user's articles (like GET /api/articles?author=<username>, if API.md has it) and check that the list is empty. The test already makes a new user, so that list should hold 0 articles.

## 6. Tests I reviewed with the API checklist
The API checklist: status · body · shape · negative cases (a refused request changes nothing) · own test data.

### "a signed-in user can create an article" (lines 37–66)
- **My decision:** Change it. It passes 4 of the 5 checklist lines: the exact status 201 (line 53), exact values for title, description, body, tags and author (lines 55-61), the slug and dates only checked to be there (lines 62-65), and its own new user (line 38). But it only checks the answer. It never reads the article again, so it doesn't prove the app saved it. I would add a GET /api/articles/<slug> after the create, expect 200, and check that the saved article has the same title, description, body and tagList.

## 7. My API rules
The rules I added to my `playwright-quality` skill, under `## API rules`:
1. Every API test checks the exact status from API.md and the exact values in the body; an id or a date is only checked to be there, never by its exact value.
2. After every request that creates, changes, deletes or is refused, the test reads the data again with a GET and checks what the app really saved (or that nothing changed).
3. Every expected value comes from API.md, never from the app's code; when the app and API.md disagree, the test keeps the API.md value and is marked with test.fail() and a note about the bug.
