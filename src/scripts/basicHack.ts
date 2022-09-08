import { NS } from 'Bitburner';


// function getMaxThreads(ns: NS, target: string): number {
//     const scriptRam = ns.getScriptRam(ns.getScriptName(), target);
//     const maxRam = ns.getServerMaxRam(target);
//     // const usedRam = ns.getServerUsedRam(hostname);
//     // const availableRam = maxRam - usedRam;
//     const maxThreads = maxRam / scriptRam;
//     const finalResult = Math.floor(maxThreads);

//     return finalResult;
// }


/**
 * Silences all of the annoying logs generated during this script
 */
 function silence(ns: NS) {
	ns.disableLog('disableLog');
	ns.disableLog('scp');
	ns.disableLog('exec');
	ns.disableLog('scan');
	ns.disableLog('killall');
	ns.disableLog('sleep');
	ns.disableLog('getServerMaxRam');
	ns.disableLog('getServerUsedRam');
}

/** @param {NS} ns */
export async function main(ns: NS) {
    silence(ns);
    
    const target = ns.args[0] as string;
    // const maxThreads = getMaxThreads(ns, target);
    const moneyThresh = ns.getServerMaxMoney(target) * 0.9;
	const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    const requiredHackingLevel = ns.getServerRequiredHackingLevel(target);

    // Main loop:
    while(true) {
        const currentHackingSkill = ns.getPlayer().skills.hacking;
        const currentSecurityLevel = ns.getServerSecurityLevel(target);
        
		// Figure out what our next task is:
        if (currentSecurityLevel >= securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target as string) < moneyThresh) {
            await ns.grow(target);
        } else if (requiredHackingLevel <= currentHackingSkill) {
            await ns.hack(target);
        }
        await ns.sleep(50);
    }
	
}