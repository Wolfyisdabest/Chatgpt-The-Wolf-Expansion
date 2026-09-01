import type { ChatGPTAdapter } from "../../adapters/chatgpt/ChatGPTAdapter";
import type { Logger } from "../../core/logger";
import { createWolfElement } from "../../shared/dom";
import type { WolfExpansionSettings } from "../../storage/schemas";
import type { FolderTreeNode } from "./FoldersRepository";

interface FoldersSidebarCallbacks {
  onSectionCollapseChange(collapsed: boolean): Promise<void>;
  onFolderCollapseChange(folderId: string, collapsed: boolean): Promise<void>;
  onCreate(name: string, parentId: string | null): Promise<void>;
  onRename(folderId: string, name: string): Promise<void>;
  onMove(folderId: string, parentId: string | null): Promise<void>;
  onDelete(folderId: string): Promise<void>;
  onReorder(folderId: string, direction: -1 | 1): Promise<void>;
}

type EditorMode =
  | { kind: "actions"; folderId: string }
  | { kind: "create"; parentId: string | null }
  | { kind: "rename"; folderId: string; initialValue: string }
  | { kind: "move"; folderId: string; currentParentId: string | null }
  | { kind: "delete"; folderId: string; name: string }
  | null;

export class FoldersSidebar {
  private section: HTMLElement | null = null;
  private editorMode: EditorMode = null;

  public constructor(
    private readonly adapter: ChatGPTAdapter,
    private readonly callbacks: FoldersSidebarCallbacks,
    private readonly logger: Logger,
  ) {}

  public render(
    tree: readonly FolderTreeNode[],
    settings: WolfExpansionSettings,
    collapsed: boolean,
  ): void {
    const section = this.ensureMounted();
    if (!section) {
      return;
    }
    section.replaceChildren();

    const header = document.createElement("div");
    header.className = "wolf-folders-header";
    const toggle = createWolfElement("button", "folders-toggle");
    toggle.type = "button";
    toggle.className = "wolf-folders-toggle";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-controls", "wolf-expansion-folders-tree");
    toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} Folders`);
    const chevron = document.createElement("span");
    chevron.className = "wolf-folders-chevron";
    chevron.textContent = collapsed ? "›" : "⌄";
    chevron.setAttribute("aria-hidden", "true");
    const heading = document.createElement("span");
    heading.className = "wolf-folders-heading";
    heading.textContent = `${settings.folders.showIcons ? "📁 " : ""}Folders`;
    toggle.append(chevron, heading);
    toggle.addEventListener("click", () => {
      void this.runSafely(() => this.callbacks.onSectionCollapseChange(!collapsed));
    });

    const add = createWolfElement("button", "folder-create-root");
    add.type = "button";
    add.className = "wolf-folder-header-action";
    add.textContent = "+";
    add.title = "Create folder";
    add.setAttribute("aria-label", "Create root folder");
    add.addEventListener("click", () => {
      this.editorMode = { kind: "create", parentId: null };
      this.render(tree, settings, collapsed);
      this.focusEditor();
    });
    header.append(toggle, add);
    section.append(header);

    if (this.editorMode?.kind === "create" && this.editorMode.parentId === null) {
      section.append(this.createNameEditor("Folder name", async (name) => {
        await this.callbacks.onCreate(name, null);
      }));
    }

    const list = createWolfElement("ul", "folders-tree");
    list.id = "wolf-expansion-folders-tree";
    list.className = "wolf-folders-tree";
    list.hidden = collapsed;
    list.setAttribute("role", "tree");
    list.setAttribute("aria-label", "Wolf Expansion folders");
    if (tree.length === 0) {
      const empty = document.createElement("li");
      empty.className = "wolf-folders-empty";
      empty.textContent = "No folders yet";
      list.append(empty);
    } else {
      tree.forEach((node, index) => {
        list.append(this.createFolderNode(node, 0, index, tree.length, tree, settings));
      });
    }
    section.append(list);
    this.logger.debug("Folder tree reconciled.", { rootCount: tree.length });
  }

  public remove(): void {
    this.section?.remove();
    this.section = null;
    this.editorMode = null;
  }

  private ensureMounted(): HTMLElement | null {
    const target = this.adapter.findSidebarInsertionTarget();
    if (!target) {
      return null;
    }
    if (!this.section) {
      this.section = createWolfElement("section", "folders-section");
      this.section.className = "wolf-folders-section";
      this.section.setAttribute("aria-label", "Wolf Expansion Folders");
    }
    const before = target.before;
    if (this.section.parentElement !== target.parent || this.section.nextElementSibling !== before) {
      target.parent.insertBefore(this.section, before);
    }
    return this.section;
  }

  private createFolderNode(
    node: FolderTreeNode,
    depth: number,
    index: number,
    siblingCount: number,
    completeTree: readonly FolderTreeNode[],
    settings: WolfExpansionSettings,
  ): HTMLLIElement {
    const item = createWolfElement("li", "folder-item");
    item.className = "wolf-folder-item";
    item.dataset.folderId = node.folder.id;
    item.setAttribute("role", "treeitem");
    item.setAttribute("aria-expanded", String(!node.folder.collapsed));
    item.style.setProperty("--wolf-folder-depth", String(depth));

    const row = document.createElement("div");
    row.className = "wolf-folder-row";
    const toggle = createWolfElement("button", "folder-toggle");
    toggle.type = "button";
    toggle.className = "wolf-folder-toggle";
    toggle.title = `${node.folder.collapsed ? "Expand" : "Collapse"} ${node.folder.name}`;
    toggle.setAttribute("aria-label", toggle.title);
    toggle.setAttribute("aria-expanded", String(!node.folder.collapsed));
    toggle.textContent = node.folder.collapsed ? "▸" : "▾";
    toggle.addEventListener("click", () => {
      void this.runSafely(() =>
        this.callbacks.onFolderCollapseChange(node.folder.id, !node.folder.collapsed));
    });

    const label = document.createElement("span");
    label.className = "wolf-folder-name";
    label.textContent = `${settings.folders.showIcons ? "📁 " : ""}${node.folder.name}`;
    label.title = node.folder.name;

    const controls = document.createElement("span");
    controls.className = "wolf-folder-controls";
    controls.append(
      this.createOrderButton(node.folder.id, node.folder.name, -1, index === 0),
      this.createOrderButton(node.folder.id, node.folder.name, 1, index === siblingCount - 1),
    );
    const actions = createWolfElement("button", "folder-actions-toggle");
    actions.type = "button";
    actions.className = "wolf-folder-control";
    actions.textContent = "…";
    actions.title = `Manage ${node.folder.name}`;
    actions.setAttribute("aria-label", actions.title);
    actions.addEventListener("click", () => {
      this.editorMode = this.editorMode?.kind === "actions" &&
        this.editorMode.folderId === node.folder.id
        ? null
        : { kind: "actions", folderId: node.folder.id };
      this.render(completeTree, settings, false);
    });
    controls.append(actions);
    row.append(toggle, label, controls);
    item.append(row);

    if (this.isEditorForFolder(node.folder.id)) {
      item.append(this.createFolderEditor(node, completeTree, settings));
    }

    if (!node.folder.collapsed) {
      const group = document.createElement("ul");
      group.className = "wolf-folder-children";
      group.setAttribute("role", "group");
      node.children.forEach((child, childIndex) => {
        group.append(
          this.createFolderNode(
            child,
            depth + 1,
            childIndex,
            node.children.length,
            completeTree,
            settings,
          ),
        );
      });
      for (const conversation of node.conversations) {
        const conversationItem = createWolfElement("li", "folder-conversation");
        conversationItem.className = "wolf-folder-conversation";
        const link = createWolfElement("a", "folder-conversation-link");
        link.className = "wolf-folder-conversation-link";
        link.href = conversation.url;
        link.textContent = conversation.title;
        link.title = conversation.title;
        conversationItem.append(link);
        group.append(conversationItem);
      }
      item.append(group);
    }
    return item;
  }

  private createFolderEditor(
    node: FolderTreeNode,
    completeTree: readonly FolderTreeNode[],
    settings: WolfExpansionSettings,
  ): HTMLElement {
    const mode = this.editorMode;
    if (!mode) {
      return document.createElement("span");
    }
    if (mode.kind === "actions") {
      const panel = this.createEditorPanel();
      panel.append(
        this.createModeButton("New subfolder", () => ({
          kind: "create",
          parentId: node.folder.id,
        }), completeTree, settings),
        this.createModeButton("Rename", () => ({
          kind: "rename",
          folderId: node.folder.id,
          initialValue: node.folder.name,
        }), completeTree, settings),
        this.createModeButton("Move", () => ({
          kind: "move",
          folderId: node.folder.id,
          currentParentId: node.folder.parentId,
        }), completeTree, settings),
        this.createModeButton("Delete", () => ({
          kind: "delete",
          folderId: node.folder.id,
          name: node.folder.name,
        }), completeTree, settings),
        this.createCancelButton(completeTree, settings),
      );
      return panel;
    }
    if (mode.kind === "create") {
      return this.createNameEditor("Subfolder name", async (name) => {
        await this.callbacks.onCreate(name, node.folder.id);
      });
    }
    if (mode.kind === "rename") {
      return this.createNameEditor("Folder name", async (name) => {
        await this.callbacks.onRename(node.folder.id, name);
      }, mode.initialValue);
    }
    if (mode.kind === "delete") {
      const panel = this.createEditorPanel();
      const message = document.createElement("span");
      message.textContent = `Delete “${mode.name}”? Chats will be unfiled; subfolders will be preserved.`;
      const confirm = this.createEditorButton("Delete", async () => {
        await this.callbacks.onDelete(node.folder.id);
      });
      confirm.classList.add("wolf-folder-danger");
      panel.append(message, confirm, this.createCancelButton(completeTree, settings));
      return panel;
    }

    const panel = this.createEditorPanel();
    const select = document.createElement("select");
    select.className = "wolf-folder-select";
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = "Top level";
    select.append(rootOption);
    const excluded = collectFolderIds(node);
    for (const option of flattenFolderOptions(completeTree)) {
      if (excluded.has(option.id)) {
        continue;
      }
      const element = document.createElement("option");
      element.value = option.id;
      element.textContent = `${"  ".repeat(option.depth)}${option.name}`;
      select.append(element);
    }
    select.value = mode.currentParentId ?? "";
    panel.append(
      select,
      this.createEditorButton("Move", async () => {
        await this.callbacks.onMove(node.folder.id, select.value || null);
      }),
      this.createCancelButton(completeTree, settings),
    );
    return panel;
  }

  private createNameEditor(
    label: string,
    submit: (name: string) => Promise<void>,
    initialValue = "",
  ): HTMLFormElement {
    const form = createWolfElement("form", "folder-name-editor");
    form.className = "wolf-folder-editor";
    const input = document.createElement("input");
    input.className = "wolf-folder-name-input";
    input.type = "text";
    input.maxLength = 100;
    input.required = true;
    input.value = initialValue;
    input.placeholder = label;
    input.setAttribute("aria-label", label);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelEditor(form);
      }
    });
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.className = "wolf-folder-editor-button";
    confirm.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "wolf-folder-editor-button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.cancelEditor(form));
    form.append(input, confirm, cancel);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name) {
        input.setCustomValidity("Folder name cannot be empty.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      this.editorMode = null;
      form.remove();
      void this.runSafely(() => submit(name));
    });
    return form;
  }

  private createEditorPanel(): HTMLDivElement {
    const panel = createWolfElement("div", "folder-action-editor");
    panel.className = "wolf-folder-editor";
    return panel;
  }

  private createEditorButton(label: string, operation: () => Promise<void>): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wolf-folder-editor-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      this.editorMode = null;
      void this.runSafely(operation);
    });
    return button;
  }

  private createModeButton(
    label: string,
    createMode: () => Exclude<EditorMode, null>,
    tree: readonly FolderTreeNode[],
    settings: WolfExpansionSettings,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wolf-folder-editor-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      this.editorMode = createMode();
      this.render(tree, settings, false);
      this.focusEditor();
    });
    return button;
  }

  private createCancelButton(
    tree: readonly FolderTreeNode[],
    settings: WolfExpansionSettings,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wolf-folder-editor-button";
    button.textContent = "Cancel";
    button.addEventListener("click", () => {
      this.editorMode = null;
      this.render(tree, settings, false);
    });
    return button;
  }

  private createOrderButton(
    folderId: string,
    name: string,
    direction: -1 | 1,
    disabled: boolean,
  ): HTMLButtonElement {
    const button = createWolfElement("button", direction === -1 ? "folder-move-up" : "folder-move-down");
    button.type = "button";
    button.className = "wolf-folder-control";
    button.textContent = direction === -1 ? "↑" : "↓";
    button.disabled = disabled;
    button.title = `Move ${name} ${direction === -1 ? "up" : "down"}`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => {
      void this.runSafely(() => this.callbacks.onReorder(folderId, direction));
    });
    return button;
  }

  private isEditorForFolder(folderId: string): boolean {
    const mode = this.editorMode;
    return mode !== null && (
      (mode.kind === "create" && mode.parentId === folderId) ||
      (mode.kind !== "create" && mode.folderId === folderId)
    );
  }

  private cancelEditor(editor?: HTMLElement): void {
    this.editorMode = null;
    editor?.remove();
    this.section?.querySelector<HTMLElement>('[data-wolf-expansion="folders-toggle"]')?.focus();
  }

  private focusEditor(): void {
    this.section?.querySelector<HTMLInputElement>(".wolf-folder-name-input")?.focus();
  }

  private async runSafely(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      this.logger.error("A Folders sidebar action failed.", error);
    }
  }
}

function flattenFolderOptions(
  tree: readonly FolderTreeNode[],
  depth = 0,
): Array<{ id: string; name: string; depth: number }> {
  return tree.flatMap((node) => [
    { id: node.folder.id, name: node.folder.name, depth },
    ...flattenFolderOptions(node.children, depth + 1),
  ]);
}

function collectFolderIds(node: FolderTreeNode): Set<string> {
  const ids = new Set<string>([node.folder.id]);
  for (const child of node.children) {
    for (const id of collectFolderIds(child)) {
      ids.add(id);
    }
  }
  return ids;
}
