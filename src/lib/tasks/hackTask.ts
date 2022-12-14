/**
 * Converts a number to a string in currency format
 * @param {number} num A Number to convert to currency format
 */
 export function convertNumberToCurrency(num) {
	const formatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	});

	return formatter.format(num);
}

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
		const moneyEarned = await ns.hack(target);

		ns.toast(`Hacked ${target} for ${convertNumberToCurrency(moneyEarned)}`);

		// Try to send message to CompletedQueue to notify monitor that we are done:
		const completedData = JSON.stringify({
			host,
			target
		});

		let success = ns.tryWritePort(4, completedData);
		while(!success) {
			// If we were successful, set success to true and sleep
			// If not, keep it at false and sleep
			success = ns.tryWritePort(4, completedData);
			await ns.sleep(10);
		}

		const data = {
			status: 'idle',
			workerHostname: host
		};

		// Try to send message to WorkerQueue to notify overseer that we are done:
		const message = JSON.stringify(data);
		let queued = ns.tryWritePort(2, message);

		while(!queued) {
			// If we were successful, set success to true and sleep
			// If not, keep it at false and sleep
			queued = ns.tryWritePort(2, message);
			await ns.sleep(10);
		}


		ns.exit();
	} catch (error) {
		ns.tprint('Error ocurred on host ' + target + error);
	}
}