const SOURCE_CONFIG = [
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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = SOURCE_CONFIG;
}