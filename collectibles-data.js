// Source: Main!G34:L38 (magazines), read 2026-09-07; Vault-Tec charms from the 2.1.2 release plugin (2026-10-06). Keep source effects verbatim for traceability.
// Photos and location hints supplied by the mod author on 2026-09-08.
const COLLECTIBLES = [
  {
    "type": "magazines",
    "sourceRow": 34,
    "name": "Backpacks of the Commonwealth",
    "locationId": "GameStart",
    "effects": [
      "+BP",
      "+BP"
    ],
    "thumbnail": "assets/collectibles/magazineCommonwealth.jpg"
  },
  {
    "type": "magazines",
    "sourceRow": 35,
    "name": "Backpacks of the Armored Infantry",
    "locationId": "ConcordMuseumExt02",
    "effects": [
      "+20PACC",
      "+PACC"
    ],
    "thumbnail": "assets/collectibles/magazineInfantry.jpg",
    "locationImage": "assets/collectibles/magazinelocationInfantry.jpg",
    "locationHint": "on a desk"
  },
  {
    "type": "magazines",
    "sourceRow": 36,
    "name": "Backpacks of the Future",
    "locationId": "CabotHouse03",
    "effects": [
      "+20PACC",
      "+5RR"
    ],
    "thumbnail": "assets/collectibles/magazineFuture.jpg",
    "locationImage": "assets/collectibles/magazinelocationFuture.jpg",
    "locationHint": "on a desk"
  },
  {
    "type": "magazines",
    "sourceRow": 37,
    "name": "Backpacks of the U.S. Military",
    "locationId": "CambridgePD01",
    "effects": [
      "+20PACC",
      "+5DR"
    ],
    "thumbnail": "assets/collectibles/magazineMilitary.jpg",
    "locationImage": "assets/collectibles/magazinelocationMilitary.jpg",
    "locationHint": "on a desk"
  },
  {
    "type": "magazines",
    "sourceRow": 38,
    "name": "Backpacks of the Wilderness",
    "locationId": "BackpackRoom",
    "effects": [
      "+20PACC",
      "+SpawnRate"
    ],
    "thumbnail": "assets/collectibles/magazineWilderness.jpg",
    "locationImage": "assets/collectibles/magazinelocationWilderness.jpg",
    "locationHint": "on a nightstand"
  },
  {
    "type": "charms",
    "sourceRow": 40,
    "name": "Vault-Tec “Smooth-Operator” Charm",
    "edition": "Vault-Tec “Smooth-Operator” Edition",
    "locationId": "VaultTecOffice01",
    "effects": [
      "+1 Charisma while your weapon is holstered",
      "5% better buying and selling prices"
    ],
    "thumbnail": "assets/collectibles/charm-smooth-operator.webp",
    "locationImage": "assets/collectibles/bobblelocationCharisma.jpg",
    "locationHint": "on a desk next to a fan"
  },
  {
    "type": "charms",
    "sourceRow": 41,
    "name": "Vault-Tec “Goo-On-My-Shoe” Charm",
    "edition": "Vault-Tec “Goo-On-My-Shoe” Edition",
    "locationId": "BackpackRoom",
    "effects": [
      "Energy weapon kills restore 10 Action Points"
    ],
    "thumbnail": "assets/collectibles/charm-goo-on-my-shoe.webp",
    "locationImage": "assets/collectibles/bobblelocationEnergy.jpg",
    "locationHint": "on a desk inside a cage"
  },
  {
    "type": "charms",
    "sourceRow": 42,
    "name": "Vault-Tec “Big-Boom” Charm",
    "edition": "Vault-Tec “Big-Boom” Edition",
    "locationId": "Vault81",
    "effects": [
      "+15% ballistic damage against targets at full health"
    ],
    "thumbnail": "assets/collectibles/charm-big-boom.webp",
    "locationImage": "assets/collectibles/bobblelocationGuns.jpg",
    "locationHint": "on top of a dresser"
  },
  {
    "type": "charms",
    "sourceRow": 43,
    "name": "Vault-Tec “Stealthy-Boy” Charm",
    "edition": "Vault-Tec “Stealthy-Boy” Edition",
    "locationId": "DLC03Vault118",
    "effects": [
      "10% harder to detect while sneaking",
      "15% at night"
    ],
    "thumbnail": "assets/collectibles/charm-stealthy-boy.webp",
    "locationImage": "assets/collectibles/bobblelocationSneak.jpg",
    "locationHint": "on a nightstand"
  },
  {
    "type": "charms",
    "sourceRow": 44,
    "name": "Vault-Tec “Rad-Ical” Charm",
    "edition": "Vault-Tec “Rad-Ical” Edition",
    "locationId": "BackpackBunker",
    "effects": [
      "+15 Radiation Resistance",
      "+1 Endurance while above 300 rads"
    ],
    "thumbnail": "assets/collectibles/charm-rad-ical.webp"
  },
  {
    "type": "charms",
    "sourceRow": 45,
    "name": "Vault-Tec “Iron-Fist” Charm",
    "edition": "Vault-Tec “Iron-Fist” Edition",
    "locationId": "Vault75",
    "effects": [
      "Unarmed and melee power attacks do 10% more damage"
    ],
    "thumbnail": "assets/collectibles/charm-iron-fist.webp"
  },
  {
    "type": "charms",
    "sourceRow": 46,
    "name": "Vault-Tec “Jet-Setter” Charm",
    "edition": "Vault-Tec “Jet-Setter” Edition",
    "locationId": "Vault114",
    "effects": [
      "5% faster movement out of combat"
    ],
    "thumbnail": "assets/collectibles/charm-jet-setter.webp"
  },
  {
    "type": "charms",
    "sourceRow": 47,
    "name": "Vault-Tec “Night-Owl” Charm",
    "edition": "Vault-Tec “Night-Owl” Edition",
    "locationId": "Vault111Cryo",
    "effects": [
      "+1 Perception and +1 Intelligence from 8 PM to 6 AM"
    ],
    "thumbnail": "assets/collectibles/charm-night-owl.webp"
  }
];
