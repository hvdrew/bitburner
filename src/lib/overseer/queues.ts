import { NS } from 'Bitburner';
import { TaskQueueEvent, WorkerQueueEvent, CompletedQueueEvent } from './events';

/**
 * Provides an interface to work with a Queue. Extend this
 * class by passing a QueueEvent type as param. Example:
 * class SomeQueue extends Queue<SomeQueueEvent> {};
 * 
 * When instantiating an inheritor of this class, pass NS as the first arg,
 * and a port as the second.
 */
abstract class Queue<QueueEvent> {
    portId: number;
    constructor(ns: NS, id: Port) {
        this.portId = id;
    }

    peek(ns: NS): QueueEvent | string {
        const data = ns.peek(this.portId);
        return this.parse(data);
    }

    read(ns: NS): QueueEvent {
        const data = ns.readPort(this.portId);
        return this.parse(data) as QueueEvent;
    }

    async tryWrite(ns: NS, input: QueueEvent): Promise<boolean> {
        let data = this.prepare(input);
        return await ns.tryWritePort(this.portId, data);
    }

    private parse(input: string): QueueEvent | string {
        if (input == 'NULL PORT DATA') {
            return input as string;
        }
        
        const data = JSON.parse(input) as QueueEvent;

        return data;
    }

    private prepare(input: QueueEvent): string | number {
        return JSON.stringify(input);
    }
}

// Helps ensure we use the correct port for each queue
export enum Port {
    taskPort = 1,
    workerPort = 2,
    completedPort = 3
};

// Exporting the current Queues that we are using:
export class TaskQueue extends Queue<TaskQueueEvent> {};
export class WorkerQueue extends Queue<WorkerQueueEvent> {};
export class CompletedQueue extends Queue<CompletedQueueEvent> {};
