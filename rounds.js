// UK (Archery GB) rounds and venues.
//
// zone types:
//   "five" - Imperial 5-zone face: Gold 9, Red 7, Blue 5, Black 3, White 1
//   "ten"  - Metric 10-zone face: X/10 .. 1 (X counts 10)
//   "worc" - Worcester face: 5 .. 1
//   "field" - Field face (black, yellow centre): 6 (centre ring), 5 (yellow), 4 .. 1
// Each section is a block of arrows shot at one distance.

window.VENUES = [
  { id: "hillsborough", name: "1st Hillsborough", sub: "Scouts Archery", theme: "hillsborough" },
  { id: "lisburn", name: "Lisburn Cathedral", sub: "Archery Club", theme: "lisburn" },
  { id: "dagger", name: "Dagger Road", sub: "Archery Range", theme: "dagger" },
];

window.ROUNDS = [
  // ---- Indoor ----
  { id: "portsmouth", name: "Portsmouth", group: "Indoor", zone: "ten", perEnd: 3, sections: [{ label: "20 yd", arrows: 60 }] },
  { id: "wa18", name: "WA 18m", group: "Indoor", zone: "ten", perEnd: 3, sections: [{ label: "18 m", arrows: 60 }] },
  { id: "worcester", name: "Worcester", group: "Indoor", zone: "worc", perEnd: 5, sections: [{ label: "20 yd", arrows: 60 }] },
  { id: "bray1", name: "Bray I", group: "Indoor", zone: "ten", perEnd: 3, sections: [{ label: "20 yd", arrows: 30 }] },
  { id: "short-worc", name: "Short Worcester", group: "Indoor", zone: "worc", perEnd: 5, sections: [{ label: "20 yd", arrows: 30 }] },
  { id: "test", name: "Test", group: "Indoor", zone: "field", perEnd: 3, endsPerTurn: 2, sections: [{ label: "12 m", arrows: 24 }] },
  // ---- Outdoor Imperial ----
  { id: "york", name: "York", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "100 yd", arrows: 72 }, { label: "80 yd", arrows: 48 }, { label: "60 yd", arrows: 24 }] },
  { id: "hereford", name: "Hereford", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "80 yd", arrows: 72 }, { label: "60 yd", arrows: 48 }, { label: "50 yd", arrows: 24 }] },
  { id: "stgeorge", name: "St George", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "100 yd", arrows: 36 }, { label: "80 yd", arrows: 36 }, { label: "60 yd", arrows: 36 }] },
  { id: "windsor", name: "Windsor", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "60 yd", arrows: 36 }, { label: "50 yd", arrows: 36 }, { label: "40 yd", arrows: 36 }] },
  { id: "national", name: "National", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "60 yd", arrows: 48 }, { label: "50 yd", arrows: 24 }] },
  { id: "newwestern", name: "New Western", group: "Outdoor Imperial", zone: "five", perEnd: 6, sections: [{ label: "100 yd", arrows: 48 }, { label: "80 yd", arrows: 48 }] },
  // ---- Outdoor Metric ----
  { id: "wa720-70", name: "WA 720 (70 m)", group: "Outdoor Metric", zone: "ten", perEnd: 6, sections: [{ label: "70 m", arrows: 72 }] },
  { id: "wa720-60", name: "WA 720 (60 m)", group: "Outdoor Metric", zone: "ten", perEnd: 6, sections: [{ label: "60 m", arrows: 72 }] },
  { id: "metric-iii", name: "Metric III", group: "Outdoor Metric", zone: "ten", perEnd: 6, sections: [{ label: "50 m", arrows: 36 }, { label: "40 m", arrows: 36 }, { label: "30 m", arrows: 36 }] },
  { id: "short-metric", name: "Short Metric", group: "Outdoor Metric", zone: "ten", perEnd: 6, sections: [{ label: "50 m", arrows: 36 }, { label: "30 m", arrows: 36 }] },
];

// Buttons shown on the keypad for each face type: [label, value, colour-class]
window.ZONES = {
  five: [["9", 9, "gold"], ["7", 7, "red"], ["5", 5, "blue"], ["3", 3, "black"], ["1", 1, "white"], ["M", 0, "miss"]],
  ten: [["X", 10, "gold"], ["10", 10, "gold"], ["9", 9, "gold"], ["8", 8, "red"], ["7", 7, "red"], ["6", 6, "blue"],
        ["5", 5, "blue"], ["4", 4, "black"], ["3", 3, "black"], ["2", 2, "white"], ["1", 1, "white"], ["M", 0, "miss"]],
  field: [["6", 6, "gold"], ["5", 5, "gold"], ["4", 4, "black"], ["3", 3, "black"], ["2", 2, "black"], ["1", 1, "black"], ["M", 0, "miss"]],
  worc: [["5", 5, "black"], ["4", 4, "black"], ["3", 3, "white"], ["2", 2, "white"], ["1", 1, "white"], ["M", 0, "miss"]],
};

window.zoneMax = (z) => ({ five: 9, worc: 5, field: 6 }[z] || 10);
window.roundById = (id) => window.ROUNDS.find((r) => r.id === id);
window.roundTotals = (r) => ({
  arrows: r.sections.reduce((a, s) => a + s.arrows, 0),
  max: r.sections.reduce((a, s) => a + s.arrows, 0) * window.zoneMax(r.zone),
});
