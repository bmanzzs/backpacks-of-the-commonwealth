/**
 * Vault-Tec Citizen Survey: the backend for the field catalog's favourite-backpack poll.
 *
 * Setup (once):
 *   1. Open the survey spreadsheet, then Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file and save.
 *   3. Deploy > New deployment > Select type: Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Deploy, then authorise it. Google warns that the app is unverified because it is your
 *      own script: choose Advanced > Go to (project name).
 *   4. Copy the Web app URL (it ends in /exec) into survey-config.js as `endpoint`.
 *
 * After editing this file later, use Deploy > Manage deployments > Edit > Version: New version,
 * so the /exec URL stays the same.
 *
 * What it stores: one row per browser and survey round on the "Survey Votes" tab (first and
 * last submission time, the round, a random browser ID, and up to five backpack numbers).
 * No names, emails or IP addresses. Submitting again from the same browser replaces that
 * browser's ballot instead of adding a new one.
 *
 * GET  ?survey=<round>             -> current results for that round
 * POST {survey, voter, picks:[n…]} -> store the ballot, then return the updated results
 */

const VOTES_SHEET = 'Survey Votes';
const HEADER = ['First submitted', 'Last updated', 'Survey', 'Voter ID', 'Pick 1', 'Pick 2', 'Pick 3', 'Pick 4', 'Pick 5'];
const MAX_PICKS = 5;           // columns Pick 1-5; ballots may rank fewer
const MAX_BACKPACK = 40;       // highest backpack number accepted (room for new backpacks)
const RESULTS_SECONDS = 120;   // how long results are cached between reads
const BALLOTS_PER_MINUTE = 60; // across all visitors; protects the sheet from floods
const SURVEY_ID = /^[a-z][a-z0-9-]{0,31}$/;
const VOTER_ID = /^v[a-z0-9]{15,39}$/; // starts with a letter so Sheets never turns it into a number

function doGet(e) {
  const survey = String((e && e.parameter && e.parameter.survey) || '');
  if (!SURVEY_ID.test(survey)) return reply_({ ok: false, error: 'bad-survey' });
  return reply_(Object.assign({ ok: true }, results_(survey)));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return reply_({ ok: false, error: 'bad-request' });
  }
  const ballot = ballot_(body);
  if (!ballot) return reply_({ ok: false, error: 'bad-ballot' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return reply_({ ok: false, error: 'busy' });
  let updated = false;
  try {
    if (tooBusy_()) return reply_({ ok: false, error: 'busy' });
    const sheet = votesSheet_();
    const now = new Date();
    const picks = ballot.picks.concat(Array(MAX_PICKS - ballot.picks.length).fill(''));
    const row = findBallot_(sheet, ballot.survey, ballot.voter);
    if (row) {
      sheet.getRange(row, 2, 1, 3 + MAX_PICKS).setValues([[now, ballot.survey, ballot.voter].concat(picks)]);
      updated = true;
    } else {
      sheet.appendRow([now, now, ballot.survey, ballot.voter].concat(picks));
    }
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove(cacheKey_(ballot.survey));
  } finally {
    lock.releaseLock();
  }
  return reply_(Object.assign({ ok: true, updated: updated }, results_(ballot.survey)));
}

// A valid ballot, or null. Picks are distinct whole backpack numbers in ranked order.
function ballot_(body) {
  if (!body || typeof body !== 'object') return null;
  const survey = String(body.survey || '');
  const voter = String(body.voter || '').toLowerCase();
  const picks = Array.isArray(body.picks) ? body.picks.map(Number) : [];
  if (!SURVEY_ID.test(survey) || !VOTER_ID.test(voter)) return null;
  if (picks.length < 1 || picks.length > MAX_PICKS) return null;
  if (picks.some(n => !Number.isInteger(n) || n < 1 || n > MAX_BACKPACK)) return null;
  if (new Set(picks).size !== picks.length) return null;
  return { survey: survey, voter: voter, picks: picks };
}

function results_(survey) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey_(survey));
  if (cached) return JSON.parse(cached);

  const tally = {};
  let ballots = 0;
  let latest = 0;
  const sheet = votesSheet_();
  const rows = sheet.getLastRow() - 1;
  if (rows > 0) {
    sheet.getRange(2, 1, rows, 4 + MAX_PICKS).getValues().forEach(r => {
      if (String(r[2]) !== survey) return;
      const picks = r.slice(4, 4 + MAX_PICKS).map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (!picks.length) return;
      ballots++;
      const at = r[1] instanceof Date ? r[1].getTime() : 0;
      if (at > latest) latest = at;
      picks.forEach((id, rank) => {
        const t = tally[id] || (tally[id] = { id: id, points: 0, first: 0, picks: 0 });
        t.points += MAX_PICKS - rank;
        t.picks += 1;
        if (rank === 0) t.first += 1;
      });
    });
  }
  const results = Object.keys(tally).map(k => tally[k])
    .sort((a, b) => b.points - a.points || b.first - a.first || b.picks - a.picks || a.id - b.id);
  const out = {
    survey: survey,
    ballots: ballots,
    maxPicks: MAX_PICKS,
    latest: latest ? new Date(latest).toISOString() : null,
    generated: new Date().toISOString(),
    results: results
  };
  cache.put(cacheKey_(survey), JSON.stringify(out), RESULTS_SECONDS);
  return out;
}

function findBallot_(sheet, survey, voter) {
  const rows = sheet.getLastRow() - 1;
  if (rows < 1) return 0;
  const cells = sheet.getRange(2, 4, rows, 1).createTextFinder(voter).matchEntireCell(true).findAll();
  for (let i = 0; i < cells.length; i++) {
    const row = cells[i].getRow();
    if (String(sheet.getRange(row, 3).getValue()) === survey) return row;
  }
  return 0;
}

function votesSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(VOTES_SHEET);
  if (!sheet) {
    sheet = book.insertSheet(VOTES_SHEET);
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Counts ballots per minute; runs inside the script lock, so the count is not raced.
function tooBusy_() {
  const cache = CacheService.getScriptCache();
  const key = 'rate:' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(key) || 0);
  if (count >= BALLOTS_PER_MINUTE) return true;
  cache.put(key, String(count + 1), 120);
  return false;
}

function cacheKey_(survey) {
  return 'results:' + survey;
}

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
