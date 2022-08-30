export interface WorkerQueueEvent {
    status: string;
    workerHostname: string;
}

export interface TaskQueueEvent {
    task: string;
    targetHostname: string;
}

export interface ConfirmationQueueEvent {
    target: string;
    worker: string;
    taskName: string;
    pid?: number;
}

export interface CompletedQueueEvent {
    host: string;
	target: string;
}
