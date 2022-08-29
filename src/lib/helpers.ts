import {NS} from "Bitburner";

const ReadText = {
    readLines(ns: NS, file: string): string[] {
        return (ns.read(file) as string).split(/\r?\n/);
    },

    readNonEmptyLines(ns: NS, file: string): string[] {
        return ReadText.readLines(ns, file).filter(
            (x) => x.trim() != ""
        );
    },
};

const DownloadFiles = {
    async getfileToHome(ns: NS, source: string, dest: string) { // BEEP
        const logger = new TermLogger(ns);
        logger.info(`Downloading ${source} -> ${dest}`);

        if (!(await ns.wget(source, dest, "home"))) {
            logger.err(`\tFailed retrieving ${source} -> ${dest}`);
        }
    },
};

class TermLogger {
    static INFO_LITERAL = "INFO   >";
    static WARN_LITERAL = "WARN   >";
    static ERR_LITERAL = "ERROR  >";
    static TRACE_LITERAL = "TRACE  >";
    ns: NS;

    constructor(ns: NS) {
        this.ns = ns;
    }

    info(msg: string, ...args: string[]) {
        this.ns.tprintf(`${TermLogger.INFO_LITERAL} ${msg}`, ...args);
    }

    warn(msg: string, ...args: string[]) {
        this.ns.tprintf(`${TermLogger.WARN_LITERAL} ${msg}`, ...args);
    }

    err(msg: string, ...args: string[]) {
        this.ns.tprintf(`${TermLogger.ERR_LITERAL} ${msg}`, ...args);
    }

    log(msg: string, ...args: string[]) {
        this.ns.tprintf(`${TermLogger.TRACE_LITERAL} ${msg}`, ...args);
    }

    // This log only hits the output terminal of the script
    local(msg: string) {
        this.ns.print(`${TermLogger.INFO_LITERAL} ${msg}`);
    }
}

interface RepoSettings {
    baseUrl: string;
    manifestPath: string;
}

const repoSettings: RepoSettings = {
    baseUrl: "http://localhost:9182",
    manifestPath: "/resources/manifest.txt",
};

class RepoInit {
    ns: NS;
    logger: TermLogger;

    constructor(ns: NS, logger: TermLogger = new TermLogger(ns)) {
        this.ns = ns;
        this.logger = logger;
    }

    private static getSourceDestPair(line: string): { source: string; dest: string } | null {
        return line.startsWith("./")
            ? {
                source: `${repoSettings.baseUrl}${line.substring(1)}`,
                dest: line.substring(1),
            }
            : null;
    }

    async pullScripts() {
        const oldFiles = getDirectoryFilesOnHome(this.ns);

        await this.getManifest();

        const newFiles = ReadText.readNonEmptyLines(
            this.ns,
            repoSettings.manifestPath
        ).sort();

        // Filter to find any files we need to get rid of on home:
        const filesToRemove = oldFiles.filter(fileName => {
            return !(newFiles.includes('.' + fileName));
        });

        // Remove unneeded files if there are any
        if (filesToRemove.length) {
            this.logger.info('Removing files from TS Directories that don\'t exist on source');
            removeLocalFiles(this.ns, filesToRemove);
        }

        await this.downloadAllFiles();
    }

    async getManifest() {
        const manifestUrl = `${repoSettings.baseUrl}${repoSettings.manifestPath}`;

        this.logger.info(`Getting manifest...`);

        await DownloadFiles.getfileToHome(
            this.ns,
            manifestUrl,
            repoSettings.manifestPath
        );
    }

    async downloadAllFiles() {
        const files = ReadText.readNonEmptyLines(
            this.ns,
            repoSettings.manifestPath
        );

        this.logger.info(`Contents of manifest:`);
        this.logger.info(`\t${files}`);

        for (let file of files) {
            const pair = RepoInit.getSourceDestPair(file);

            if (!pair) {
                this.logger.err(`Could not read line ${file}`);
            } else {
                await DownloadFiles.getfileToHome(this.ns, pair.source, pair.dest);
            }
        }
    }
}

function getDirectoryFilesOnHome(ns: NS): string[] {
    const currentFiles = ns.ls('home');
    
    let directoryFiles = currentFiles.filter(file => {
        let isInDir = false;
        if (file.startsWith('/bin') || file.startsWith('/lib') || file.startsWith('/resources')) {
            if (file.includes('manifest.txt')) return false;
            isInDir = true;
        }

        return isInDir;
    });

    return directoryFiles;
}

function removeLocalFiles(ns: NS, files: string[]) {
    files.forEach(file => {
        ns.rm(file, 'home');
    });
}

export {ReadText, TermLogger, RepoInit, DownloadFiles};