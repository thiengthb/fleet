// Page Object Model example — role-based locators first, getByTestId only as a fallback,
// never raw CSS. Mirror the REAL screen (this sketches todo's "today" list); rename/adjust
// to the app's actual roles, labels, and text.
import { type Page, type Locator, expect } from "@playwright/test";

export class TodayPage {
  readonly heading: Locator;
  readonly newTaskInput: Locator;
  readonly addButton: Locator;
  readonly list: Locator;

  constructor(private page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.newTaskInput = page.getByLabel("New task");
    this.addButton = page.getByRole("button", { name: "Add" });
    this.list = page.getByRole("list");
  }

  async goto() {
    await this.page.goto("/");
  }

  async addTask(title: string) {
    await this.newTaskInput.fill(title);
    await this.addButton.click();
    // Wait for the item to appear — not a timer.
    await expect(this.list.getByText(title)).toBeVisible();
  }

  async toggle(title: string) {
    await this.list.getByRole("listitem").filter({ hasText: title }).getByRole("checkbox").click();
  }

  async expectTaskVisible(title: string) {
    await expect(this.list.getByText(title)).toBeVisible();
  }
}
