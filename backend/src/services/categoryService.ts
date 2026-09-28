import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { DEFAULT_CATEGORIES, type DefaultCategoryNode } from "../seedData/defaultCategories";

/** Keeps the tree at most two levels deep, which also makes cycles impossible. */
export async function validateParentCategory(
  userId: string,
  parentId: string | null | undefined,
  categoryId?: string | null,
): Promise<string | null> {
  if (!parentId) return null;
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw new HttpError(400, "Parent category not found");
  if (categoryId && parentId === categoryId) throw new HttpError(400, "Category cannot be its own parent");

  if (parent.parentId) {
    throw new HttpError(400, "Categories can only be nested two levels deep");
  }
  if (categoryId) {
    const childCount = await prisma.category.count({ where: { parentId: categoryId, userId } });
    if (childCount > 0) {
      throw new HttpError(400, "A category with subcategories cannot be moved under another category");
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
