import type { NS } from "Bitburner";


/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
    ns.tprint("This file is not meant to be called directly... Exiting because you're a dumbass.");
    return;
}


 /**
  * Gets max threads for a given script on a given host
  */
export function getMaxThreads(ns: NS, hostname: string, scriptName: string): number {
    const maxRam = ns.getServerMaxRam(hostname);
    const requiredRam = ns.getScriptRam(scriptName);
    // const usedRam = ns.getServerUsedRam(hostname);

    // const availableRam = maxRam - usedRam;
    // const maxThreads = availableRam / requiredRam;
    const maxThreads = maxRam / requiredRam;
    const finalResult = Math.floor(maxThreads);

    return finalResult;
}

/** @param {NS} ns */
export function killAnyRunningScripts(ns: NS, hostname: string): void {
    const currentProcesses = ns.ps(hostname);

    if (currentProcesses.length > 0) {
        ns.killall(hostname);
    }
}

// TODO: Use ns.getServer to figure out:
// - If we have root
// - If we can get root
// - Which exploits to run (based on open ports)
/** @param {NS} ns */
export async function getRoot(ns: NS, hostname: string): Promise<boolean> {
    ns.tprint(hostname)
    if (ns.fileExists("BruteSSH.exe", "home") && !ns.hasRootAccess(hostname)) {
        ns.brutessh(hostname);
    }
    if (ns.fileExists("FTPCrack.exe", "home") && !ns.hasRootAccess(hostname)) {
        ns.ftpcrack(hostname);
    }
    if (ns.fileExists("relaySMTP.exe", "home") && !ns.hasRootAccess(hostname)) {
        ns.relaysmtp(hostname);
    }
    if (ns.fileExists("HTTPWorm.exe", "home") && !ns.hasRootAccess(hostname)) {
        ns.httpworm(hostname);
    }
    if (ns.fileExists("SQLInject.exe", "home") && !ns.hasRootAccess(hostname)) {
        ns.sqlinject(hostname);
    }

    try {
        ns.nuke(hostname);
    } catch(error) {
        ns.print('Error nuking server ' + hostname)
    }
    

    if (ns.hasRootAccess(hostname)) {
        try {
            await ns.installBackdoor();
        } catch (error) {

        }
    }

    return ns.hasRootAccess(hostname);
}


/**
 * Converts a number to a string in currency format
 * @param {number} num A Number to convert to currency format
 */
export function convertNumberToCurrency(num): string {
	const formatter = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	});

	return formatter.format(num);
}


/**
 * Converts the given number into a valid RAM amount by using it as an exponent
 * over 2
 * @param {number} desiredRamPower Number to use as an exponent to calculate valid RAM amounts
 */
export function convertRam(desiredRamPower: number):number {
	return Math.pow(2, desiredRamPower);
}


/** 
 * Recursively finds all hostnames on the network and returns a
 * list of unique entries
 * @param {NS} ns You know what this is
 */
export function getAllHostnames(ns: NS, limit: boolean, easy: boolean = false): string[] {
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