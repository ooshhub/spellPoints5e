/* globals on, sendChat, log, findObjs, getAttrByName */

const spellPoints5e = (() => { //eslint-disable-line

  const scriptName = 'spellPoints5e',
    scriptVersion = '0.1.0';

  const config = {
    templates: ['atkdmg', 'atk', 'spell', 'dmg'],
    spellPointFlagAttribute: 'use_spell_points',
    spellPointProgression: [ 0, 2, 3, 5, 6, 7, 9, 10, 11, 13 ],
    spellPointsResourceNameRx: /spell\spoints\s*$/i,
  }

  const getSpellLevel = (msgContent) => {
    const spellLevel = (msgContent.match(/{{(spell)?level=([^}]*)/)||[])[2];
    return spellLevel ? spellLevel.replace(/\D/g, '') : null;
  }

  const getCharacter = (msgContent) => {
    const charName = (msgContent.match(/charname=([^}]*)(}|$)/)||[])[1];
    const char = findObjs({ type: 'character', name: charName })[0];
    return char;
  }

  const getSpellPointFlag = (character) => {
    if (!character || !character.id) return false;
    const spellPointFlag = getAttrByName(character.id, config.spellPointFlagAttribute);
    return spellPointFlag == 1 ? true : false;
  }

  const getSpellPoints = (character) => {
    if (!character || !character.id) return null;
    const staticAttributes = ['class_resource_name', 'other_resource_name'];
    const spellPointNameAttribute = findObjs({ type: 'attribute', characterid: character.id })
      .find(a => {
        const rx = /repeating_resource.*(left|right)_name$/i;
        if (rx.test(a.get('name')) || staticAttributes.includes(a.get('name'))) {
          if (config.spellPointsResourceNameRx.test(a.get('current'))) return a;
        }
      });
    if (!spellPointNameAttribute) return postMessage(`Couldn't find spell points resource on ${character.name}`, 'gm');
    const valueAttributeName = spellPointNameAttribute.get('name').replace(/_name$/i, ''),
      spellPointsAttribute = findObjs({ type: 'attribute', characterid: character.id, name: valueAttributeName })[0];
    if (!spellPointsAttribute) return postMessage(`Couldn't find spell points value on ${character.name}`, 'gm');
    return spellPointsAttribute;
  }

  const adjustSpellPoints = (character, spellPointsAttribute, spellLevel) => {
    const currentSpellPoints = parseInt(spellPointsAttribute.get('current')),
      requiredSpellPoints = config.spellPointProgression[spellLevel],
      templateStart = `SPELL CAST LEVEL ${spellLevel}%NEWLINE%`,
      templateCharName = character.get('name');
    let templateEnd = ``;
    if (!currentSpellPoints || currentSpellPoints < requiredSpellPoints) templateEnd = `<span style="color:red; font-weight: bold">NOT ENOUGH SPELL POINTS</span>`;
    else {
      const newSpellPoints = currentSpellPoints - requiredSpellPoints;
      spellPointsAttribute.set({ current: newSpellPoints });
      templateEnd = `${newSpellPoints} SPELL POINTS REMAIN`;
    }
    postSimple(`${templateStart}${templateEnd}`, templateCharName)
  }

  const postMessage = (content, whisper) => {
    const whisperTo = whisper ? `/w "${whisper}" ` : '';
    sendChat(scriptName, `${whisperTo}${content}`);
  }

  const postSimple = (content, charName, whisper) => {
    const prefix = `&{template:simple} {{rname=`,
      suffix = `}}`,
      charname = `{{charname=${charName}}}`;
    postMessage(`${prefix}${content}${suffix}${charname}`, whisper);
  }
  
  const handleInput = (msg) => {
    if (msg.rolltemplate && config.templates.includes(msg.rolltemplate)) {
      const spellLevel = getSpellLevel(msg.content);
      if (spellLevel > 0) {
        const caster = getCharacter(msg.content);
        if (!caster) {
          postMessage(`Couldn't find caster for level ${spellLevel} spellcast.`, 'gm');
          return;
        }
        const isUsingSpellPoints = getSpellPointFlag(caster);
        if (isUsingSpellPoints) {
          const spellPointsAttribute = getSpellPoints(caster);
          if (spellPointsAttribute) adjustSpellPoints(caster, spellPointsAttribute, spellLevel);
        }
      }
    }
  }

  on('ready', () => {
    on('chat:message', handleInput);
    log(`${scriptName} - v${scriptVersion}`);
  });

})();