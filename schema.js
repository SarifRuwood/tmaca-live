const Schema = (() => {

  const ID_PREFIX = "MAG-";
  const ID_PATTERN = /^MAG-\d{3}$/;
  const MIN_SEASON = 1;
  const MAX_SEASON = 5;

  function defaultEpisode(number){
    return {
      id: ID_PREFIX + String(number).padStart(3, "0"),
      number,
      season: 1,
      title: "Episode " + number,
      summary: "",
      characters: [],
      locations: [],
      references: []
    };
  }

  function makeCanonicalEpisode(number){
    const episode = defaultEpisode(number);

    // Introduce controlled variation for validation testing.
    if (Math.random() < 0.25) {
      episode.id = ID_PREFIX + String(number + 1).padStart(3, "0");
    }

    if (Math.random() < 0.20) {
      episode.title = "";
    }

    if (Math.random() < 0.10) {
      episode.season = 0;
    }

    return episode;
  }

  function isValidIdFormat(id){
    return ID_PATTERN.test(id);
  }

  function isValidSeason(season){
    return Number.isInteger(season) && season >= MIN_SEASON && season <= MAX_SEASON;
  }

  function isPositiveInteger(value){
    return Number.isInteger(value) && value > 0;
  }

  return {
    defaultEpisode,
    makeCanonicalEpisode,
    isValidIdFormat,
    isValidSeason,
    isPositiveInteger,
    ID_PREFIX,
    MIN_SEASON,
    MAX_SEASON
  };

})();
