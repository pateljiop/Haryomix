export type UnitCategory = "length" | "mass" | "temperature" | "area" | "volume" | "speed" | "time" | "storage";
export const UNIT_OPTIONS: Record<UnitCategory, readonly { value: string; label: string }[]> = {
  length: [{value:"mm",label:"Millimetre (mm)"},{value:"cm",label:"Centimetre (cm)"},{value:"m",label:"Metre (m)"},{value:"km",label:"Kilometre (km)"},{value:"in",label:"Inch (in)"},{value:"ft",label:"Foot (ft)"},{value:"yd",label:"Yard (yd)"},{value:"mi",label:"Mile (mi)"}],
  mass: [{value:"mg",label:"Milligram (mg)"},{value:"g",label:"Gram (g)"},{value:"kg",label:"Kilogram (kg)"},{value:"tonne",label:"Metric tonne (t)"},{value:"oz",label:"Ounce (oz)"},{value:"lb",label:"Pound (lb)"}],
  temperature: [{value:"C",label:"Celsius (°C)"},{value:"F",label:"Fahrenheit (°F)"},{value:"K",label:"Kelvin (K)"}],
  area: [{value:"cm2",label:"Square centimetre (cm²)"},{value:"m2",label:"Square metre (m²)"},{value:"km2",label:"Square kilometre (km²)"},{value:"ft2",label:"Square foot (ft²)"},{value:"acre",label:"Acre"},{value:"ha",label:"Hectare (ha)"}],
  volume: [{value:"ml",label:"Millilitre (mL)"},{value:"l",label:"Litre (L)"},{value:"m3",label:"Cubic metre (m³)"},{value:"cup",label:"US cup"},{value:"gal",label:"US gallon"}],
  speed: [{value:"ms",label:"Metres/second (m/s)"},{value:"kmh",label:"Kilometres/hour (km/h)"},{value:"mph",label:"Miles/hour (mph)"},{value:"knot",label:"Knot"}],
  time: [{value:"ms",label:"Millisecond (ms)"},{value:"s",label:"Second (s)"},{value:"min",label:"Minute (min)"},{value:"h",label:"Hour (h)"},{value:"day",label:"Day"},{value:"week",label:"Week"}],
  storage: [{value:"B",label:"Byte (B)"},{value:"KB",label:"Kilobyte (KB)"},{value:"MB",label:"Megabyte (MB)"},{value:"GB",label:"Gigabyte (GB)"},{value:"TB",label:"Terabyte (TB)"}],
};
const FACTORS: Partial<Record<UnitCategory, Record<string, number>>> = {
  length: {mm:.001,cm:.01,m:1,km:1000,in:.0254,ft:.3048,yd:.9144,mi:1609.344},
  mass: {mg:.000001,g:.001,kg:1,tonne:1000,oz:.028349523125,lb:.45359237},
  area: {cm2:.0001,m2:1,km2:1e6,ft2:.09290304,acre:4046.8564224,ha:10000},
  volume: {ml:.001,l:1,m3:1000,cup:.2365882365,gal:3.785411784},
  speed: {ms:1,kmh:1/3.6,mph:.44704,knot:.5144444444},
  time: {ms:.001,s:1,min:60,h:3600,day:86400,week:604800},
  storage: {B:1,KB:1024,MB:1024**2,GB:1024**3,TB:1024**4},
};
export function convertUnit(value: number, category: UnitCategory, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new Error("Enter a valid finite number.");
  if (!UNIT_OPTIONS[category].some(unit=>unit.value===from) || !UNIT_OPTIONS[category].some(unit=>unit.value===to)) throw new Error("Choose units from the selected category.");
  let result: number;
  if (category === "temperature") {
    const celsius = from === "C" ? value : from === "F" ? (value - 32) * 5/9 : value - 273.15;
    result = to === "C" ? celsius : to === "F" ? celsius * 9/5 + 32 : celsius + 273.15;
  } else {
    const factors = FACTORS[category];
    if (!factors) throw new Error("This conversion is not supported.");
    result = value * factors[from] / factors[to];
  }
  if (!Number.isFinite(result)) throw new Error("Converted value is outside the supported numeric range.");
  return Object.is(result, -0) ? 0 : result;
}
