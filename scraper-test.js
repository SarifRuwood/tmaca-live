const fs = require('fs');
const path = require('path');
const schemaCode = fs.readFileSync('schema.js', 'utf8');
const validatorCode = fs.readFileSync('validator.js', 'utf8');
const vm = new Function(schemaCode + '\n' + validatorCode + '\nreturn { Schema, Validator };');
const { Schema, Validator } = vm();
if (typeof global !== 'undefined') {
  global.Schema = Schema;
}
const sourceConfig = require('./source-config.js');
const scraper = require('./scraper.js');

function loadSample(filename) {
  return fs.readFileSync(path.join(__dirname, 'scraper-samples', filename), 'utf8');
}

async function test() {
  const episode = Schema.defaultEpisode(1);
  scraper.setSourceCatalog(sourceConfig);
  const official = {
    source: sourceConfig.find(s => s.id === 'official-show-db'),
    url: 'http://localhost/official-show-db/001',
    payload: loadSample('official-show-db-001.html')
  };
  const wiki = {
    source: sourceConfig.find(s => s.id === 'community-wiki'),
    url: 'http://localhost/community-wiki/001',
    payload: loadSample('community-wiki-001.html')
  };
  const forum = {
    source: sourceConfig.find(s => s.id === 'forum-search'),
    url: 'http://localhost/forum-search/001',
    payload: loadSample('forum-search-001.html')
  };

  scraper.setSchema(Schema);
  const parsedOfficial = scraper.parseEpisodeFromSource(official);
  const parsedWiki = scraper.parseEpisodeFromSource(wiki);
  const parsedForum = scraper.parseEpisodeFromSource(forum);
  const normalized = scraper.normalizeScrapedEpisode([parsedOfficial, parsedWiki, parsedForum]);

  const validation = Validator.validate(normalized);

  console.log('Parsed official fields:', parsedOfficial.fields);
  console.log('Parsed forum links:', parsedForum.threadLinks);
  console.log('Normalized episode keys:', Object.keys(normalized));
  console.log('Validation ok:', validation.ok);
  if (!validation.ok) console.log('Failures:', validation.failures);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});