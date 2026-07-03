const fs = require('fs');
const path = require('path');
const schemaCode = fs.readFileSync(path.join(__dirname, 'schema.js'), 'utf8');
const validatorCode = fs.readFileSync(path.join(__dirname, 'validator.js'), 'utf8');
const vm = new Function(schemaCode + '\n' + validatorCode + '\nreturn { Schema, Validator };');
const { Schema, Validator } = vm();
const scraper = require('./scraper.js');
const sourceConfig = require('./source-config.js');

async function loadFixture(episodeNumber, sourceId){
  const filename = `${sourceId}-${String(episodeNumber).padStart(3, '0')}.html`;
  const filePath = path.join(__dirname, 'scraper-samples', filename);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return null;
}

async function fetchFixture(source, episode){
  const fixture = await loadFixture(episode.number, source.id);
  if (fixture) {
    return {
      source,
      url: source.urlTemplate
        .replace('{id}', episode.id)
        .replace('{number}', String(episode.number).padStart(3, '0')),
      payload: fixture,
      sourceType: 'fixture'
    };
  }

  const url = source.urlTemplate
    .replace('{id}', episode.id)
    .replace('{number}', String(episode.number).padStart(3, '0'));

  if (url.includes('example')) {
    return null;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`);
  }

  const payload = source.format === 'json' ? await response.json() : await response.text();
  return { source, url, payload, sourceType: 'network' };
}

async function buildScrapedDataset(){
  scraper.setSchema(Schema);
  scraper.setSourceCatalog(sourceConfig);
  const episodes = JSON.parse(fs.readFileSync(path.join(__dirname, 'episodes.json'), 'utf8'));
  const results = [];

  for (const episode of episodes) {
    const sources = sourceConfig.filter(source => source.type !== 'forum');
    const forumSource = sourceConfig.find(source => source.type === 'forum');
    const fetchTasks = sources.map(source => fetchFixture(source, episode));
    if (forumSource) fetchTasks.push(fetchFixture(forumSource, episode));

    const fetched = await Promise.allSettled(fetchTasks);
    const parsedSources = [];
    const sourceErrors = [];
    const sourceInfo = [];

    for (const result of fetched) {
      if (result.status === 'fulfilled' && result.value) {
        const parsed = scraper.parseEpisodeFromSource(result.value);
        parsedSources.push(parsed);
        sourceInfo.push({ source: result.value.source.id, type: result.value.sourceType });
      } else {
        const error = result.status === 'rejected' ? result.reason.message : 'Skipped placeholder source';
        sourceErrors.push(error);
      }
    }

    const normalized = scraper.normalizeScrapedEpisode(parsedSources);
    let validation;
    try {
      validation = Validator.validate(normalized);
    } catch (err) {
      validation = {
        ok: false,
        failures: [
          {
            rule: 'SCRAPER_VALIDATION_ERROR',
            category: 'integrity',
            path: 'episode',
            expected: 'valid episode object',
            received: null,
            description: err.message,
            timestamp: new Date().toISOString()
          }
        ]
      };
    }

    normalized.scrapeMetadata = {
      sourceCount: parsedSources.length,
      sourceInfo,
      sourceErrors,
      validation: {
        ok: validation.ok,
        failures: validation.failures.map(f => ({ rule: f.rule, path: f.path, category: f.category }))
      }
    };

    results.push(normalized);
  }

  fs.writeFileSync(path.join(__dirname, 'episodes-scraped.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log(`Generated episodes-scraped.json with ${results.length} episodes`);
}

buildScrapedDataset().catch(error => {
  console.error(error);
  process.exit(1);
});