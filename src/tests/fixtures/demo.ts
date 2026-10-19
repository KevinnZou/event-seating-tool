import type { GuestInput } from "../../domain/models";
export const demoGuests: GuestInput[] = [
  {
    displayName: "示例小禾一家",
    size: 4,
    kind: "family",
    category: "虚构亲友",
    attendance: "confirmed",
    note: "全体人物均为虚构",
  },
  {
    displayName: "示例星舟夫妻",
    size: 2,
    kind: "couple",
    category: "虚构朋友",
    attendance: "confirmed",
  },
  { displayName: "示例云朵", size: 1, kind: "person", attendance: "tentative" },
  { displayName: "示例云朵", size: 1, kind: "person", attendance: "confirmed" },
  {
    displayName: "示例青岚团队",
    size: 3,
    kind: "team",
    attendance: "confirmed",
  },
  { displayName: "示例木木", size: 1, kind: "person", attendance: "declined" },
];
