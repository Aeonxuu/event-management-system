const baseUrl = process.env.APP_URL || "http://localhost:3000";
const password = process.env.DEMO_PASSWORD || "demo123";

const users = {
  admin: "admin@school.demo",
  student: "student.leader@school.demo",
  adviser: "adviser@school.demo",
  dean: "dean@school.demo",
  facilities: "facilities@school.demo",
  osa: "osa@school.demo",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || "Invalid JSON response" };
  }
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseJson(response);
  assert(response.ok && payload.success, `Login failed for ${email}: ${payload.error || response.status}`);

  const setCookie = response.headers.get("set-cookie");
  assert(setCookie, `No auth cookie returned for ${email}`);

  return setCookie.split(";")[0];
}

async function api(path, options = {}, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  const payload = await parseJson(response);
  if (!response.ok || payload.success === false) {
    throw new Error(`API ${path} failed: ${payload.error || response.status}`);
  }

  return payload;
}

async function ensureVenue(adminCookie) {
  const list = await api("/api/venues", { method: "GET" }, adminCookie);
  if (Array.isArray(list.data) && list.data.length > 0) {
    return list.data[0];
  }

  const created = await api(
    "/api/venues",
    {
      method: "POST",
      body: JSON.stringify({
        name: `Main Hall ${randomSuffix()}`,
        location: "Campus A",
        capacity: 500,
        notes: "Auto-created by smoke test",
      }),
    },
    adminCookie,
  );

  return created.data;
}

async function main() {
  console.log(`Running smoke workflow against ${baseUrl}`);

  const adminCookie = await login(users.admin);
  const venue = await ensureVenue(adminCookie);
  console.log(`Using venue: ${venue.name}`);

  const studentCookie = await login(users.student);
  const now = Date.now();
  const dayOffset = Math.floor(Math.random() * 45) + 1;
  const startAt = new Date(now + 1000 * 60 * 60 * 24 * dayOffset).toISOString();
  const endAt = new Date(now + 1000 * 60 * 60 * (24 * dayOffset + 2)).toISOString();

  const created = await api(
    "/api/events",
    {
      method: "POST",
      body: JSON.stringify({
        title: `Smoke Event ${randomSuffix()}`,
        description: "Automated smoke-test proposal",
        venueId: venue._id,
        startAt,
        endAt,
        budget: 2500,
        expectedAttendees: 120,
      }),
    },
    studentCookie,
  );

  const eventId = created.data?._id;
  assert(eventId, "Event ID missing after create");
  console.log(`Created event: ${eventId}`);

  await api(`/api/events/${eventId}/submit`, { method: "POST" }, studentCookie);
  console.log("Submitted event to adviser queue");

  const approverSequence = [
    { key: "adviser", expected: "PENDING_DEAN" },
    { key: "dean", expected: "PENDING_FACILITIES" },
    { key: "facilities", expected: "PENDING_OSA" },
    { key: "osa", expected: "APPROVED" },
  ];

  for (const approver of approverSequence) {
    const cookie = await login(users[approver.key]);
    await api(`/api/events/${eventId}/approve`, { method: "POST" }, cookie);

    const detail = await api(`/api/events/${eventId}`, { method: "GET" }, cookie);
    const status = detail.data?.event?.status;
    assert(status === approver.expected, `${approver.key} approval expected ${approver.expected} but got ${status}`);
    console.log(`${approver.key} approved -> ${status}`);
  }

  const adminArchive = await api("/api/admin/events?page=1&limit=25", { method: "GET" }, adminCookie);
  const found = adminArchive.data?.find?.((row) => row._id === eventId);
  assert(found, "Final event not found in admin archive");
  assert(found.status === "APPROVED", `Expected APPROVED in admin archive, got ${found.status}`);

  console.log("Smoke workflow passed");
}

main().catch((error) => {
  console.error("Smoke workflow failed:", error.message);
  process.exit(1);
});
