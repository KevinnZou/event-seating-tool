import { ZodError } from "zod";
export function errorMessage(error: unknown, fallback = "操作失败，请重试") {
  const e = error as {
    name?: string;
    inner?: { name?: string };
    failures?: { name?: string }[];
  };
  if (
    e?.name === "QuotaExceededError" ||
    e?.inner?.name === "QuotaExceededError" ||
    e?.failures?.some((f) => f.name === "QuotaExceededError")
  )
    return "本机存储空间不足，本次变更未保存。请先下载备份，再删除不需要的历史检查点。";
  if (error instanceof ZodError)
    return "输入不符合要求，请核对必填项、人数与容量范围。";
  return error instanceof Error ? error.message : fallback;
}
