import type { Page } from "@playwright/test";
import { file, png, stl, text, threeMf, zip } from "./fixtures";
import { expect, expectUploaded, pickFiles, test } from "./helpers";

const zipFile = (name: string, entries: Record<string, Uint8Array>) => file(name, zip(entries), "application/zip");

function zipDialog(page: Page) {
  return page.getByRole("dialog", { name: /Import zip|Choose files/ });
}

/** Import and unzip, then confirm the listed entries. */
async function unzip(page: Page, entries: string[]) {
  const dialog = zipDialog(page);
  await dialog.getByRole("button", { name: "Import and unzip" }).click();
  await expect(dialog.getByText("Choose files", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(entries.length);
  for (const entry of entries)
    await expect(dialog.getByRole("checkbox", { name: new RegExp(`^${entry}`) })).toBeChecked();
  await expect(dialog).toContainText(`${entries.length} of ${entries.length} selected`);
  return dialog;
}

test("import as zip keeps the archive whole, as one model", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(page, zipFile("Zip Whole Kit.zip", { "a.stl": stl(), "Parts/b.3mf": threeMf() }));

  const dialog = zipDialog(page);
  await expect(dialog).toContainText("How would you like to handle this zip file?");
  await expect(dialog).toContainText("Zip Whole Kit.zip");
  await dialog.getByRole("button", { name: "Import as zip" }).click();

  await page.waitForURL(/\/models\/[^/?]+\?edit=/);
  const print = await api.print(page.url().match(/\/models\/([^/?]+)/)![1]);
  expect(print).toMatchObject({ name: "Zip Whole Kit", category_id: null });
  expect(print.plates.map((p) => p.filename)).toEqual(["Zip Whole Kit.zip"]);
  const after = await api.summary();
  expect(after.model_count).toBe(before.model_count + 1);
  expect(after.category_count).toBe(before.category_count);
});

test("import and unzip makes a model per file and a folder per directory, however deep", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(
    page,
    zipFile("Zip Library.zip", {
      "Zip Loose.stl": stl(),
      "Zip Pack/Zip Gear.3mf": threeMf(),
      "Zip Pack/Zip Render.png": png(),
      "Zip Pack/readme.txt": text("not a model"),
      "Zip Pack/Zip Deep/Zip Deeper/Zip Bolt.stl": stl(),
    }),
  );

  const dialog = await unzip(page, [
    "Zip Loose.stl",
    "Zip Pack/readme.txt",
    "Zip Pack/Zip Deep/Zip Deeper/Zip Bolt.stl",
    "Zip Pack/Zip Gear.3mf",
    "Zip Pack/Zip Render.png",
  ]);
  await dialog.getByRole("button", { name: "Import selected" }).click();
  // The text file is listed but isn't something that can become a model, so four, not five.
  await expectUploaded(page, 4);
  await expect(dialog).toBeHidden();

  const pack = await api.folderAt("Zip Pack");
  const deeper = await api.folderAt("Zip Pack", "Zip Deep", "Zip Deeper");
  expect(pack?.kind).toBe("folder");
  expect(deeper?.kind).toBe("folder");
  const [loose, gear, render, bolt] = await api.printsNamed("Zip Loose", "Zip Gear", "Zip Render", "Zip Bolt");
  expect(loose.category_id).toBeNull();
  expect(gear.category_id).toBe(pack!.id);
  expect(render.category_id).toBe(pack!.id);
  expect(bolt.category_id).toBe(deeper!.id);
  expect(gear.plates[0].thumb_url).toBeTruthy();
  expect(render.plates[0].thumb_url).toBeTruthy();

  const after = await api.summary();
  expect(after.model_count).toBe(before.model_count + 4);
  expect(after.category_count).toBe(before.category_count + 3);
});

test("only the ticked entries are unzipped", async ({ page, api }) => {
  await page.goto("/models");
  await pickFiles(
    page,
    zipFile("Zip Partial.zip", { "Pick One.stl": stl(), "Pick Two.3mf": threeMf(), "Skip Me.stl": stl() }),
  );
  const dialog = await unzip(page, ["Pick One.stl", "Pick Two.3mf", "Skip Me.stl"]);

  await dialog.getByRole("button", { name: "Clear" }).click();
  await expect(dialog).toContainText("0 of 3 selected");
  await expect(dialog.getByRole("button", { name: "Import selected" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Select all" }).click();
  await expect(dialog).toContainText("3 of 3 selected");
  await dialog.getByRole("checkbox", { name: /^Skip Me\.stl/ }).uncheck();
  await expect(dialog).toContainText("2 of 3 selected");
  await dialog.getByRole("button", { name: "Import selected" }).click();
  await expectUploaded(page, 2);

  await api.printsNamed("Pick One", "Pick Two");
  expect((await api.prints()).some((p) => p.name === "Skip Me")).toBe(false);
});

test("a zip picked together with other files: the files upload, then the zip asks", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(page, [
    file("Mixed Plain.stl", stl()),
    zipFile("Mixed Bundle.zip", { "Mixed Inner A.stl": stl(), "Mixed Inner B.3mf": threeMf() }),
  ]);
  const dialog = await unzip(page, ["Mixed Inner A.stl", "Mixed Inner B.3mf"]);
  await dialog.getByRole("button", { name: "Import selected" }).click();
  await expectUploaded(page, 3);

  await api.printsNamed("Mixed Plain", "Mixed Inner A", "Mixed Inner B");
  expect((await api.summary()).model_count).toBe(before.model_count + 3);
});

test("several zips are asked about one after another", async ({ page, api }) => {
  await page.goto("/models");
  await pickFiles(page, [
    zipFile("Queue First.zip", { "Queue One.stl": stl() }),
    zipFile("Queue Second.zip", { "Queue Two.stl": stl() }),
  ]);

  const dialog = zipDialog(page);
  await expect(dialog).toContainText("Queue First.zip");
  await dialog.getByRole("button", { name: "Import as zip" }).click();
  await expect(dialog).toContainText("Queue Second.zip");
  await (await unzip(page, ["Queue Two.stl"])).getByRole("button", { name: "Import selected" }).click();
  await expectUploaded(page, 2);

  await api.printsNamed("Queue First", "Queue Two");
});

test("cancelling the zip choice uploads nothing", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(page, zipFile("Zip Cancelled.zip", { "Never.stl": stl() }));
  const dialog = await unzip(page, ["Never.stl"]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
  expect((await api.summary()).model_count).toBe(before.model_count);
});

test("an unreadable zip says so instead of importing", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(page, file("Zip Broken.zip", text("this is not a zip archive"), "application/zip"));
  const dialog = zipDialog(page);
  await dialog.getByRole("button", { name: "Import and unzip" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  // Still on the first step, free to import it whole or close.
  await expect(dialog.getByRole("button", { name: "Import as zip" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close" }).click();
  expect((await api.summary()).model_count).toBe(before.model_count);
});

test("macOS archive junk is neither listed nor imported", async ({ page, api }) => {
  const before = await api.summary();
  await page.goto("/models");
  await pickFiles(
    page,
    zipFile("Zip Mac.zip", {
      "Zip Mac/Mac Part.stl": stl(),
      "Zip Mac/.DS_Store": text("junk"),
      "__MACOSX/Zip Mac/._Mac Part.stl": text("resource fork"),
    }),
  );
  const dialog = await unzip(page, ["Zip Mac/Mac Part.stl"]);
  await dialog.getByRole("button", { name: "Import selected" }).click();
  // Just the one model, which opens for editing.
  await page.waitForURL(/\/models\/[^/?]+\?edit=/);

  await api.printsNamed("Mac Part");
  expect((await api.summary()).model_count).toBe(before.model_count + 1);
  expect(await api.folderAt("__MACOSX")).toBeUndefined();
});
