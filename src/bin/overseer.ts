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
import { TaskQueue, WorkerQueue, ConfirmationQueue, Port } from '/lib/overseer/queues';
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
 
 
// Map of task name => filepath
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

    const limit = (ns.args[0] == 'limit');
    const easy = (ns.args[1] == 'easy');

    const monitorScript = TaskNamePaths.monitor;
    const taskScripts = [TaskNamePaths.grow, TaskNamePaths.hack, TaskNamePaths.weaken];
    const localMachine = ns.getHostname();
    const personalServerHostnameBase = 'hv-headless-';
    const playerObject = ns.getPlayer();

    if (limit) {
        ns.tprint(`Overseer running in limit mode, will only attack as many machines as we have workers.`);
    }

    // Get Queues setup:
    const taskQueue = new TaskQueue(ns, Port.taskPort);
    const workerQueue = new WorkerQueue(ns, Port.workerPort);
    const confirmationQueue = new ConfirmationQueue(ns, Port.confirmationPort);

    // Clear all ports we use:
    clearPorts(ns);

    // Enable to shut logs up:
    silence(ns);

    const allHosts: string[] = getAllHostnames(ns, limit, easy);

    let targets: string[] = [];
    let workers: string[] = ns.getPurchasedServers();
 
    for (const host of allHosts) {
        // TODO: Move this logic into a method (getViableTargets or something)
        // TODO: Get worker hostnames from ns.getPurchasedServers();
        if (host.includes(personalServerHostnameBase)) {
            // Commenting this out as we are trying to use built in method to check for workers
            // workers.push(host);
            continue;
        }

        if (workers.length <= targets.length && limit) {
            ns.tprint(`Hit limit - in limit mode - Worker count: ${workers.length} | Target count: ${targets.length}`);
            break;
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
        if(taskQueue.peek() == 'NULL PORT DATA') {
            // No new tasks, sleep and skip this loop iteration:
            await ns.sleep(10);
            continue;
        }
 
        // Check worker queue to see if we have anything to use for assignment
        if(workerQueue.peek() == 'NULL PORT DATA') {
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

            let successfullyQueued = await workerQueue.tryWrite(data);
            while(!successfullyQueued) {
                successfullyQueued = await workerQueue.tryWrite(data);
                await ns.sleep(10);
            }

            // No workers available, sleep and skip this iteration:
            await ns.sleep(10);
            continue;
        }
 
        // At this point we have a task and a worker to use for it
        // Read queue data for all the variables we need:
        const { task, targetHostname } = taskQueue.read();
        const { status, workerHostname } = workerQueue.read();

        // Get the full script name from task in queue:
        const taskName: TaskNamePaths = TaskNamePaths[task];

        // Need to run task script on worker machine
        const pid = ns.exec(taskName, workerHostname, getMaxThreads(ns, workerHostname, taskName), targetHostname);


        // TODO: Figure out if we still need this assignment queue
        // TODO: Move it to port 4 if so
        // const data = {
        //     target: targetHostname,
        //     worker: workerHostname,
        //     pid,
        //     taskName 
        // };

        // let successfullyWrote = await confirmationQueue.tryWrite(data);
        // if (!successfullyWrote) {
        //     successfullyWrote = await confirmationQueue.tryWrite(data);
        //     await ns.sleep(10);
        // }
 
        // I think we are done??? Log that a task is queued and for what machine:
        log.local(`Assigned worker ${workerHostname} to task ${taskName} on target ${targetHostname}`);
 
        // Finally, sleep to prevent shit from breaking:
        await ns.sleep(10);
     }
 }