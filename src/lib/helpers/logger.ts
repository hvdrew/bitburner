import { NS } from 'Bitburner';

/**
 * Provides a nice, organized termlogger
 */
export class TermLogger {
    static INFO_LITERAL = "INFO >";
    static WARN_LITERAL = "WARN >";
    static ERR_LITERAL = "ERROR >";
    static TRACE_LITERAL = "TRACE >";
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
