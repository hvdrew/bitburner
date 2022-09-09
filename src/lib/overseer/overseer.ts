import { NS } from 'Bitburner';
import { TaskFile } from '/lib/types/TaskFile';
import { Port } from '/lib/types/Port';
import { TaskQueue, WorkerQueue, ConfirmationQueue } from '/lib/overseer/queues';
import { getAllHostnames, getMaxThreads, getRoot } from '/lib/helpers/utils';
import { TermLogger } from '/lib/helpers/logger';

//import { TermLogger } from '/lib/helpers/logger';
// TODO:
/**
 * - Finish building methods that are incomplete
 * - Move flag initialization to an options object
 * - Add flags to trigger different behavior:
 *   - target - force all machines to attack one machine
 *   - forceTask - Monitors only run one script
 *   - Limit - limit targets to number of workers
 *   - Easy - Sort workers by easiest first depending on this flag
 *   - Hard - Sort workers by hardest first
 *   - turbo - Use monitor machines to run tasks if they have enough RAM (Max to number of machines detected - workers)
 * - Method for copying over files depending on the task
 *    - When copying over task files to each machine, send dependencies too (probably the whole /lib/overseer/ folder)
 * - Create method for assigning a task
 * - Find a way to track task status and worker status cleaner - ie. storing the next-up workers and tasks inside class for dispatching
 * in one line of code
 * - Send confirmation event
 * - Figure out if we can do anything with completed queue, or remove it.
 * - Look for more things to do with this?
 */


export class Overseer {
    ns: NS;
    log: TermLogger;
    target: string;
    forceTask: string;
    limit: boolean;
    easy: boolean;
    hard: boolean;
    turbo: boolean;

    taskQueue: TaskQueue;
    workerQueue: WorkerQueue;
    confirmationQueue: ConfirmationQueue;

    localHostname: string;
    delay = 30;

    constructor(ns: NS, options: OverseerParameters) {
        this.ns = ns;
        this.log = options.logger ? options.logger : new TermLogger(this.ns);

        this.target = options.target;
        this.forceTask = options.forceTask;
        this.limit = options.limit;
        this.easy = options.easy;
        this.hard = options.hard;
        this.turbo = options.turbo;

        this.taskQueue = new TaskQueue(this.ns, Port.taskPort);
        this.workerQueue = new WorkerQueue(this.ns, Port.workerPort);
        this.confirmationQueue = new ConfirmationQueue(this.ns, Port.confirmationPort);
        this.localHostname = 'home';

        this.init();
    }

    /**
     * Used to initialize the application
     */
    async init() {
        // Get some stuff out of the way
        silence(this.ns);
        this.clearQueues();

        const { allHosts, workers, targets } = await this.getHosts(); // TODO: Add hard mode implementation

        /**
         * - Use separate method to determine what to do
         * - Use switch to determine what to actually do based on previous findings
         * - Before detemining what task to perform, find the answer to the following:
         *   - Are we using just one task, or operating normally?
         *   - Are we specifying a target? If so we need to only attack them, if not attack normal folks based on monitor reporting
         *   - Are we specifying limit mode? If so, only operate when target.length == worker.length
         *   - Easy - Sorts hosts found by difficulty for hacing
         *   - Hard - Same as easy, just the opposite order. Hardest first...
         *   - Turbo - Calculates remaining ram on monitor and hosts after we are done with initial batch
         *       If we end up not having enough resources, we can just abort...
         *       Any literary work leading up to 9/9, if she's done, check with the bartender if this relationship is appropriate, 
         */

        // TODO: Split these out outside of else if statements to help segment logic for different combos
        // that we accept...
        // Decide what to do:
        
        // Single target or list of targets:
        const targetOrListOfTargets = !!this.target
            ? this.target
            : targets;
        
        // Single task path or false (later on check for falsey, run as normal if false)
        const forcedTask = !!this.forceTask
            ? this.forceTask
            : false;

        if (this.limit) {
            // Run as normal, but only allow one target per worker available
        } else if (this.easy && !this.hard) {
            // Normal behavior, but with hosts sorted by easiest
        } else if (this.hard && !this.easy) {
            // Normal behavior, but with hosts sorted by hardest
        } else if ((this.hard && this.easy) || (!this.hard && !this.easy)) {
            // Normal behavior in regards to easy/hard mode
        } else if (this.turbo) {
            // Normal behavior, but use remaining cores on home and remaining cores on monitors to run extra workers
        }
        
        const setupComplete = await this.killDeployAndRun(allHosts, targets, workers);
        if (!setupComplete) {
            throw new Error(`Setup of init function failed`);
        }

        await this.monitorQueues();
    }


    /**
     * Handles main logic for monitoring each queue
     */
    private async monitorQueues() {
        let startingWorkers = this.ns.getPurchasedServers();

        while(true) {
            // // this.ns.('Hit the beginning of the loop')

            // Is the task queue empty?
            if (this.taskQueue.empty()) {
                // this.ns.('Checking taskqueue for values')
                await this.ns.sleep(this.delay);
                continue;
            }

            // // this.ns.('About to check worker Queue')

            // Is the worker queue empty?
            if (this.workerQueue.empty() || startingWorkers.length >= 1) {
                // let event = this.workerQueue.peek() as WorkerQueueEvent;
                // this.ns.('Trying to push startingHost to the worker Queue... | ' + startingWorkers[0]);

                let workername = startingWorkers.shift();

                // Queue a worker from the starting list if we can:
                const successData = {
                    status: 'idle',
                    workerHostname: workername as string
                }

                // this.ns.('Trying to push events for specifically this hostname: ' + successData.workerHostname);

                // Queue a starting worker if none were found in queue and we still have one available:
                let success = await this.workerQueue.tryWrite(successData);
                if (!success) {
                    success = await this.workerQueue.tryWrite(successData);
                    await this.ns.sleep(this.delay);
                }

                // this.ns.('Logged event for ' + successData.workerHostname);
                // this.ns.('Remaining starting workers: ' + startingWorkers.length);

                await this.ns.sleep(this.delay);
                continue;
            }

            // this.ns.('Made it past the initial phase... We now have a worker and a task')

            // Here is where we have a task and a worker:
            // Get task and worker info:
            const { task, targetHostname } = this.taskQueue.read();
            const { status, workerHostname } = this.workerQueue.read();

            // Get task file path and queue it:
            const taskFile = TaskFile[task];

            if (!workerHostname || !targetHostname || !task) {
                await this.ns.sleep(this.delay);
                continue;
            }

            await this.runTask(taskFile, targetHostname, workerHostname);

            this.log.local(`Assigned task ${task} to ${workerHostname} against ${targetHostname}`);
            // Send confirmation event that it was queued:
            const confirmationData = {
                target: targetHostname,
                worker: workerHostname,
                taskName: taskFile,
            }
            let confirmationSent = await this.confirmationQueue.tryWrite(confirmationData);
            while (!confirmationSent) {
                confirmationSent = await this.confirmationQueue.tryWrite(confirmationData);
                this.log.local(`Posting confirmation... Success: ${confirmationSent}`);
                await this.ns.sleep(this.delay);
            }
            
            await this.ns.sleep(this.delay);
        }
    }


    /**
     * Kills all running processes on allHosts, then deploys necessary files
     * on targets and workers
     * 
     * @param allHosts All hosts involved in this operation
     * @param targets Just the target hosts
     * @param workers Just the worker hosts
     */
    private async killDeployAndRun(allHosts: string[], targets: string[], workers: string[]) {
        const kill = this.killAll(allHosts);
        const deployedMonitors = await this.deployMonitorFiles(targets);
        const deployedTasks = await this.deployWorkerFiles(workers);

        if (!kill || !deployedMonitors || !deployedTasks) {
            throw new Error(`Failed to kill and deploy`);
        }

        return true;
    }


    /**
     * Enumerates all hosts from the local intranet. Returns 
     * allHosts, as well as targets and workers (separated)
     */
     private async getHosts() {
        // Update the call to getAllHostnames to use limit arg
        const allHosts = getAllHostnames(this.ns, this.limit, this.easy);

        await this.ns.sleep(50);

        const { startingHostnames, workers, targets } = await this.filterHosts(allHosts);
        return { allHosts: startingHostnames, workers, targets };
    }

    
    /**
     * Takes a list of hostnames and returns all workers, along with
     * any viable hacking candidates.
     */
    private async filterHosts(hostnames: string[]) {
        const playerStats = this.ns.getPlayer();
        let workers: string[] = this.ns.getPurchasedServers();
        let startingHostnames: string[] = Array.from(hostnames);
        let targets: string[] = [];

        if (workers.length < 1) {
            this.log.info(`Workers didn't work out... first index: ${workers[0]}`)
        }

        for (const host of startingHostnames) {
            if (host.startsWith('hv-headless-')) {
                continue;
            }

            const hostStats = this.ns.getServer(host);

            if (   hostStats.maxRam < 1 
                || hostStats.moneyMax < 1 
                || hostStats.requiredHackingSkill > playerStats.skills.hacking
            ) {
                continue;
            }

            if (hostStats.maxRam == 0) {
                continue;
            }

            if (hostStats.hasAdminRights) {
                targets.push(host);
            } else {
                const hasRoot = await getRoot(this.ns, host);
                if (hasRoot) targets.push(host);
                continue;
            }
        }

        for  (const target of targets) {
            this.log.local(`${target} recorded as a target`)
        }

        return {
            startingHostnames,
            workers,
            targets
        };
    }

    /**
     * Kill all processes on every host provided. Returns true or false depending on 
     * if it was able to kill all processes or not.
     * @param hostnames A list of hostnames to target with this method
     */
    private killAll(hostnames: string[]): boolean {
        // Kill all processes on each hostname provided
        for (const host of hostnames) {
            const processes = this.ns.ps(host);
            
            for (const process of processes) {
                let success = this.ns.killall(host);
                if (!success) return false; 
            }
        }

        return true;
    }


    /**
     * Copies and runs necessary files on the included hostnames
     * @param hostnames Hostnames to deploy and run on
     */
     private async deployMonitorFiles(hostnames: string[]): Promise<boolean> {
        // Get tasks and dependencies
        const filesToTransfer = this.getTasksAndDependencies();
        
        // Deploy monitorTask and dependencies
        if (!filesToTransfer.length) {
            this.log.err('No files found!');
            throw new Error(`deployMonitorFiles: Error - No file to transfer to ${hostnames}`);
        }

        for (const host of hostnames) {
            const success = await this.ns.scp(filesToTransfer, host, this.localHostname);
            if (!success) {
                throw new Error(`deployMonitorFiles: Error - Can't copy to host ${host}`);
            }

            const result = this.ns.exec(TaskFile.monitor, host, 1);
            if (!result) {
                throw new Error('Failed to copy to ' + host);
            }
        }

        return true;
    }


    /**
     * Copies all necessary files to the included hostnames
     * @param hostnames Hostnames to deploy to
     */
    private async deployWorkerFiles(hostnames: string[]): Promise<boolean> {
        // Get tasks and dependencies
        const filesToTransfer = this.getTasksAndDependencies();

        // Deploy task files and dependencies
        if (!filesToTransfer.length) {
            this.log.err('No files found!');
            return false;
        }

        for (const host of hostnames) {
            const success = this.ns.scp(filesToTransfer, host, this.localHostname);
            if (!success) {
                throw new Error('Failed to copy to ' + host);
            }
        }

        return true;
    }


    /**
     * 
     */
    private async runTask(task: TaskFile, targetHostname: string, workerHostname: string): Promise<void> {
        // this.ns.(`Running ${task} on ${workerHostname} against ${targetHostname}`);
        this.log.info('Run Task calcs: ' + targetHostname + ' Host name for next calc: ' + workerHostname);
        const maxThreads = getMaxThreads(this.ns, workerHostname, task);

        this.log.info('Max Threads: ' + maxThreads)

        // this.ns.(`Task ${task} has a max thread count of ${maxThreads} on worker ${workerHostname}`)

        const pid = await this.ns.exec(task, workerHostname, maxThreads, targetHostname);

        // this.ns.('Executed previous task ' + pid)
    }


    /**
     * Fetches all task files and files for any depencies
     */
    private getTasksAndDependencies(): string[] {
        
        // TODO: Consider adding more cases to this switch:
        // TODO: Figure out if there are different dependencies or not
        //       and set this up to distribute accordingly:
        // switch (taskName) {
        //     case Task.monitor:
        //         // Get all files related to monitorTask, along with monitorTask itself
        //         break;
        //     default:
        //         // Get all files related to tasks other than monitor, and the taskName itself
        // }

        // Solution for now:
        const fileNames = this.ns.ls(this.localHostname);
        let filesToDeploy = fileNames.filter(filename => {
            return !!(
                    filename.includes('bin/tasks/') ||
                    filename.includes('lib/overseer/') &&
                    !filename.includes('overseer.js')
                );
        });

        return filesToDeploy;
    }


    /**
     * Clears the queues of each member 
     */
    private clearQueues() {
        this.ns.clearPort(this.taskQueue.portId);
        this.ns.clearPort(this.workerQueue.portId);
    }
}


interface OverseerParameters {
    target: string;
    forceTask: string;
    limit: boolean;
    easy: boolean;
    hard: boolean;
    turbo: boolean;
    logger?: TermLogger;
}


function silence(ns: NS) {
    ns.disableLog('disableLog');
    ns.disableLog('scp');
    ns.disableLog('exec');
    ns.disableLog('scan');
    ns.disableLog('killall');
    ns.disableLog('sleep');
    // ns.disableLog('getServerMaxRam');
    ns.disableLog('getServerUsedRam');
}