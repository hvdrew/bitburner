import { NS } from 'Bitburner';
import { Overseer } from '/lib/overseer/overseer';

export async function main(ns: NS) {
    const overseer = new Overseer(ns);
    overseer.init();
}