// Test helper: mirrors js/core/games.js's normalizeGameId
// Used by test stubs that intentionally install minimal/partial DSCoreGames replacements.
function stubNormalizeGameId(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
}

module.exports = {
  stubNormalizeGameId,
};
