/*
  TMACA Scraper Skeleton

  This module defines the high-level scraping workflow for episode metadata, source attribution,
  and forum thread discovery. It is intentionally a skeleton that can be extended with actual
  source fetchers and parsers.
*/

const Scraper = (() => {
  let SchemaRef = null;
  let SOURCE_CATALOG = [
    {
      id: 'official-show-db',
      name: 'Official Show Database',
      type: 'official',
      urlTemplate: 'https://show.example/episodes/{id}',
      format: 'html',
      trust: 0.95
    },
    {
      id: 'community-wiki',
      name: 'Community Wiki',
      type: 'secondary',
      urlTemplate: 'https://wiki.example/episode/{number}',
      format: 'html',
      trust: 0.85
    },
    {
      id: 'forum-search',
      name: 'Forum Thread Search',
      type: 'forum',
      urlTemplate: 'https://forum.example/search?query=episode+{number}',
      format: 'html',
      trust: 0.7
    }
  ];

  async function fetchJson(url){
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return await response.json();
  }

  async function fetchText(url){
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return await response.text();
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

  function extractSingle(html, regex){
    const match = regex.exec(html);
    return match ? match[1].trim() : null;
  }

  function extractAll(html, regex){
    const results = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      results.push(match.slice(1).map(s => s.trim()));
    }
    return results;
  }

  function extractSection(html, className){
    const regex = new RegExp(`<section[^>]*class=["']${className}["'][^>]*>([\\s\\S]*?)<\\/section>`, 'i');
    return extractSingle(html, regex);
  }

  function parseListItems(sectionHtml, attributeName){
    if (!sectionHtml) return [];
    const itemRegex = new RegExp(`<li[^>]*${attributeName}=["']([^"']+)["'][^>]*>([^<]+)<\\/li>`, 'gi');
    const items = [];
    let match;
    while ((match = itemRegex.exec(sectionHtml)) !== null) {
      items.push({ id: match[1].trim(), name: match[2].trim() });
    }
    return items;
  }

  function parseReferenceItems(sectionHtml){
    if (!sectionHtml) return [];
    const itemRegex = /<li[^>]*data-target=["']([^"']+)["'][^>]*>([^<]+)<\/li>/gi;
    const items = [];
    let match;
    while ((match = itemRegex.exec(sectionHtml)) !== null) {
      items.push({ type: 'episode', target: match[1].trim(), note: match[2].trim() });
    }
    return items;
  }

  function normalizeArray(items){
    return Array.isArray(items) ? items : [];
  }

  function uniqBy(items, key){
    const seen = new Set();
    return (items || []).filter(item => {
      const value = item && item[key];
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

    switch (source.id) {
      case 'official-show-db': {
        const html = String(payload);
        const number = parseInt(extractSingle(html, /class=["']episode-number["']>([^<]+)/i), 10) || null;
        const season = parseInt(extractSingle(html, /class=["']episode-season["']>([^<]+)/i), 10) || null;
        parsed.fields = {
          id: number ? `${SchemaRef.ID_PREFIX}${String(number).padStart(3, '0')}` : null,
          number,
          season,
          title: extractSingle(html, /class=["']episode-title["']>([^<]+)/i),
          summary: extractSingle(html, /class=["']episode-summary["']>([^<]+)/i),
          characters: parseListItems(extractSection(html, 'characters'), 'data-id'),
          locations: parseListItems(extractSection(html, 'locations'), 'data-id'),
          artifacts: parseListItems(extractSection(html, 'artifacts'), 'data-id'),
          fearEntities: parseListItems(extractSection(html, 'fear-entities'), 'data-id'),
          references: parseReferenceItems(extractSection(html, 'references')),
          themes: [],
          timeline: []
        };
        break;
      }
      case 'community-wiki': {
        const html = String(payload);
        parsed.fields = {
          id: extractSingle(html, /data-episode-id=["']([^"']+)/i),
          number: parseInt(extractSingle(html, /data-episode-number=["']([^"']+)/i), 10) || null,
          season: parseInt(extractSingle(html, /data-episode-season=["']([^"']+)/i), 10) || null,
          title: extractSingle(html, /class=["']wiki-title["']>([^<]+)/i),
          summary: extractSingle(html, /class=["']wiki-summary["']>([^<]+)/i),
          characters: parseListItems(extractSection(html, 'wiki-characters'), 'data-id'),
          locations: parseListItems(extractSection(html, 'wiki-locations'), 'data-id'),
          artifacts: parseListItems(extractSection(html, 'wiki-artifacts'), 'data-id'),
          fearEntities: parseListItems(extractSection(html, 'wiki-fear-entities'), 'data-id'),
          references: parseReferenceItems(extractSection(html, 'wiki-references')),
          themes: [],
          timeline: []
        };
        break;
      }
      case 'forum-search': {
        const html = String(payload);
        const threadBlocks = extractAll(html, /<div[^>]*class=["']thread["'][^>]*>([\s\S]*?)<\/div>/gi).map(([block]) => block);
        parsed.threadLinks = threadBlocks.map(block => {
          const linkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i.exec(block);
          const url = linkMatch ? linkMatch[1].trim() : '';
          const title = linkMatch ? linkMatch[2].trim() : null;
          const forum = extractSingle(block, /class=["']forum["']>([^<]+)<\/span>/i);
          const postedAt = extractSingle(block, /class=["']posted["']>([^<]+)<\/span>/i);
          const popularity = parseInt(extractSingle(block, /class=["']popularity["']>([^<]+)<\/span>/i), 10) || null;
          return {
            title: title || 'Untitled Thread',
            url: url || '',
            forum: forum || 'Unknown',
            postedAt: postedAt || null,
            popularity,
            tags: []
          };
        }).filter(thread => thread.url);
        break;
      }
      default:
        break;
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
