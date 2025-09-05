import { Page } from 'playwright';

export class StrictAsserter {

    static async hasLinks(page: Page): Promise<boolean> {
        const links = await page.locator('a').elementHandles();
        return links.length > 0;
    }

    static async hasLinksWithTerm(page: Page, term: string): Promise<boolean> {
        const links = await page.locator('a').allInnerTexts();
        return links.some(link => link.toLowerCase().includes(term.toLowerCase()));
    }

    static async containsSentence(page: Page, term: string): Promise<boolean> {
        const bodyText = await page.innerText('body');
        const sentences = bodyText.split(/[.!?]/);
        return sentences.some(s => s.toLowerCase().includes(term.toLowerCase()));
    }

    static async isPresent(page: Page, text: string): Promise<boolean> {
        return await page.locator(`text=${text}`).count() > 0;
    }

    static async isNotPresent(page: Page, text: string): Promise<boolean> {
        return await page.locator(`text=${text}`).count() === 0;
    }

    static async isVisible(page: Page, text: string): Promise<boolean> {
        const locator = page.locator(`text=${text}`);
        const count = await locator.count();
        if (count > 0) {
            return await locator.first().isVisible();
        }
        return false;
    }

    static async isSelected(page: Page, text: string): Promise<boolean> {
        const locator = page.locator(`text=${text}`);
        try {
            return await locator.first().isChecked();
        } catch {
            return false;
        }
    }

    static async assertWithoutLlm(term: string, page: Page): Promise<boolean | number> {
        term = term.trim().toLowerCase();

        if (term.includes("page has links with the term")) {
            const match = term.match(/term '(.+?)'/);
            if (match) {
                return await StrictAsserter.hasLinksWithTerm(page, match[1]);
            }
        }

        if (term.includes("page has links")) {
            return await StrictAsserter.hasLinks(page);
        }

        if (term.includes("page has sentences containing the term")) {
            const match = term.match(/term '(.+?)'/);
            if (match) {
                return await StrictAsserter.containsSentence(page, match[1]);
            }
        }

        if (term.includes("the 'type' is")) {
            const match = term.match(/type' is '(\d+)'/);
            if (match) {
                const expectedType = match[1];
                const pageText = await page.innerText('body');
                return pageText.includes(expectedType);
            }
        }

        if (term.includes("or")) {
            const options = [...term.matchAll(/'(.*?)'/g)].map(m => m[1]);
            if (options.length > 0) {
                const body = await page.innerText('body');
                const matches = options.filter(opt => body.toLowerCase().includes(opt.toLowerCase()));
                const confidence = Math.floor(100 * matches.length / options.length);
                //console.log("Confidence:", confidence);
                return confidence;
            }
        }

        if (term.includes("is not present")) {
            const match = term.match(/'(.*?)'/);
            if (match) {
                return await StrictAsserter.isNotPresent(page, match[1]);
            }
        }

        if (term.includes("is present") || term.includes("is displayed")) {
            const match = term.match(/'(.*?)'/);
            if (match) {
                return await StrictAsserter.isPresent(page, match[1]);
            }
        }

        return false;
    }
}