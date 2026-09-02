export interface TreeBranchMetadata {
  depth: number;
  isLastSibling: boolean;
  ancestorHasNextSibling: readonly boolean[];
}

export function createTreeBranchMetadata(
  depth: number,
  siblingIndex: number,
  siblingCount: number,
  ancestorHasNextSibling: readonly boolean[],
): TreeBranchMetadata {
  return {
    depth,
    isLastSibling: siblingIndex === siblingCount - 1,
    ancestorHasNextSibling: [...ancestorHasNextSibling],
  };
}

export function getChildAncestorContinuations(
  branch: TreeBranchMetadata,
): readonly boolean[] {
  if (branch.depth === 0) {
    return [];
  }
  return [...branch.ancestorHasNextSibling, !branch.isLastSibling];
}

export const ROOT_TREE_BRANCH: TreeBranchMetadata = {
  depth: 0,
  isLastSibling: true,
  ancestorHasNextSibling: [],
};
