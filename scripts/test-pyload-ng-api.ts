/**
 * PyLoad-NG REST API Test Script
 *
 * Tests the new PyLoad-NG API endpoints with HTTP Basic Auth.
 * Run with: npx ts-node scripts/test-pyload-ng-api.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file
function loadEnv(): Record<string, string> {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });

  return env;
}

const env = loadEnv();
const BASE_URL = env.PYLOAD_URL || 'https://pyload.treasurechest.design';
const USERNAME = env.PYLOAD_USERNAME || 'admin';
const PASSWORD = env.PYLOAD_PASSWORD || '';

// Create Basic Auth header
function getBasicAuthHeader(): string {
  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

// Make GET request with Basic Auth
async function apiGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}/api/${endpoint}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`\n[GET] ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': getBasicAuthHeader(),
      'Accept': 'application/json'
    }
  });

  const text = await response.text();
  console.log(`Status: ${response.status} ${response.statusText}`);

  try {
    const data = JSON.parse(text);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch {
    console.log('Raw response:', text);
    return text as unknown as T;
  }
}

// Make POST request with JSON body and Basic Auth
async function apiPost<T>(endpoint: string, body: Record<string, any> = {}): Promise<T> {
  const url = `${BASE_URL}/api/${endpoint}`;

  console.log(`\n[POST] ${url}`);
  console.log('Body:', JSON.stringify(body, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': getBasicAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  console.log(`Status: ${response.status} ${response.statusText}`);

  try {
    const data = JSON.parse(text);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch {
    console.log('Raw response:', text);
    return text as unknown as T;
  }
}

// Test functions
async function testCheckAuth(): Promise<boolean> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: check_auth (authentication validation)');
  console.log('='.repeat(60));

  try {
    const result = await apiGet<object>('check_auth', {
      username: USERNAME,
      password: PASSWORD
    });

    // Returns empty object {} if invalid, populated object if valid
    const isValid = result && Object.keys(result).length > 0;
    console.log(`\nAuth valid: ${isValid}`);
    return isValid;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function testStatusServer(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: status_server (server status)');
  console.log('='.repeat(60));

  try {
    await apiGet<object>('status_server');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testStatusDownloads(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: status_downloads (active downloads)');
  console.log('='.repeat(60));

  try {
    await apiGet<any[]>('status_downloads');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testGetQueueData(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: get_queue_data (queue with packages)');
  console.log('='.repeat(60));

  try {
    await apiGet<any[]>('get_queue_data');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testGetConfigValue(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: get_config_value (speed limit status)');
  console.log('='.repeat(60));

  try {
    await apiGet<any>('get_config_value', {
      category: 'download',
      option: 'limit_speed'
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testAddPackage(): Promise<number | null> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: add_package (add download)');
  console.log('='.repeat(60));

  try {
    const result = await apiPost<number>('add_package', {
      name: 'Test_Package_' + Date.now(),
      links: ['https://example.com/test-file.txt'],
      dest: 1 // QUEUE
    });

    console.log(`\nPackage ID: ${result}`);
    return typeof result === 'number' ? result : null;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

async function testDeleteFiles(fileIds: number[]): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: delete_files');
  console.log('='.repeat(60));

  try {
    await apiPost<void>('delete_files', {
      file_ids: fileIds
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testDeletePackages(packageIds: number[]): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: delete_packages');
  console.log('='.repeat(60));

  try {
    await apiPost<void>('delete_packages', {
      package_ids: packageIds
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testDeleteFinished(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: delete_finished (clear completed)');
  console.log('='.repeat(60));

  try {
    await apiPost<number[]>('delete_finished');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testCheckUrls(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: check_urls');
  console.log('='.repeat(60));

  try {
    await apiPost<object>('check_urls', {
      urls: ['https://example.com/test.txt']
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testSetConfigValue(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: set_config_value (toggle speed limit)');
  console.log('='.repeat(60));

  try {
    await apiPost<void>('set_config_value', {
      category: 'download',
      option: 'limit_speed',
      value: false
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testIsCaptchaWaiting(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: is_captcha_waiting');
  console.log('='.repeat(60));

  try {
    const result = await apiGet<boolean>('is_captcha_waiting');
    console.log(`\nCaptcha waiting: ${result}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testRestartFileWithQueryParam(fileId: number): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: restart_file (POST with query param)');
  console.log('='.repeat(60));

  // This tests that POST with query params works correctly
  const url = `${BASE_URL}/api/restart_file?file_id=${fileId}`;

  console.log(`\n[POST] ${url} (no body)`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': getBasicAuthHeader(),
        'Accept': 'application/json'
      }
    });

    const text = await response.text();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', text || '(empty)');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testStopDownloads(fileIds: number[]): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: stop_downloads');
  console.log('='.repeat(60));

  try {
    await apiPost<void>('stop_downloads', {
      file_ids: fileIds
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testRestartFile(fileId: number): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TEST: restart_file');
  console.log('='.repeat(60));

  try {
    await apiPost<void>('restart_file', undefined);
    // Note: restart_file uses query param, not body
    const url = `${BASE_URL}/api/restart_file?file_id=${fileId}`;
    console.log(`\nActual endpoint should be: POST ${url}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Main test runner
async function main() {
  console.log('PyLoad-NG API Test Script');
  console.log('='.repeat(60));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Auth Header: ${getBasicAuthHeader()}`);

  // Test authentication first
  const authValid = await testCheckAuth();
  if (!authValid) {
    console.error('\n\nAuthentication failed! Check credentials.');
    process.exit(1);
  }

  // Core read operations
  await testStatusServer();
  await testStatusDownloads();
  await testGetQueueData();
  await testGetConfigValue();

  // Test URL checking
  await testCheckUrls();

  // Test config setting
  await testSetConfigValue();

  // Test captcha status
  await testIsCaptchaWaiting();

  // Test adding a package (will create test data)
  const packageId = await testAddPackage();

  // Clean up test package if created
  if (packageId) {
    console.log(`\nCleaning up test package ${packageId}...`);
    await testDeletePackages([packageId]);
  }

  // Test delete finished
  await testDeleteFinished();

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
