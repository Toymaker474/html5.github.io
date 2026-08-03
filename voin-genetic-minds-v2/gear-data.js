export const HEARTS = {
  'Alum Heart': { hp: 1, tempRegen: 0.30, defense: 0.20, tags: ['temporary','cooldown'] },
  'Emerald Heart': { hp: 4, regen: 0.22, defense: 0.18, tags: ['regeneration'] },
  'Fragile Guardian Heart': { hp: 3, lightningWard: 0.42, mobility: 0.10, tags: ['lightning','invulnerability'] },
  'Golden Heart': { hp: 1, luck: 0.56, defense: -0.20, tags: ['luck','greed'] },
  'Hunger Heart': { hp: 4, ichorHeal: 0.32, resource: -0.15, tags: ['ichor','healing'] },
  'Mortal Heart': { hp: 5, damage: 0.18, resource: 0.48, luck: 0.48, noAttackHeal: true, tags: ['damage','ichor','luck'] },
  'Northern Heart': { hp: 5, absorb: 0.34, defense: 0.35, tags: ['defense','absorb'] },
  'Obsidian Heart': { hp: 4, physical: 0.16, fire: 0.16, tags: ['physical','fire'] },
  'Phoenix Heart': { hp: 3, revive: 0.72, fire: 0.18, tags: ['revive','fire'] },
  'Quartz Heart': { hp: 3, tempOnHit: 0.35, defense: 0.24, tags: ['temporary','retaliation'] },
  'Ruby Heart': { hp: 4, resource: 0.32, tags: ['ichor'] },
  'Twin-Fused Heart': { hp: 4, missingHeartDamage: 0.20, fire: 0.12, cold: 0.12, tags: ['fire','cold','berserk'] },
  'Vampiric Heart': { hp: 4, critHeal: 0.28, tags: ['critical','healing'] }
};

export const ARTIFACTS = {
  'Chimerical Key': { psychic: 0.16, critPower: 0.14, tags: ['psychic','critical'] },
  'Emerald Key': { psychicResist: 0.20, critPower: 0.12, tags: ['psychic','critical'] },
  'Golden Scarab': { luckPerKill: 0.04, maxLuckStacks: 20, tags: ['luck','streak'] },
  'Hand of Misfortune': { chestLuck: 0.65, chestExplosion: 0.19, tags: ['chest','luck','greed'] },
  'Necromantic Goblet': { ichorOnHit: 0.10, tags: ['ichor','on-hit'] },
  'Owl Statuette': { mobility: 0.28, exploration: 0.24, tags: ['movement','exploration'] },
  'Pocket Cloud': { airMobility: 0.34, lightningStrike: 0.20, tags: ['air','movement','lightning'] },
  'Prancing Steed': { mobility: 0.35, extraJump: 1, tags: ['movement','exploration'] },
  'Ritual Skull': { ichorOrbChance: 0.08, resource: 0.25, tags: ['ichor','kill'] },
  'Tibia': { cooldown: 0.22, chainCooldown: 0.18, tags: ['cooldown','power'] },
  'Weird Claw': { tempHeartBonus: 0.30, defense: 0.18, tags: ['temporary','defense'] }
};

export const NECKLACES = {
  'Dragonhead': { fireProc: 0.18, fire: 0.20, tags: ['fire','meteor'] },
  'Phoenix Feather': { fire: 0.28, selfAblaze: 0.12, tags: ['fire','risk'] },
  'Poison Vial Pendant': { poisonCrit: 0.22, tags: ['poison','critical'] },
  'Runic Amulet': { lightning: 0.24, runePower: 0.28, tags: ['lightning','rune'] },
  'Screeching Necklet': { psychic: 0.25, weakened: 0.20, tags: ['psychic','debuff'] },
  'Shardcaller': { coldProc: 0.20, cold: 0.22, tags: ['cold','freeze'] },
  'Viper Eye': { poison: 0.28, selfPoison: 0.10, tags: ['poison','risk'] }
};

export const RUNES = {
  'Capacious Runes': { hits: 6, heavy: 0.42, burst: 0.22, tags: ['heavy','physical'] },
  'Runes of Chaotic Elements': { hits: 4, elemental: 0.20, debuff: 0.22, tags: ['elemental','debuff'] },
  'Rune of Gathering Storm': { hits: 4, lightning: 0.32, chain: 0.24, tags: ['lightning','swarm'] },
  'Runes of Hurtful Remedy': { hits: 7, purge: 0.36, burst: 0.25, tags: ['debuff','burst'] },
  'Major Runes of Energy Flow': { hits: 5, cooldown: 0.20, tags: ['cooldown','power'] },
  'Minor Runes of Energy Flow': { hits: 3, cooldown: 0.16, tags: ['cooldown','power'] },
  'Runes of Purist': { hits: 4, heal: 0.24, noLightHeal: true, tags: ['healing','rune'] },
  'Runes of Thunder Echoes': { hits: 5, lightning: 0.30, clones: 4, tags: ['lightning','swarm'] }
};

export const WEAPONS = {
  'Ashmaker': { min: 28, max: 37, speed: 1.20, reach: 0.85, fire: 0.34, powerStyle: 'furnace', tags: ['dagger','fire'] },
  'Barbarian Blade': { min: 58, max: 66, speed: 0.70, reach: 1.25, rage: 0.24, powerStyle: 'greatsword', tags: ['sword','physical','rage'] },
  'Black Razor': { min: 34, max: 40, speed: 1.25, reach: 1.00, execute: 0.15, powerStyle: 'sword', tags: ['sword','execute'] },
  'Crusher': { min: 66, max: 84, speed: 0.66, reach: 1.12, heavy: 0.34, powerStyle: 'hammer', tags: ['hammer','heavy','weakened'] },
  'Flamekeeper Sickles': { min: 18, max: 24, speed: 2.05, reach: 0.66, invulnPower: 0.92, powerStyle: 'skillspam', tags: ['dual','fire','invulnerability'] },
  'Frostcore': { min: 55, max: 65, speed: 0.82, reach: 1.16, cold: 0.34, powerStyle: 'greatsword', tags: ['sword','cold','aura'] },
  'Intricate Dagger': { min: 21, max: 45, speed: 1.42, reach: 0.72, parryCooldown: 0.20, sharpen: 0.20, powerStyle: 'dagger', tags: ['dagger','parry','cooldown'] },
  'Iron Claymore': { min: 42, max: 48, speed: 1.00, reach: 1.35, comboCrit: 0.18, powerStyle: 'greatsword', tags: ['sword','combo','critical'] },
  "Lightning's Sword": { min: 28, max: 34, speed: 1.08, reach: 1.03, lightning: 0.26, powerStyle: 'sword', tags: ['sword','lightning'] },
  'Scorching Twins': { min: 12, max: 16, speed: 2.10, reach: 0.72, fire: 0.36, vortex: 0.25, powerStyle: 'skillspam', tags: ['dual','fire','swarm'] },
  'Sickles': { min: 10, max: 18, speed: 2.20, reach: 0.62, guaranteedCrit: 0.20, powerStyle: 'dual', tags: ['dual','critical','on-hit'] },
  'Storm Tachi': { min: 24, max: 28, speed: 1.55, reach: 1.05, lightning: 0.38, powerStyle: 'sword', tags: ['sword','lightning','rune'] },
  'The Rose': { min: 42, max: 48, speed: 1.02, reach: 1.08, clones: 0.24, airMobility: 0.18, powerStyle: 'sword', tags: ['sword','air','lightning'] },
  'Wraith': { min: 35, max: 41, speed: 1.35, reach: 0.72, perfectDash: 0.42, freeze: 0.30, powerStyle: 'dagger', tags: ['dagger','dash','cold'] },
  'Windraiser': { min: 36, max: 41, speed: 1.28, reach: 1.10, forceWave: 0.24, powerStyle: 'sword', tags: ['sword','ranged','physical'] }
};

export const RINGS = {
  'Ring of Arcane Retribution': { retaliation: 0.30, tempHeartSynergy: 0.26, tags: ['retaliation','temporary'] },
  'Bloody Ring': { healing: 0.35, selfWeaken: 0.10, tags: ['healing','risk'] },
  'Crystalline Ring': { dashDamage: 0.22, cold: 0.24, tags: ['dash','cold'] },
  'Ring of Floating Butterfly': { dashDamage: 0.25, lightning: 0.20, tags: ['dash','lightning'] },
  'Ring of Murder': { crit: 0.20, marked: 0.24, tags: ['critical','burst'] },
  'Ring of Purging Shock': { cleanse: 0.24, retaliation: 0.16, tags: ['cleanse','physical'] },
  'Ring of Rot': { poison: 0.30, tags: ['poison','on-hit'] }
};

export const SOULFRUITS = {
  'Blood Strider': { dashRecovery: 0.28, regen: 0.18, cost: 5, tags: ['dash','healing'] },
  'Conflux Core': { elemental: 0.22, cost: 8, tags: ['elemental'] },
  'Debtless Death': { deathRetention: 1, resource: -0.40, cost: 3, tags: ['death','ichor'] },
  "Duelist's Muse": { experience: 0.30, combo: 0.18, cost: 4, tags: ['experience','combo'] },
  'Echo Trial': { revive: 0.55, cost: 10, tags: ['revive','challenge'] },
  'Fractal Step': { mobility: 0.24, dashRecovery: 0.22, cost: 8, tags: ['dash','movement'] },
  "Gambler's Guillotine": { damage: 0.25, crit: -1, cost: 6, tags: ['damage','no-crit'] },
  'Leech': { ichorOnHit: 0.14, cost: 6, tags: ['ichor','on-hit'] },
  'Pulsing Sacrifice': { cooldown: 0.40, selfDamage: 0.18, cost: 6, tags: ['cooldown','risk'] },
  'Runic Maw': { runeCharge: 0.32, cost: 6, tags: ['rune','cooldown'] },
  'Scorched Bloom': { lastHeartDamage: 0.50, cost: 6, tags: ['berserk','damage'] },
  'Stolen Moment': { invulnerability: 0.30, cost: 4, tags: ['invulnerability','defense'] },
  'Storm Covenant': { lightning: 0.30, fire: -1, cold: -1, cost: 6, tags: ['lightning'] },
  "Wind's Hunger": { mobility: 0.52, cost: 8, tags: ['dash','movement'] },
  'Undying': { healing: 0.28, cost: 5, tags: ['healing','survival'] }
};

export const COMMUNITY_SEEDS = [
  {
    name: 'Community Immortality / Skill Spam',
    confidence: 0.93,
    source: 'Steam guide + comments',
    build: {
      weapon: 'Flamekeeper Sickles', artifact: 'Tibia', heart: 'Alum Heart',
      rune: 'Minor Runes of Energy Flow', ring: 'Ring of Floating Butterfly',
      necklace: 'Dragonhead', soulfruit: 'Stolen Moment'
    },
    note: 'Power-use invulnerability, cooldown stacking, Sharpened, fast multi-hit powers. Expensive to fully level.'
  },
  {
    name: 'Wraith Perfect-Dash Freeze',
    confidence: 0.74,
    source: 'Community video + equipment guide',
    build: {
      weapon: 'Wraith', artifact: 'Prancing Steed', heart: 'Northern Heart',
      rune: 'Rune of Gathering Storm', ring: 'Crystalline Ring',
      necklace: 'Shardcaller', soulfruit: 'Fractal Step'
    },
    note: 'Perfect Dash grants Obscured, freezes on hit, and stacks cold/dash retaliation.'
  },
  {
    name: 'Ichor Harvester',
    confidence: 0.86,
    source: 'Official equipment data + farming discussion',
    build: {
      weapon: 'Sickles', artifact: 'Ritual Skull', heart: 'Mortal Heart',
      rune: 'Minor Runes of Energy Flow', ring: 'Ring of Murder',
      necklace: 'Runic Amulet', soulfruit: 'Leech'
    },
    note: 'High hit count, Ichor-on-hit/orb generation, Resourcefulness and fast pack clears.'
  },
  {
    name: 'Chest-Rarity Greed',
    confidence: 0.78,
    source: 'Official equipment data',
    build: {
      weapon: 'Storm Tachi', artifact: 'Hand of Misfortune', heart: 'Golden Heart',
      rune: 'Runes of Thunder Echoes', ring: 'Ring of Murder',
      necklace: 'Runic Amulet', soulfruit: "Gambler's Guillotine"
    },
    note: 'Maximizes rarity and chest value but accepts one-heart and exploding-chest risk.'
  },
  {
    name: 'Heavy Rage Crusher',
    confidence: 0.68,
    source: 'Equipment guide + 0.4 itemization screenshot',
    build: {
      weapon: 'Crusher', artifact: 'Tibia', heart: 'Obsidian Heart',
      rune: 'Capacious Runes', ring: 'Ring of Murder',
      necklace: 'Dragonhead', soulfruit: 'Conflux Core'
    },
    note: 'Slow heavy attacks, large crits, force waves and physical/fire scaling.'
  }
];

export const GEAR_TABLES = {
  heart: HEARTS,
  artifact: ARTIFACTS,
  necklace: NECKLACES,
  rune: RUNES,
  weapon: WEAPONS,
  ring: RINGS,
  soulfruit: SOULFRUITS
};

export const GEAR_KEYS = Object.fromEntries(Object.entries(GEAR_TABLES).map(([k,v])=>[k,Object.keys(v)]));
