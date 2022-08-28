import { NS } from 'Bitburner';

export type PortData = string | number;

export enum QueueNames {
    Task = 2,
    Worker = 1
}


/** =============================================== */


export interface WorkerQueueEvent {
    status: string;
    workerHostname: string;
}

class WorkerQueue {
    peek(ns: NS): WorkerQueueEvent | string {
        const data = ns.peek(QueueNames.Worker);
        return this.parse(data);
    }

    read(ns: NS): WorkerQueueEvent {
        const data = ns.readPort(QueueNames.Worker);
        return this.parse(data) as WorkerQueueEvent;
    }

    async tryWrite(ns: NS, input: WorkerQueueEvent): Promise<boolean> {
        let data = this.prepare(input);
        return await ns.tryWritePort(QueueNames.Worker, data);
    }

    private parse(input: string): WorkerQueueEvent | string {
        if (input == 'NULL PORT DATA') {
            return input as string;
        }
        
        const data = JSON.parse(input);

        return {
            status: data.status,
            workerHostname: data.workerHostname
        } as WorkerQueueEvent;
    }

    private prepare(input: WorkerQueueEvent): string | number {
        return JSON.stringify(input);
    }
}



export interface TaskQueueEvent {
    task: string;
    targetHostname: string;
}

class TaskQueue {
    peek(ns: NS): TaskQueueEvent | string {
        const data = ns.peek(QueueNames.Task);
        return this.parse(data);
    }

    read(ns: NS): TaskQueueEvent {
        const data = ns.readPort(QueueNames.Task);
        return this.parse(data) as TaskQueueEvent;
    }

    async tryWrite(ns: NS, input: TaskQueueEvent): Promise<boolean> {
        let data = this.prepare(input);
        return await ns.tryWritePort(QueueNames.Task, data);
    }

    private parse(input: string): TaskQueueEvent | string {
        if (input == 'NULL PORT DATA') {
            return input as string;
        }
        
        const data = JSON.parse(input);

        return {
            task: data.task,
            targetHostname: data.targetHostname
        } as TaskQueueEvent;
    }

    private prepare(input: TaskQueueEvent): string | number {
        return JSON.stringify(input);
    }
}

export const taskQueue = new TaskQueue();
export const workerQueue = new WorkerQueue();