import { expect, test } from "@playwright/test";

test("creates a project and selects it in chat scope", async ({ page }) => {
  // Uses a relative navigation on purpose so we can rely on Playwright's baseURL.
  await page.goto("/projects");

  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();

  const emptyStateHeading = page.getByRole("heading", { name: "No projects yet" });
  await expect(emptyStateHeading).toBeVisible();

  await page.getByRole("button", { name: "New Project" }).click();

  // Creating a project re-renders the page, so the empty state should disappear.
  await expect(emptyStateHeading).toBeHidden();

  const projectLink = page.getByRole("link", { name: /^Open Project / }).first();
  await expect(projectLink).toBeVisible();

  const projectAriaLabel = await projectLink.getAttribute("aria-label");
  expect(projectAriaLabel).toBeTruthy();
  const projectName = projectAriaLabel!.replace(/^Open\s+/, "");

  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "New Chat" })).toBeVisible();

  const projectScopeButton = page.getByRole("button", { name: projectName });
  await expect(projectScopeButton).toBeVisible();
  await expect(projectScopeButton).toHaveAttribute("aria-pressed", "false");

  await projectScopeButton.click();
  await expect(projectScopeButton).toHaveAttribute("aria-pressed", "true");
});
