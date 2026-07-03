const Store = (() => {

  const KEY = "tmaca_state_v1";

  /* -------------------------
     DEFAULT STATE
  --------------------------*/
  function defaultState(){
    return {
      total: 0,
      failures: 0,
      current: null,
      log: [],
      driftHistory: []
    };
  }

  /* -------------------------
     LOAD STATE (persistent)
  --------------------------*/
  function load(){
    try {
      const raw = localStorage.getItem(KEY);
      if(!raw) return defaultState();

      const parsed = JSON.parse(raw);

      // safety merge (prevents schema breakage across updates)
      return {
        ...defaultState(),
        ...parsed,
        log: parsed.log || [],
        driftHistory: parsed.driftHistory || []
      };

    } catch (e) {
      return defaultState();
    }
  }

  /* -------------------------
     SAVE STATE
  --------------------------*/
  function save(state){
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("TMACA: Failed to save state", e);
    }
  }

  /* -------------------------
     RESET STATE
  --------------------------*/
  function reset(){
    localStorage.removeItem(KEY);
    return defaultState();
  }

  /* -------------------------
     PUBLIC API
  --------------------------*/
  return {
    load,
    save,
    reset
  };

})();