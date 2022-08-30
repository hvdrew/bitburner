import { NS } from 'Bitburner';
import { TaskQueue, WorkerQueue, CompletedQueue, Port } from '/lib/overseer/queues';
import { getAllHostnames, getRoot } from '/lib/utils';

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
    taskQueue: TaskQueue;
    workerQueue: WorkerQueue;
    completedQueue: CompletedQueue;

    constructor(ns: NS) {
        this.ns = ns;
        this.taskQueue = new TaskQueue(this.ns, Port.taskPort);
        this.workerQueue = new WorkerQueue(this.ns, Port.workerPort);
        this.completedQueue = new CompletedQueue(this.ns, Port.completedPort);

        this.clearQueues();
    }

    /**
     * Used to initialize the application
     */
    async init() {
        const { allHosts, workers, targets } = await this.getHosts();
        
        // TODO: Set this function up:
        this.killDeployAndRun(allHosts, targets, workers);
        
        // TODO: What do we do after killing, deploying, and running monitor?

        // Start the while loop for main checks
    }


    /**
     * Enumerates all hosts from the local intranet. Returns 
     * allHosts, as well as targets and workers (separated)
     */
    private async getHosts() {
        const allHosts = getAllHostnames(this.ns);
        const { workers, targets } = await this.filterHosts(allHosts);
        return { allHosts, workers, targets };
    }

    
    /**
     * Takes a list of hostnames and returns all workers, along with
     * any viable hacking candidates.
     */
    private async filterHosts(hostnames: string[]) {
        const playerStats = this.ns.getPlayer();
        let workers: string[] = this.ns.getPurchasedServers();
        let startingTargets: string[] = Array.from(hostnames);
        let targets: string[] = [];

        for (const host of startingTargets) {
            if (!host.startsWith('hv-headless-')) {
                targets.push(host);
                continue;
            }

            const hostStats = this.ns.getServer(host);

            if (hostStats.maxRam < 1 
                || hostStats.moneyMax < 1 
                || hostStats.requiredHackingSkill > playerStats.skills.hacking
            ) {
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

        return {
            workers,
            targets
        };
    }

    /**
     * Kills all running processes on allHosts, then deploys necessary files
     * on targets and workers
     * 
     * @param allHosts All hosts involved in this operation
     * @param targets Just the target hosts
     * @param workers Just the worker hosts
     */
    private killDeployAndRun(allHosts: string[], targets: string[], workers: string[]) {
        // kill all host processes
        this.killAll(allHosts);

        // TODO: Implement this shit:
        this.deployMonitorFiles(targets);
        this.deployWorkerFiles(workers);
    }


    /**
     * Kill all processes on every host provided
     * @param hostnames A list of hostnames to target with this method
     */
    private killAll(hostnames: string[]) {
        // Kill all processes on each hostname provided
        for (const host of hostnames) {
            const processes = this.ns.ps(host);
            
            for (const process of processes) {
                this.ns.kill(process.filename, host);
            }
        }
    }


    /**
     * Fetches all task files and files for any depencies
     */
    private getTasksAndDependencies(taskName: Task): string[] {
        
        // TODO: Consider adding more cases to this switch:
        // TODO: Figure out if there are different dependencies or not
        //       and set this up to distribute accordingly:
        switch (taskName) {
            case Task.monitor:
                // Get all files related to monitorTask, along with monitorTask itself
                break;
            default:
                // Get all files related to tasks other than monitor, and the taskName itself
        }
    }

    /**
     * Copies and runs necessary files on the included hostnames
     * @param hostnames Hostnames to deploy and run on
     */
    private deployMonitorFiles(hostnames: string[]) {
        // Get tasks and dependencies
        
        // Deploy monitorTask and dependencies

        // Run monitorTask
    }


    /**
     * Copies all necessary files to the included hostnames
     * @param hostnames Hostnames to deploy to
     */
    private deployWorkerFiles(hostnames: string[]) {
        // Deploy worker tasks and dependencies
    }

    /**
     * Clears the queues of each member 
     */
    private clearQueues() {
        this.ns.clearPort(this.taskQueue.portId);
        this.ns.clearPort(this.workerQueue.portId);
        this.ns.clearPort(this.completedQueue.portId);
    }
}


/**
 * Enum to help translate tasks to their file paths
 */
enum Task {
    grow = '/bin/tasks/growTask.js',
    hack = '/bin/tasks/hackTask.js',
    monitor = '/bin/tasks/monitorTask.js',
    weaken = '/bin/tasks/weakenTask.js',
}
