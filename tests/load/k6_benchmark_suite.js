import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://frontend:80';

export const options = {
  stages: [
    { duration: '10s', target: 15 },
    { duration: '20s', target: 40 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Alert if > 5% requests fail
  },
};

const commonHeaders = {
  'Host': 'localhost',
};

export function setup() {
  // 1. Healthcheck verification
  const healthRes = http.get(`${BASE_URL}/healthz`, {
    headers: commonHeaders,
  });
  check(healthRes, {
    'healthz status 200': (r) => r.status === 200,
  });

  // 2. Register unique benchmark user
  const timestamp = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  const email = `bench_${timestamp}_${rand}@rezekify.id`;
  const password = 'SecurePassword123!';

  const regPayload = JSON.stringify({
    email: email,
    password: password,
    full_name: `Benchmark User ${rand}`,
  });
  const regHeaders = {
    ...commonHeaders,
    'Content-Type': 'application/json',
  };
  const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, regPayload, {
    headers: regHeaders,
  });

  check(regRes, {
    'register status 200': (r) => r.status === 200,
  });

  const regData = regRes.json();
  const token = regData.access_token;

  // 3. Create holding account BCA (balance 10,000,000)
  const accPayload = JSON.stringify({
    name: 'BCA',
    account_type: 'BANK',
    initial_balance: 10000000,
  });
  const authHeaders = {
    ...commonHeaders,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const accRes = http.post(`${BASE_URL}/api/v1/accounts`, accPayload, {
    headers: authHeaders,
  });

  check(accRes, {
    'account created 200': (r) => r.status === 200,
  });

  const accData = accRes.json();
  const account_id = accData.id;

  return { token: token, account_id: account_id };
}

export default function (data) {
  const authHeaders = {
    ...commonHeaders,
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // 1. GET http://frontend:80/api/v1/dashboard/summary (Read telemetry)
  const summaryRes = http.get(`${BASE_URL}/api/v1/dashboard/summary`, {
    headers: authHeaders,
  });
  check(summaryRes, {
    'summary status 200': (r) => r.status === 200,
  });

  // 2. POST http://frontend:80/api/v1/transactions (Write ACID ledger transaction: 25000 Rp expense)
  const txPayload = JSON.stringify({
    transaction_type: 'EXPENSE',
    amount: 25000,
    description: 'Benchmark coffee expense',
    account_id: data.account_id,
  });
  const txRes = http.post(`${BASE_URL}/api/v1/transactions`, txPayload, {
    headers: authHeaders,
  });
  check(txRes, {
    'transaction status 200': (r) => r.status === 200,
  });

  // 3. POST http://frontend:80/api/v1/dashboard/simulate-purchase (Deterministic simulation)
  const simPayload = JSON.stringify({
    planned_amount: 50000,
  });
  const simRes = http.post(`${BASE_URL}/api/v1/dashboard/simulate-purchase`, simPayload, {
    headers: authHeaders,
  });
  check(simRes, {
    'simulate-purchase status 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
