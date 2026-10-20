import { z } from "zod";
export const pointSchema = z.object({
  x: z.number().int().min(0).max(12000),
  y: z.number().int().min(0).max(12000),
});
export const areaSchema = pointSchema.extend({
  id: z.string().uuid(),
  kind: z.enum(["stage", "entrance", "zone", "aisle"]),
  label: z.string().trim().min(1).max(60),
  width: z.number().int().min(40).max(12000),
  height: z.number().int().min(40).max(12000),
});
export const venueSchema = z
  .object({
    width: z.number().int().min(400).max(12000),
    height: z.number().int().min(400).max(12000),
    areas: z.array(areaSchema).max(100),
  })
  .superRefine((venue, ctx) => {
    const ids = new Set<string>();
    for (const area of venue.areas) {
      if (
        ids.has(area.id) ||
        area.x + area.width > venue.width ||
        area.y + area.height > venue.height
      )
        ctx.addIssue({ code: "custom", message: "区域ID重复或超出画布" });
      ids.add(area.id);
    }
  });
export type Point = z.infer<typeof pointSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type VenueArea = z.infer<typeof areaSchema>;
export const areaLabels = {
  aisle: "过道（禁放桌位）",
  stage: "舞台",
  entrance: "入口",
  zone: "自定义区域",
};
