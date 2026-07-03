/*
  TMACA Scraper Skeleton

  This module defines the high-level scraping workflow for episode metadata, source attribution,
  and forum thread discovery. It is intentionally a skeleton that can be extended with actual
  source fetchers and parsers.
*/

const { JSDOM } = require('jsdom');

const Scraper = (() => {
  let SchemaRef = null;
  let SOURCE_CATALOG = [
    {
      id: 'official-show-db',
      name: 'Official Show Database',
      type: 'official',
      urlTemplate: 'https://show.example/episodes/{id}',
      format: 'html',
      trust: 0.95,
      selectors: {
        number: { selector: '.episode-number' },
        season: { selector: '.episode-season' },
        title: { selector: '.episode-title' },
        summary: { selector: '.episode-summary' },
        characters: { selector: '.characters li[data-id]' },
        locations: { selector: '.locations li[data-id]' },
        artifacts: { selector: '.artifacts li[data-id]' },
        fearEntities: { selector: '.fear-entities li[data-id]' },
        references: { selector: '.references li[data-target]' }
      }
    },
    {
      id: 'community-wiki',
      name: 'Community Wiki',
      type: 'secondary',
      urlTemplate: 'https://wiki.example/episode/{number}',
      format: 'html',
      trust: 0.85,
      selectors: {
        id: { selector: '.wiki-episode', attr: 'data-episode-id' },
        number: { selector: '.wiki-episode', attr: 'data-episode-number' },
        season: { selector: '.wiki-episode', attr: 'data-episode-season' },
        title: { selector: '.wiki-title' },
        summary: { selector: '.wiki-summary' },
        characters: { selector: '.wiki-characters li[data-id]' },
        locations: { selector: '.wiki-locations li[data-id]' },
        artifacts: { selector: '.wiki-artifacts li[data-id]' },
        fearEntities: { selector: '.wiki-fear-entities li[data-id]' },
        references: { selector: '.wiki-references li[data-target]' }
      }
    },
    {
      id: 'forum-search',
      name: 'Forum Thread Search',
      type: 'forum',
      urlTemplate: 'https://forum.example/search?query=episode+{number}',
      format: 'html',
      trust: 0.7,
      selectors: {
        threads: { selector: '.thread' },
        threadLink: { selector: 'a[href]' },
        threadForum: { selector: '.forum' },
        threadPostedAt: { selector: '.posted' },
        threadPopularity: { selector: '.popularity' },
        threadTags: { selector: '.tag' }
      }
    }
  ];

  async function fetchJson(url){
    const response = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
    return await response.json();
  }

  async function fetchText(url){
    const response = await fetchWithRetry(url, { headers: { 'Accept': 'text/html' } });
    return await response.text();
  }

  async function fetchWithRetry(url, options = {}, attempts = 3, delayMs = 500) {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  function buildSourceUrl(source, episode){
    return source.urlTemplate
      .replace('{id}', episode.id)
      .replace('{number}', String(episode.number).padStart(3, '0'));
  }

  async function fetchSourceData(source, episode){
    const url = buildSourceUrl(source, episode);
    if (source.format === 'json') {
      return {
        source,
        url,
        payload: await fetchJson(url)
      };
    }
    return {
      source,
      url,
      payload: await fetchText(url)
    };
  }

  function parseHtml(html){
    return new JSDOM(String(html)).window.document;
  }

  function queryText(root, selector){
    if (!selector) return null;
    const node = root.querySelector(selector);
    return node ? node.textContent.trim() : null;
  }

  function queryAttr(root, selector, attr){
    if (!selector || !attr) return null;
    const node = root.querySelector(selector);
    return node ? node.getAttribute(attr)?.trim() : null;
  }

  function parseEntities(root, selector, idAttr = 'data-id'){
    if (!selector) return [];
    const items = Array.from(root.querySelectorAll(selector));
    return items.map(item => ({
      id: item.getAttribute(idAttr) ? item.getAttribute(idAttr).trim() : null,
      name: item.textContent.trim()
    })).filter(entity => entity.id && entity.name);
  }

  function parseReferences(root, selector){
    if (!selector) return [];
    const items = Array.from(root.querySelectorAll(selector));
    return items.map(item => ({
      type: 'episode',
      target: item.getAttribute('data-target')?.trim() || null,
      note: item.textContent.trim()
    })).filter(reference => reference.target);
  }

  function extractJsonValue(payload, path){
    if (!payload || !path) return null;
    return path.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), payload) ?? null;
  }

  function extractJsonList(payload, path){
    const value = extractJsonValue(payload, path);
    return Array.isArray(value) ? value : [];
  }

  function parseEntitiesFromJson(payload, selectorMeta){
    if (!selectorMeta || !selectorMeta.path) return [];
    const items = extractJsonList(payload, selectorMeta.path);
    const idPath = selectorMeta.idPath || 'id';
    const namePath = selectorMeta.namePath || 'name';
    return items.map(item => ({
      id: extractJsonValue(item, idPath),
      name: extractJsonValue(item, namePath)
    })).filter(entity => entity.id && entity.name);
  }

  function getSelectorValue(selectorMeta){
    if (!selectorMeta) return null;
    return typeof selectorMeta === 'string' ? selectorMeta : selectorMeta.selector || null;
  }

  function parseForumThreads(root, selectors){
    const threadSelector = getSelectorValue(selectors?.threads) || '.thread';
    const anchorSelector = getSelectorValue(selectors?.threadLink) || 'a[href]';
    const forumSelector = getSelectorValue(selectors?.threadForum) || '.forum';
    const postedSelector = getSelectorValue(selectors?.threadPostedAt) || '.posted';
    const popularitySelector = getSelectorValue(selectors?.threadPopularity) || '.popularity';
    const tagSelector = getSelectorValue(selectors?.threadTags) || '.tag';

    return Array.from(root.querySelectorAll(threadSelector)).map(thread => {
      const anchor = thread.querySelector(anchorSelector);
      return {
        title: anchor ? anchor.textContent.trim() : 'Untitled Thread',
        url: anchor ? anchor.href : '',
        forum: queryText(thread, forumSelector) || 'Unknown',
        postedAt: queryText(thread, postedSelector) || null,
        popularity: parseInt(queryText(thread, popularitySelector), 10) || null,
        tags: Array.from(thread.querySelectorAll(tagSelector)).map(node => node.textContent.trim()).filter(Boolean)
      };
    }).filter(thread => thread.url);
  }

  function extractField(root, selectorMeta){
    if (!selectorMeta) return null;
    if (selectorMeta.json && selectorMeta.path) {
      return extractJsonValue(root, selectorMeta.path);
    }
    if (!selectorMeta.selector) return null;
    if (selectorMeta.attr) {
      return queryAttr(root, selectorMeta.selector, selectorMeta.attr);
    }
    return queryText(root, selectorMeta.selector);
  }

  function extractList(root, selectorMeta){
    if (!selectorMeta) return [];
    if (selectorMeta.json && selectorMeta.path) {
      return parseEntitiesFromJson(root, selectorMeta);
    }
    if (!selectorMeta.selector) return [];
    return parseEntities(root, selectorMeta.selector, selectorMeta.idAttr || 'data-id');
  }

  function normalizeArray(items){
    return Array.isArray(items) ? items : [];
  }

  function uniqBy(items, key){
    const seen = new Set();
    return (items || []).filter(item => {
      const value = item && (typeof key === 'function' ? key(item) : item[key]);
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function parseEpisodeFromSource(sourceData){
    const { source, payload } = sourceData;
    const parsed = {
      sourceId: source.id,
      source,
      url: sourceData.url,
      fields: {},
      threadLinks: []
    };

    if (source.format === 'html') {
      const root = parseHtml(payload);
      const selectors = source.selectors || {};

      if (source.type === 'forum') {
        parsed.threadLinks = parseForumThreads(root, selectors);
      } else {
        const number = parseInt(extractField(root, selectors.number), 10) || null;
        const season = parseInt(extractField(root, selectors.season), 10) || null;
        parsed.fields = {
          id: extractField(root, selectors.id) || (number ? `${SchemaRef.ID_PREFIX}${String(number).padStart(3, '0')}` : null),
          number,
          season,
          title: extractField(root, selectors.title),
          summary: extractField(root, selectors.summary),
          characters: extractList(root, selectors.characters),
          locations: extractList(root, selectors.locations),
          artifacts: extractList(root, selectors.artifacts),
          fearEntities: extractList(root, selectors.fearEntities),
          references: parseReferences(root, selectors.references?.selector || selectors.references?.selector),
          themes: [],
          timeline: []
        };
      }
    }

    return parsed;
  }

  function normalizeScrapedEpisode(parsedSources){
    const fieldOrder = ['official-show-db', 'community-wiki'];

    function firstField(name){
      for (const source of fieldOrder) {
        const parsed = parsedSources.find(ps => ps.sourceId === source);
        if (parsed && parsed.fields && parsed.fields[name] != null && parsed.fields[name] !== '') {
          return parsed.fields[name];
        }
      }
      for (const parsed of parsedSources) {
        if (parsed.fields && parsed.fields[name] != null && parsed.fields[name] !== '') {
          return parsed.fields[name];
        }
      }
      return null;
    }

    const episode = {
      id: firstField('id'),
      number: firstField('number'),
      season: firstField('season'),
      title: firstField('title'),
      summary: firstField('summary'),
      characters: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.characters)), 'id'),
      locations: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.locations)), 'id'),
      artifacts: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.artifacts)), 'id'),
      fearEntities: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.fearEntities)), 'id'),
      references: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.references)), 'target'),
      themes: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.themes)), item => item),
      timeline: uniqBy(parsedSources.flatMap(ps => normalizeArray(ps.fields.timeline)), item => item.eventId),
      sources: parsedSources.map(ps => ({
        sourceId: ps.sourceId,
        name: ps.source.name,
        url: ps.url,
        type: ps.source.type,
        confidence: ps.source.trust,
        retrievedAt: new Date().toISOString()
      })),
      forumThreads: parsedSources.flatMap(ps => ps.threadLinks || []),
      scrapeMetadata: {
        fetchedAt: new Date().toISOString(),
        sourceCount: parsedSources.length,
        status: parsedSources.length ? 'success' : 'no-data'
      }
    };

    if (!episode.id && Number.isInteger(episode.number) && SchemaRef) {
      episode.id = `${SchemaRef.ID_PREFIX}${String(episode.number).padStart(3, '0')}`;
    }

    return episode;
  }

  async function scrapeEpisode(episode){
    const sources = SOURCE_CATALOG.filter(source => source.type !== 'forum');
    const forumSource = SOURCE_CATALOG.find(source => source.type === 'forum');

    const fetchTasks = sources.map(source => fetchSourceData(source, episode));
    if (forumSource) fetchTasks.push(fetchSourceData(forumSource, episode));

    const fetched = await Promise.allSettled(fetchTasks);

    const parsed = fetched
      .filter(result => result.status === 'fulfilled')
      .map(result => parseEpisodeFromSource(result.value));

    return normalizeScrapedEpisode(parsed);
  }

  async function scrapeEpisodes(episodes){
    const results = [];
    for (const episode of episodes) {
      const scraped = await scrapeEpisode(episode);
      results.push(scraped);
    }
    return results;
  }

  function setSourceCatalog(catalog){
    if (Array.isArray(catalog)) {
      SOURCE_CATALOG = catalog;
    }
  }

  function setSchema(schema){
    SchemaRef = schema;
  }

  function getSourceCatalog(){
    return SOURCE_CATALOG;
  }

  return {
    SOURCE_CATALOG,
    getSourceCatalog,
    setSourceCatalog,
    setSchema,
    fetchSourceData,
    parseEpisodeFromSource,
    normalizeScrapedEpisode,
    scrapeEpisode,
    scrapeEpisodes
  };
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = Scraper;
}
