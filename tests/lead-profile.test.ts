import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function loginUser(email: string, password = 'password123') {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    throw new Error(`Failed to log in as ${email}: ${res.status}`);
  }
  const data = await res.json();
  return { token: data.token, user: data.user };
}

describe('DialPulse CRM — Lead Profile & Activity Scoping Tests', () => {
  let adminToken = '';
  let repToken = '';
  let testLeadId = '';
  let initialVersion = 1;

  it('Step 0: Authenticate Admin and Rep sessions', async () => {
    const adminAuth = await loginUser('rahul@telecrm.in');
    adminToken = adminAuth.token;
    assert.ok(adminToken, 'Admin token received');

    const repAuth = await loginUser('amit@telecrm.in');
    repToken = repAuth.token;
    assert.ok(repToken, 'Rep token received');
    console.log('[PASS] Admin and Rep authenticated with real sessions');
  });

  it('Step 1: Fetch leads and identify target lead record', async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(res.status, 200, 'Expected 200 OK for leads list');
    const leads = await res.json();
    assert.ok(Array.isArray(leads), 'Expected leads array');
    assert.ok(leads.length > 0, 'Expected at least one lead in database');

    testLeadId = leads[0].id;
    initialVersion = leads[0].version || 1;
    console.log(`[PASS] Found target lead: ${testLeadId} (name: ${leads[0].name}, version: ${initialVersion})`);
  });

  it('Step 2: GET /api/leads/:id returns full lead profile details', async () => {
    assert.ok(testLeadId, 'Test lead ID must be defined');
    const res = await fetch(`${BASE_URL}/api/leads/${testLeadId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assert.strictEqual(res.status, 200, 'Expected 200 OK for lead detail');
    const lead = await res.json();
    assert.strictEqual(lead.id, testLeadId);
    assert.ok(lead.name, 'Lead name should exist');
    assert.ok(lead.phone, 'Lead phone should exist');
    assert.ok(lead.stage, 'Lead stage should exist');
    console.log(`[PASS] Lead profile fetched: ${lead.name}, Stage: ${lead.stage}, Value: ${lead.value}`);
  });

  it('Step 3: Update lead notes, stage, and callback reminder via PUT /api/leads/:id', async () => {
    assert.ok(testLeadId, 'Test lead ID must be defined');
    const reminderDate = new Date(Date.now() + 86400000).toISOString();
    const updatedNotes = `Client interested in enterprise telecalling package. Verified at ${new Date().toISOString()}`;

    const res = await fetch(`${BASE_URL}/api/leads/${testLeadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        notes: updatedNotes,
        stage: 'Follow-up',
        callbackReminder: reminderDate,
        version: initialVersion,
        updatedAt: new Date().toISOString()
      })
    });

    assert.strictEqual(res.status, 200, 'Expected 200 OK for lead update');
    const updated = await res.json();
    assert.strictEqual(updated.stage, 'Follow-up');
    assert.strictEqual(updated.notes, updatedNotes);
    assert.strictEqual(updated.version, initialVersion + 1);
    console.log(`[PASS] Lead successfully updated: stage=${updated.stage}, version=${updated.version}`);
  });

  it('Step 4: Enforce optimistic concurrency conflict (409) when version is stale', async () => {
    assert.ok(testLeadId, 'Test lead ID must be defined');
    const res = await fetch(`${BASE_URL}/api/leads/${testLeadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        notes: 'Outdated concurrent write attempt',
        version: initialVersion, // Stale version! (should be initialVersion + 1 now)
        updatedAt: new Date().toISOString()
      })
    });

    assert.strictEqual(res.status, 409, 'Expected 409 Conflict for stale version');
    const errorBody = await res.json();
    assert.strictEqual(errorBody.code, 'CONCURRENCY_CONFLICT');
    console.log('[PASS] Optimistic concurrency protected against concurrent overwrite (HTTP 409)');
  });

  it('Step 5: GET /api/calls and /api/messages with leadId are strictly scoped', async () => {
    assert.ok(testLeadId, 'Test lead ID must be defined');
    const [callsRes, msgRes] = await Promise.all([
      fetch(`${BASE_URL}/api/calls?leadId=${testLeadId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }),
      fetch(`${BASE_URL}/api/messages?leadId=${testLeadId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    ]);

    assert.strictEqual(callsRes.status, 200);
    assert.strictEqual(msgRes.status, 200);

    const calls = await callsRes.json();
    const messages = await msgRes.json();

    assert.ok(Array.isArray(calls));
    assert.ok(Array.isArray(messages));

    // Ensure all returned calls and messages belong to this lead
    for (const c of calls) {
      assert.strictEqual(c.leadId, testLeadId, `Call ${c.id} must match requested leadId`);
    }
    for (const m of messages) {
      assert.strictEqual(m.leadId, testLeadId, `Message ${m.id} must match requested leadId`);
    }

    console.log(`[PASS] Scoped activity verification: ${calls.length} calls and ${messages.length} messages scoped to ${testLeadId}`);
  });
});
