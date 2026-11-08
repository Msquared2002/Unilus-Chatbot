// New Supabase server keys belong only in apikey. Legacy JWT keys also need Bearer.
function storageHeaders(key = process.env.SUPABASE_STORAGE_KEY) {
  if (!key || /^sb_publishable_/.test(key)) throw Error('Server-side Storage credential required');
  return key.startsWith('sb_secret_') ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key };
}
module.exports = { storageHeaders };
