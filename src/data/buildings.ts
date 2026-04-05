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
    desc: "Parking near the Marshall Student Center.",
    rooms: [],
  },
];
