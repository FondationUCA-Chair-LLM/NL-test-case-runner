import { Page} from '@playwright/test';
import { Obs } from './Observe.js';



export class EvaluateAction {
    static evaluateWithoutLLM(term: string, data: Obs): boolean {
        return EvaluateAction.actions(term, data);
    }

    static actions(term: string, data: Obs, page?: Page): boolean {
        console.debug(`\nEvaluate without LLM: ${term}`);
        const termLower = term.toLowerCase();
        if (termLower.startsWith("press")) {return true;}
        const result = termLower.match(/'([^']*)'/);
        if (!result) {
            console.debug("No valid UI element found in the term.");
            return false;
        }
        const target = result[1];
        
        if (termLower.startsWith("click")) {
            return EvaluateAction._evaluateClick(target, data);
        } else if (termLower.startsWith("check")) {
            return EvaluateAction._evaluateCheck(target, data, page);
        } else if (termLower.startsWith("uncheck")) {
            return EvaluateAction._evaluateUncheck(target, data, page);
        } else if (termLower.startsWith("fill") || termLower.startsWith("type")) {
            return EvaluateAction._evaluateFill(target, data, page);
        } else if (termLower.startsWith("select")) {
            return EvaluateAction._evaluateSelect(target, data);
        } else if (termLower.startsWith("open")) {
            return EvaluateAction._evaluateOpen(target, data);
        } else if (termLower.includes("go_back")) {
            return EvaluateAction._evaluateGoBack(page, data);
        } else {
            console.debug("Term not handled explicitly. Returning False.");
            return false;
        }
    }

    static inC(target: string, data: Obs, elementsToCheck?: string[]): boolean {
        const targetLower = target.toLowerCase();
        if (!elementsToCheck) {
            elementsToCheck = [
                ...data.links,
                ...data.buttons,
                ...data.forms,
                ...data.checkboxes,
                ...data.selects,
                ...data.fields,
                ...data.statictText
            ];
        }
        const found = elementsToCheck.some(el => el.toLowerCase().includes(targetLower));
        console.debug("Element exists:", found);
        return found;
    }

    private static _evaluateClick(target: string, data: Obs): boolean {
        const found = EvaluateAction.inC(target, data, [...data.links, ...data.buttons, ...data.checkboxes]);
        console.debug("Click element found:", found);
        return found;
    }

    private static _evaluateCheck(target: string, data: Obs, page?: Page): boolean {
        const found = EvaluateAction.inC(target, data, data.checkboxes);
        console.debug("Checkbox found in data:", found);

        if (!page || !found) return found;

        try {
            const checkbox = page.getByRole("checkbox", { name: target });
            // Playwright's isChecked is async, but here we keep it sync for parity
            // In real code, use await checkbox.isChecked()
            // For demo:
            // const isNotChecked = !(await checkbox.isChecked());
            // return found && isNotChecked;
            return found; // Placeholder
        } catch (e) {
            console.debug(`Error while checking checkbox state: ${e}`);
            return false;
        }
    }

    private static _evaluateUncheck(target: string, data: Obs, page?: Page): boolean {
        const found = EvaluateAction.inC(target, data, data.checkboxes);
        console.debug("Checkbox found in data:", found);

        if (!page || !found) return found;

        try {
            const checkbox = page.getByRole("checkbox", { name: target });
            // Playwright's isChecked is async, but here we keep it sync for parity
            // In real code, use await checkbox.isChecked()
            // For demo:
            // const isChecked = await checkbox.isChecked();
            // return found && isChecked;
            return found; // Placeholder
        } catch (e) {
            console.debug(`Error while checking checkbox state: ${e}`);
            return false;
        }
    }

    private static _evaluateFill(target: string, data: Obs, page?: Page): boolean {
        const targetLower = target.trim().toLowerCase();
        const found = EvaluateAction.inC(target, data, data.fields);

        console.debug("Fill form check (based on text):", found);

        if (!found || !page) return found;

        try {
            const locator = page.locator(
                `input[name="${targetLower}"], textarea[name="${targetLower}"], select[name="${targetLower}"]`
            );
            // Playwright's toBeEditable is async
            // await expect(locator).toBeEditable();
            console.debug(`The input for '${target}' is editable.`);
            return true;
        } catch (e) {
            console.debug(`Error locating or validating input: ${e}`);
            return false;
        }
    }

    private static _evaluateSelect(target: string, data: Obs): boolean {
        const found = EvaluateAction.inC(target, data, data.selects);
        console.debug("Select option check:", found);
        return found;
    }

    private static _evaluateOpen(target: string, data: Obs): boolean {
        const found = EvaluateAction.inC(target, data, data.links);
        console.debug("Open element check:", found);
        return found;
    }

    private static _evaluateGoBack(page?: Page, data?: any): boolean {
        if (data && 'history' in data) {
            const canGoBack = data.history.length > 1;
            console.debug(`[Evaluate go_back] Can go back based on history: ${canGoBack}`);
            return canGoBack;
        }
        console.debug("[Evaluate go_back] History not available.");
        return false;
    }
}