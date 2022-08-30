import { NS } from 'Bitburner';
import { TermLogger } from '../helpers';
import { TaskQueueEvent, WorkerQueueEvent, ConfirmationQueueEvent, CompletedQueueEvent } from './events';

/**
 * Provides an interface to work with a Queue. Extend this
 * class by passing a QueueEvent type as param. Example:
 * class SomeQueue extends Queue<SomeQueueEvent> {};
 * 
 * When instantiating an inheritor of this class, pass NS as the first arg,
 * and a port as the second.
 */
abstract class Queue<QueueEvent> {
    ns: NS;
    portId: number;
    log: TermLogger;
    constructor(ns: NS, id: Port, logger?: TermLogger) {
        this.ns = ns;
        this.portId = id;
        this.log = logger
            ? logger
            : new TermLogger(this.ns);
    }

    peek(): QueueEvent | string {
        const data = this.ns.peek(this.portId);
        return this.parse(data);
    }

    read(): QueueEvent {
        const data = this.ns.readPort(this.portId);
        return this.parse(data) as QueueEvent;
    }


    async tryWrite(input: QueueEvent): Promise<boolean> {
        let data = this.prepare(input);

        if (data === undefined) {
            this.log.err(`Queue.prepare - input data was bad: ${data}`);
            return false;
        }
        return await this.ns.tryWritePort(this.portId, data);
    }


    /**
     * Parses incoming events down to either their QueueEvent or to `'NULL PORT DATA'`
     */
    private parse(input: string): QueueEvent | string {
        if (input == 'NULL PORT DATA') {
            return input as string;
        }
        
        const data = JSON.parse(input) as QueueEvent;

        return data;
    }


    /**
     * Prepares data as a string. Returns `undefined` if an error occurs.
     */
    private prepare(input: QueueEvent): string | undefined {
        try {
            return JSON.stringify(input);
        } catch (error) {
            this.log.err(`Error in Json: ${error}`);
        }
        return undefined;
    }
}

// Helps ensure we use the correct port for each queue
export enum Port {
    taskPort = 1,
    workerPort = 2,
    confirmationPort = 3,
    completedPort = 4
};

// Exporting the current Queues that we are using:
export class TaskQueue extends Queue<TaskQueueEvent> {};
export class WorkerQueue extends Queue<WorkerQueueEvent> {};
export class ConfirmationQueue extends Queue<ConfirmationQueueEvent> {};
export class CompletedQueue extends Queue<CompletedQueueEvent> {};
