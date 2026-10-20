import { it, expect } from "vitest";
import { feedbackText } from "../features/help/feedback";
it("反馈仅含用户填写信息，不附加活动和设备元数据", () => {
  const text = feedbackText({
    category: "操作体验",
    description: " 虚构复现：菜单不便查找 ",
    steps: "新建虚构活动后操作",
    privacyConfirmed: true,
    eventId: "must-not-include",
    guests: ["must-not-include"],
  });
  expect(text).toContain("菜单不便查找");
  expect(text).not.toContain("must-not-include");
  expect(text).toContain("下载不代表已提交");
});
it("空白和未经隐私确认的反馈不能生成", () => {
  expect(() =>
    feedbackText({
      category: "功能问题",
      description: " ",
      steps: "",
      privacyConfirmed: true,
    }),
  ).toThrow();
  expect(() =>
    feedbackText({
      category: "功能问题",
      description: "虚构问题",
      steps: "",
      privacyConfirmed: false,
    }),
  ).toThrow();
});
