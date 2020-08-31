# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course.

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle), dApp scaffolding (using HTML, CSS and JS) and server app scaffolding.

To install, download or clone the repo, then:
```
$ npm install

$ truffle compile

```
## Steps to consider:

Launch Ganache with following parameters:
```

Mnemonic: "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat"

Total accounts to generate: 40

Account default balance: 1000 ETH

Port number: 8545
```
##To run tests
- Edit truffle-config.js

        comment line: 7-9
	
        uncomment line: 10-11
- Save the file

``` 
$ truffle compile
$ truffle migrate --reset
$ truffle test ./test/oracles.js
$ truffle test ./test/flightSurety.js
```

## To lunch application
- Edit truffle-config.js

	    uncomment line: 7-9
	    
	    comment line: 10-11
- Save the file
```
$ truffle migrate --reset
```
## Develop Server

`$ npm run server`

Note: The server initialization process registers airlines, funds airlines and registers flights.
## Develop Client

To use the dapp:

`$ npm run dapp`

To view dapp:

`http://localhost:8000`

Note: The client fetches registered flights from the server running at port 3000 and renders flights in the UI as well as allows insurees to purchase flight insurance, check flight status, check insurance credit and withdraw credit.

## Screenshots
[Images Folder](./images)
## Resources

* [How does Ethereum work anyway?](https://medium.com/@preethikasireddy/how-does-ethereum-work-anyway-22d1df506369)
* [BIP39 Mnemonic Generator](https://iancoleman.io/bip39/)
* [Truffle Framework](http://truffleframework.com/)
* [Ganache Local Blockchain](http://truffleframework.com/ganache/)
* [Remix Solidity IDE](https://remix.ethereum.org/)
* [Solidity Language Reference](http://solidity.readthedocs.io/en/v0.4.24/)
* [Ethereum Blockchain Explorer](https://etherscan.io/)
* [Web3Js Reference](https://github.com/ethereum/wiki/wiki/JavaScript-API)