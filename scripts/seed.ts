/**
 * Creates a demo camp with a handful of patients so every screen has something to show.
 *   npm run db:seed
 */
import { getQueue } from "../src/lib/queue";
import { createCampWithPreset } from "../src/lib/queue/presets";

const q = getQueue();
if (q.getCampBySlug("demo")) {
  console.log("Demo camp already exists: /c/demo");
  process.exit(0);
}

const camp = createCampWithPreset(
  q,
  { slug: "demo", name: "Free Health Check-up Camp", venue: "Community Hall, Malleswaram, Bengaluru", opensAt: "09:00", closesAt: "17:00", slotMinutes: 30, slotCapacity: 8 },
  "general",
);
const by = (code: string) => q.listStations(camp.id).find((s) => s.code === code)!;

const people: [string, number, string, string?][] = [
  ["Lakshmi Devi", 68, "GEN"],
  ["Ravi Kumar", 41, "GEN"],
  ["Anitha S", 29, "SCR"],
  ["Mohammed Irfan", 52, "GEN"],
  ["Shobha Rao", 34, "EYE"],
  ["Suresh Babu", 74, "SCR"],
  ["Divya M", 27, "DEN"],
  ["Nagaraj K", 46, "GEN"],
  ["Kavya R", 31, "SCR"],
];
for (const [name, age, code] of people) {
  q.register({ campId: camp.id, stationId: by(code).id, name, age, source: "self", language: "en" });
}
// One patient is already being seen so the display board is not empty.
const called = q.callNext(by("GEN").id, 1);
if (called) q.startServing(called.id);
q.callNext(by("SCR").id, 1);

console.log("Seeded demo camp.\n  Sign-up:  /c/demo\n  Display:  /display/demo\n  Staff:    /staff/demo   (PIN 1234)\n  Admin:    /admin/demo   (PIN 9999)");
