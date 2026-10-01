// Vault-Tec survey settings.
// endpoint: the Google Apps Script web app URL from tools/vault-tec-survey.gs (it ends in /exec).
//           Leave it empty and the survey stays hidden.
// id:       the survey round. Change it to start a fresh round; earlier ballots stay in the sheet.
// picks:    how many backpacks each ballot ranks (1–5). Scoring is fixed: a #1 pick earns 5 points and
//           each place below earns one less, so a 3-pick ballot scores 5, 4 and 3.
window.VAULT_TEC_SURVEY = {
  endpoint: '',
  id: 'favorites-1',
  picks: 5
};
