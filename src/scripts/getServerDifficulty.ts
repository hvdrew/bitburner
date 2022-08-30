/** @param {NS} ns */
export async function main(ns) {
	const allHostNames = getAllHostnames(ns);

    let logMessage = 'Server Difficulties:\n';

	for(const host of allHostNames) {
		const { hackDifficulty, minDifficulty, maxRam, requiredHackingSkill } = ns.getServer(host);

        if(hackDifficulty > (minDifficulty + 5)) {
            logMessage += `${host} (${maxRam}GB of RAM) - ${hackDifficulty} current / ${minDifficulty + 5} minimum | Level ${requiredHackingSkill} required\n`
        }
	}

    ns.tprint(logMessage);
}

/** 
 * Recursively finds all hostnames on the network and returns a
 * list of unique entries
 * @param {NS} ns You know what this is
 */
function getAllHostnames(ns) {
    const startingList = ns.scan(ns.getHostname());
    const foundHosts = [...startingList];
    const scannedHosts = new Set();

    let scanPossible = true;

    while(scanPossible) {
        // Check length of found hosts, if more than 0 continue
        // if not set scanPossible to false
        if (foundHosts.length < 1) {
            scanPossible = false;
            continue;
        }

        // Pop val off foundHosts
        let currentHostname = foundHosts.shift();

        // Check if scannedHosts contains value, if so `continue`
        if (scannedHosts.has(currentHostname)) continue;

        // Scan val and store results
        let scanResults = ns.scan(currentHostname);

        // Add results to the foundHosts list (unless the value of one of the results is "home")
        scanResults.forEach(host => {
            if (host != "home" && !scannedHosts.has(host)) {
                foundHosts.push(host);
            }
        });

        // Add val to the scannedHosts Set
        scannedHosts.add(currentHostname);

        // Set scanPossible to false to end loop
        if (foundHosts.length < 1) {
            scanPossible = false;
        }
    }

    return Array.from(scannedHosts).sort();
}