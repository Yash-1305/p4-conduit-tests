import { test, expect, APIRequestContext } from '@playwright/test';

// Signs up a new user with a unique name and returns the username and token.
async function signUp(request: APIRequestContext) {
  const id = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const username = `writer${id}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(response.status()).toBe(201);
  const json = await response.json();
  return { username, token: json.user.token as string };
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

// Creates an article for this user and returns the article from the answer.
async function createArticle(request: APIRequestContext, token: string, title: string) {
  const response = await request.post('/api/articles', {
    headers: auth(token),
    data: {
      article: {
        title,
        description: 'A short description',
        body: 'The article body',
        tagList: ['testing', 'api'],
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article;
}

test.describe('Articles API', () => {
  test('a signed-in user can create an article', async ({ request }) => {
    const { username, token } = await signUp(request);
    const title = `Create test ${Date.now()}`;

    const response = await request.post('/api/articles', {
      headers: auth(token),
      data: {
        article: {
          title,
          description: 'A short description',
          body: 'The article body',
          tagList: ['testing', 'api'],
        },
      },
    });

    expect(response.status()).toBe(201);
    const { article } = await response.json();
    expect(article.title).toBe(title);
    expect(article.description).toBe('A short description');
    expect(article.body).toBe('The article body');
    expect(article.tagList).toEqual(['testing', 'api']);
    expect(article.favorited).toBe(false);
    expect(article.favoritesCount).toBe(0);
    expect(article.author).toEqual({ username, bio: null, image: null, following: false });
    expect(typeof article.slug).toBe('string');
    expect(article.slug).not.toBe('');
    expect(article.createdAt).toBeTruthy();
    expect(article.updatedAt).toBeTruthy();
  });

  test('anyone can read an article by its slug', async ({ request }) => {
    const { username, token } = await signUp(request);
    const title = `Read test ${Date.now()}`;
    const created = await createArticle(request, token, title);

    const response = await request.get(`/api/articles/${created.slug}`);

    expect(response.status()).toBe(200);
    const { article } = await response.json();
    expect(article.slug).toBe(created.slug);
    expect(article.title).toBe(title);
    expect(article.description).toBe('A short description');
    expect(article.body).toBe('The article body');
    expect(article.tagList).toEqual(['testing', 'api']);
    expect(article.favorited).toBe(false);
    expect(article.favoritesCount).toBe(0);
    expect(article.author).toEqual({ username, bio: null, image: null, following: false });
    expect(article.createdAt).toBeTruthy();
    expect(article.updatedAt).toBeTruthy();
  });

  test('the author can change the body and the other fields stay the same', async ({ request }) => {
    // Known app bug - PUT /api/articles/:slug clears tagList when tagList is not sent; API.md says unsent fields stay as they were.
    test.fail();
    const { username, token } = await signUp(request);
    const title = `Update test ${Date.now()}`;
    const created = await createArticle(request, token, title);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: auth(token),
      data: { article: { body: 'The new body' } },
    });

    expect(response.status()).toBe(200);
    const { article } = await response.json();
    expect(article.body).toBe('The new body');
    expect(article.title).toBe(title);
    expect(article.slug).toBe(created.slug);
    expect(article.description).toBe('A short description');
    expect(article.tagList).toEqual(['testing', 'api']);
    expect(article.author).toEqual({ username, bio: null, image: null, following: false });
    expect(article.updatedAt).toBeTruthy();
  });

  test('the author can delete an article and it is gone', async ({ request }) => {
    const { token } = await signUp(request);
    const created = await createArticle(request, token, `Delete test ${Date.now()}`);

    const response = await request.delete(`/api/articles/${created.slug}`, { headers: auth(token) });

    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');

    const after = await request.get(`/api/articles/${created.slug}`);
    expect(after.status()).toBe(404);
    expect(await after.json()).toEqual({ errors: { article: ['not found'] } });
  });

  test('creating an article without a token gives 401', async ({ request }) => {
    const response = await request.post('/api/articles', {
      data: {
        article: { title: `No token ${Date.now()}`, description: 'A short description', body: 'The article body' },
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ errors: { token: ['is missing'] } });
  });

  test('creating an article without a title gives 422', async ({ request }) => {
    const { token } = await signUp(request);

    const response = await request.post('/api/articles', {
      headers: auth(token),
      data: { article: { description: 'A short description', body: 'The article body' } },
    });

    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ errors: { title: ["can't be blank"] } });
  });

  test('reading an article that does not exist gives 404', async ({ request }) => {
    const response = await request.get(`/api/articles/no-such-article-${Date.now()}`);

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ errors: { article: ['not found'] } });
  });

  test("changing someone else's article gives 403 and the article stays the same", async ({ request }) => {
    const author = await signUp(request);
    const other = await signUp(request);
    const created = await createArticle(request, author.token, `Forbidden update ${Date.now()}`);

    const response = await request.put(`/api/articles/${created.slug}`, {
      headers: auth(other.token),
      data: { article: { body: 'Changed by someone else' } },
    });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    const after = await request.get(`/api/articles/${created.slug}`);
    expect(after.status()).toBe(200);
    expect((await after.json()).article.body).toBe('The article body');
  });

  test("deleting someone else's article gives 403 and the article is still there", async ({ request }) => {
    const author = await signUp(request);
    const other = await signUp(request);
    const created = await createArticle(request, author.token, `Forbidden delete ${Date.now()}`);

    const response = await request.delete(`/api/articles/${created.slug}`, { headers: auth(other.token) });

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ errors: { article: ['forbidden'] } });

    const after = await request.get(`/api/articles/${created.slug}`);
    expect(after.status()).toBe(200);
  });
});
