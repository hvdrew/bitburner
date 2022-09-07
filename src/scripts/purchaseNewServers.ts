import { NS } from 'Bitburner';

export async function main(ns: NS) {
    const args = ns.flags([
        ['upgrade', false],
        ['basename', 'hv-headless-'],
        ['quantity', 1],
        ['mock', false],
        ['rename', false],
    ]);

    const {
        upgrade,
        basename,
        quantity,
        mock,
    } = args;

    let playerMoney = ns.getPlayer().money;
    const currentServers = ns.getPurchasedServers();
    const maxServerCount = ns.getPurchasedServerLimit();
    const desiredRam = Math.pow(2, args._[0]);
    
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
        const currentServersWithBasename = currentServers.filter(hostname => hostname.includes(basename));

        let serverId = 0;
        for (const host of currentServersWithBasename) {
            // Double check that we have the right basename here:
            let splitTest = host.split('-');
            if (splitTest.length != basename.split('-')) continue;

            // Assume in good faith that the last chunk of the hostname is a number
            let currentId = parseInt(splitTest[splitTest.length - 1]);
            serverId = currentId >= serverId
                ? currentId
                : serverId;
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