const Validator = (() => {

  /* -------------------------
     VALIDATION RULES
  --------------------------*/
  function validate(ep){

    // RULE 1: ID must match number
    const expectedId = "MAG-" + ep.number.toString().padStart(3,'0');

    if(ep.id !== expectedId){
      return {
        ok: false,
        error: "ID_NUMBER_MISMATCH"
      };
    }

    // RULE 2: title must exist and be non-empty
    if(!ep.title || ep.title.trim() === ""){
      return {
        ok: false,
        error: "EMPTY_TITLE"
      };
    }

    // RULE 3: season must be valid (future-proof constraint)
    if(ep.season < 1 || ep.season > 5){
      return {
        ok: false,
        error: "INVALID_SEASON"
      };
    }

    return { ok: true };
  }

  /* -------------------------
     REPAIR ENGINE
  --------------------------*/
  function repair(ep, error){

    switch(error){

      case "ID_NUMBER_MISMATCH":
        ep.id = "MAG-" + ep.number.toString().padStart(3,'0');
        break;

      case "EMPTY_TITLE":
        ep.title = "Recovered Episode " + ep.number;
        break;

      case "INVALID_SEASON":
        ep.season = 1;
        break;

      default:
        // fallback safety: regenerate safe defaults
        ep.title = ep.title || "Recovered Episode " + ep.number;
        ep.season = ep.season || 1;
        ep.id = "MAG-" + ep.number.toString().padStart(3,'0');
        break;
    }

    return ep;
  }

  /* -------------------------
     PUBLIC API
  --------------------------*/
  return {
    validate,
    repair
  };

})();