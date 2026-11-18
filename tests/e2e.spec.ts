import { test, expect, APIRequestContext, Page } from '@playwright/test';

// Makes a unique id, so every run uses new names and titles.
function uniqueId() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

// Signs up a new user with the API and returns the username and token.
async function signUp(request: APIRequestContext, prefix: string) {
  const username = `${prefix}${uniqueId()}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, token: json.user.token as string };
}

// Gives the page the user's token: the page reads it from localStorage, key jwtToken.
async function signInPage(page: Page, token: string) {
  await page.addInitScript((t) => {
    window.localStorage.setItem('jwtToken', t);
  }, token);
}

// Returns this author's articles from the API (the list has no body).
async function articlesBy(request: APIRequestContext, username: string) {
  const response = await request.get(`/api/articles?author=${encodeURIComponent(username)}`);
  expect(response.status()).toBe(200);
  return (await response.json()).articles as Array<{ slug: string; title: string }>;
}

// Returns the comments on an article from the API.
async function commentsOn(request: APIRequestContext, slug: string) {
  const response = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(response.status()).toBe(200);
  return (await response.json()).comments as Array<{ body: string; author: { username: string } }>;
}

type User = { username: string; token: string };

// What the current test made, so afterEach can delete it.
// Each test fills this in as soon as it knows the user, before any check can fail.
let made: {
  article?: { title: string; author: User; slug?: string };
  comment?: { slug: string; body: string; author: User };
} = {};

test.beforeEach(() => {
  made = {};
});

// Runs after every test, also when a check failed. Deletes the comment first, then the article.
// If a test stopped before making something, the API lookup finds nothing and nothing is deleted.
test.afterEach(async ({ request }) => {
  if (made.comment) {
    const { slug, body, author } = made.comment;
    const mine = (await commentsOn(request, slug)).filter(
      (c) => c.body === body && c.author.username === author.username,
    ) as Array<{ id: number; body: string; author: { username: string } }>;
    for (const c of mine) {
      const response = await request.delete(`/api/articles/${encodeURIComponent(slug)}/comments/${c.id}`, {
        headers: auth(author.token),
      });
      expect(response.status()).toBe(204);
    }
  }

  if (made.article) {
    const { title, author, slug } = made.article;
    // The publish test does not know the slug from the API, so look it up by author and title.
    const slugs = slug
      ? [slug]
      : (await articlesBy(request, author.username)).filter((a) => a.title === title).map((a) => a.slug);
    for (const s of slugs) {
      const response = await request.delete(`/api/articles/${encodeURIComponent(s)}`, {
        headers: auth(author.token),
      });
      expect(response.status()).toBe(204);
    }
  }
});

test.describe('End-to-end: API and page together', () => {
  test('a signed-in user publishes a new article in the editor', async ({ page, request }) => {
    const { username, token } = await signUp(request, 'e2eauthor');
    const title = `E2E article ${uniqueId()}`;
    const description = 'An article written in the editor';
    const body = 'This body was typed in the page by an end-to-end test.';
    made.article = { title, author: { username, token } };

    // Before the journey: this user has no article with this title.
    expect((await articlesBy(request, username)).filter((a) => a.title === title)).toHaveLength(0);

    // The journey in the page.
    await signInPage(page, token);
    await page.goto('/editor');
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('textbox', { name: "What's this article about?" }).fill(description);
    await page.getByRole('textbox', { name: 'Write your article' }).fill(body);
    await page.getByRole('button', { name: 'Publish Article' }).click();
    // After publishing, the page opens the new article.
    await expect(page).toHaveURL(/\/article\//);

    // After the journey: the API has exactly one article with this title by this user...
    const mine = (await articlesBy(request, username)).filter((a) => a.title === title);
    expect(mine).toHaveLength(1);

    // ...and it has the exact values typed in the page.
    const response = await request.get(`/api/articles/${encodeURIComponent(mine[0].slug)}`);
    expect(response.status()).toBe(200);
    const { article } = await response.json();
    expect(article.title).toBe(title);
    expect(article.description).toBe(description);
    expect(article.body).toBe(body);
    expect(article.author.username).toBe(username);
  });

  test('a signed-in user posts a comment on an article', async ({ page, request }) => {
    // An article by another user, made with the API.
    const author = await signUp(request, 'e2ewriter');
    const targetTitle = `E2E comment target ${uniqueId()}`;
    made.article = { title: targetTitle, author };
    const create = await request.post('/api/articles', {
      headers: auth(author.token),
      data: {
        article: {
          title: targetTitle,
          description: 'An article to comment on',
          body: 'Comment on this article.',
          tagList: [],
        },
      },
    });
    expect(create.status()).toBe(201);
    const { slug } = (await create.json()).article;
    made.article.slug = slug;

    // The new user who will post the comment.
    const { username, token } = await signUp(request, 'e2ereader');
    const commentText = `E2E comment ${uniqueId()}`;
    made.comment = { slug, body: commentText, author: { username, token } };

    // Before the journey: no comment with this text by this user.
    const isMine = (c: { body: string; author: { username: string } }) =>
      c.body === commentText && c.author.username === username;
    expect((await commentsOn(request, slug)).filter(isMine)).toHaveLength(0);

    // The journey in the page.
    await signInPage(page, token);
    await page.goto(`/article/${encodeURIComponent(slug)}`);
    await page.getByRole('textbox', { name: 'Write a comment' }).fill(commentText);
    await page.getByRole('button', { name: 'Post Comment' }).click();

    // After the journey: the API has exactly one comment with this exact text by this user.
    await expect
      .poll(async () => (await commentsOn(request, slug)).filter(isMine).length)
      .toBe(1);
  });
});
