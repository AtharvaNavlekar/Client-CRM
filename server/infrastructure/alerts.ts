import { logger } from './logger';
import { metricsRegistry } from './metrics';

const lastAlertTimestamps = new Map<string, number>();

export function emitRateLimitAlert(
  alertType: string,
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL',
  description: string,
  context: Record<string, any> = {},
  debounceMs = 60_000
) {
  const now = Date.now();
  const last = lastAlertTimestamps.get(alertType) || 0;
  if (now - last < debounceMs) {
    return;
  }
  lastAlertTimestamps.set(alertType, now);

  const payload = {
    alertType,
    severity,
    description,
    ...context
  };

  if (severity === 'CRITICAL' || severity === 'HIGH') {
    logger.error(`[ALERT] ${alertType}`, null, payload);
  } else {
    logger.warn(`[ALERT] ${alertType}`, payload);
  }
}

export function evaluateAlerts() {
  const metrics = metricsRegistry.metrics();

  const getMetricValue = (metricName: string, labelPattern?: RegExp) => {
    const regex = new RegExp(`^${metricName}(\\{.*\\})?\\s+([0-9.]+)$`, 'gm');
    let sum = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(metrics)) !== null) {
      const labels = match[1] || '';
      if (!labelPattern || labelPattern.test(labels)) {
        sum += parseFloat(match[2]);
      }
    }
    return sum;
  };

  const aiErrors = getMetricValue('ai_errors_total');
  if (aiErrors > 10) {
    logger.error('[ALERT] HIGH_AI_ERROR_RATE', null, {
      alertType: 'AI_PROVIDER_ERROR',
      severity: 'HIGH',
      description: 'Sustained AI provider errors detected (>10 errors).'
    });
  }

  const authFailures = getMetricValue('auth_failures_total');
  if (authFailures > 50) {
    logger.warn('[ALERT] HIGH_AUTH_FAILURES', {
      alertType: 'AUTHENTICATION_SPIKE',
      severity: 'MEDIUM',
      description: 'Abnormal number of authentication failures detected.'
    });
  }

  const jobFailures = getMetricValue('job_failed_total');
  if (jobFailures > 20) {
    logger.error('[ALERT] HIGH_JOB_FAILURE_RATE', null, {
      alertType: 'WORKER_FAILURES',
      severity: 'HIGH',
      description: 'Background worker experiencing high failure rate.'
    });
  }

  const dbConnectionErrors = getMetricValue('db_connection_errors_total');
  if (dbConnectionErrors > 5) {
    logger.fatal('[ALERT] DATABASE_CONNECTION_EXHAUSTION', null, {
      alertType: 'DATABASE_ERROR',
      severity: 'CRITICAL',
      description: 'Database connection errors detected.'
    });
  }

  const rateLimitStoreErrors = getMetricValue('rate_limit_store_errors_total');
  if (rateLimitStoreErrors > 0) {
    emitRateLimitAlert(
      'RATE_LIMIT_STORE_UNAVAILABLE',
      'HIGH',
      'Redis rate-limiting store errors detected.',
      { totalErrors: rateLimitStoreErrors }
    );
  }

  const rateLimitFallbacks = getMetricValue('rate_limit_fallback_total');
  if (rateLimitFallbacks > 0) {
    emitRateLimitAlert(
      'RATE_LIMIT_FALLBACK_ACTIVE',
      'HIGH',
      'Rate limiter operating in fallback/fail-open mode.',
      { totalFallbacks: rateLimitFallbacks }
    );
  }

  const authRateLimitBlocked = getMetricValue(
    'rate_limit_exceeded_total',
    /policy="(login_ip_request|login_ip_failed|login_account_failed|session_refresh)"/
  );
  if (authRateLimitBlocked > 20) {
    emitRateLimitAlert(
      'AUTH_RATE_LIMIT_SPIKE',
      'MEDIUM',
      'Elevated volume of blocked authentication/refresh attempts.',
      { totalBlocked: authRateLimitBlocked }
    );
  }

  const expensiveRouteBlocked = getMetricValue(
    'rate_limit_exceeded_total',
    /policy="(ai_transcription|lead_export|lead_import|bulk_update)"/
  );
  if (expensiveRouteBlocked > 10) {
    emitRateLimitAlert(
      'HIGH_COST_ENDPOINT_ABUSE',
      'HIGH',
      'Elevated rate-limit blocks on expensive AI/import/export endpoints.',
      { totalBlocked: expensiveRouteBlocked }
    );
  }
}

// In production, run the evaluator every 60 seconds
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ALERTS === 'true') {
  const timer = setInterval(evaluateAlerts, 60000);
  timer.unref?.();
}

