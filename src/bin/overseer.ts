/**
 * Port Guide:
 * - Port 1: Idle Worker Queue (Events are sent here when a worker is done with it's work and considered Idle)
 *     Data:
 *      - status: 'idle'
 * 		- host: hostname that is idle
 * - Port 2: Task Request Queue (Events are sent here when a monitor script identifies a task that it needs performed)
 * 	   Data:
 * 		- task: enum[task] == task name (matched to the taskName enum)
 * - Port 3: Assignment Queue (Events are pushed here when queued tasks are accepted by workers (assigned to them)) - Unused
 *      - host: hostname that was assigned, used to tell monitor scripts that the host is actively having a task performed on it
 *      - task: enum[task] == task name (matched to the taskName enum)
 * - Port 4: Task Completion Queue (Events are sent here when tasks are 100% completed. This is used by monitors so they know when to start checking stats and creating assigments again)
 */

import { NS } from 'Bitburner';
import { getAllHostnames, getRoot, getMaxThreads } from '/lib/utils';
import { taskQueue, workerQueue } from '/lib/queues';
import { TermLogger } from '/lib/helpers';

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

/**
 * Clears all used ports
 */
function clearPorts(ns: NS) {
    ns.clearPort(1);
    ns.clearPort(2);
    ns.clearPort(3);
    ns.clearPort(4);
}
 
 
/**
 * Gets a full file name from given task name
 * TODO: Replace with Enum
 */
function getTaskName(ns: NS, input: string) {
    const taskNames = {
        'grow': 'growTask.js',
        'weaken': 'weakenTask.js',
        'hack': 'hackTask.js'
    };

    return typeof taskNames[input] == 'string'
        ? taskNames[input]
        : taskNames['weaken']; // Run weaken as fallback
}


enum TaskNamePaths {
    grow = '/bin/tasks/growTask.js',
    hack = '/bin/tasks/hackTask.js',
    monitor = '/bin/tasks/monitorTask.js',
    weaken = '/bin/tasks/weakenTask.js',
}

/**
 * Overseer Script:
 * Starts off the whole queue-based event-driven system. Finds all
 * viable hosts for targets, as well as all workers, gets root for workers,
 * copies necessary scripts, then runs monitor scripts on target machines.
 * Monitor scripts queue tasks that are needed next, then overseer assigns these
 * tasks to available workers.
 * 
 * @param {NS} ns
 */
export async function main(ns: NS) {
    // Get a logger:
    const log = new TermLogger(ns);

    const monitorScript = TaskNamePaths.monitor;
    const taskScripts = [TaskNamePaths.grow, TaskNamePaths.hack, TaskNamePaths.weaken];
    const localMachine = ns.getHostname();
    const personalServerHostnameBase = 'hv-headless-';
    const playerObject = ns.getPlayer();
    
    // Clear all ports we use:
    clearPorts(ns);

    // Enable to shut logs up:
    silence(ns);

    const allHosts: string[] = getAllHostnames(ns);

    let targets: string[] = [];
    let workers: string[] = [];
 
    for (const host of allHosts) {
        // TODO: Move this logic into a method (getViableTargets or something)
        // TODO: Get worker hostnames from ns.getPurchasedServers();
        if (host.includes(personalServerHostnameBase)) {
            workers.push(host);
            continue;
        }

        let serverStats = ns.getServer(host);
        
        // Remove hosts with 0GB of RAM:
        if (serverStats.maxRam < 1) continue;

        // Remove hosts with maxMoney of 0:
        if (serverStats.moneyMax < 1) continue;

        // Remove hostnames with a higher hacklevel requirement than I can meet:
        if (serverStats.requiredHackingSkill > playerObject.hacking) continue;
 
        // Check for root, get it if we don't have it yet:
        if (!serverStats.hasAdminRights) {
            const hasRoot = await getRoot(ns, host);
            if (!hasRoot) continue;
        }
 
        // Push to targets:
        targets.push(host);
    }
 
    // At this point, workers contains all personal servers
    // targets contains all targets we can currently go after
    const hostsInvolved = [...targets, ...workers];
    const startingWorkers = [...workers];
 
    for (const host of hostsInvolved) {
        ns.killall(host);
    }
 
    for (const target of targets) {
        await ns.scp(monitorScript, target, localMachine);
        await ns.exec(monitorScript, target, 1, target);
    }

    for (const worker of workers) {
        await ns.scp(taskScripts, worker, localMachine);
    }

    // Main loop:
    while(true) {
        if(taskQueue.peek(ns) == 'NULL PORT DATA') {
            // No new tasks, sleep and skip this loop iteration:
            await ns.sleep(10);
            continue;
        }
 
        // Check worker queue to see if we have anything to use for assignment
        if(workerQueue.peek(ns) == 'NULL PORT DATA') {
            if (!startingWorkers.length) {
                await ns.sleep(10);
                continue;
            }

            // Queue any remaining workers from startingWorkers:
            let nextWorker = startingWorkers.shift();

            if (!nextWorker) continue;

            const data = {
                status: 'idle',
                workerHostname: nextWorker!
            };

            let successfullyQueued = await workerQueue.tryWrite(ns, data);
            while(!successfullyQueued) {
                successfullyQueued = await workerQueue.tryWrite(ns, data);
                await ns.sleep(10);
            }

            // No workers available, sleep and skip this iteration:
            await ns.sleep(10);
            continue;
        }
 
        // At this point we have a task and a worker to use for it
        // Read queue data for all the variables we need:
        // const { task, targetHostname } = JSON.parse(ns.readPort(2));
        const { task, targetHostname } = taskQueue.read(ns);
        const { status, workerHostname } = workerQueue.read(ns);

        // Get the full script name from task in queue:
        const taskName: TaskNamePaths = TaskNamePaths[task];

        // Need to run task script on worker machine
        const pid = ns.exec(taskName, workerHostname, getMaxThreads(ns, workerHostname, taskName), targetHostname);

        const data = JSON.stringify({
            targetHostname,
            workerHostname,
            pid,
            taskName 
        });
         
        // Retry until success:
        let successfullyWrote = ns.tryWritePort(3, data);
        while(!successfullyWrote) {
            successfullyWrote = ns.tryWritePort(3, data);
            await ns.sleep(10);
        }
 
        // I think we are done??? Log that a task is queued and for what machine:
        log.local(`Assigned worker ${workerHostname} to task ${taskName} on target ${targetHostname}`);
 
        // Finally, sleep to prevent shit from breaking:
        await ns.sleep(10);
     }
 }