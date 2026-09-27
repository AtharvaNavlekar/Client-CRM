import { db } from '../server/db/client';
import * as schema from '../server/db/schema';
import {
  INITIAL_TENANTS,
  TEAMS,
  INITIAL_USERS,
  INITIAL_LEADS,
  INITIAL_CALLS,
  INITIAL_MESSAGES,
  INITIAL_TICKETS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SECURITY_ALERTS,
  INITIAL_BILLING_RECORDS,
  INITIAL_FEATURE_FLAGS
} from '../server/seed/development';
import { DEFAULT_ROLE_PERMISSIONS } from '../server/seed/defaultRolePermissions';
import { DEFAULT_FREQUENCY_RULES } from '../server/db';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Development seeding is strictly prohibited in production mode.');
    process.exit(1);
  }

  console.log('[SEED] Starting development database seeding into PostgreSQL...');

  try {
    await db.transaction(async (tx) => {
      // Clean existing rows
      await tx.delete(schema.ticketReplies);
      await tx.delete(schema.tickets);
      await tx.delete(schema.messages);
      await tx.delete(schema.calls);
      await tx.delete(schema.leads);
      await tx.delete(schema.auditLogs);
      await tx.delete(schema.securityAlerts);
      await tx.delete(schema.impersonationSessions);
      await tx.delete(schema.billingRecords);
      await tx.delete(schema.sessions);
      await tx.delete(schema.users);
      await tx.delete(schema.teams);
      await tx.delete(schema.tenants);
      await tx.delete(schema.featureFlags);
      await tx.delete(schema.customFields);
      await tx.delete(schema.rolePermissions);
      await tx.delete(schema.pipelineStages);
      await tx.delete(schema.complianceRules);

      // 1. Tenants
      if (INITIAL_TENANTS.length > 0) {
        await tx.insert(schema.tenants).values(INITIAL_TENANTS as any);
        console.log(`[SEED] Inserted ${INITIAL_TENANTS.length} tenants`);
      }

      // 2. Teams
      if (TEAMS.length > 0) {
        await tx.insert(schema.teams).values(TEAMS as any);
        console.log(`[SEED] Inserted ${TEAMS.length} teams`);
      }

      // 3. Users
      if (INITIAL_USERS.length > 0) {
        await tx.insert(schema.users).values(INITIAL_USERS as any);
        console.log(`[SEED] Inserted ${INITIAL_USERS.length} users`);
      }

      // 4. Role Permissions
      if (DEFAULT_ROLE_PERMISSIONS.length > 0) {
        await tx.insert(schema.rolePermissions).values(DEFAULT_ROLE_PERMISSIONS as any);
        console.log(`[SEED] Inserted ${DEFAULT_ROLE_PERMISSIONS.length} role permissions`);
      }

      // 5. Compliance Rules
      for (const t of INITIAL_TENANTS) {
        await tx.insert(schema.complianceRules).values({
          id: `cr-${t.id}`,
          tenantId: t.id,
          ...DEFAULT_FREQUENCY_RULES
        } as any);
      }
      console.log(`[SEED] Inserted compliance rules for ${INITIAL_TENANTS.length} tenants`);

      // 6. Leads
      if (INITIAL_LEADS.length > 0) {
        await tx.insert(schema.leads).values(INITIAL_LEADS as any);
        console.log(`[SEED] Inserted ${INITIAL_LEADS.length} leads`);
      }

      // 7. Calls
      if (INITIAL_CALLS.length > 0) {
        await tx.insert(schema.calls).values(INITIAL_CALLS as any);
        console.log(`[SEED] Inserted ${INITIAL_CALLS.length} calls`);
      }

      // 8. Messages
      if (INITIAL_MESSAGES.length > 0) {
        await tx.insert(schema.messages).values(INITIAL_MESSAGES as any);
        console.log(`[SEED] Inserted ${INITIAL_MESSAGES.length} messages`);
      }

      // 9. Tickets
      if (INITIAL_TICKETS.length > 0) {
        const ticketRows: any[] = [];
        const replyRows: any[] = [];
        for (const t of INITIAL_TICKETS) {
          const { replies, ...ticketData } = t as any;
          ticketRows.push(ticketData);
          if (replies && replies.length > 0) {
            for (const r of replies) {
              replyRows.push({ ...r, ticketId: t.id });
            }
          }
        }
        await tx.insert(schema.tickets).values(ticketRows);
        if (replyRows.length > 0) {
          await tx.insert(schema.ticketReplies).values(replyRows);
        }
        console.log(`[SEED] Inserted ${ticketRows.length} tickets and ${replyRows.length} replies`);
      }

      // 10. Audit logs
      if (INITIAL_AUDIT_LOGS.length > 0) {
        await tx.insert(schema.auditLogs).values(INITIAL_AUDIT_LOGS as any);
        console.log(`[SEED] Inserted ${INITIAL_AUDIT_LOGS.length} audit logs`);
      }

      // 11. Security Alerts
      if (INITIAL_SECURITY_ALERTS.length > 0) {
        await tx.insert(schema.securityAlerts).values(INITIAL_SECURITY_ALERTS as any);
        console.log(`[SEED] Inserted ${INITIAL_SECURITY_ALERTS.length} security alerts`);
      }

      // 12. Billing Records
      if (INITIAL_BILLING_RECORDS.length > 0) {
        await tx.insert(schema.billingRecords).values(INITIAL_BILLING_RECORDS as any);
        console.log(`[SEED] Inserted ${INITIAL_BILLING_RECORDS.length} billing records`);
      }

      // 13. Feature Flags
      if (INITIAL_FEATURE_FLAGS.length > 0) {
        await tx.insert(schema.featureFlags).values(INITIAL_FEATURE_FLAGS as any);
        console.log(`[SEED] Inserted ${INITIAL_FEATURE_FLAGS.length} feature flags`);
      }
    });

    console.log('[SEED] Database seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Database seeding failed:', err);
    process.exit(1);
  }
}

seed();
