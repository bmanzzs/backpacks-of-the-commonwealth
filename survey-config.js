// Vault-Tec survey settings.
// endpoint: the Google Apps Script web app URL from tools/vault-tec-survey.gs (it ends in /exec).
//           Leave it empty and the survey stays hidden.
// id:       the survey round. Change it to start a fresh round; earlier ballots stay in the sheet.
// picks:    how many backpacks each ballot ranks (#1 earns this many points, the last pick earns 1).
window.VAULT_TEC_SURVEY = {
  endpoint: '',
  id: 'favorites-1',
  picks: 5
};
