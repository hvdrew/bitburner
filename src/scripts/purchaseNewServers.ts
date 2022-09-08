import { NS } from 'Bitburner';

/**
 * TODO:
 *   - Implement rename flag:
 *     - Rename all machines during upgrade using basename if possible, if not, start incrementing from lowest iteration
 *       of basename
 *     - Do nothing if not upgrading
 *   - Fix calc for upgrade cost (show actual along with full price)
 *   - implement recommendation mode - shows you:
 *     - Highest number of computers you can purchase for X ram
 *     - Highest RAM machine you can afford one of
 *     - Highest amount of RAM for the amount of machines you want * 
 */

export async function main(ns: NS) {
    const args = ns.flags([
        ['upgrade', false],
        ['basename', 'hv-headless-'],
        ['quantity', 1],
        ['mock', false],
        ['rename', false],
        ['test', false],
        ['deleteByName', false]
    ]);

    const {
        upgrade,
        basename,
        quantity,
        mock,
        rename,
        test,
        deleteByName
    } = args;

    
    let playerMoney = ns.getPlayer().money;
    const currentServers = ns.getPurchasedServers();
    const maxServerCount = ns.getPurchasedServerLimit();
    const desiredRam = Math.pow(2, args._[0]);
    
    if (test) {
        testFunc(ns, currentServers, basename);
        ns.exit();
    }

    if (deleteByName) {
        const exists = ns.serverExists(args._[0]);
        const success = ns.deleteServer(args._[0]);
        ns.tprint(`Trying to delete ${args._[0]}... Success? ${success}`);
        ns.exit();
    }

    // Calcs
    const baseServerCost = ns.getPurchasedServerCost(desiredRam);
    const totalCost = upgrade ? baseServerCost * currentServers.length : baseServerCost * quantity;
    const canAfford = (playerMoney - totalCost) > 0;

    // Print errors when can't afford or when no more servers can be purchased (when not in upgrade mode)
    //    No more can be purchased when: (currentServers.length + quantity) > maxServerCount
    if ((currentServers.length + quantity) > maxServerCount && !upgrade && !mock) {
        ns.tprint(`Cannot purchase ${quantity} servers, it would exceed max server limit (${maxServerCount}). Try using upgrade flag.`);
        ns.exit();
    }
    
    if (!mock && !upgrade && !canAfford) {
        ns.tprint(`Can't afford to buy ${quantity} new servers, cost: ${ns.nFormat(totalCost, '0.0a')} | current money: ${ns.nFormat(playerMoney, '0.0a')}`);
        ns.exit();
    }

    // Print total cost and RAM + server count if in mock mode
    if (mock && upgrade) {
        ns.tprint(`
        Mock Mode Upgrade results:
        Server Quantity | ${currentServers.length}
        Server RAM | ${desiredRam}
        Total Cost | ${ns.nFormat(totalCost, '0.0a')}`);
        ns.exit();
    } else if (mock) {
        ns.tprint(`
        Mock Mode Purchase results:
        Server Quantity | ${quantity}
        Server RAM | ${desiredRam}
        Total Cost | ${ns.nFormat(totalCost, '0.0a')}`);
        ns.exit();
    }

    // Purchase servers if not in mock and not in upgrade
    //   Find servernames that match basename format and pull the number from the end
    //   Use that number to decide what to name new machines, starting at 0
    if (!mock && !upgrade) {
        // If serverId is 0, set to basename + serverId and increment serverId
        // Otherwise, set to basename + serverId and increment serverId

        const currentServersWithBasename = currentServers.filter(hostname => hostname.includes(basename));

        // TODO: Remove this, it was just for testing:
        let serverId = 0;
        for (const host of currentServersWithBasename) {
            // Double check that we have the right basename here:
            let splitTest = host.split('-');
            if (splitTest.length != basename.split('-').length) continue;

            // Assume in good faith that the last chunk of the hostname is a number
            let currentId = parseInt(splitTest[splitTest.length - 1]);
            
            // TODO: Validate this is working and remove the comments if so:
            // If the current ID is higher than the server ID we are keeping track of, set it to one more than that:
            // Else if the current ID and server ID are the same, set it to one more than server ID
            // Else keep server ID the same as it is
            if (serverId <= currentId) {
                serverId = currentId + 1;
            } else {
                serverId = serverId;
            }
        }

        for (let i = 0; i < quantity; i++) {
            ns.purchaseServer(basename + serverId, desiredRam);
            serverId++;
        }

        ns.tprint(`Purchased ${quantity} servers with ${desiredRam} for ${ns.nFormat(totalCost, '0.0a')}`);
        ns.exit();
    }

    // Upgrade mode:
    if (!mock && upgrade) {
        let upgradeCount = 0;
        for (const server of currentServers) {
            playerMoney = ns.getPlayer().money;
            const cost = ns.getPurchasedServerCost(desiredRam);
            const serverStats = ns.getServer(server);
            if (desiredRam < serverStats.maxRam) continue;

            if (playerMoney < ns.getPurchasedServerCost(desiredRam)) {
                ns.tprint(`Couldn't upgrade server. ${upgradeCount} upgraded. Cost: ${ns.nFormat(cost, '0.0a')} | Money: ${ns.nFormat(totalCost, '0.0a')}`);
                break;
            }

            ns.deleteServer(server);
            let newServer = ns.purchaseServer(server, desiredRam);
            if (newServer.length == 0) continue; // This means the purchase failed:
            
            upgradeCount++;
        }

        if (!upgradeCount) {
            ns.tprint(`For one reason or another, no servers were upgraded.`);
            ns.exit();
        }
        ns.tprint(`Upgraded ${upgradeCount} servers with ${desiredRam} for ${ns.nFormat(upgradeCount * baseServerCost, '0.0a')}`);
    }

    ns.exit();
};


export function testFunc(ns: NS, currentServers, basename) {
    const currentServersWithBasename = currentServers.filter(hostname => hostname.includes(basename));
    ns.tprint(currentServersWithBasename);
    // Server ID | Set this initially, increment it later:
    // let serverId = 0;
    // const currentHosts = currentServers.filter(host => host.includes(basename));
    // if (currentHosts.length) {
    //     // Get current max ID
    //     let id = 0;
    //     for(const host of currentHosts) {
    //         if (host.split('-').length == basename.split('-') && host.includes(basename)) {
    //             // Basename is the same as current host (probably)
    //             // Get ID and check if it's the new highest
    //             let newId = parseInt(host.split('-')[host.split('-').length - 1]);
    //             id = newId > id
    //                 ? newId
    //                 : newId == id
    //                     ? id++
    //                     : newId;
    //         }
    //     }

    //     serverId = id > serverId ? id : serverId;
    // }

    // ns.tprint(serverId);
    // return serverId;
}