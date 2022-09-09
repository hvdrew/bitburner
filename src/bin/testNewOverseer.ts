import { NS } from 'Bitburner';
import { Overseer } from '/lib/overseer/overseer';

export async function main(ns: NS) {
    // Flags we need to pass into the class:
    const args = this.ns.flags([
        ['target', ''], // this will return false with the !! operator
        ['forceTask', ''], // this will return false with the !! operator
        ['limit', false], // Falls back to false, true if present
        ['easy', false], // Falls back to false, true if present
        ['hard', false], // Falls back to false, true if present
        ['turbo', false] // Falls back to false, true if present
    ]);

    // Pass flags into Overseer class and init:
    const overseer = new Overseer(ns, {
        target: args.target,
        forceTask: args.forceTask,
        limit: args.limit,
        easy: args.easy,
        hard: args.hard,
        turbo: args.turbo
    });
    await overseer.init();
}