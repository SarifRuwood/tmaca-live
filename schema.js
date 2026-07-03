const Schema = (() => {
  const ID_PREFIX = "MAG-";
  const EPISODE_ID_PATTERN = /^MAG-\d{3}$/;
  const CHARACTER_ID_PATTERN = /^CHR-\d{3}$/;
  const LOCATION_ID_PATTERN = /^LOC-\d{3}$/;
  const ARTIFACT_ID_PATTERN = /^ART-\d{3}$/;
  const FEAR_ID_PATTERN = /^FEAR-\d{3}$/;
  const MIN_SEASON = 1;
  const MAX_SEASON = 5;

  function formatId(prefix, number){
    return `${prefix}${String(number).padStart(3, '0')}`;
  }

  function defaultEpisode(number){
    const id = formatId(ID_PREFIX, number);
    return {
      id,
      number,
      season: 1,
      title: `Episode ${number}`,
      summary: `A canonical episode summary for episode ${number}.`,
      characters: [
        {
          id: formatId('CHR-', number),
          name: `Character ${number}`
        }
      ],
      locations: [
        {
          id: formatId('LOC-', number),
          name: `Location ${number}`
        }
      ],
      artifacts: [
        {
          id: formatId('ART-', number),
          name: `Artifact ${number}`
        }
      ],
      fearEntities: [
        {
          id: formatId('FEAR-', number),
          name: `Fear Entity ${number}`
        }
      ],
      references: [
        {
          type: 'episode',
          target: number > 1 ? formatId(ID_PREFIX, number - 1) : id,
          note: number > 1 ? 'References the previous episode.' : 'Self-reference for the first episode.'
        }
      ],
      themes: ['Documentation', 'Memory'],
      timeline: [
        {
          eventId: `EVT-${String(number).padStart(3, '0')}`,
          description: `Primary event from episode ${number}`
        }
      ]
    };
  }

  function makeCanonicalEpisode(number){
    const episode = defaultEpisode(number);

    if (Math.random() < 0.25) {
      episode.id = formatId(ID_PREFIX, number + 1);
    }

    if (Math.random() < 0.20) {
      episode.title = '';
    }

    if (Math.random() < 0.20) {
      episode.summary = '';
    }

    if (Math.random() < 0.15) {
      episode.season = 0;
    }

    if (Math.random() < 0.15) {
      episode.characters[0].id = `BAD-001`;
    }

    if (Math.random() < 0.15) {
      episode.references[0].target = 'MAG-XYZ';
    }

    return episode;
  }

  function isValidEpisodeId(id){
    return EPISODE_ID_PATTERN.test(id);
  }

  function isValidCharacterId(id){
    return CHARACTER_ID_PATTERN.test(id);
  }

  function isValidLocationId(id){
    return LOCATION_ID_PATTERN.test(id);
  }

  function isValidArtifactId(id){
    return ARTIFACT_ID_PATTERN.test(id);
  }

  function isValidFearId(id){
    return FEAR_ID_PATTERN.test(id);
  }

  function isValidSeason(season){
    return Number.isInteger(season) && season >= MIN_SEASON && season <= MAX_SEASON;
  }

  function isPositiveInteger(value){
    return Number.isInteger(value) && value > 0;
  }

  function isNonEmptyString(value){
    return typeof value === 'string' && value.trim().length > 0;
  }

  return {
    defaultEpisode,
    makeCanonicalEpisode,
    isValidEpisodeId,
    isValidCharacterId,
    isValidLocationId,
    isValidArtifactId,
    isValidFearId,
    isValidSeason,
    isPositiveInteger,
    isNonEmptyString,
    ID_PREFIX,
    MIN_SEASON,
    MAX_SEASON
  };
})();
