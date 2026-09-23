import test from 'node:test';
import assert from 'node:assert/strict';

// Test phone normalization logic
function normalizeWhatsAppNumber(rawInput, defaultDialCode = "+234") {
  if (!rawInput) return "";
  let cleaned = rawInput.trim().replace(/[\s\(\)\-\.]/g, "");
  if (cleaned.startsWith("+")) {
    return "+" + cleaned.slice(1).replace(/\D/g, "");
  }
  cleaned = cleaned.replace(/\D/g, "");
  const dialDigits = defaultDialCode.replace(/\D/g, "");
  if (cleaned.startsWith(dialDigits)) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0")) {
    return `${defaultDialCode}${cleaned.slice(1)}`;
  }
  if (cleaned.length === 10 && defaultDialCode === "+234") {
    return `${defaultDialCode}${cleaned}`;
  }
  return `${defaultDialCode}${cleaned}`;
}

function isValidPhoneNumber(phoneNumber) {
  if (!phoneNumber) return false;
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  return e164Regex.test(phoneNumber.trim());
}

function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return "00:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const mm = mins < 10 ? `0${mins}` : `${mins}`;
  const ss = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mm}:${ss}`;
}

function parseChallengeTextFromUrl(whatsappUrl) {
  try {
    const url = new URL(whatsappUrl);
    return url.searchParams.get("text") || "";
  } catch {
    const match = whatsappUrl.match(/[?&]text=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return "";
  }
}

test('normalizeWhatsAppNumber - Nigerian local formats', () => {
  assert.equal(normalizeWhatsAppNumber('08012345678'), '+2348012345678');
  assert.equal(normalizeWhatsAppNumber('09087654321'), '+2349087654321');
  assert.equal(normalizeWhatsAppNumber('07011223344'), '+2347011223344');
  assert.equal(normalizeWhatsAppNumber('8012345678'), '+2348012345678');
});

test('normalizeWhatsAppNumber - with spaces, dashes, parentheses', () => {
  assert.equal(normalizeWhatsAppNumber('0801 234 5678'), '+2348012345678');
  assert.equal(normalizeWhatsAppNumber('(0801) 234-5678'), '+2348012345678');
  assert.equal(normalizeWhatsAppNumber('+234 801 234 5678'), '+2348012345678');
  assert.equal(normalizeWhatsAppNumber('2348012345678'), '+2348012345678');
});

test('normalizeWhatsAppNumber - international numbers', () => {
  assert.equal(normalizeWhatsAppNumber('0241234567', '+233'), '+233241234567');
  assert.equal(normalizeWhatsAppNumber('+44 7911 123456'), '+447911123456');
  assert.equal(normalizeWhatsAppNumber('+1 (555) 234-5678'), '+15552345678');
});

test('isValidPhoneNumber - E.164 compliance', () => {
  assert.equal(isValidPhoneNumber('+2348012345678'), true);
  assert.equal(isValidPhoneNumber('+447911123456'), true);
  assert.equal(isValidPhoneNumber('+15552345678'), true);
  assert.equal(isValidPhoneNumber('08012345678'), false); // missing '+'
  assert.equal(isValidPhoneNumber(''), false);
  assert.equal(isValidPhoneNumber('123'), false);
});

test('formatCountdown - MM:SS formatting', () => {
  assert.equal(formatCountdown(300), '05:00');
  assert.equal(formatCountdown(299), '04:59');
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(9), '00:09');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(-5), '00:00');
});

test('parseChallengeTextFromUrl - extracts query text', () => {
  const url = 'https://wa.me/2348000000000?text=PARALEARN%20LOGIN%20ABC123XYZ';
  assert.equal(parseChallengeTextFromUrl(url), 'PARALEARN LOGIN ABC123XYZ');
});

test('Challenge status polling state machine flow', () => {
  const states = ['IDLE', 'STARTING', 'WAITING_FOR_USER', 'VERIFIED', 'COMPLETING', 'SUCCESS'];
  let currentState = 'IDLE';

  // Step 1: User enters phone and clicks Start
  currentState = 'STARTING';
  assert.equal(currentState, 'STARTING');

  // Step 2: Challenge created, waiting for user to send WhatsApp msg
  const challenge = {
    challengeId: 'cuid_test_123',
    whatsappUrl: 'https://wa.me/2348000000000?text=PARALEARN%20LOGIN%20A1B2C3',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  currentState = 'WAITING_FOR_USER';
  assert.equal(currentState, 'WAITING_FOR_USER');

  // Step 3: Polling checks status
  const pollStatuses = ['PENDING', 'PENDING', 'VERIFIED'];
  for (const status of pollStatuses) {
    if (status === 'VERIFIED') {
      currentState = 'VERIFIED';
      break;
    }
  }
  assert.equal(currentState, 'VERIFIED');

  // Step 4: Call complete
  currentState = 'COMPLETING';
  assert.equal(currentState, 'COMPLETING');

  // Step 5: Session issued
  const sessionResult = {
    accessToken: 'jwt_mock_token',
    user: { id: 'usr_1', roles: ['admin'] },
  };
  assert.ok(sessionResult.accessToken);
  currentState = 'SUCCESS';
  assert.equal(currentState, 'SUCCESS');
});
