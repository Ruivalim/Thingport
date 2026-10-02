import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { DEFAULT_CATEGORIES, type DefaultCategoryNode } from "../seedData/defaultCategories";

export const CATEGORY_KINDS = ["category", "folder"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** A new or moved category takes its parent's kind; a top-level one keeps `fallback`. */
export async function kindUnder(userId: string, parentId: string | null, fallback: string): Promise<string> {
  if (!parentId) return fallback;
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId }, select: { kind: true } });
  return parent?.kind ?? fallback;
}

/** Keeps a moved subtree's kind in line with its new top-level ancestor. */
export async function setSubtreeKind(userId: string, rootId: string, kind: string): Promise<void> {
  const ids: string[] = [];
  let frontier = [rootId];
  while (frontier.length) {
    ids.push(...frontier);
    const children = await prisma.category.findMany({
      where: { userId, parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
  }
  await prisma.category.updateMany({ where: { userId, id: { in: ids } }, data: { kind } });
}

/** Any depth is allowed; only cycles are rejected (a category under itself or its own descendant). */
export async function validateParentCategory(
  userId: string,
  parentId: string | null | undefined,
  categoryId?: string | null,
): Promise<string | null> {
  if (!parentId) return null;
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw new HttpError(400, "Parent category not found");
  if (categoryId && parentId === categoryId) throw new HttpError(400, "Category cannot be its own parent");

  if (categoryId) {
    // `visited` guards against a cycle already in the data.
    const visited = new Set<string>();
    let ancestorId = parent.parentId;
    while (ancestorId && !visited.has(ancestorId)) {
      if (ancestorId === categoryId) {
        throw new HttpError(400, "A category cannot be moved under one of its own subcategories");
      }
      visited.add(ancestorId);
      const ancestor = await prisma.category.findFirst({
        where: { id: ancestorId, userId },
        select: { parentId: true },
      });
      ancestorId = ancestor?.parentId ?? null;
    }
  }

  return parentId;
}

/** Takes a Prisma client so it can run in the user-creation transaction. */
export async function seedDefaultCategories(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  async function createNode(node: DefaultCategoryNode, parentId: string | null, position: number): Promise<void> {
    const category = await tx.category.create({
      data: {
        userId,
        name: node.name,
        kind: "category",
        tags: node.tags ?? [],
        parentId,
        position,
        metaTitle: node.metaTitle ?? null,
        metaDescription: node.metaDescription ?? null,
        makerworldCatIds: node.makerworldCatIds ?? [],
        thingiverseCatIds: node.thingiverseCatIds ?? [],
        printablesCatIds: node.printablesCatIds ?? [],
      },
    });
    let i = 0;
    for (const child of node.children ?? []) {
      await createNode(child, category.id, i);
      i++;
    }
  }

  let i = 0;
  for (const root of DEFAULT_CATEGORIES) {
    await createNode(root, null, i);
    i++;
  }
}
