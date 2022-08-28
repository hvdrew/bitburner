import { NS } from 'Bitburner';
import { TermLogger } from '/lib/helpers';

export async function main(ns: NS) {
    const log = new TermLogger(ns);
    log.err('This alias has no current implementation.');
}