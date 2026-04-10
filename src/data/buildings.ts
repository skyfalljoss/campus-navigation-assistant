export type BuildingType = "academic" | "service" | "parking";

export type BuildingTag = "study" | "dining" | "parking";

export interface Room {
  id: string;
  name: string;
  floor: string;
  desc: string;
}

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  tags: BuildingTag[];
  lat: number;
  lng: number;
  primaryEntrance: [number, number];
  primaryEntranceRouteTarget?: [number, number];
  primaryEntranceLabel: string;
  primaryEntranceHint: string;
  entrances?: Array<{
    coordinates: [number, number];
    routeTarget?: [number, number];
    label: string;
    hint: string;
  }>;
  desc: string;
  rooms: Room[];
}

export const BUILDINGS: Building[] = [
  {
    id: "lib",
    name: "USF Library (LIB)",
    type: "academic",
    tags: ["study"],
    lat: 28.05948,
    lng: -82.41228,
    primaryEntrance: [28.05926, -82.41212],
    primaryEntranceRouteTarget: [28.05917, -82.41211],
    primaryEntranceLabel: "library mall entrance",
    primaryEntranceHint: "Faces the main east-west campus mall on the south side of the library.",
    entrances: [
      {
        coordinates: [28.05926, -82.41212],
        routeTarget: [28.05917, -82.41211],
        label: "library mall entrance",
        hint: "Faces the main east-west campus mall on the south side of the library.",
      },
      {
        coordinates: [28.0596, -82.41212],
        routeTarget: [28.05966, -82.41208],
        label: "north library entrance",
        hint: "Use the north-side approach near the library service road and north plaza.",
      },
    ],
    desc: "Main campus library and study spaces.",
    rooms: [
      { id: "lib-1", name: "Learning Commons", floor: "1st Floor", desc: "Open study area with computers" },
      { id: "lib-2", name: "Digital Media Commons", floor: "1st Floor", desc: "Multimedia editing and equipment checkout" },
      { id: "lib-3", name: "Special Collections", floor: "4th Floor", desc: "Rare books and archives" },
    ],
  },
  {
    id: "msc",
    name: "Marshall Student Center (MSC)",
    type: "service",
    tags: ["dining", "study"],
    lat: 28.06373,
    lng: -82.41349,
    primaryEntrance: [28.06365, -82.4132],
    primaryEntranceRouteTarget: [28.06358, -82.41308],
    primaryEntranceLabel: "MLK Plaza entrance",
    primaryEntranceHint: "Use the entrance facing MLK Plaza and the main student center courtyard.",
    entrances: [
      {
        coordinates: [28.06365, -82.4132],
        routeTarget: [28.06358, -82.41308],
        label: "MLK Plaza entrance",
        hint: "Use the entrance facing MLK Plaza and the main student center courtyard.",
      },
      {
        coordinates: [28.0638, -82.41362],
        routeTarget: [28.06384, -82.41374],
        label: "northwest student center entrance",
        hint: "Best for approaches coming from the northwest side of the student center.",
      },
    ],
    desc: "Student union, dining, and event spaces.",
    rooms: [
      { id: "msc-1", name: "Bulls Media", floor: "4th Floor", desc: "Student run media" },
      { id: "msc-2", name: "Food Court", floor: "1st Floor", desc: "Various dining options" },
      { id: "msc-3", name: "Oval Theater", floor: "2nd Floor", desc: "Large event and lecture space" },
    ],
  },
  {
    id: "enb",
    name: "Engineering Building II (ENB)",
    type: "academic",
    tags: ["study"],
    lat: 28.05875,
    lng: -82.41503,
    primaryEntrance: [28.05858, -82.41482],
    primaryEntranceLabel: "north entrance",
    primaryEntranceHint: "Approach from the north-side sidewalk near the engineering complex.",
    desc: "College of Engineering classrooms and labs.",
    rooms: [
      { id: "enb-109", name: "ENB 109", floor: "1st Floor", desc: "Near the main north entrance" },
      { id: "enb-118", name: "ENB 118", floor: "1st Floor", desc: "Large lecture hall" },
      { id: "enb-205", name: "ENB 205", floor: "2nd Floor", desc: "Computer Lab" },
    ],
  },
  {
    id: "isa",
    name: "Interdisciplinary Sciences (ISA)",
    type: "academic",
    tags: ["study"],
    lat: 28.06145,
    lng: -82.41385,
    primaryEntrance: [28.06131, -82.41364],
    primaryEntranceRouteTarget: [28.06124, -82.41356],
    primaryEntranceLabel: "science mall entrance",
    primaryEntranceHint: "Faces the open science mall walkway between ISA and the surrounding science buildings.",
    entrances: [
      {
        coordinates: [28.06131, -82.41364],
        routeTarget: [28.06124, -82.41356],
        label: "science mall entrance",
        hint: "Faces the open science mall walkway between ISA and the surrounding science buildings.",
      },
      {
        coordinates: [28.06157, -82.41363],
        routeTarget: [28.06163, -82.41354],
        label: "north science entrance",
        hint: "Best for approaches coming from the north side near the Allen Welcome Center.",
      },
      {
        coordinates: [28.06139, -82.41395],
        routeTarget: [28.06136, -82.41403],
        label: "west science entrance",
        hint: "Use the west-side door for arrivals approaching from the Natural Sciences side.",
      },
    ],
    desc: "Advanced science labs and lecture halls.",
    rooms: [
      { id: "isa-1051", name: "ISA 1051", floor: "1st Floor", desc: "Science Lecture Hall" },
      { id: "isa-2020", name: "ISA 2020", floor: "2nd Floor", desc: "Chemistry Lab" },
    ],
  },
  {
    id: "svc",
    name: "Student Services Building (SVC)",
    type: "service",
    tags: [],
    lat: 28.06249,
    lng: -82.41255,
    primaryEntrance: [28.06223, -82.41249],
    primaryEntranceRouteTarget: [28.06216, -82.41246],
    primaryEntranceLabel: "plaza-side entrance",
    primaryEntranceHint: "Enter from the plaza-facing side closest to the central campus walkway.",
    entrances: [
      {
        coordinates: [28.06223, -82.41249],
        routeTarget: [28.06216, -82.41246],
        label: "plaza-side entrance",
        hint: "Enter from the plaza-facing side closest to the central campus walkway.",
      },
      {
        coordinates: [28.06254, -82.4126],
        routeTarget: [28.0626, -82.41262],
        label: "north services entrance",
        hint: "Better for arrivals coming from the north side near Willow Drive.",
      },
    ],
    desc: "Admissions, Financial Aid, and Registrar.",
    rooms: [
      { id: "svc-1", name: "Admissions Desk", floor: "1st Floor", desc: "Undergraduate admissions" },
      { id: "svc-2", name: "Financial Aid Office", floor: "1st Floor", desc: "Financial aid counselors" },
    ],
  },
  {
    id: "rec",
    name: "Campus Recreation Center (REC)",
    type: "service",
    tags: [],
    lat: 28.06048,
    lng: -82.40752,
    primaryEntrance: [28.06026, -82.40733],
    primaryEntranceLabel: "southeast entrance",
    primaryEntranceHint: "Best approach is from the southeast corner by the adjacent road and sidewalk.",
    desc: "Fitness center, indoor track, and courts.",
    rooms: [
      { id: "rec-1", name: "Weight Room", floor: "1st Floor", desc: "Free weights and machines" },
      { id: "rec-2", name: "Cardio Deck", floor: "2nd Floor", desc: "Treadmills and ellipticals" },
      { id: "rec-3", name: "Basketball Courts", floor: "1st Floor", desc: "Indoor courts" },
    ],
  },
  {
    id: "sun",
    name: "Yuengling Center (SUN)",
    type: "service",
    tags: [],
    lat: 28.05924,
    lng: -82.40662,
    primaryEntrance: [28.05903, -82.40643],
    primaryEntranceLabel: "southeast entrance",
    primaryEntranceHint: "Use the sidewalk approach on the southeast side of the arena.",
    desc: "Arena for sports, concerts, and events.",
    rooms: [
      { id: "sun-1", name: "Main Arena", floor: "1st Floor", desc: "Basketball and volleyball court" },
      { id: "sun-2", name: "Ticket Office", floor: "Gate A", desc: "Box office" },
    ],
  },
  {
    id: "cpr",
    name: "Cooper Hall (CPR)",
    type: "academic",
    tags: ["study"],
    lat: 28.05961,
    lng: -82.41075,
    primaryEntrance: [28.05941, -82.41059],
    primaryEntranceLabel: "south entrance",
    primaryEntranceHint: "Faces the south-side pedestrian corridor leading toward the library area.",
    desc: "College of Arts and Sciences.",
    rooms: [{ id: "cpr-103", name: "CPR 103", floor: "1st Floor", desc: "General purpose classroom" }],
  },
  {
    id: "bsn",
    name: "Business Building (BSN)",
    type: "academic",
    tags: ["study"],
    lat: 28.05835,
    lng: -82.40978,
    primaryEntrance: [28.05814, -82.40966],
    primaryEntranceLabel: "south entrance",
    primaryEntranceHint: "Approach from the south sidewalk along the main business building frontage.",
    desc: "Muma College of Business.",
    rooms: [{ id: "bsn-1100", name: "Atrium", floor: "1st Floor", desc: "Main gathering space" }],
  },
  {
    id: "edu",
    name: "Education Building (EDU)",
    type: "academic",
    tags: ["study"],
    lat: 28.06076,
    lng: -82.41072,
    primaryEntrance: [28.06056, -82.41058],
    primaryEntranceRouteTarget: [28.06047, -82.41055],
    primaryEntranceLabel: "Mall-side entrance",
    primaryEntranceHint: "Faces the pedestrian mall on the south side near the main east-west path.",
    entrances: [
      {
        coordinates: [28.06056, -82.41058],
        routeTarget: [28.06047, -82.41055],
        label: "Mall-side entrance",
        hint: "Faces the pedestrian mall on the south side near the main east-west path.",
      },
      {
        coordinates: [28.06088, -82.41071],
        routeTarget: [28.06096, -82.41073],
        label: "north education entrance",
        hint: "Use the north-side entry if approaching from Collins Boulevard and the parking lots.",
      },
    ],
    desc: "College of Education.",
    rooms: [{ id: "edu-162", name: "TECO Hall", floor: "1st Floor", desc: "Large presentation hall" }],
  },
  {
    id: "fah",
    name: "Fine Arts Building (FAH)",
    type: "academic",
    tags: ["study"],
    lat: 28.06307,
    lng: -82.41659,
    primaryEntrance: [28.06302, -82.41634],
    primaryEntranceRouteTarget: [28.06295, -82.41628],
    primaryEntranceLabel: "arts plaza entrance",
    primaryEntranceHint: "Use the entrance facing the arts-side plaza and east walkway network.",
    entrances: [
      {
        coordinates: [28.06302, -82.41634],
        routeTarget: [28.06295, -82.41628],
        label: "arts plaza entrance",
        hint: "Use the entrance facing the arts-side plaza and east walkway network.",
      },
      {
        coordinates: [28.06314, -82.41663],
        routeTarget: [28.0632, -82.41672],
        label: "northwest arts entrance",
        hint: "Better for arrivals coming from the northwest arts complex side.",
      },
    ],
    desc: "College of The Arts.",
    rooms: [{ id: "fah-101", name: "Art Gallery", floor: "1st Floor", desc: "Student and faculty exhibitions" }],
  },
  {
    id: "shs",
    name: "Student Health Services (SHS)",
    type: "service",
    tags: [],
    lat: 28.06352,
    lng: -82.41198,
    primaryEntrance: [28.0633, -82.41183],
    primaryEntranceLabel: "southeast entrance",
    primaryEntranceHint: "Approach from the southeast path near the health services frontage.",
    desc: "Medical clinic and pharmacy.",
    rooms: [{ id: "shs-pharm", name: "Pharmacy", floor: "1st Floor", desc: "Prescription pickup" }],
  },
  {
    id: "fletcher-hub",
    name: "East Fletcher Transit Hub",
    type: "service",
    tags: [],
    lat: 28.06395,
    lng: -82.41872,
    primaryEntrance: [28.06395, -82.41872],
    primaryEntranceLabel: "pickup point",
    primaryEntranceHint: "Arrival is at the curbside transit stop area.",
    desc: "Popular pickup point near East Fletcher Ave and N Palms Dr.",
    rooms: [],
  },
  {
    id: "rab",
    name: "Richard A. Beard Parking Garage (RAB)",
    type: "parking",
    tags: ["parking"],
    lat: 28.05854,
    lng: -82.41711,
    primaryEntrance: [28.05835, -82.41692],
    primaryEntranceLabel: "east entrance",
    primaryEntranceHint: "Use the east-side vehicle and pedestrian access point.",
    desc: "Multi-level parking facility for students and staff.",
    rooms: [],
  },
  {
    id: "cbp",
    name: "Collins Blvd Parking Garage (CBP)",
    type: "parking",
    tags: ["parking"],
    lat: 28.06151,
    lng: -82.41197,
    primaryEntrance: [28.06129, -82.41178],
    primaryEntranceLabel: "southeast entrance",
    primaryEntranceHint: "Best approach is from the southeast corner near Collins Boulevard.",
    desc: "Visitor and permit parking near the library.",
    rooms: [],
  },
  {
    id: "chg",
    name: "Crescent Hill Parking Garage (CHG)",
    type: "parking",
    tags: ["parking"],
    lat: 28.06518,
    lng: -82.4121,
    primaryEntrance: [28.06497, -82.41191],
    primaryEntranceLabel: "southeast entrance",
    primaryEntranceHint: "Approach from the southeast side closest to the student center paths.",
    desc: "Parking near the Marshall Student Center.",
    rooms: [],
  },
];
