export function shouldCancelFolderNameEditor(pointerInsideEditor: boolean): boolean {
  return !pointerInsideEditor;
}

export function shouldCloseFolderMenu(
  pointerInsideMenu: boolean,
  pointerInsideOwnTrigger: boolean,
): boolean {
  return !pointerInsideMenu && !pointerInsideOwnTrigger;
}
