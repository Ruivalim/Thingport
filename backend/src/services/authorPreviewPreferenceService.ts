import { prisma } from "../db";

export async function getUserAuthorPreviewEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { authorPreviewEnabled: true } });
  return user?.authorPreviewEnabled ?? true;
}

export async function setUserAuthorPreviewEnabled(userId: string, enabled: boolean): Promise<boolean> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { authorPreviewEnabled: enabled },
    select: { authorPreviewEnabled: true },
  });
  return user.authorPreviewEnabled;
}
