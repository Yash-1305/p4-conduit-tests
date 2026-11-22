// spec: specs/plan.md
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// Signs up a new user with the API and returns the token, so no practice user is changed.
async function signUp(request: APIRequestContext): Promise<string> {
  const username = `follower${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const response = await request.post(`${BASE}/api/users`, {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).user.token;
}

// Gives the page the user's token: the page reads it from localStorage, key jwtToken.
async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => {
    window.localStorage.setItem('jwtToken', t);
  }, token);
}

async function isFollowing(request: APIRequestContext, token: string): Promise<boolean> {
  const response = await request.get(`${BASE}/api/profiles/practice-author`, {
    headers: { Authorization: `Token ${token}` },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.profile.following;
}

test.describe('Profile follow', () => {
  test('Follow practice-author from the profile page', async ({ page, request }) => {
    // 1. A new user, who does not follow practice-author yet; give the page its token and open the profile
    const token = await signUp(request);
    expect(await isFollowing(request, token)).toBe(false);

    await signInPage(page, token);
    await page.goto(`${BASE}/profile/practice-author`);

    const followButton = page.getByRole('button', { name: 'Follow practice-author' });
    const unfollowButton = page.getByRole('button', { name: 'Unfollow practice-author' });
    await expect(followButton).toBeVisible();
    await expect(unfollowButton).toHaveCount(0);

    // 2. Click Follow
    await followButton.click();
    await expect(unfollowButton).toBeVisible();

    // 3. Reload the page
    await page.reload();
    await expect(unfollowButton).toBeVisible();

    // 4. Final check via API: following is true after the click
    expect(await isFollowing(request, token)).toBe(true);
  });
});
