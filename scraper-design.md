# TMACA Scraper Design

## Purpose

Create a scraper pipeline that collects episode metadata from reliable sources and supplements each episode record with a list of top forum threads published when the episode first aired.

The goal is to turn `episodes.json` into a richer, evidence-backed dataset with sourced fields and reference links.

## Target data model

Each scraped episode record should include:

- `id`: canonical episode ID (`MAG-###`)
- `number`: episode number
- `season`: season number
- `title`: episode title
- `summary`: canonical summary
- `characters`: list of character objects
- `locations`: list of location objects
- `artifacts`: list of artifact objects
- `fearEntities`: list of fear entity objects
- `references`: list of reference objects
- `themes`: list of themes
- `timeline`: list of event objects
- `sources`: array of source metadata objects
- `forumThreads`: array of thread objects
- `scrapeMetadata`: pipeline metadata, including source counts, last fetched, status

Example source entry:

```json
{
  "sourceId": "official-site",
  "name": "Official Show Database",
  "url": "https://show.example/episodes/001",
  "type": "official",
  "confidence": 0.95,
  "retrievedAt": "2026-07-03T00:00:00.000Z",
  "notes": "Primary episode metadata source"
}
```

Example thread entry:

```json
{
  "title": "Episode 001 discussion thread",
  "url": "https://forum.example/thread/12345",
  "forum": "ExampleForum",
  "postedAt": "2023-02-05T12:34:00.000Z",
  "popularity": 247,
  "tags": ["episode-1", "debut"]
}
```

## Reliable source categories

1. Official sources
   - official show websites
   - broadcaster episode guides
   - production company episode databases

2. Trusted secondary sources
   - widely cited wikis
   - established episode guide sites
   - recognized databases with stable schemas

3. Community evidence
   - forum threads from authoritative communities
   - subreddit posts, discussion boards, Q&A
   - social archives timed around release dates

## Scraper pipeline

1. Source discovery
   - maintain a curated list of source endpoints for episode metadata
   - include URL templates and source type metadata
   - identify forum sources with discussion thread search endpoints

2. Fetching
   - fetch HTML or JSON payloads for each episode source
   - support rate limiting, retries, and caching
   - normalize pages to a common intermediate structure

3. Parsing
   - implement source-specific parsers for HTML/JSON
   - extract canonical fields and source attribution
   - parse forum search results to identify top threads

4. Normalization
   - map scraped fields into the canonical episode schema
   - validate IDs, names, season, and references
   - preserve source attribution for each field

5. Merging
   - merge multiple source records for the same episode
   - use source confidence and trust rules to resolve conflicts
   - preserve alternate values in `sources` metadata

6. Validation
   - validate the merged episode record with `Validator.validate`
   - create diagnostics for incomplete or inconsistent scraped data

7. Output
   - emit a normalized dataset file such as `episodes-scraped.json`
   - optionally persist an augmented `episodes.json` with `sources` and `forumThreads`

## Scraper reliability model

- assign each source a reliability score
- classify fields as `required`, `recommended`, or `optional`
- track when a field is taken from multiple sources
- record any data conflicts and resolution decisions

## Integration plan

- add a scraping module alongside existing app files: `scraper.js`
- add `episodes-scraped.json` as generated output
- update app UI to show dataset source and scrape metadata
- expose manual import of scraped files through the existing dataset import button

## Next implementation steps

1. Build a source catalog and schema for source definitions.
2. Implement a core `scrapeEpisode(episodeNumber)` function.
3. Add a parser for one reliable metadata source.
4. Add forum thread collection for one community source.
5. Validate scraped data against the canonical schema.
6. Add output writing and UI integration.
