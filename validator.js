const Validator = (() => {
  function timestamp(){
    return new Date().toISOString();
  }

  function makeFailure(rule, category, path, expected, received, description){
    return {
      rule,
      category,
      object: 'episode',
      path,
      expected,
      received,
      description,
      timestamp: timestamp()
    };
  }

  function validateEntityList(items, validIdFn, typeName){
    const failures = [];

    if (!Array.isArray(items)) {
      failures.push(makeFailure(
        `INVALID_${typeName.toUpperCase()}_LIST`,
        'structural',
        typeName,
        'array',
        typeof items,
        `${typeName} must be an array of objects.`
      ));
      return failures;
    }

    items.forEach((item, index) => {
      const prefix = `${typeName}[${index}]`;
      if (!item || typeof item !== 'object') {
        failures.push(makeFailure(
          `INVALID_${typeName.toUpperCase()}_ITEM`,
          'structural',
          prefix,
          'object',
          typeof item,
          `${typeName} entries must be objects.`
        ));
        return;
      }

      if (!Schema.isNonEmptyString(item.id)) {
        failures.push(makeFailure(
          `MISSING_${typeName.toUpperCase()}_ID`,
          'structural',
          `${prefix}.id`,
          'non-empty string',
          item.id,
          `${typeName} item must have an id.`
        ));
      } else if (!validIdFn(item.id)) {
        failures.push(makeFailure(
          `INVALID_${typeName.toUpperCase()}_ID`,
          'format',
          `${prefix}.id`,
          `${typeName.toUpperCase()}-###`,
          item.id,
          `${typeName} id must match the expected format.`
        ));
      }

      if (!Schema.isNonEmptyString(item.name)) {
        failures.push(makeFailure(
          `INVALID_${typeName.toUpperCase()}_NAME`,
          'structural',
          `${prefix}.name`,
          'non-empty string',
          item.name,
          `${typeName} item must have a name.`
        ));
      }
    });

    return failures;
  }

  function validate(ep){
    const failures = [];
    const expectedId = Schema.ID_PREFIX + ep.number.toString().padStart(3, '0');

    if (!Schema.isPositiveInteger(ep.number)) {
      failures.push(makeFailure(
        'INVALID_EPISODE_NUMBER',
        'integrity',
        'number',
        'positive integer',
        ep.number,
        'Episode number must be a positive integer.'
      ));
    }

    if (!Schema.isValidEpisodeId(ep.id)) {
      failures.push(makeFailure(
        'ID_FORMAT',
        'format',
        'id',
        'MAG-###',
        ep.id,
        'Episode ID must match the MAG-### format.'
      ));
    }

    if (ep.id !== expectedId) {
      failures.push(makeFailure(
        'ID_NUMBER_MISMATCH',
        'semantic',
        'id',
        expectedId,
        ep.id,
        'Episode ID must correspond to the episode number.'
      ));
    }

    if (!Schema.isNonEmptyString(ep.title)) {
      failures.push(makeFailure(
        'EMPTY_TITLE',
        'structural',
        'title',
        'non-empty string',
        ep.title,
        'Episode title is required and must not be empty.'
      ));
    }

    if (!Schema.isNonEmptyString(ep.summary)) {
      failures.push(makeFailure(
        'EMPTY_SUMMARY',
        'structural',
        'summary',
        'non-empty string',
        ep.summary,
        'Episode summary is required and must not be empty.'
      ));
    }

    if (!Schema.isValidSeason(ep.season)) {
      failures.push(makeFailure(
        'INVALID_SEASON',
        'semantic',
        'season',
        `integer ${Schema.MIN_SEASON}-${Schema.MAX_SEASON}`,
        ep.season,
        'Episode season must be within the allowed range.'
      ));
    }

    failures.push(...validateEntityList(ep.characters, Schema.isValidCharacterId, 'character'));
    failures.push(...validateEntityList(ep.locations, Schema.isValidLocationId, 'location'));
    failures.push(...validateEntityList(ep.artifacts, Schema.isValidArtifactId, 'artifact'));
    failures.push(...validateEntityList(ep.fearEntities, Schema.isValidFearId, 'fearEntity'));

    if (!Array.isArray(ep.references)) {
      failures.push(makeFailure(
        'INVALID_REFERENCES',
        'structural',
        'references',
        'array',
        typeof ep.references,
        'References must be an array of reference objects.'
      ));
    } else {
      ep.references.forEach((ref, index) => {
        const path = `references[${index}]`;
        if (!ref || typeof ref !== 'object') {
          failures.push(makeFailure(
            'INVALID_REFERENCE_ITEM',
            'structural',
            path,
            'object',
            typeof ref,
            'Each reference must be an object.'
          ));
          return;
        }
        if (!Schema.isNonEmptyString(ref.type)) {
          failures.push(makeFailure(
            'MISSING_REFERENCE_TYPE',
            'structural',
            `${path}.type`,
            'non-empty string',
            ref.type,
            'Reference type is required.'
          ));
        }
        if (!Schema.isNonEmptyString(ref.target) || !Schema.isValidEpisodeId(ref.target)) {
          failures.push(makeFailure(
            'INVALID_REFERENCE_TARGET',
            'referential',
            `${path}.target`,
            'MAG-###',
            ref.target,
            'Reference target must be a valid episode ID.'
          ));
        }
      });
    }

    return {
      ok: failures.length === 0,
      failures
    };
  }

  function repair(ep, failures){
    const repaired = { ...ep };
    const repairs = [];
    const expectedId = Schema.ID_PREFIX + ep.number.toString().padStart(3, '0');

    if (failures.some(f => f.rule === 'ID_FORMAT' || f.rule === 'ID_NUMBER_MISMATCH')) {
      repairs.push({
        rule: 'ID_NUMBER_MISMATCH',
        strategy: 'replace-with-canonical-id',
        original: repaired.id,
        repaired: expectedId,
        success: true
      });
      repaired.id = expectedId;
    }

    if (failures.some(f => f.rule === 'EMPTY_TITLE')) {
      const replacement = `Recovered Episode ${repaired.number}`;
      repairs.push({
        rule: 'EMPTY_TITLE',
        strategy: 'set-default-title',
        original: repaired.title,
        repaired: replacement,
        success: true
      });
      repaired.title = replacement;
    }

    if (failures.some(f => f.rule === 'EMPTY_SUMMARY')) {
      const replacement = `Recovered summary for episode ${repaired.number}.`;
      repairs.push({
        rule: 'EMPTY_SUMMARY',
        strategy: 'set-default-summary',
        original: repaired.summary,
        repaired: replacement,
        success: true
      });
      repaired.summary = replacement;
    }

    if (failures.some(f => f.rule === 'INVALID_SEASON')) {
      repairs.push({
        rule: 'INVALID_SEASON',
        strategy: 'clamp-season-to-default',
        original: repaired.season,
        repaired: Schema.MIN_SEASON,
        success: true
      });
      repaired.season = Schema.MIN_SEASON;
    }

    if (failures.some(f => f.rule === 'INVALID_CHARACTER_ID')) {
      repaired.characters = repaired.characters.map(character => {
        if (!Schema.isValidCharacterId(character.id)) {
          const replacement = `CHR-${String(repaired.number).padStart(3, '0')}`;
          repairs.push({
            rule: 'INVALID_CHARACTER_ID',
            strategy: 'replace-with-canonical-character-id',
            original: character.id,
            repaired: replacement,
            success: true
          });
          return { ...character, id: replacement };
        }
        return character;
      });
    }

    if (failures.some(f => f.rule === 'INVALID_REFERENCE_TARGET')) {
      repaired.references = repaired.references.map(reference => {
        if (!Schema.isValidEpisodeId(reference.target)) {
          const replacement = expectedId;
          repairs.push({
            rule: 'INVALID_REFERENCE_TARGET',
            strategy: 'replace-with-current-episode-id',
            original: reference.target,
            repaired: replacement,
            success: true
          });
          return { ...reference, target: replacement };
        }
        return reference;
      });
    }

    return {
      episode: repaired,
      repairs
    };
  }

  return {
    validate,
    repair
  };
})();
