// Preloaded with `node --require` so the CLI runs offline: the Google client becomes a stub
// that answers "<lang>:<text>" for every request.
const path = require('path');
const id = require.resolve('@google-cloud/translate', { paths: [path.join(__dirname, '..', 'bin')] });
require.cache[id] = {
  id,
  filename: id,
  loaded: true,
  exports: function () {
    return { translate: (text, lang) => Promise.resolve([lang + ':' + text]) };
  },
};
