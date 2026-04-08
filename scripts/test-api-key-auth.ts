/**
 * Test script to verify X-API-Key auth works for pyload-ng REST API.
 * Specifically tests POST endpoints that were failing with CSRF token errors.
 * Run with: npx ts-node scripts/test-api-key-auth.ts
 */

import * as fs from 'fs';
import * as path from 'path';

function loadEnv(): Record<string, string> {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  });
  return env;
}

const env = loadEnv();
const BASE_URL = env.PYLOAD_URL || 'https://pyload.treasurechest.design';
const API_KEY = env.PYLOAD_API_KEY || '';
const USERNAME = env.PYLOAD_USERNAME || '';
const PASSWORD = env.PYLOAD_PASSWORD || '';

console.log(`Server: ${BASE_URL}`);
console.log(`API Key: ${API_KEY ? API_KEY.slice(0, 10) + '...' : '(not set)'}`);
console.log();

async function req(label: string, method: string, endpoint: string, body?: object, headers: Record<string, string> = {}) {
  const url = `${BASE_URL}/api/${endpoint}`;
  console.log(`[${method}] ${url}`);
  if (body) console.log('  Body:', JSON.stringify(body));
  console.log('  Headers:', JSON.stringify(headers));

  const init: RequestInit = {
    method,
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
  };
  if (body) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  const text = await res.text();
  console.log(`  Status: ${res.status}`);
  console.log(`  Response: ${text.slice(0, 200)}`);
  console.log();
  return { status: res.status, text };
}

async function main() {
  // Test 1: GET with Basic Auth (currently working)
  console.log('=== Test 1: GET status_server with Basic Auth ===');
  const basicAuth = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  await req('status_server (basic)', 'GET', 'status_server', undefined, { 'Authorization': basicAuth });

  // Test 2: GET with API Key
  console.log('=== Test 2: GET status_server with X-API-Key ===');
  await req('status_server (apikey)', 'GET', 'status_server', undefined, { 'X-API-Key': API_KEY });

  // Test 3: POST add_package with Basic Auth (currently failing with CSRF error)
  console.log('=== Test 3: POST add_package with Basic Auth (expect CSRF error) ===');
  await req('add_package (basic)', 'POST', 'add_package',
    { name: 'test_csrf_' + Date.now(), links: ['https://example.com/test.txt'], dest: 1 },
    { 'Authorization': basicAuth }
  );

  // Test 4: POST add_package with X-API-Key (should work)
  console.log('=== Test 4: POST add_package with X-API-Key ===');
  const testPkgName = 'test_apikey_' + Date.now();
  const result = await req('add_package (apikey)', 'POST', 'add_package',
    { name: testPkgName, links: ['https://example.com/test.txt'], dest: 1 },
    { 'X-API-Key': API_KEY }
  );

  // Clean up if package was created
  const pkgId = parseInt(result.text);
  if (!isNaN(pkgId) && pkgId > 0) {
    console.log(`=== Cleanup: Deleting test package ${pkgId} ===`);
    await req('delete_packages', 'POST', 'delete_packages',
      { package_ids: [pkgId] },
      { 'X-API-Key': API_KEY }
    );
  }

  // Test 5: GET check_auth with API Key
  console.log('=== Test 5: GET check_auth with X-API-Key ===');
  await req('check_auth (apikey)', 'GET', 'check_auth', undefined, { 'X-API-Key': API_KEY });
}

main().catch(console.error);
