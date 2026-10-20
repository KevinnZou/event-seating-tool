import { pointSchema, venueSchema } from "./venueModels";
import { z } from "zod";
export const countSchema = z.number().int().min(1).max(999);
const timestamp = z.string().datetime();
const id = z.string().uuid();
export const eventSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  type: z.enum(["wedding", "banquet", "annual-party", "roundtable-other"]),
  date: z.iso.date().optional(),
  defaultCapacity: countSchema,
  overCapacityPolicy: z.enum(["block", "warn-confirm"]),
  createdAt: timestamp,
  updatedAt: timestamp,
  schemaVersion: z.literal(1),
  venue: venueSchema.optional(),
});
export const guestSchema = z.object({
  id,
  eventId: id,
  displayName: z.string().trim().min(1).max(100),
  size: countSchema,
  kind: z.enum(["person", "couple", "family", "team", "other"]),
  category: z.string().max(100).optional(),
  attendance: z.enum(["confirmed", "tentative", "declined"]),
  note: z.string().max(2000).optional(),
  tableId: id.nullable(),
  originGroupId: id.optional(),
  orderIndex: z.number().int().min(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const tableSchema = z.object({
  position: pointSchema.optional(),
  id,
  eventId: id,
  label: z.string().trim().min(1).max(40),
  capacity: countSchema,
  orderIndex: z.number().int().min(0),
  locked: z.boolean(),
  note: z.string().max(2000).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export const issueSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  entityId: z.string().optional(),
});
export type EventEntity = z.infer<typeof eventSchema>;
export type GuestGroupEntity = z.infer<typeof guestSchema>;
export type TableEntity = z.infer<typeof tableSchema>;
export type ValidationIssue = z.infer<typeof issueSchema>;
export interface Snapshot {
  event: EventEntity;
  guests: GuestGroupEntity[];
  tables: TableEntity[];
}
export interface LocalCheckpoint {
  id: string;
  eventId: string;
  createdAt: string;
  reason: "import" | "bulk-edit" | "manual";
  name?: string;
  snapshot: unknown;
}
export type EventInput = Pick<
  EventEntity,
  "name" | "type" | "date" | "defaultCapacity"
>;
export type GuestInput = Pick<
  GuestGroupEntity,
  "displayName" | "size" | "kind" | "category" | "attendance" | "note"
>;
export type TableInput = Pick<
  TableEntity,
  "label" | "capacity" | "locked" | "note"
>;
export const eventTypes = {
  wedding: "婚礼",
  banquet: "宴会",
  "annual-party": "年会",
  "roundtable-other": "其他圆桌活动",
};
export const attendanceLabels = {
  confirmed: "确认",
  tentative: "待定",
  declined: "不参加",
};
