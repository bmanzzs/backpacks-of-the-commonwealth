/**
 * Vault-Tec Citizen Survey: the backend for the field catalog's favourite-backpack poll.
 * Ballots are kept in this script's own storage (Script Properties). No spreadsheet is needed,
 * and the script never touches your Drive, Sheets or other Google data.
 *
 * Setup (once):
 *   1. Go to script.google.com and choose New project.
 *   2. Replace everything in Code.gs with this file and save.
 *   3. Deploy > New deployment > Select type: Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      Deploy. If Google asks you to authorize, it is only for this script's own storage.
 *   4. Copy the Web app URL (it ends in /exec) into survey-config.js as `endpoint`.
 *
 * After editing this file later, use Deploy > Manage deployments > Edit > Version: New version,
 * so the /exec URL stays the same.
 *
 * What it stores: one entry per browser and survey round (a random browser ID and up to five
 * backpack numbers), plus the time of each round's latest ballot. No names, emails or IP
 * addresses. Submitting again from the same browser replaces that browser's ballot. Script
 * Properties hold up to 500 KB, which is room for roughly 8,000 ballots.
 *
 * GET  ?survey=<round>             -> current results for that round
 * POST {survey, voter, picks:[n…]} -> store the ballot, then return the updated results
 */

const MAX_PICKS = 5;           // ballots rank up to five; #1 earns 5 points, each place below one less
const MAX_BACKPACK = 40;       // highest backpack number accepted (room for new backpacks)
const RESULTS_SECONDS = 120;   // how long results are cached between reads
const BALLOTS_PER_MINUTE = 60; // across all visitors; protects the store from floods
const SURVEY_ID = /^[a-z][a-z0-9-]{0,31}$/;
const VOTER_ID = /^v[a-z0-9]{15,39}$/;

function doGet(e) {
  const survey = String((e && e.parameter && e.parameter.survey) || '');
  if (!SURVEY_ID.test(survey)) return reply_({ ok: false, error: 'bad-survey' });
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey_(survey));
  if (cached) return reply_(Object.assign({ ok: true }, JSON.parse(cached)));
  // Count under the script lock, so a tally read before a ballot was saved can't be cached after it.
  // If the lock stays busy, answer without caching.
  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(5000);
  try {
    const filled = locked && cache.get(cacheKey_(survey)); // another request counted while this one waited
    const out = filled ? JSON.parse(filled) : tally_(survey);
    if (locked && !filled) cache.put(cacheKey_(survey), JSON.stringify(out), RESULTS_SECONDS);
    return reply_(Object.assign({ ok: true }, out));
  } finally {
    if (locked) lock.releaseLock();
  }
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
  let out;
  try {
    if (tooBusy_()) return reply_({ ok: false, error: 'busy' });
    const store = PropertiesService.getScriptProperties();
    const key = ballotKey_(ballot.survey, ballot.voter);
    updated = store.getProperty(key) !== null;
    const change = {};
    change[key] = ballot.picks.join(',');
    change[latestKey_(ballot.survey)] = String(Date.now());
    try {
      store.setProperties(change);
    } catch (err) {
      return reply_({ ok: false, error: 'full' }); // the 500 KB store is full
    }
    out = tally_(ballot.survey);
    CacheService.getScriptCache().put(cacheKey_(ballot.survey), JSON.stringify(out), RESULTS_SECONDS);
  } finally {
    lock.releaseLock();
  }
  return reply_(Object.assign({ ok: true, updated: updated }, out));
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

// Current standings for a round, counted from every stored ballot.
function tally_(survey) {
  const all = PropertiesService.getScriptProperties().getProperties();
  const prefix = ballotKey_(survey, '');
  const tally = {};
  let ballots = 0;
  Object.keys(all).forEach(key => {
    if (key.indexOf(prefix) !== 0) return;
    const picks = String(all[key]).split(',').map(Number)
      .filter(n => Number.isInteger(n) && n > 0 && n <= MAX_BACKPACK).slice(0, MAX_PICKS);
    if (!picks.length) return;
    ballots++;
    picks.forEach((id, rank) => {
      const t = tally[id] || (tally[id] = { id: id, points: 0, first: 0, picks: 0 });
      t.points += MAX_PICKS - rank;
      t.picks += 1;
      if (rank === 0) t.first += 1;
    });
  });
  const latest = Number(all[latestKey_(survey)]) || 0;
  const results = Object.keys(tally).map(k => tally[k])
    .sort((a, b) => b.points - a.points || b.first - a.first || b.picks - a.picks || a.id - b.id);
  return {
    survey: survey,
    ballots: ballots,
    maxPicks: MAX_PICKS,
    latest: ballots && latest ? new Date(latest).toISOString() : null,
    generated: new Date().toISOString(),
    results: results
  };
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

function ballotKey_(survey, voter) {
  return 'b|' + survey + '|' + voter;
}

function latestKey_(survey) {
  return 'latest|' + survey;
}

function cacheKey_(survey) {
  return 'results:' + survey;
}

function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
