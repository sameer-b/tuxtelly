import { nearest, type Direction } from "@tuxtelly/core";

const directions: Record<string, Direction | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/** Move the remote's focus between interactive controls on the search page. */
export function navigateSearch(container: HTMLElement, event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const direction = directions[event.key];
  if (!direction) return false;

  // Horizontal arrows edit the query naturally; Up and Down leave the field.
  if (
    event.target instanceof HTMLInputElement &&
    (event.target.type === "text" || event.target.type === "search") &&
    (direction === "left" || direction === "right")
  )
    return false;

  const controls = [
    ...container.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]",
    ),
    ...document.querySelectorAll<HTMLElement>(
      '[data-search-nav="true"]:not(:disabled)',
    ),
  ].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const current = document.activeElement as HTMLElement | null;
  if (!current || !controls.includes(current)) return false;

  const nextIndex = nearest(
    current.getBoundingClientRect(),
    controls.map((element) => element.getBoundingClientRect()),
    direction,
  );
  if (nextIndex < 0) return false;

  event.preventDefault();
  event.stopPropagation();
  controls[nextIndex].focus();
  controls[nextIndex].scrollIntoView?.({ block: "nearest" });
  return true;
}
