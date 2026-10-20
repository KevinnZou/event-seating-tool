import { z } from "zod";
export const feedbackSchema = z.object({
  category: z.enum(["功能问题", "操作体验", "兼容性", "功能建议"]),
  description: z.string().trim().min(1, "请描述问题或建议").max(2000),
  steps: z.string().trim().max(2000),
  privacyConfirmed: z.literal(true, {
    error: "请先确认内容不含私人名单或联系方式",
  }),
});
export function feedbackText(input: unknown) {
  const value = feedbackSchema.parse(input);
  return [
    "智能排桌助手 V0.1 · 匿名反馈草稿",
    `类型：${value.category}`,
    "",
    "问题或建议：",
    value.description,
    "",
    "虚构数据复现步骤：",
    value.steps || "未填写",
    "",
    "此草稿仅由用户填写，不附加活动、名单、URL、设备标识或浏览器日志。",
    "下载不代表已提交，请自行检查后决定是否分享。",
  ].join("\n");
}
