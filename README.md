# BitBurner TypeScript Project

This project houses my personal bitburner projects/scripts. It features hot reloading and automatic file transfers between the game and your IDE, thanks to `bitburner-sync`. Most things in this repo are either a work in progress, or soon to be replaced.

# Usage

Starting in dev/hot reload mode:
```bash
npm run dev
```

Building TS:
```bash
npm run build
```

Manual Synchronization:
```bash
npm run sync
```

Cleaning TS Build Files:
```bash
npm run clean
```

## Requirements

Any relatively recent version of node should work just fine for running this project, as it mainly relies on TS anyway. I'm currently using v16.14.0. You will also need NPM (although good luck getting one without the other). This repo does have some setup steps, so please be sure to follow those below if you plan on trying it out.

## Setup

First thing is first, you must install dependencies before any NPM scripts will run:
```bash
npm i
```

Once that's done, the only other required step is configuring your bitburner-sync settings to get communication with the game's server working. There are a number of ways to do this (see [here](https://github.com/Nezrahm/bitburner-sync)), but I recommend following these steps:
1. Create a file in the root of this project called `bitburner-sync.json`
2. Populate the file with the following options:
```json
{
    "authToken": "", // Required for communication with the API server
    "scriptRoot": "./dist", // Helps ensure we are only synching built JS files
    "allowDelete": true // Optional, allows sync to remove files from the game that you have removed
}
```
3. Get your auth token from the game (Menu Bar => API Server => Copy Auth Token) and use it as the value for the `authToken` in the newly created `bitburner-sync.json`
4. Enable your API Server in the game (Menu Bar => API Server => Enable Server)

From there you're all set! There are several other customizations you may wish to make, both to the bitburner-sync config and the TS Config. Please refer to those projects for more information on other configuration options.
