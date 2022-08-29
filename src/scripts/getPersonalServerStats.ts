import { NS } from 'Bitburner';

export async function main(ns: NS) {
	const personalServers = ns.getPurchasedServers();
	personalServers.forEach(server => {
		let ram = ns.getServerMaxRam(server);
		ns.tprint(`${server}: ${ram}GB`);
	})
}