const SOURCE_CONFIG = [
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
      threads: '.thread',
      threadLink: 'a[href]',
      threadForum: '.forum',
      threadPostedAt: '.posted',
      threadPopularity: '.popularity',
      threadTags: '.tag'
    }
  }
];

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = SOURCE_CONFIG;
}