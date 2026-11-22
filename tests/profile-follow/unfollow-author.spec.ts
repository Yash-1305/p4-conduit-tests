// spec: specs/plan.md
// seed: tests/seed.spec.ts

import { test, expect, APIRequestContext, Page } from '@playwright/test';

const BASE = 'http://127.0.0.1:3000';

// Signs up a new user with the API and returns the token, so no practice user is changed.
async function signUp(request: APIRequestContext): Promise<string> {
  const username = `unfollower${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const res = await request.post(`${BASE}/api/users`, {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).user.token;
}

// Gives the page the user's token: the page reads it from localStorage, key jwtToken.
async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => {
    window.localStorage.setItem('jwtToken', t);
  }, token);
}

test.describe('Profile follow', () => {
  test('Unfollow practice-author from the profile page', async ({ page, request }) => {
    // 1. A new user follows practice-author via API; give the page its token and open the profile
    const token = await signUp(request);
    const headers = { Authorization: `Token ${token}` };
    const followRes = await request.post(`${BASE}/api/profiles/practice-author/follow`, { headers });
    expect(followRes.ok()).toBeTruthy();
    const before = await request.get(`${BASE}/api/profiles/practice-author`, { headers });
    expect((await before.json()).profile.following).toBe(true);

    await signInPage(page, token);
    await page.goto(`${BASE}/profile/practice-author`);

    await expect(page.getByRole('button', { name: 'Unfollow practice-author' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow practice-author', exact: true })).toHaveCount(0);

    // 2. Click the Unfollow practice-author button
    await page.getByRole('button', { name: 'Unfollow practice-author' }).click();
    await expect(page.getByRole('button', { name: 'Follow practice-author', exact: true })).toBeVisible();

    // 3. Reload the page
    await page.reload();
    await expect(page.getByRole('button', { name: 'Follow practice-author', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unfollow practice-author' })).toHaveCount(0);

    // 4. Verify via API that following is false
    const after = await request.get(`${BASE}/api/profiles/practice-author`, { headers });
    expect((await after.json()).profile.following).toBe(false);
  });
});
