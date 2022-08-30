import { NS } from 'Bitburner';
// import { WorkerQueueEvent } from './events';
import { TermLogger } from '/lib/helpers';
import { TaskQueue, WorkerQueue, ConfirmationQueue, Port } from '/lib/overseer/queues';
import { getAllHostnames, getMaxThreads, getRoot } from '/lib/utils';

// TODO:
/**
 * - Finish building methods that are incomplete
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
    limit: number | undefined;

    taskQueue: TaskQueue;
    workerQueue: WorkerQueue;
    confirmationQueue: ConfirmationQueue;

    localHostname: string;
    delay = 30;

    constructor(ns: NS, limit?: undefined | number, logger?: TermLogger) {
        this.ns = ns;
        this.limit = limit;
        this.log = logger ? logger : new TermLogger(this.ns);

        this.taskQueue = new TaskQueue(this.ns, Port.taskPort);
        this.workerQueue = new WorkerQueue(this.ns, Port.workerPort);
        this.confirmationQueue = new ConfirmationQueue(this.ns, Port.confirmationPort);
        
        this.localHostname = 'home';

        this.clearQueues();
    }

    /**
     * Used to initialize the application
     */
    async init() {
        silence(this.ns);

        // Uncomment when done testing empty method on Queue:
        const { allHosts, workers, targets } = await this.getHosts();
        
        const setupComplete = await this.killDeployAndRun(allHosts, targets, workers);
        if (!setupComplete) {
            throw new Error(`Setup of init function failed`);
        }

        // Remove everything below this after done testing:
        // this.ns.('Successfully finished set up...');
        // this.ns.('Starting to watch...')
        // Remove everything above this after done testing

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
            const taskFile = TaskFilePath[task];

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
        const allHosts = getAllHostnames(this.ns);
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

            const result = this.ns.exec(TaskFilePath.monitor, host, 1);
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
    private async runTask(task: TaskFilePath, targetHostname: string, workerHostname: string): Promise<void> {
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


/**
 * Enum to help translate tasks to their file paths
 */
enum TaskFilePath {
    grow = '/bin/tasks/growTask.js',
    hack = '/bin/tasks/hackTask.js',
    monitor = '/bin/tasks/monitorTask.js',
    weaken = '/bin/tasks/weakenTask.js',
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