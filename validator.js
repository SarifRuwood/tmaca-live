const Validator = (() => {

  function timestamp(){
    return new Date().toISOString();
  }

  function makeFailure(rule, category, path, expected, received, description){
    return {
      rule,
      category,
      object: "episode",
      path,
      expected,
      received,
      description,
      timestamp: timestamp()
    };
  }

  /* -------------------------
     VALIDATION RULES
  --------------------------*/
  function validate(ep){
    const failures = [];
    const expectedId = Schema.ID_PREFIX + ep.number.toString().padStart(3, '0');

    if(!Schema.isValidIdFormat(ep.id)){
      failures.push(makeFailure(
        "ID_FORMAT",
        "format",
        "id",
        "MAG-###",
        ep.id,
        "Episode ID must match the MAG-### format."
      ));
    }

    if(ep.id !== expectedId){
      failures.push(makeFailure(
        "ID_NUMBER_MISMATCH",
        "semantic",
        "id",
        expectedId,
        ep.id,
        "Episode ID must correspond to the episode number."
      ));
    }

    if(!ep.title || ep.title.trim() === ""){
      failures.push(makeFailure(
        "EMPTY_TITLE",
        "structural",
        "title",
        "non-empty string",
        ep.title,
        "Episode title is required and must not be empty."
      ));
    }

    if(!Schema.isValidSeason(ep.season)){
      failures.push(makeFailure(
        "INVALID_SEASON",
        "semantic",
        "season",
        `integer ${Schema.MIN_SEASON}-${Schema.MAX_SEASON}`,
        ep.season,
        "Episode season must be within the allowed range."
      ));
    }

    return {
      ok: failures.length === 0,
      failures
    };
  }

  /* -------------------------
     REPAIR ENGINE
  --------------------------*/
  function repair(ep, failures){
    const repaired = { ...ep };
    const repairs = [];
    const expectedId = Schema.ID_PREFIX + ep.number.toString().padStart(3, '0');

    if(failures.some(f => f.rule === "ID_FORMAT" || f.rule === "ID_NUMBER_MISMATCH")){
      repairs.push({
        rule: "ID_NUMBER_MISMATCH",
        strategy: "replace-with-canonical-id",
        original: repaired.id,
        repaired: expectedId,
        success: true
      });
      repaired.id = expectedId;
    }

    if(failures.some(f => f.rule === "EMPTY_TITLE")){
      const replacement = "Recovered Episode " + repaired.number;
      repairs.push({
        rule: "EMPTY_TITLE",
        strategy: "set-default-title",
        original: repaired.title,
        repaired: replacement,
        success: true
      });
      repaired.title = replacement;
    }

    if(failures.some(f => f.rule === "INVALID_SEASON")){
      repairs.push({
        rule: "INVALID_SEASON",
        strategy: "clamp-season-to-default",
        original: repaired.season,
        repaired: Schema.MIN_SEASON,
        success: true
      });
      repaired.season = Schema.MIN_SEASON;
    }

    return {
      episode: repaired,
      repairs
    };
  }

  /* -------------------------
     PUBLIC API
  --------------------------*/
  return {
    validate,
    repair
  };

})();
