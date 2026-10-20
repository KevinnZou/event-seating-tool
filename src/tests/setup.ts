import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

if (typeof HTMLDialogElement !== "undefined")
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };

if (typeof HTMLDialogElement !== "undefined")
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
