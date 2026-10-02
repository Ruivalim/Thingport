import { prisma } from "../db";

// Kept in sync by hand with the frontend's CategoriesView.
export const CATEGORIES_VIEWS = ["categories", "folders"] as const;
export type CategoriesView = (typeof CATEGORIES_VIEWS)[number];

/** Stored per user, not per browser, so every device opens the models page on the same tree. */
export async function getCategoriesView(userId: string): Promise<CategoriesView> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { categoriesView: true } });
  return user?.categoriesView === "folders" ? "folders" : "categories";
}

export async function setCategoriesView(userId: string, view: CategoriesView): Promise<CategoriesView> {
  await prisma.user.update({ where: { id: userId }, data: { categoriesView: view } });
  return view;
}
