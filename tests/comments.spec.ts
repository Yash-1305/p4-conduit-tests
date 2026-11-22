import { test, expect, APIRequestContext } from '@playwright/test';

// Makes a unique id, so every run uses new names and titles.
function uniqueId() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

function auth(token: string) {
  return { Authorization: `Token ${token}` };
}

type User = { username: string; token: string };

// Signs up a new user with the API and returns the username and token.
async function signUp(request: APIRequestContext): Promise<User> {
  const username = `commenter${uniqueId()}`;
  const response = await request.post('/api/users', {
    data: { user: { username, email: `${username}@example.com`, password: 'password123' } },
  });
  expect(response.status()).toBe(201);
  return { username, token: (await response.json()).user.token as string };
}

// Creates an article for this user and returns its slug.
async function createArticle(request: APIRequestContext, token: string): Promise<string> {
  const response = await request.post('/api/articles', {
    headers: auth(token),
    data: {
      article: {
        title: `Comments test ${uniqueId()}`,
        description: 'An article to comment on',
        body: 'Comment on this article.',
        tagList: [],
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).article.slug as string;
}

// Returns the comments on an article from the API.
async function commentsOn(request: APIRequestContext, slug: string) {
  const response = await request.get(`/api/articles/${encodeURIComponent(slug)}/comments`);
  expect(response.status()).toBe(200);
  return (await response.json()).comments as Array<{
    id: unknown;
    body: string;
    author: { username: string };
  }>;
}

// What the current test made, so afterEach can delete it.
// Each test fills this in as soon as it knows the value, before any check can fail.
let made: { user?: User; slug?: string; commentId?: unknown } = {};

test.beforeEach(() => {
  made = {};
});

// Runs after every test, also when a check failed. Deletes the comment first, then the article.
test.afterEach(async ({ request }) => {
  const { user, slug, commentId } = made;
  if (!user || !slug) return;

  if (commentId !== undefined) {
    const response = await request.delete(
      `/api/articles/${encodeURIComponent(slug)}/comments/${commentId}`,
      { headers: auth(user.token) },
    );
    expect(response.status()).toBe(204);
    expect(await commentsOn(request, slug)).toEqual([]);
  }

  const response = await request.delete(`/api/articles/${encodeURIComponent(slug)}`, {
    headers: auth(user.token),
  });
  expect(response.status()).toBe(204);
  const gone = await request.get(`/api/articles/${encodeURIComponent(slug)}`);
  expect(gone.status()).toBe(404);
});

test.describe('Comments API', () => {
  test('a signed-in user posts a comment and the list shows exactly that comment', async ({ request }) => {
    const user = await signUp(request);
    made.user = user;
    const slug = await createArticle(request, user.token);
    made.slug = slug;
    const text = `A comment ${uniqueId()}`;

    const response = await request.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
      headers: auth(user.token),
      data: { comment: { body: text } },
    });
    expect(response.status()).toBe(201);
    const { comment } = await response.json();
    made.commentId = comment.id;
    expect(comment.id).toBeDefined();
    expect(comment.body).toBe(text);
    expect(comment.author.username).toBe(user.username);

    // Read the data again: exactly one comment, with the same id, text and author.
    const comments = await commentsOn(request, slug);
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(comment.id);
    expect(comments[0].body).toBe(text);
    expect(comments[0].author.username).toBe(user.username);
  });

  test('a comment with an empty body is refused and nothing is saved', async ({ request }) => {
    // Bug: POST /api/articles/:slug/comments accepts an empty body and saves it (201),
    // but API.md lines 33 and 104 say body is required and give 422.
    test.fail();
    const user = await signUp(request);
    made.user = user;
    const slug = await createArticle(request, user.token);
    made.slug = slug;

    const response = await request.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
      headers: auth(user.token),
      data: { comment: { body: '' } },
    });
    // If the app saved it anyway, keep the id so afterEach deletes it.
    if (response.status() === 201) made.commentId = (await response.json()).comment.id;
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ errors: { body: ["can't be blank"] } });

    // Read the data again: the list is still empty.
    expect(await commentsOn(request, slug)).toEqual([]);
  });

  test('the comment answer has exactly the Comment keys from API.md', async ({ request }) => {
    const user = await signUp(request);
    made.user = user;
    const slug = await createArticle(request, user.token);
    made.slug = slug;
    const text = `A contract comment ${uniqueId()}`;

    const response = await request.post(`/api/articles/${encodeURIComponent(slug)}/comments`, {
      headers: auth(user.token),
      data: { comment: { body: text } },
    });
    expect(response.status()).toBe(201);
    const json = await response.json();
    made.commentId = json.comment?.id;

    expect(Object.keys(json)).toEqual(['comment']);
    const { comment } = json;
    // id and dates: only checked to be there, never by exact value.
    expect(comment).toMatchObject({
      id: expect.anything(),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      body: text,
      // A new user has bio and image null; the user does not follow themselves.
      author: { username: user.username, bio: null, image: null, following: false },
    });
    expect(Object.keys(comment).sort()).toEqual(['author', 'body', 'createdAt', 'id', 'updatedAt']);
    expect(Object.keys(comment.author).sort()).toEqual(['bio', 'following', 'image', 'username']);

    // Read the data again: the saved comment is the one in the answer.
    const comments = await commentsOn(request, slug);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: comment.id, body: text, author: { username: user.username } });
  });
});
