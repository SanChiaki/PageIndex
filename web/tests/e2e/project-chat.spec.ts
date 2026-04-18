import { expect, test } from "@playwright/test";

test("creates a project and selects it in chat scope", async ({ page }) => {
  // Uses a relative navigation on purpose so we can rely on Playwright's baseURL.
  await page.goto("/projects");

  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();

  const projectLinks = page.getByRole("link", { name: /^Open / });
  const beforeCount = await projectLinks.count();
  const beforeAriaLabels = await projectLinks.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")),
  );

  await page.getByRole("button", { name: "New Project" }).click();

  await expect(projectLinks).toHaveCount(beforeCount + 1);

  const afterAriaLabels = await projectLinks.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")),
  );

  const beforeSet = new Set(beforeAriaLabels.filter(Boolean) as string[]);
  const createdAriaLabel = afterAriaLabels.find(
    (value): value is string => Boolean(value) && !beforeSet.has(value),
  );
  expect(createdAriaLabel).toBeTruthy();
  const projectName = createdAriaLabel!.replace(/^Open\s+/, "");

  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "New Chat" })).toBeVisible();

  const projectScopeButton = page.getByRole("button", { name: projectName });
  await expect(projectScopeButton).toBeVisible();
  await expect(projectScopeButton).toHaveAttribute("aria-pressed", "false");

  await projectScopeButton.click();
  await expect(projectScopeButton).toHaveAttribute("aria-pressed", "true");
});
