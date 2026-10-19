import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import App from "../app/App";
afterEach(cleanup);
it("首页无名单且可打开创建表单", async () => {
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "本地活动" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "新建活动" }));
  expect(screen.getByLabelText("活动名称")).toBeInTheDocument();
});
