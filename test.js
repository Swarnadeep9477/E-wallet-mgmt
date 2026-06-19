// Test script for E-wallet backend API
// This script performs a basic end-to-end flow:
// 1. Request OTP for email and phone
// 2. Verify the OTPs (using dev_otp returned for testing)
// 3. Sign up a new user
// 4. Log in as the user
// 5. Retrieve session info and user profile
// No changes are made to existing project code.

const base = 'http://localhost:3000';

async function requestOtp(channel, target) {
  const res = await fetch(`${base}/api/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, target, purpose: 'signup' })
  });
  const data = await res.json();
  console.log(`OTP ${channel} send:`, data);
  return data.dev_otp;
}

async function verifyOtp(channel, target, code) {
  const res = await fetch(`${base}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, target, code, purpose: 'signup' })
  });
  const data = await res.json();
  console.log(`OTP ${channel} verify:`, data);
  return data.ok;
}

async function signupUser(user) {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  const data = await res.json();
  console.log('Signup response:', data);
  return data;
}

async function loginUser(email, password) {
  const res = await fetch(`${base}/api/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';
  console.log('Login response:', data);
  console.log('Extracted token:', token);
  return { data, token };
}

async function getSession(token) {
  const res = await fetch(`${base}/api/session`, {
    method: 'GET',
    headers: { Cookie: `token=${token}` }
  });
  const data = await res.json();
  console.log('Session info:', data);
  return data;
}

async function getProfile(token) {
  const res = await fetch(`${base}/api/me`, {
    method: 'GET',
    headers: { Cookie: `token=${token}` }
  });
  const data = await res.json();
  console.log('User profile:', data);
  return data;
}

async function main() {
  try {
    const email = 'test@example.com';
    const phone = '9876543210';
    // 1. Request OTPs
    const emailOtp = await requestOtp('email', email);
    const phoneOtp = await requestOtp('phone', phone);
    // 2. Verify OTPs
    await verifyOtp('email', email, emailOtp);
    await verifyOtp('phone', phone, phoneOtp);
    // 3. Sign up user
    const user = {
      name: 'Test User',
      email,
      phone,
      password: 'TestPass123',
      transactionPin: '1234',
      bankAccountNo: '1234567890',
      bankName: 'Test Bank',
      address: '123 Test St',
      dob: '1990-01-01',
      gender: 'M',
      upiHandle: '@ybl'
    };
    await signupUser(user);
    // 4. Login user
    const { token } = await loginUser(email, user.password);
    if (!token) {
      console.error('Failed to obtain auth token.');
      return;
    }
    // 5. Get session and profile
    await getSession(token);
    await getProfile(token);
  } catch (err) {
    console.error('Error during test flow:', err);
  }
}

main();
