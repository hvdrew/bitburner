import { NS } from 'Bitburner';

/** @param {NS} ns */
export async function main(ns: NS) {
	const targetScript = ns.args[0] as string;
	const targetMachine = ns.args[1] as string;

    const maxRam = ns.getServerMaxRam(targetMachine);
    const requiredRam = ns.getScriptRam(targetScript);

    const maxThreads = maxRam / requiredRam;

    ns.tprint(`${targetMachine} can run ${targetScript} on ${Math.floor(maxThreads)} threads.`);
}