/**
 * This file handles purchasing of new servers. It takes a RAM value, but this is used as the
 * exponent of 2. RAM values on purchased servers are only valid if they are powers of 2.
 * 
 * It also supports mock runs to help determine the cost of the given RAM amount before actually
 * committing to purchasing a server.
 * 
 */

 import { convertNumberToCurrency, convertRam } from '/lib/utils';


// TODO: Should make mock run a bool
interface ParsedArgs {
    desiredRamPower: number;
    mockRun: string;
    upgradeMode: boolean;
}

 /**
  * Pulls args from command line and attempts some basic validation
  * @param {NS} ns You know what this is
  */
 function parseArgs(ns): ParsedArgs | void {
     if (ns.args.length && ns.args.length == 2) {
         let desiredRamPower = ns.args[0];
         let mockRun = ns.args[1];
 
         if (typeof desiredRamPower === 'number' && typeof mockRun === 'string') {
             return {
                 desiredRamPower,
                 mockRun,
                 upgradeMode: false
             }
         } else {
             ns.tprint(`Error: script arguments do not match required types.`);
             ns.tprint(`Usage: run ${ns.getScriptName()} [desired RAM power (number)] [mock (string)]`);
             ns.exit();
         }
     } else if (ns.args.length && ns.args.length == 3) {
         let desiredRamPower = ns.args[0];
         let mockRun = ns.args[1];
         let upgradeMode = ns.args[2];
 
         if (typeof desiredRamPower === 'number' && typeof mockRun === 'string' && typeof upgradeMode === 'boolean') {
             return {
                 desiredRamPower,
                 mockRun,
                 upgradeMode
             }
         } else {
             ns.tprint(`Error: script arguments do not match required types.`);
             ns.tprint(`Usage: run ${ns.getScriptName()} [desired RAM power (number)] [mock (string)] [?upgrade mode (bool)]`);
             ns.exit();
         }
     } else {
         ns.tprint(`Error: script arguments do not match required length.`);
         ns.tprint(`Usage: run ${ns.getScriptName()} [desired RAM power] [mock]`);
         ns.exit();
     }
     ns.exit();
 }
 
 /**
  * Builds next hostname based on number of existing servers
  * @param {NS} ns You know what this is
  * @param {string[]} purchasedServers An Array of purchased servers
  */
 function getNextHostname(ns, purchasedServers) {
     const hostnameBaseString = 'hv-headless-';
 
     if (purchasedServers.length < 1) {
         return hostnameBaseString + '0';
     }
 
     let lastHostnameIndex = 0;
     for (const hostname of purchasedServers) {
         const hostIndex = parseInt(hostname.replace(hostnameBaseString, ''));
         lastHostnameIndex = hostIndex > lastHostnameIndex
             ? hostIndex
             : lastHostnameIndex;
     }
 
     return hostnameBaseString + (lastHostnameIndex + 1);
 }
 
 
 /**
  * Takes inputted mock value from commandline and determines if we should run
  * in mock mode or not
  * @param {string} input A String to match against enum of mock commands
  */
 function getMockValue(input) {
     const mockValues = {
         'buy': false,
         'purchase': false,
         'mock': true,
         'fake': true,
         'test': true
     };
 
     if (typeof mockValues[input] != 'undefined') return mockValues[input];
     
     // Default to mocking if not sure:
     return true;
 }
 
 
 /**
  * Purchases a server with the given RAM value. Supports mocking
  * as a form of price check.
  * @param {NS} ns You know what this is
  */
 export async function main(ns) {
     const purchasedServers = ns.getPurchasedServers();
     const serverLimit = ns.getPurchasedServerLimit();
 
     // We aren't at max purchased servers, continue:
     const { desiredRamPower, mockRun, upgradeMode } = parseArgs(ns) as ParsedArgs;
     const desiredRam = convertRam(desiredRamPower);
     const mockMode = getMockValue(mockRun);
     const newMachineHostname = getNextHostname(ns, purchasedServers);
     const rawMachineCost = ns.getPurchasedServerCost(desiredRam)
     const newMachineCost = convertNumberToCurrency(rawMachineCost);
     let availableMoney = ns.getPlayer().money;
 
     // Temporary code for upgrading:
     if (upgradeMode) {
         for (const server of purchasedServers){
             availableMoney = ns.getPlayer().money;
             ns.tprint("Server: " + server + " cost: " + newMachineCost + " money: " + availableMoney)
 
             // Check if we have enough money:
             if (availableMoney >= rawMachineCost) {
                 ns.deleteServer(server);
                 ns.purchaseServer(server, desiredRam);
                 ns.tprint('purchased');
                 continue;
             }
 
             ns.tprint('Not enough money to upgrade server' + newMachineCost);
             continue;
         }
 
         ns.exit();
     }
 
     if (mockMode) {
         ns.tprint(`Mock mode, no purchase has been made.`);
         ns.tprint(`
         Purchased Server Info:
            New Hostname: ${newMachineHostname}
            RAM Amount: ${desiredRam}
            Total Cost: ${newMachineCost}`);
         
         ns.exit();
     } else {
         if (purchasedServers.length >= serverLimit) {
             ns.tprint(`You can't purchase any more servers!`);
             ns.exit();
         }
 
         ns.tprint(`Purchase mode, attempting to purchase server...`);
         const newHostname = ns.purchaseServer(newMachineHostname, desiredRam);
         ns.tprint(`Purchase successful!
         Purchased Server Info:
            New Hostname: ${newHostname}
            RAM Amount: ${desiredRam}
            Total Cost: ${newMachineCost}`);
     }
 }