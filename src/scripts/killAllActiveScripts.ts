import { NS } from "Bitburner";
import { getAllHostnames } from '../lib/helpers';

// TODO: Find a way to kill processes on host, too:
export async function main(ns: NS) {
	const hostnames = getAllHostnames(ns, false, false);

	for(const host of hostnames) {
		ns.killall(host);
	}

	ns.tprint('Killed all processes on all hosts. Trying to kill home processes...');
	ns.killall('home');
}