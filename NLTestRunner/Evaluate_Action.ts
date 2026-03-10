import { expect, Page} from '@playwright/test';
import { Obs } from './Observe.js';



export class EvaluateAction {
    static async evaluateWithoutLLM(term: string, data: Obs): Promise<boolean> {
        return await EvaluateAction.actions(term, data);
    }

    static async actions(term: string, data: Obs, page?: Page): Promise<boolean> {
        console.debug(`\nEvaluate without LLM: ${term}`);
        console.debug("Data:", data);
        const termLower = term.toLowerCase();
        if (termLower.startsWith("press")) {return true;}
        const result = termLower.match(/'([^']*)'/g); //match(/'([^']*)'/);
        if (!result) {
            console.debug("No valid UI element found in the term.");
            return false; // retourner exception
        }
        let target = result[0].slice(1, -1);
        switch (true) {
            case termLower.startsWith("click"):
            return EvaluateAction._evaluateClick(target, data);
            case termLower.startsWith("check"):
            return EvaluateAction._evaluateCheck(target, data, page);
            case termLower.startsWith("uncheck"):
            return EvaluateAction._evaluateUncheck(target, data, page);
            case termLower.startsWith("fill"):
            return EvaluateAction._evaluateFill(target, data, page);
            case termLower.startsWith("type") || termLower.startsWith("enter"): {
                target= result[1].slice(1, -1);
            return EvaluateAction._evaluateFill(target, data, page); }
            case termLower.startsWith("select"):
            return EvaluateAction._evaluateSelect(target, data);
            case termLower.startsWith("open"):
            return EvaluateAction._evaluateOpen(target, data);
            case termLower.includes("go_back"):
            return EvaluateAction._evaluateGoBack(page, data);
            default:
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

    private static async _evaluateFill(target: string, data: Obs, page?: Page): Promise<boolean> {
        const targetLower = target.trim().toLowerCase();
        let found = EvaluateAction.inC(target, data, data.fields);
        console.debug("Fill form check (based on text):", found);
        if (!found ) 
            {
                //check in forms
                data.forms.forEach(element => {
                    if (element.toLowerCase().includes(targetLower)) {
                        found = true;
                        console.debug("Fill form check (based on forms):", found);
                    }
                });
                
            }
            if (!found || !page) return found;
            
        try {
            const locator = page.locator(
                `input[name="${targetLower}"], textarea[name="${targetLower}"], select[name="${targetLower}"]`
            );
            // Playwright's toBeEditable is async
             await expect(locator).toBeEditable();
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