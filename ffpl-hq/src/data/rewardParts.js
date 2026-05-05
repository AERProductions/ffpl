// Cross-region season reward parts.
// US champions (retiring) earn JP-exclusive WH Hangar weapons.
// JP champions (retiring) earn high-tier US arm weapons.
// Part IDs are 0-indexed per the corresponding region's parts catalog.
export const FFPL_REWARD_PARTS = [
  // JP-native parts (US champion earns these on retirement)
  { id: 328, region: 'JP', name: 'CR-WH05BP',      label: 'CR-WH05BP     — JP WH Hangar'  },
  { id: 329, region: 'JP', name: 'CR-WH01HP',      label: 'CR-WH01HP     — JP WH Hangar'  },
  { id: 330, region: 'JP', name: 'WH09H-WRAITH',   label: 'WH09H-WRAITH  — JP WH Hangar'  },
  { id: 331, region: 'JP', name: 'WH12PL-ETTIN',   label: 'WH12PL-ETTIN  — JP WH Hangar'  },
  { id: 332, region: 'JP', name: 'WH10M-SILKY',    label: 'WH10M-SILKY   — JP WH Hangar'  },
  { id: 333, region: 'JP', name: 'WH11PU-PERYTON', label: 'WH11PU-PERYTON — JP WH Hangar' },
  { id: 334, region: 'JP', name: 'CR-WH01SP',      label: 'CR-WH01SP     — JP WH Hangar'  },
  { id: 335, region: 'JP', name: 'CR-WH05RLA',     label: 'CR-WH05RLA    — JP WH Hangar'  },
  { id: 336, region: 'JP', name: 'WH08RS-FENRIR',  label: 'WH08RS-FENRIR — JP WH Hangar'  },
  // US-native parts (JP champion earns these on retirement)
  { id: 287, region: 'US', name: 'CR-WR84RA2',     label: 'CR-WR84RA2    — US Arm Weapon'  },
  { id: 280, region: 'US', name: 'CR-WR84HNR',     label: 'CR-WR84HNR    — US Arm Weapon'  },
  { id: 279, region: 'US', name: 'CR-WR84HNM',     label: 'CR-WR84HNM    — US Arm Weapon'  },
  { id: 277, region: 'US', name: 'CR-WR84S',       label: 'CR-WR84S      — US Shotgun'     },
];
