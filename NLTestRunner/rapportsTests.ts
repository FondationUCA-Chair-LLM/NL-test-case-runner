import { model_eval, test_suite } from "./stagehand.config.js";
import ExcelJS from 'exceljs';

async function createExcelFile(filePath: string = './results.xlsx',titles: string[], values: number[]) {
    const workbook = new ExcelJS.Workbook();
    const model = model_eval.replace(":", " ");
    const sheet = workbook.addWorksheet(model);

    sheet.columns = [
        { header: 'Site_eval', key: 'site_eval', width: 20 },
        { header: 'Readiness', key: 'readiness', width: 20 },
        { header: 'Navigation', key: 'navigation', width: 20 },
        { header: 'Assertion', key: 'assertion', width: 20 },
        { header: 'Standarddev_readi', key: 'standarddev_readi', width: 20 },
        { header: 'Standarddev_nav', key: 'standarddev_nav', width: 20 },
        { header: 'Standarddev_assert', key: 'standarddev_assert', width: 20 },
        { header: 'Site_nl', key: 'site_nl', width: 20 },
        { header: 'Correctness', key: 'correctness', width: 20 },
        { header: 'Real_consis', key: 'real_consis', width: 20 },
        { header: 'Consistency', key: 'consistency', width: 20 },
        { header: 'Err_relative_moy', key: 'err_relative_moy', width: 20 },
        { header: 'Nb_fail', key: 'nb_fail', width: 20 },
        { header: 'Nb_INC', key: 'nb_inc', width: 20 }
    ];

    const row: Record<string, any> = {};
    titles.forEach((t, i) => row[t.toLowerCase()] = values[i]);

    const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");

    row['site_nl'] = site;

    sheet.addRow(row);

    sheet.getRow(2).getCell('site_nl').font = {
        color: { argb: 'FF0000' }
    };

    console.debug("colonnes créées");

    await workbook.xlsx.writeFile(filePath);
    console.log("Fichier créé !");
}


export async function writeInFile(filePath: string = './results.xlsx', titles: string[], values: number[]) {
    const workbook = new ExcelJS.Workbook();


    try {
        await workbook.xlsx.readFile(filePath);
    } catch {
        console.debug("Fichier manquant, création du fichier…");
        await createExcelFile(filePath, titles, values);
        return;
    }

    const model = model_eval.replace(":", " ");
    let sheet = workbook.getWorksheet(model);

    if (!sheet) {
        console.error('Feuille absente, création...');
        sheet = workbook.addWorksheet(model);

        sheet.columns = [
            { header: 'Site_eval', key: 'site_eval', width: 20 },
            { header: 'Readiness', key: 'readiness', width: 20 },
            { header: 'Navigation', key: 'navigation', width: 20 },
            { header: 'Assertion', key: 'assertion', width: 20 },
            { header: 'Standarddev_readi', key: 'standarddev_readi', width: 20 },
            { header: 'Standarddev_nav', key: 'standarddev_nav', width: 20 },
            { header: 'Standarddev_assert', key: 'standarddev_assert', width: 20 },
            { header: 'Site_nl', key: 'site_nl', width: 20 },
            { header: 'Correctness', key: 'correctness', width: 20 },
            { header: 'Real_consis', key: 'real_consis', width: 20 },
            { header: 'Consistency', key: 'consistency', width: 20 },
            { header: 'Err_relative_moy', key: 'err_relative_moy', width: 20 },
            { header: 'Nb_fail', key: 'nb_fail', width: 20 },
            { header: 'Nb_INC', key: 'nb_inc', width: 20 }
        ];

        const row: Record<string, any> = {};
        titles.forEach((t, i) => row[t.toLowerCase()] = values[i]);

        const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");

        row['site_nl'] = site;

        sheet.addRow(row);

        sheet.getRow(2).getCell('site_nl').font = {
            color: { argb: 'FF0000' }
        };

        await workbook.xlsx.writeFile(filePath);
        console.log("Feuille recréée et ligne ajoutée !");
        return;
    }

    const headerRow = sheet.getRow(1);

    const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];

    if (headerValues.length === 0) {
        console.error("Aucune en-tête trouvée dans la feuille; impossible de réinjecter les colonnes.");
        sheet.columns = [];
    } else {
        sheet.columns = headerValues.map((header: any) => ({
            header: String(header),
            key: String(header).toLowerCase(),
            width: 20
        }));
    }


    let lastCorrectnessUsedRow = 1;
    const totalCorrectnessRows = sheet.rowCount || 1;


    let colIndex = getColIndexByKey("correctness");

    if (colIndex === null) {
        console.error(`Colonne manquante : "correctness"`);
        return;
    }


    for (let r = totalCorrectnessRows; r >= 2; r--) {
        const cell = sheet.getRow(r).getCell(colIndex);
        const val = cell ? cell.value : null;
        if (val !== null && val !== undefined) {
            if (r > lastCorrectnessUsedRow) lastCorrectnessUsedRow = r;
            break;
        }
    }


    const totalSiteRows = sheet.rowCount || 1;

    colIndex = getColIndexByKey("site_nl");
    const site = test_suite.replace(/^.*[\\/]/, "").replace(".json", "");

    let passed = false;
    let filled = false;

    if (colIndex === null) return;


    for (let r = totalSiteRows; r >= 2; r--) {
        const cell = sheet.getRow(r).getCell(colIndex);
        const val = cell ? cell.value : null;
        if (val !== null && val !== undefined) {
            if (val !== site) {
                titles.forEach((t) => { sheet.getRow(lastCorrectnessUsedRow + 1).getCell(t.toLowerCase()).value = ""; });
                sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colIndex).value = "";

                sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colIndex).value = site;

                sheet.getRow(lastCorrectnessUsedRow + 2).getCell('site_nl').font = {
                    color: { argb: 'FF0000' }
                };


                titles.forEach((t, i) => {
                    const key = t.toLowerCase();
                    const colIndex = getColIndexByKey(key);
                    if (colIndex !== null) {
                        sheet.getRow(lastCorrectnessUsedRow + 3).getCell(colIndex).value = values[i];
                    }
                });

                const colReal = getColIndexByKey('real_consis');
                const colCons = getColIndexByKey('consistency');
                const colErr = getColIndexByKey('err_relative_moy');
                const colcorrectness = getColIndexByKey('correctness');

                if (colReal !== null && colcorrectness !== null) {
                    const vReal = sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colReal).value;


                    if (typeof vReal === 'number' && vReal !== 0) {
                        sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colcorrectness).value = vReal;
                    }
                }

                if (colReal !== null && colCons !== null && colErr !== null) {
                    const vReal = sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colReal).value;
                    const vCons = sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colCons).value;

                    if (typeof vReal === 'number' && typeof vCons === 'number' && vReal !== 0) {
                        sheet.getRow(lastCorrectnessUsedRow + 2).getCell(colErr).value = (vReal - vCons) / vReal;
                    }
                }

                filled = true;
            }
            passed = true;
            break;
        }
    }
    if (!passed) {
        sheet.getRow(2).getCell(colIndex).value = site;

        sheet.getRow(2).getCell('site_nl').font = {
            color: { argb: 'FF0000' }
        };
    }


    function getColIndexByKey(key: string): number | null {
        const k = key.toLowerCase();
        const cols = sheet.columns;

        for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const colKey = col.key ? String(col.key).toLowerCase() : "";
            if (colKey === k) return i + 1;
        }

        return null;
    }






    if (!filled) {

        if (lastCorrectnessUsedRow < totalCorrectnessRows) {
            titles.forEach((t, i) => {
                const key = t.toLowerCase();
                const colIndex = getColIndexByKey(key);

                if (colIndex !== null) {
                    sheet.getRow(totalCorrectnessRows).getCell(colIndex).value = values[i];
                }
            });

            const colReal = getColIndexByKey('real_consis');
            const colCons = getColIndexByKey('consistency');
            const colErr = getColIndexByKey('err_relative_moy');
            const colcorrectness = getColIndexByKey('correctness');

            if (colReal !== null && colcorrectness !== null) {
                const vReal = sheet.getRow(totalCorrectnessRows).getCell(colReal).value;

                if (typeof vReal === 'number' && vReal !== 0) {
                    sheet.getRow(totalCorrectnessRows).getCell(colcorrectness).value = vReal;
                }
            }

            if (colReal !== null && colCons !== null && colErr !== null) {
                const vReal = sheet.getRow(totalCorrectnessRows).getCell(colReal).value;
                const vCons = sheet.getRow(totalCorrectnessRows).getCell(colCons).value;

                if (typeof vReal === 'number' && typeof vCons === 'number' && vReal !== 0) {
                    sheet.getRow(totalCorrectnessRows).getCell(colErr).value = (vReal - vCons) / vReal;
                }
            }
        }
        else {
            titles.forEach((t, i) => {
                const key = t.toLowerCase();
                const colIndex = getColIndexByKey(key);

                if (colIndex !== null) {
                    sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colIndex).value = values[i];
                }
            });

            const colReal = getColIndexByKey('real_consis');
            const colCons = getColIndexByKey('consistency');
            const colErr = getColIndexByKey('err_relative_moy');
            const colcorrectness = getColIndexByKey('correctness');

            if (colReal !== null && colcorrectness !== null) {
                const vReal = sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colReal).value;

                if (typeof vReal === 'number' && vReal !== 0) {
                    sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colcorrectness).value = vReal;
                }
            }

            if (colReal !== null && colCons !== null && colErr !== null) {
                const vReal = sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colReal).value;
                const vCons = sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colCons).value;

                if (typeof vReal === 'number' && typeof vCons === 'number' && vReal !== 0) {
                    sheet.getRow(lastCorrectnessUsedRow + 1).getCell(colErr).value = (vReal - vCons) / vReal;
                }
            }
        }

    }

    await workbook.xlsx.writeFile(filePath);
    console.log("Valeurs ajoutées !");
}