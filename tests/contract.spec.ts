import { test, expect, APIRequestContext } from '@playwright/test';

// Signs up a new user with a unique name and returns the username and token.
async function signUp(request: APIRequestContext) {
  const id = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `contract${id}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, email: `${username}@example.com`, token: json.user.token as string };
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

// Creates an article for this user and returns the article from the answer.
async function createArticle(request: APIRequestContext, token: string) {
  const response = await request.post('/api/articles', {
    headers: auth(token),
    data: {
      article: {
        title: `Contract test ${Date.now()}`,
        description: 'A short description',
        body: 'The article body',
        tagList: ['testing', 'api'],
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article;
}

// Reads the article again and checks that it is exactly as it was before.
async function expectArticleUnchanged(request: APIRequestContext, before: any) {
  const response = await request.get(`/api/articles/${before.slug}`);
  expect(response.status()).toBe(200);
  const { article } = await response.json();
  expect(article.slug).toBe(before.slug);
  expect(article.title).toBe(before.title);
  expect(article.description).toBe(before.description);
  expect(article.body).toBe(before.body);
  expect(article.tagList).toEqual(before.tagList);
  expect(article.updatedAt).toBe(before.updatedAt);
}

// Keys from API.md, sorted.
const ARTICLE_KEYS = [
  'author',
  'body',
  'createdAt',
  'description',
  'favorited',
  'favoritesCount',
  'slug',
  'tagList',
  'title',
  'updatedAt',
];
const PROFILE_KEYS = ['bio', 'following', 'image', 'username'];
const USER_KEYS = ['bio', 'email', 'image', 'token', 'username'];

test.describe('Schema checks', () => {
  test('GET /api/articles/:slug answers with the Article shape', async ({ request }) => {
    const { token } = await signUp(request);
    const created = await createArticle(request, token);

    const response = await request.get(`/api/articles/${created.slug}`);

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(Object.keys(json).sort()).toEqual(['article']);
    expect(json).toMatchObject({
      article: {
        slug: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        body: expect.any(String),
        tagList: expect.any(Array),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        favorited: expect.any(Boolean),
        favoritesCount: expect.any(Number),
        author: {
          username: expect.any(String),
          // API.md: a new user has bio and image set to null.
          bio: null,
          image: null,
          following: expect.any(Boolean),
        },
      },
    });
    expect(Object.keys(json.article).sort()).toEqual(ARTICLE_KEYS);
    expect(Object.keys(json.article.author).sort()).toEqual(PROFILE_KEYS);
  });

  test('GET /api/user answers with the User shape', async ({ request }) => {
    const { username, email, token } = await signUp(request);

    const response = await request.get('/api/user', { headers: auth(token) });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(Object.keys(json).sort()).toEqual(['user']);
    expect(json).toMatchObject({
      user: {
        email: expect.any(String),
        token: expect.any(String),
        username: expect.any(String),
        // API.md: a new user has bio and image set to null.
        bio: null,
        image: null,
      },
    });
    expect(json.user.username).toBe(username);
    expect(json.user.email).toBe(email);
    expect(Object.keys(json.user).sort()).toEqual(USER_KEYS);
  });
});

test.describe('Auth checks', () => {
  test('changing an article with no token gives 401 "token is missing"', async ({ request }) => {
    const { token } = await signUp(request);
    const article = await createArticle(request, token);

    const response = await request.put(`/api/articles/${article.slug}`, {
      data: { article: { title: 'Changed with no token' } },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
    await expectArticleUnchanged(request, article);
  });

  test('changing an article with a wrong token gives 401 "token is invalid"', async ({ request }) => {
    const { token } = await signUp(request);
    const article = await createArticle(request, token);

    const response = await request.put(`/api/articles/${article.slug}`, {
      headers: auth('not-a-real-token'),
      data: { article: { title: 'Changed with a wrong token' } },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is invalid'] } });
    await expectArticleUnchanged(request, article);
  });

  test("changing someone else's article gives 403 \"article forbidden\"", async ({ request }) => {
    const author = await signUp(request);
    const other = await signUp(request);
    const article = await createArticle(request, author.token);

    const response = await request.put(`/api/articles/${article.slug}`, {
      headers: auth(other.token),
      data: { article: { title: 'Changed by someone else' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });
    await expectArticleUnchanged(request, article);
  });
});
