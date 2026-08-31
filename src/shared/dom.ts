export const WOLF_ATTRIBUTE = "data-wolf-expansion";

export function createWolfElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  role: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.setAttribute(WOLF_ATTRIBUTE, role);
  return element;
}

export function removeWolfElements(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(`[${WOLF_ATTRIBUTE}]`).forEach((element) => {
    element.remove();
  });
}

export function isWolfElement(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest(`[${WOLF_ATTRIBUTE}]`) !== null;
}
