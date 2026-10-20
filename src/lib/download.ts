export function safeFilename(name: string) {
  const ext = name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? "";
  const base = (ext ? name.slice(0, -ext.length) : name)
    .split("")
    .map((c) =>
      c.charCodeAt(0) < 32 ||
      c.charCodeAt(0) === 127 ||
      '<>:"/\\|?*'.includes(c)
        ? "_"
        : c,
    )
    .join("")
    .replace(/[. ]+$/, "");
  return (base.slice(0, 90 - ext.length) || "活动") + ext;
}
export function download(
  content: BlobPart,
  name: string,
  type = "application/octet-stream",
) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(name);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
