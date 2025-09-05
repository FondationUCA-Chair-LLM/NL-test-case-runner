import { Page, expect } from '@playwright/test';
import { BrowserContext } from 'playwright';

export class Obs {
    links: string[] = [];
    buttons: string[] = [];
    forms: string[] = [];
    checkboxes: string[] = [];
    selects: string[] = [];
    fields: string[] = [];
    statictText: string[] = [];
    page?: Page;

    constructor(
        links: string[] = [],
        buttons: string[] = [],
        forms: string[] = [],
        fields: string[] = [],
        checkboxes: string[] = [],
        selects: string[] = [],
        statictText: string[] = [],
        page?: Page
    ) {
        this.links = links;
        this.buttons = buttons;
        this.forms = forms;
        this.checkboxes = checkboxes;
        this.fields = fields;
        this.selects = selects;
        this.statictText = statictText;
        this.page = page;
    }

    equals(other: Obs): boolean {
        if (!(other instanceof Obs)) return false;
        return (
            new Set(this.links).size === new Set(other.links).size &&
            new Set(this.buttons).size === new Set(other.buttons).size &&
            new Set(this.fields).size === new Set(other.fields).size &&
            new Set(this.forms).size === new Set(other.forms).size &&
            new Set(this.checkboxes).size === new Set(other.checkboxes).size &&
            new Set(this.statictText).size === new Set(other.statictText).size
        );
    }

    async getUIElements(page: Page): Promise<void> {
        this.links = await page.locator('a:visible').allInnerTexts();
        this.buttons = await page.locator('button:visible').allInnerTexts();
        this.fields = await page.$$eval('input', inputs =>
    inputs.map(input => input.getAttribute('name') || '(no name)')
  );//page.locator('input:visible').all().;
        this.forms = await page.locator('form:visible').allInnerTexts();
        this.checkboxes = await page.$$eval('input[type="checkbox"]', checkboxes =>
    checkboxes.map(checkbox => checkbox.getAttribute('name') || '(no name)')
  );
        //page.locator('checkbox:visible').allInnerTexts();
        this.selects = await page.locator('select:visible').allInnerTexts();
        this.statictText = await page.locator('p:visible, li:visible, span:visible').allInnerTexts();
    }

    static async getUIElementsByText(filter: string, page:Page): Promise<string[]> {
        
        return await page.getByText(filter).allInnerTexts();
    }

    static eleToJson(linkList: string[], eleType: string): string {
        let result="";
        for(var k=0; k<linkList.length; k++) {
            result += "{\"id\": , \"description\": "+linkList[k]+", \"type\": "+eleType+"}\n";
            }
    return result;
        
        //const result = linkList.map(link => ({ type: eleType, text: link }));
        //return JSON.stringify(result, null, 2);
    }
}