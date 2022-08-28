import { NS } from 'Bitburner';

export async function main(ns: NS) {
    const localHostname = ns.getHostname();
    const files = ns.ls(localHostname);

    let filesFromTSSource = files.filter((fileName) => {
        let deleteFile = false;
        if (fileName.startsWith('/bin') || fileName.startsWith('/lib') || fileName.startsWith('/resources')) {
            deleteFile = true;
        }

        return deleteFile;
    });

    let terminalMessage = `
    `;
    filesFromTSSource.forEach(fileName => {
        terminalMessage += `
        ${fileName}`;
    });

    ns.tprint(terminalMessage);
}