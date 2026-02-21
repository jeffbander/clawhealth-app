/**
 * E2E Test Setup — ClawHealth
 * Provides Clerk testing tokens, test user/physician creation, cleanup
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const CLERK_SECRET = process.env.CLERK_SECRET_KEY!;
const CLERK_API = "https://api.clerk.com/v1";

if (!CLERK_SECRET) throw new Error("CLERK_SECRET_KEY required for E2E tests");

const clerkHeaders = {
  Authorization: `Bearer ${CLERK_SECRET}`,
  "Content-Type": "application/json",
};

/** Get a short-lived Clerk testing token (bypasses email verification) */
export async function getTestingToken(): Promise<string> {
  const res = await fetch(`${CLERK_API}/testing_tokens`, {
    method: "POST",
    headers: clerkHeaders,
  });
  if (!res.ok) throw new Error(`Failed to get testing token: ${res.status}`);
  const data = await res.json();
  return data.token;
}

/** Create a Clerk test user */
export async function createTestUser(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${CLERK_API}/users`, {
    method: "POST",
    headers: clerkHeaders,
    body: JSON.stringify({
      email_address: [email],
      first_name: firstName,
      last_name: lastName,
      password: "TestPassword123!",
      skip_password_checks: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to create test user: ${JSON.stringify(err)}`);
  }
  const user = await res.json();
  return { id: user.id, email };
}

/** Delete a Clerk test user */
export async function deleteTestUser(userId: string): Promise<void> {
  await fetch(`${CLERK_API}/users/${userId}`, {
    method: "DELETE",
    headers: clerkHeaders,
  });
}

/** Create a session token for a test user (via Clerk Backend API) */
export async function createSessionToken(userId: string): Promise<string> {
  // In test mode, we can create a session directly
  const testToken = await getTestingToken();
  // Use the testing token as a Bearer token with __clerk_testing_token cookie
  return testToken;
}

/** Make an authenticated API request to ClawHealth */
export async function apiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
  } = {}
) {
  const { method = "GET", body, token } = options;
  const testingToken = token || (await getTestingToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `__clerk_db_jwt=${testingToken}`,
    Authorization: `Bearer ${testingToken}`,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });

  return {
    status: res.status,
    ok: res.ok,
    data: res.headers.get("content-type")?.includes("json")
      ? await res.json()
      : await res.text(),
    headers: res.headers,
  };
}

/** Directly create a physician in the DB via Prisma (bypasses API for test setup) */
export async function createTestPhysicianDirect(): Promise<string> {
  // We'll use a direct DB call via a test API endpoint
  // For now, use the setup script approach
  const testUser = await createTestUser(
    `physician+${Date.now()}@clawhealth-test.com`,
    "Test",
    "Physician"
  );

  return testUser.id;
}

export { BASE_URL, CLERK_SECRET, CLERK_API, clerkHeaders };
