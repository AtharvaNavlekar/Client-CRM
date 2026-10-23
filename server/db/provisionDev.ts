import bcryptjs from 'bcryptjs';
import { db } from './client';
import * as schema from './schema';
import {
  INITIAL_TENANTS,
  TEAMS,
  INITIAL_USERS,
  INITIAL_LEADS
} from '../seed/development';
import { DEFAULT_ROLE_PERMISSIONS } from '../seed/defaultRolePermissions';

/**
 * Idempotent development-only database provisioner.
 * Guarantees that tenants, teams, permissions, and demo users (Rahul, Priya, Amit, Karan)
 * exist in PostgreSQL for local development and testing.
 *
 * STRICT SAFETY RULE:
 * This provisioner is completely disabled in production environments.
 */
export async function provisionDevelopmentData(): Promise<void> {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const devFlag = process.env.ENABLE_DEV_PROVISIONING === 'true';

  if (!isDev && !devFlag) {
    console.log('[PROVISION] Skipped: Development provisioning is disabled in non-development environments.');
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('[PROVISION CRITICAL ERROR] Refusing to run development provisioning in production mode!');
    return;
  }

  console.log('[PROVISION] Running idempotent development provisioning into PostgreSQL...');

  // Configurable demo password with 'password123' compatibility for dev
  const demoPassword = process.env.DIALPULSE_DEV_DEMO_PASSWORD || 'password123';
  const demoPasswordHash = bcryptjs.hashSync(demoPassword, 10);

  // 1. Provision Tenants (Conflict-safe on ID)
  for (const tenant of INITIAL_TENANTS) {
    await db.insert(schema.tenants).values({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      createdAt: tenant.createdAt || new Date().toISOString(),
      tier: tenant.tier,
      primaryContactName: tenant.primaryContactName,
      primaryContactEmail: tenant.primaryContactEmail,
      leadCap: tenant.leadCap,
      userCap: tenant.userCap,
      timezone: tenant.timezone || 'Asia/Kolkata'
    }).onConflictDoUpdate({
      target: schema.tenants.id,
      set: {
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        tier: tenant.tier,
        primaryContactName: tenant.primaryContactName,
        primaryContactEmail: tenant.primaryContactEmail
      }
    });
  }

  // 2. Provision Teams (Conflict-safe on ID)
  for (const team of TEAMS) {
    await db.insert(schema.teams).values({
      id: team.id,
      name: team.name,
      location: team.location,
      tenantId: team.tenantId
    }).onConflictDoUpdate({
      target: schema.teams.id,
      set: {
        name: team.name,
        location: team.location,
        tenantId: team.tenantId
      }
    });
  }

  // 3. Provision Role Permissions (Conflict-safe on role)
  for (const perm of DEFAULT_ROLE_PERMISSIONS) {
    await db.insert(schema.rolePermissions).values({
      role: perm.role,
      scope: perm.scope,
      actions: perm.actions,
      requiresApproval: perm.requiresApproval || [],
      canViewAllLeads: perm.canViewAllLeads ?? false,
      canExportData: perm.canExportData ?? false,
      canManageTemplates: perm.canManageTemplates ?? false
    }).onConflictDoUpdate({
      target: schema.rolePermissions.role,
      set: {
        scope: perm.scope,
        actions: perm.actions,
        requiresApproval: perm.requiresApproval || [],
        canViewAllLeads: perm.canViewAllLeads ?? false,
        canExportData: perm.canExportData ?? false,
        canManageTemplates: perm.canManageTemplates ?? false
      }
    });
  }

  // 4. Provision Demo Users (Conflict-safe on ID)
  for (const u of INITIAL_USERS) {
    await db.insert(schema.users).values({
      id: u.id,
      tenantId: u.tenantId || null,
      name: u.name,
      email: u.email.trim().toLowerCase(),
      role: u.role,
      isPlatformStaff: u.isPlatformStaff ?? false,
      passwordHash: demoPasswordHash,
      avatar: u.avatar || null,
      title: u.title || null,
      phone: u.phone || null,
      teamId: u.teamId || null,
      managesTeamIds: u.managesTeamIds || null
    }).onConflictDoUpdate({
      target: schema.users.id,
      set: {
        name: u.name,
        email: u.email.trim().toLowerCase(),
        role: u.role,
        tenantId: u.tenantId || null,
        isPlatformStaff: u.isPlatformStaff ?? false,
        passwordHash: demoPasswordHash,
        avatar: u.avatar || null,
        title: u.title || null,
        phone: u.phone || null,
        teamId: u.teamId || null,
        managesTeamIds: u.managesTeamIds || null
      }
    });
  }

  // 5. Provision Sample Leads if empty
  const existingLeads = await db.select({ id: schema.leads.id }).from(schema.leads).limit(1);
  if (existingLeads.length === 0 && INITIAL_LEADS.length > 0) {
    for (const lead of INITIAL_LEADS) {
      await db.insert(schema.leads).values({
        id: lead.id,
        tenantId: lead.tenantId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        stage: lead.stage,
        source: lead.source,
        assignedRepId: lead.assignedRepId || 'usr-3',
        assignedRepName: lead.assignedRepName || null,
        teamId: lead.teamId || null,
        createdDate: (lead as any).createdDate || new Date().toISOString(),
        lastContactDate: (lead as any).lastContactDate || new Date().toISOString(),
        notes: lead.notes || '',
        industry: (lead as any).industry || null,
        value: (lead as any).value || 0,
        customFields: (lead as any).customFields || {}
      }).onConflictDoNothing();
    }
  }

  console.log('[PROVISION] Development demo accounts provisioned successfully.');
}
