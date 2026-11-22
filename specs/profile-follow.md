# Profile page and following an author

## Application Overview

Conduit practice app at http://127.0.0.1:3000, page /profile/practice-author. Signed-out visitors see only the heading, bio and articles (no Follow button). Signed in as practice-reader (practice-reader@example.com / Practice123) the page shows a follow button. Notes for the test code: use getByRole locators only. Sign-in fields: getByRole('textbox', { name: 'Email' }), getByRole('textbox', { name: 'Password' }), getByRole('button', { name: 'Sign in' }). Follow button: getByRole('button', { name: 'Follow practice-author' }); after following: getByRole('button', { name: 'Unfollow practice-author' }). Do not use waitForTimeout; rely on web-first assertions (expect(...).toBeVisible()). Add an afterEach that unfollows: DELETE /api/profiles/practice-author/follow with header Authorization: Token <practice-reader token from POST /api/users/login> so practice-reader stays clean. Observation: when first explored, practice-reader was already following practice-author (button showed Unfollow); it was unfollowed during exploration, so the starting state is now not following. Each test should still start with an API precondition check/DELETE so it is independent.

## Test Scenarios

### 1. Profile follow

**Seed:** `tests/seed.spec.ts`

#### 1.1. Follow practice-author from the profile page

**File:** `tests/profile-follow/follow-author.spec.ts`

**Steps:**
  1. Precondition via API: sign in practice-reader (POST /api/users/login), DELETE /api/profiles/practice-author/follow, GET /api/profiles/practice-author with token. Sign in through the UI at /login using the Email and Password textboxes and the Sign in button, then open /profile/practice-author.
    - expect: API shows following: false
    - expect: Button 'Follow practice-author' is visible; 'Unfollow practice-author' is not present
  2. Click the button 'Follow practice-author'.
    - expect: Button 'Unfollow practice-author' becomes visible
  3. Reload the page.
    - expect: Button 'Unfollow practice-author' is still visible after reload
  4. GET /api/profiles/practice-author with practice-reader's token.
    - expect: profile.following is true
  5. afterEach: DELETE /api/profiles/practice-author/follow with practice-reader's token.
    - expect: Response 200 with following: false

#### 1.2. Unfollow practice-author from the profile page

**File:** `tests/profile-follow/unfollow-author.spec.ts`

**Steps:**
  1. Precondition via API: sign in practice-reader, POST /api/profiles/practice-author/follow, confirm GET shows following: true. Sign in through the UI and open /profile/practice-author.
    - expect: Button 'Unfollow practice-author' is visible (final check is true before the action)
  2. Click the button 'Unfollow practice-author'.
    - expect: Button 'Follow practice-author' becomes visible
  3. Reload the page.
    - expect: Button 'Follow practice-author' is visible; 'Unfollow practice-author' is not present
  4. GET /api/profiles/practice-author with practice-reader's token.
    - expect: profile.following is false
  5. afterEach: DELETE /api/profiles/practice-author/follow with practice-reader's token (safe if already unfollowed).
    - expect: Response 200 with following: false
