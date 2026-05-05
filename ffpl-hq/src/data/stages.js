// Stage table — US and JP identical, confirmed from RAM dump analysis.
// IDs are the hex values stored in the save file's stage field.
export const FFFL_STAGES = [
  { id: 0x78, name: 'RUS FIELD',      cat: 4, ecm: 30,  avail: true  },
  { id: 0x79, name: 'VORTEX MINE',    cat: 2, ecm: 100, avail: true  },
  { id: 0x7A, name: 'FROS REGION',    cat: 3, ecm: 30,  avail: true  },
  { id: 0x7B, name: 'POLINE RANGE',   cat: 1, ecm: 50,  avail: true  },
  { id: 0x7F, name: 'RAWDY HANGAR',   cat: 2, ecm: 60,  avail: false },
  { id: 0x80, name: 'LPM FURNACE',    cat: 2, ecm: 960, avail: false },
  { id: 0x82, name: 'WAVIS CANYON',   cat: 1, ecm: 20,  avail: true  },
  { id: 0x83, name: 'VINA PARKING',   cat: 5, ecm: 110, avail: false },
  { id: 0x84, name: 'IGOL ISLAND',    cat: 3, ecm: 560, avail: true  },
  { id: 0x86, name: 'GRAND ARENA',    cat: 5, ecm: 180, avail: false },
  { id: 0xA3, name: 'YERI BLOCK',     cat: 4, ecm: 10,  avail: true  },
  { id: 0xA4, name: 'DUSK ARENA',     cat: 3, ecm: 200, avail: false },
  { id: 0xA6, name: 'SOLITER BASE',   cat: 4, ecm: 50,  avail: true  },
  { id: 0xAD, name: 'HATON FACTORY',  cat: 3, ecm: 10,  avail: false },
  { id: 0xAE, name: 'AZOY DESERT',    cat: 4, ecm: 230, avail: true  },
  { id: 0xB1, name: 'DIMCAGE TOWN',   cat: 4, ecm: 60,  avail: false },
  { id: 0xB4, name: 'AROS HIGHLAND',  cat: 1, ecm: 20,  avail: true  },
  { id: 0xB5, name: 'DEWLITE CITY',   cat: 5, ecm: 50,  avail: true  },
  { id: 0xB7, name: 'LEPTAS ARENA',   cat: 2, ecm: 10,  avail: false },
  { id: 0xB8, name: 'HOLLOW ARENA',   cat: 1, ecm: 650, avail: false },
];
