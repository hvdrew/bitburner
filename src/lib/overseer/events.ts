export interface WorkerQueueEvent {
    status: string;
    workerHostname: string;
}

export interface TaskQueueEvent {
    task: string;
    targetHostname: string;
}

export interface CompletedQueueEvent {
    host: string;
	target: string;
}