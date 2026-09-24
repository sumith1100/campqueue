import type { QueueService } from "./service";

export type Preset = "general" | "blank";

/**
 * A ready-made patient flow for a general health camp:
 *   Screening -> General physician -> Pharmacy
 *   Eye check-up (ends)      Dental (ends)
 */
export function createCampWithPreset(
  service: QueueService,
  camp: Parameters<QueueService["createCamp"]>[0],
  preset: Preset,
) {
  const created = service.createCamp(camp);
  if (preset === "blank") return created;

  const pharmacy = service.addStation({
    campId: created.id,
    name: "Pharmacy",
    code: "PHA",
    color: "#2e6a38",
    counters: 1,
    defaultServiceSeconds: 90,
    acceptsRegistration: false,
  });
  const general = service.addStation({
    campId: created.id,
    name: "General physician",
    code: "GEN",
    color: "#0a6f72",
    counters: 2,
    defaultServiceSeconds: 420,
    nextStationId: pharmacy.id,
  });
  service.addStation({
    campId: created.id,
    name: "BP and sugar screening",
    code: "SCR",
    color: "#b23c0c",
    counters: 2,
    defaultServiceSeconds: 150,
    nextStationId: general.id,
  });
  service.addStation({
    campId: created.id,
    name: "Eye check-up",
    code: "EYE",
    color: "#5a3ea3",
    counters: 1,
    defaultServiceSeconds: 300,
  });
  service.addStation({
    campId: created.id,
    name: "Dental",
    code: "DEN",
    color: "#a3194f",
    counters: 1,
    defaultServiceSeconds: 480,
  });
  return created;
}
