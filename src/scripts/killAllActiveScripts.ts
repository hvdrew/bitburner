import { NS } from "Bitburner";

// TODO: Find a way to kill processes on host, too:
export async function main(ns: NS) {
	const hostnames = getAllHostnames(ns, false, false);

	for(const host of hostnames) {
		ns.killall(host);
	}

	ns.tprint('Killed all processes on all hosts. Trying to kill home processes...');
	ns.killall('home');
}


function getAllHostnames(ns: NS, limit: boolean, easy: boolean = false): string[] {
    const startingList: string[] = ns.scan(ns.getHostname());
    const foundHosts: string[] = [...startingList];
    const scannedHosts: Set<string> = new Set();

    let scanPossible = true;

    while(scanPossible) {
        // Check length of found hosts, if more than 0 continue
        // if not set scanPossible to false
        if (foundHosts.length < 1) {
            scanPossible = false;
            continue;
        }

        const currentHostname = foundHosts.shift();

        if (!currentHostname) {
            break;
        }

        // Check if scannedHosts contains value, if so `continue`
        if (currentHostname && scannedHosts.has(currentHostname)) continue;

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

    if (!limit) return Array.from(scannedHosts);

    let hostsWithData: HostWithData[] = [];
    scannedHosts.forEach((host) => {
        // Skip if limit is set to false
        if (limit) {
            const money = ns.getServer(host).moneyMax;
            hostsWithData.push({
                hostname: host,
                maxMoney: money
            });
        }
    })

    let sortedHosts: HostWithData[] = [];
    // For Hardest servers first:
    if (!easy) {
        sortedHosts = hostsWithData.sort((a, b) => b.maxMoney - a.maxMoney);
    }
    
    // For easiest hosts first:
    if (easy) {
        sortedHosts = hostsWithData.sort((a, b) => a.maxMoney - b.maxMoney);
    }

    return sortedHosts.map(hostData => hostData.hostname);
}


interface HostWithData {
    hostname: string;
    maxMoney: number;
}