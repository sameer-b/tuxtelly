import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateSearch } from "./search-navigation";

function setRect(element: HTMLElement, rect: DOMRect) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);
}

function rect(left: number, top: number, width = 100, height = 40) {
  return new DOMRect(left, top, width, height);
}

describe("search remote navigation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("moves down from the query into the service filters", () => {
    const container = document.createElement("main");
    const query = document.createElement("input");
    query.type = "search";
    const submit = document.createElement("button");
    submit.textContent = "Search";
    const peacock = document.createElement("input");
    peacock.type = "checkbox";
    container.append(query, submit, peacock);
    document.body.append(container);
    setRect(query, rect(10, 10, 300));
    setRect(submit, rect(320, 10));
    setRect(peacock, rect(10, 70, 25, 25));
    query.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });

    expect(navigateSearch(container, event)).toBe(true);
    expect(document.activeElement).toBe(peacock);
    expect(event.defaultPrevented).toBe(true);
  });

  it("moves up from the query to the Search tab in the top navigation", () => {
    const nav = document.createElement("button");
    nav.dataset.searchNav = "true";
    const container = document.createElement("main");
    const query = document.createElement("input");
    query.type = "search";
    const filter = document.createElement("input");
    filter.type = "checkbox";
    container.append(query, filter);
    document.body.append(nav, container);
    setRect(nav, rect(300, 10));
    setRect(query, rect(10, 80, 400));
    setRect(filter, rect(10, 150, 25, 25));
    query.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    });

    expect(navigateSearch(container, event)).toBe(true);
    expect(document.activeElement).toBe(nav);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves left and right arrows available for editing the query", () => {
    const container = document.createElement("main");
    const query = document.createElement("input");
    query.type = "search";
    container.append(query);
    document.body.append(container);
    query.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });

    expect(navigateSearch(container, event)).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(query);
  });

  it("moves vertically between result actions and stops parent navigation", () => {
    const container = document.createElement("main");
    const first = document.createElement("button");
    const second = document.createElement("button");
    first.textContent = "Open Peacock";
    second.textContent = "Open Hulu";
    container.append(first, second);
    document.body.append(container);
    setRect(first, rect(10, 10));
    setRect(second, rect(10, 70));
    first.focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    const parentHandler = vi.fn();
    container.parentElement?.addEventListener("keydown", parentHandler);

    expect(navigateSearch(container, event)).toBe(true);
    expect(document.activeElement).toBe(second);
    expect(parentHandler).not.toHaveBeenCalled();
  });
});
