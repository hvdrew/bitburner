/**
 * Silences all of the annoying logs generated during this script
 */
 function silence(ns) {
	ns.disableLog('disableLog');
	ns.disableLog('scp');
	ns.disableLog('exec');
	ns.disableLog('scan');
	ns.disableLog('killall');
	ns.disableLog('sleep');
	ns.disableLog('getServerMaxRam');
	ns.disableLog('getServerUsedRam');
}

/** @param {NS} ns */
export async function main(ns) {
	silence(ns);
	
	const target = ns.args[0];
	const host = ns.getHostname();

	try {
		await ns.weaken(target);

		ns.print(`${host} is done with task hack on target ${target}`);

		const data = {
			status: 'idle',
			workerHostname: host
		};

		// Try to send message to WorkerQueue to notify overseer that we are done:
		const message = JSON.stringify(data);
		let success = ns.tryWritePort(1, message);

		while(!success) {
			// If we were successful, set success to true and sleep
			// If not, keep it at false and sleep
			success = ns.tryWritePort(1, message);
			await ns.sleep(10);
		}

		// Try to send message to CompletedQueue to notify monitor that we are done:
		const completedData = JSON.stringify({
			host,
			target,
		});

		success = ns.tryWritePort(3, completedData);

		while(!success) {
			// If we were successful, set success to true and sleep
			// If not, keep it at false and sleep
			success = ns.tryWritePort(3, completedData);
			await ns.sleep(10);
		}

		ns.exit();
	} catch (error) {
		ns.tprint('Error ocurred on host ' + target + error);
	}
}