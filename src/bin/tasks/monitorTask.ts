import { NS } from 'Bitburner';


/**
 * Silences all of the annoying logs generated during this script
 */
 function silence(ns) {
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

	const localHostname = ns.getHostname();
    const maxMoney = ns.getServerMaxMoney(localHostname);
    const moneyThresh = maxMoney * 0.9;
	const securityThresh = ns.getServerMinSecurityLevel(localHostname) + 5;
    let requiredHackingLevel = ns.getServerRequiredHackingLevel(localHostname);

    if (maxMoney == 0) {
        ns.tprint(`Max money is 0 on ${localHostname}, exiting`);
        ns.exit();
    }

    // Main loop:
    while(true) {
        const currentHackingSkill = ns.getPlayer().skills.hacking;
        const currentSecurityLevel = ns.getServerSecurityLevel(localHostname);
        requiredHackingLevel = ns.getServerRequiredHackingLevel(localHostname);
        let nextTask: string | boolean = false;
		// Figure out what our next task is:
        if (currentSecurityLevel >= securityThresh) {
            nextTask = 'weaken';
        } else if (ns.getServerMoneyAvailable(localHostname) < moneyThresh) {
            nextTask = 'grow';
        } else if (requiredHackingLevel <= currentHackingSkill) {
            nextTask = 'hack';
        }

        if (!nextTask) {
            ns.print('No new task found, some issue exists above, server status: ');
            ns.print(`
            ${localHostname}
            Security: ${currentSecurityLevel} current/${securityThresh} min
            Money: ${ns.getServerMoneyAvailable(localHostname)}/${moneyThresh}
            Hack Level: ${currentHackingSkill}/${requiredHackingLevel}`);

            // No new task type makes sense, sleep then skip this iteration:
            await ns.sleep(10000);
            continue;
        }

        // At this point we have our next task figured out, time to queue it up BABY
        const data = JSON.stringify({
            task: nextTask,
            targetHostname: localHostname            
        });

        // Keep track of success for pushing to queue:
        let successfullyQueuedTask = await ns.tryWritePort(1, data);

        while (!successfullyQueuedTask) {
            // Retry queue push:
            successfullyQueuedTask = await ns.tryWritePort(1, data);
            await ns.sleep(100);
        }

        ns.print(`Queued task ${nextTask}`);

        // Wait to hear from SuccessQueue that this task has been picked up:
        let confirmed = false;
        while(!confirmed) {
            if (ns.peek(4) != 'NULL PORT DATA' && JSON.parse(ns.peek(4)).target == localHostname) {
                // Should probably do something with this data...
                ns.readPort(4);
                confirmed = true;
                continue;
            }

            // Sleep to avoid breaking the game, then continue to find a new task:
            await ns.sleep(100);
        }

        ns.print(`task ${nextTask} is done`);

        // Task was assigned and completed:
        await ns.sleep(100);
    }
	
}