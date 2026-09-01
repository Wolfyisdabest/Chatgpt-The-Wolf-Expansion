export const MAX_FOLDER_NAME_LENGTH = 100;

export type FolderNameEditorState =
  | {
      kind: "create";
      parentId: string | null;
      draft: string;
    }
  | {
      kind: "rename";
      folderId: string;
      originalName: string;
      draft: string;
    };

export type FolderNameEditorResolution =
  | { status: "commit"; state: FolderNameEditorState; name: string }
  | { status: "unchanged"; state: FolderNameEditorState }
  | { status: "invalid"; state: FolderNameEditorState }
  | { status: "cancel"; state: FolderNameEditorState };

export class FolderNameEditorController {
  private state: FolderNameEditorState | null = null;

  public get activeState(): FolderNameEditorState | null {
    return this.state ? { ...this.state } : null;
  }

  public startCreate(parentId: string | null): FolderNameEditorState {
    this.state = { kind: "create", parentId, draft: "" };
    return this.activeState as FolderNameEditorState;
  }

  public startRename(folderId: string, originalName: string): FolderNameEditorState {
    this.state = { kind: "rename", folderId, originalName, draft: originalName };
    return this.activeState as FolderNameEditorState;
  }

  public updateDraft(draft: string): void {
    if (this.state) {
      this.state = { ...this.state, draft: draft.slice(0, MAX_FOLDER_NAME_LENGTH) };
    }
  }

  public resolveEnter(): FolderNameEditorResolution | null {
    return this.resolve();
  }

  public resolveBlur(): FolderNameEditorResolution | null {
    return null;
  }

  public resolveOutsidePointer(): FolderNameEditorResolution | null {
    return this.cancel();
  }

  public cancel(): FolderNameEditorResolution | null {
    const state = this.activeState;
    if (!state) {
      return null;
    }
    this.state = null;
    return { status: "cancel", state };
  }

  public isEditingFolder(folderId: string): boolean {
    return this.state?.kind === "rename" && this.state.folderId === folderId;
  }

  private resolve(): FolderNameEditorResolution | null {
    const state = this.activeState;
    if (!state) {
      return null;
    }
    const name = state.draft.trim();
    if (!name) {
      return { status: "invalid", state };
    }
    if (state.kind === "rename" && name === state.originalName) {
      this.state = null;
      return { status: "unchanged", state };
    }
    this.state = null;
    return { status: "commit", state, name };
  }
}

export function isFolderDraggable(
  editorState: FolderNameEditorState | null,
  folderId: string,
): boolean {
  if (!editorState) {
    return true;
  }
  return editorState.kind === "rename"
    ? editorState.folderId !== folderId
    : editorState.parentId !== folderId;
}
