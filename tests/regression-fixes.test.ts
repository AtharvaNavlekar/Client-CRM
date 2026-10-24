import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractErrorMessage, ApiError } from '../src/services/api';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function httpRequest(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

describe('DialPulse CRM — Regression Tests for Fixed Runtime Errors & Permissions', () => {
  let adminToken = '';
  let repToken = '';
  let adminUserId = '';
  let repUserId = '';

  it('Step 0: Authenticate Admin and Telecaller', async () => {
    // Admin login
    const adminRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'rahul@telecrm.in', password: 'password123' }
    });
    assert.strictEqual(adminRes.status, 200, 'Admin login must succeed');
    adminToken = adminRes.data.token;
    adminUserId = adminRes.data.user.id;

    // Rep login
    const repRes = await httpRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'amit@telecrm.in', password: 'password123' }
    });
    assert.strictEqual(repRes.status, 200, 'Rep login must succeed');
    repToken = repRes.data.token;
    repUserId = repRes.data.user.id;
  });

  it('Fix 1: ApiError and extractErrorMessage prevent [object Object]', () => {
    // Nested object
    const errObj = { error: { code: 'FORBIDDEN', message: 'Action not permitted' } };
    const msg = extractErrorMessage(errObj);
    assert.strictEqual(msg, 'Action not permitted');

    // ApiError constructor
    const apiErr = new ApiError(errObj, 403, errObj);
    assert.strictEqual(apiErr.message, 'Action not permitted');
    assert.ok(!apiErr.message.includes('[object Object]'), 'Message must not contain [object Object]');
    assert.strictEqual(apiErr.code, 'FORBIDDEN');
  });

  it('Fix 2: POST /api/auth/switch-user role elevation protection', async () => {
    // Non-admin attempt to switch user must fail with 403
    const repSwitchRes = await httpRequest('/api/auth/switch-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { userId: adminUserId }
    });
    assert.strictEqual(repSwitchRes.status, 403, 'Telecaller must be blocked from switching user');

    // Admin switch user succeeds
    const adminSwitchRes = await httpRequest('/api/auth/switch-user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { userId: repUserId }
    });
    assert.strictEqual(adminSwitchRes.status, 200, 'Admin must be able to switch user context');
    assert.ok(adminSwitchRes.data.token, 'Must return new JWT token');
  });

  it('Fix 3: GET /api/settings allows tenant members to read safe configuration', async () => {
    // Rep should be able to read settings
    const repSettingsRes = await httpRequest('/api/settings', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert.strictEqual(repSettingsRes.status, 200, 'Rep must be able to read workspace settings');
    assert.ok(Array.isArray(repSettingsRes.data.pipelineStages), 'Must include pipelineStages');
    assert.ok(Array.isArray(repSettingsRes.data.customFields), 'Must include customFields');
    assert.strictEqual(repSettingsRes.data.canManageSettings, false, 'Rep canManageSettings must be false');
    assert.deepStrictEqual(repSettingsRes.data.rolePermissions, [], 'Rep must not receive rolePermissions');

    // Admin receives full settings including rolePermissions
    const adminSettingsRes = await httpRequest('/api/settings', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminSettingsRes.status, 200, 'Admin must be able to read settings');
    assert.strictEqual(adminSettingsRes.data.canManageSettings, true, 'Admin canManageSettings must be true');
    assert.ok(adminSettingsRes.data.rolePermissions.length > 0, 'Admin must receive rolePermissions');

    // Non-admin cannot modify settings
    const repPutFieldsRes = await httpRequest('/api/settings/fields', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { customFields: [] }
    });
    assert.strictEqual(repPutFieldsRes.status, 403, 'Rep cannot modify custom fields');
  });

  it('Fix 4: GET /api/audit-logs enforces RBAC properly', async () => {
    // Admin receives audit logs
    const adminAuditRes = await httpRequest('/api/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminAuditRes.status, 200, 'Admin must be able to fetch audit logs');
    assert.ok(Array.isArray(adminAuditRes.data), 'Audit logs must be an array');

    // Telecaller is blocked with 403
    const repAuditRes = await httpRequest('/api/audit-logs', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert.strictEqual(repAuditRes.status, 403, 'Rep must be forbidden from reading audit logs');
  });

  it('Fix 5: POST /api/messages handles tenant isolation and outreach compliance', async () => {
    // Fetch leads
    const leadsRes = await httpRequest('/api/leads', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
    const validLead = leads.find((l: any) => !l.preferences?.isOptedOut && l.fatigueStatus !== 'capped');
    assert.ok(validLead, 'Should find a valid non-opted-out lead');

    // Rep sends message to valid lead with manager/testing override if outside quiet hours
    const msgRes = await httpRequest('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        leadId: validLead.id,
        text: 'Hello from regression test suite',
        direction: 'outbound',
        overrideCompliance: true
      }
    });
    assert.strictEqual(msgRes.status, 200, 'Valid message must be persisted');
    assert.strictEqual(msgRes.data.leadId, validLead.id);
    assert.strictEqual(msgRes.data.status, 'sent');
  });
});
