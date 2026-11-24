/**
 * backend/Code.gs
 * Google Apps Script web app: emails the PDF exam report to the signed-in user.
 *
 * - The browser sends a Firebase ID token + the PDF. This script checks the token with Firebase,
 *   then mails the PDF ONLY to the email address inside that token (never to an address from the request).
 * - Free: runs on your Google account (consumer Gmail limit: about 100 emails a day for all users together).
 *
 * Script Properties (Project Settings > Script properties):
 *   FIREBASE_API_KEY   required   the apiKey from your Firebase web config
 *   SITE_URL           optional   your site address, e.g. https://mursalfk.github.io/spsc-cce-mock-tests/
 *   SENDER_NAME        optional   name shown as sender (default: Mock Test Practice)
 *
 * Deploy: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 */

var MAX_PDF_BYTES = 3 * 1024 * 1024;
var MAX_BODY_CHARS = 4.5 * 1024 * 1024;
var PER_USER_DAILY = 25;
var TOTAL_Q = 200;
var PASS_MARK = 66;

function doGet() {
  return json_({ ok: true, service: 'Mock test mailer' });
}

/** Run this once from the editor (Run > setup) to grant the permissions. */
function setup() {
  var key = props_().getProperty('FIREBASE_API_KEY');
  Logger.log('FIREBASE_API_KEY set: ' + !!key);
  Logger.log('Email quota left today: ' + MailApp.getRemainingDailyQuota());
  UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/', { muteHttpExceptions: true });
  Logger.log('Permissions granted. Now deploy as a web app.');
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    if (!e || !e.postData || !e.postData.contents) return fail_('Empty request.');
    if (e.postData.contents.length > MAX_BODY_CHARS) return fail_('Request too large.');
    var body;
    try { body = JSON.parse(e.postData.contents); } catch (x) { return fail_('Bad request.'); }

    var user = verifyToken_(body.token);
    if (!user.emailVerified) return fail_('Verify your email address first.');

    var rep = validate_(body);
    if (rep.error) return fail_(rep.error);

    lock.waitLock(20000);
    locked = true;
    if (!takeSlot_(user.uid)) return fail_('Daily report limit reached for this account. Download the PDF instead.');
    if (MailApp.getRemainingDailyQuota() < 1) return fail_('The site’s daily email limit is used up. Download the PDF instead and try emailing tomorrow.');

    send_(user, rep);
    return json_({ ok: true });
  } catch (err) {
    return fail_(String(err && err.message ? err.message : err));
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}

/* ---------- helpers ---------- */

function props_() { return PropertiesService.getScriptProperties(); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(msg) { return json_({ ok: false, error: msg }); }

function verifyToken_(token) {
  if (!token || typeof token !== 'string' || token.length < 100 || token.length > 4096) throw new Error('Please log in again.');
  var key = props_().getProperty('FIREBASE_API_KEY');
  if (!key) throw new Error('The mailer is not configured (FIREBASE_API_KEY missing).');
  var site = props_().getProperty('SITE_URL') || 'https://mursalfk.github.io/spsc-cce-mock-tests/';
  var res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post',
    contentType: 'application/json',
    headers: { Referer: site },
    payload: JSON.stringify({ idToken: token }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Your sign-in could not be verified. Log in again.');
  var data = JSON.parse(res.getContentText());
  var u = data && data.users && data.users[0];
  if (!u || !u.email || !u.localId) throw new Error('Your sign-in could not be verified. Log in again.');
  return { uid: u.localId, email: String(u.email), emailVerified: u.emailVerified === true, name: u.displayName ? String(u.displayName) : '' };
}

function validate_(b) {
  var test = Number(b.test), c = Number(b.c), w = Number(b.w), u = Number(b.u), net = Number(b.net);
  if (!isInt_(test) || test < 1 || test > 99) return { error: 'Invalid test number.' };
  if (!isInt_(c) || !isInt_(w) || !isInt_(u) || c < 0 || w < 0 || u < 0 || c + w + u > TOTAL_Q) return { error: 'Invalid score counts.' };
  if (!isFinite(net) || Math.abs(net - (c - 0.25 * w)) > 0.01) return { error: 'Score does not add up.' };
  var file = String(b.file || '');
  if (!/^[A-Za-z0-9_\-.]{1,80}\.pdf$/.test(file)) return { error: 'Invalid file name.' };
  var b64 = String(b.pdf || '').replace(/\s+/g, '');
  if (!b64 || b64.length > MAX_PDF_BYTES * 1.4 || !/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'Invalid PDF data.' };
  var bytes = Utilities.base64Decode(b64);
  if (bytes.length < 200 || bytes.length > MAX_PDF_BYTES) return { error: 'PDF size not accepted.' };
  if (!(bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70)) return { error: 'That file is not a PDF.' };
  return { test: test, c: c, w: w, u: u, net: net, file: file, bytes: bytes };
}
function isInt_(n) { return isFinite(n) && Math.floor(n) === n; }

/** Per-account daily cap, stored as one small JSON property (today's entries only). */
function takeSlot_(uid) {
  var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var map = {};
  try { map = JSON.parse(props_().getProperty('rate') || '{}'); } catch (x) {}
  var next = {};
  Object.keys(map).forEach(function (k) { if (map[k] && map[k][0] === today) next[k] = map[k]; });
  var n = next[uid] ? next[uid][1] : 0;
  if (n >= PER_USER_DAILY) return false;
  next[uid] = [today, n + 1];
  props_().setProperty('rate', JSON.stringify(next));
  return true;
}

function esc_(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function send_(user, r) {
  var sender = props_().getProperty('SENDER_NAME') || 'Mock Test Practice';
  var site = props_().getProperty('SITE_URL') || '';
  var title = 'Mock Test ' + ('0' + r.test).slice(-2);
  var first = (user.name || user.email.split('@')[0]).split(/\s+/)[0].replace(/[\r\n]/g, '').slice(0, 40);
  var pass = r.net >= PASS_MARK;
  var net = (Math.round(r.net * 100) / 100).toFixed(2);
  var verdict = pass ? 'above the pass mark of ' + PASS_MARK : 'below the pass mark of ' + PASS_MARK + ' (short by ' + (Math.round((PASS_MARK - r.net) * 100) / 100).toFixed(2) + ')';
  var subject = title + ' practice report: ' + net + ' / ' + TOTAL_Q;

  var text = [
    'Hello ' + first + ',',
    '',
    'Thank you for taking ' + title + '. Your detailed report is attached as a PDF.',
    '',
    'Net score: ' + net + ' / ' + TOTAL_Q + ' (' + verdict + ')',
    'Correct: ' + r.c + '   Wrong: ' + r.w + '   Skipped: ' + r.u,
    '',
    'The report shows your section-wise performance, where to focus next, a guess audit, and every wrong or skipped question with the correct answer.',
    'Tip: read the wrong-answer table first, then redo the missed questions as flashcards.',
    '',
    'Keep practising, and good luck.',
    '',
    site ? 'Back to the tests: ' + site : '',
    'This is an automated message; replies are not monitored.',
    'Unofficial practice test. Not affiliated with, endorsed by or connected to the Sindh Public Service Commission.'
  ].join('\n');

  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1c2230;max-width:560px">'
    + '<p>Hello ' + esc_(first) + ',</p>'
    + '<p>Thank you for taking <b>' + esc_(title) + '</b>. Your detailed report is attached as a PDF.</p>'
    + '<table style="border-collapse:collapse;margin:12px 0"><tr><td style="padding:8px 14px;background:#e7eef6;border-radius:8px">'
    + '<div style="font-size:26px;font-weight:bold;color:' + (pass ? '#1b7f4b' : '#b3261e') + '">' + net + ' <span style="font-size:14px;color:#667085">/ ' + TOTAL_Q + '</span></div>'
    + '<div style="color:#667085;font-size:13px">' + esc_(verdict.charAt(0).toUpperCase() + verdict.slice(1)) + '</div></td></tr></table>'
    + '<p>Correct <b>' + r.c + '</b> &middot; Wrong <b>' + r.w + '</b> &middot; Skipped <b>' + r.u + '</b></p>'
    + '<p>The report shows your section-wise performance, where to focus next, a guess audit, and every wrong or skipped question with the correct answer.</p>'
    + '<p><i>Tip: read the wrong-answer table first, then redo the missed questions as flashcards.</i></p>'
    + '<p>Keep practising, and good luck.</p>'
    + (site ? '<p><a href="' + esc_(site) + '">Back to the tests</a></p>' : '')
    + '<p style="color:#98a2b3;font-size:12px">This is an automated message; replies are not monitored.<br>Unofficial practice test. Not affiliated with, endorsed by or connected to the Sindh Public Service Commission.</p></div>';

  MailApp.sendEmail({
    to: user.email,
    subject: subject,
    body: text,
    htmlBody: html,
    name: sender,
    attachments: [Utilities.newBlob(r.bytes, 'application/pdf', r.file)]
  });
}
