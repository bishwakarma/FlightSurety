import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

// Flight status codes
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

let oracles = {};
const ORACLES_COUNT = 30;
const STATUS_CODES = [
    STATUS_CODE_UNKNOWN,
    STATUS_CODE_ON_TIME,
    STATUS_CODE_LATE_AIRLINE,
    STATUS_CODE_LATE_WEATHER,
    STATUS_CODE_LATE_TECHNICAL,
    STATUS_CODE_LATE_OTHER
];

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
let gas = 6721975; // Gas price
let flights = {};

let airlines = [];
let airlineNames = ['Genesis Airlines', 'Frontier Airlines', 'United Airlines', 'Sun Country Airlines'];
let flightCodes = ['FL1101', 'FL1000', 'FL1111', 'FL1010']; // List of Flights
let counter = 1;

web3.eth.getAccounts().then((accounts) => {
    flightSuretyData.methods.authorizeCaller(config.appAddress)
    .send({ from: accounts[0] })
    .then(result => {
        console.log(`FlightSuretyApp contract authorized: ${config.appAddress}`);

        // Register Airline, Fund Airline and Register Flight
        while(counter <= 4) {
            airlines.push(accounts[counter]);
            if(counter === 1) {
                fundAirline(accounts[counter]);
                registerFlight(flightCodes[counter - 1], accounts[counter]);
            } else {
                registerAirline(airlineNames[counter - 1], accounts[counter]);
                fundAirline(accounts[counter]);
                registerFlight(flightCodes[counter - 1], accounts[counter]);
            }
            counter++;
        }
    })
    .catch(error => {
        if(error) console.log(error);
        console.log(`Error authorizing app contract`);
    });

    flightSuretyApp.methods.REGISTRATION_FEE().call()
    .then(fee => {
        for (let a = 10; a < ORACLES_COUNT + 10; a++) { // starts index from 10
            flightSuretyApp.methods.registerOracle()
            .send({ from: accounts[a], value: fee, gas: gas })
            .then(result => {
                flightSuretyApp.methods.getMyIndexes().call({ from: accounts[a] })
                .then(indices => {
                    for (let index in indices) {
                        if (oracles[indices[index]] == null){
                            oracles[indices[index]] = [];
                        }
                        oracles[indices[index]].push(accounts[a]);
                    }
                    console.log(`Oracle registered: ${accounts[a]}, indices: ${indices}`);
                })
            })
            .catch(error => {
                console.log(`Error registering oracle: ${accounts[a]}`);
            });
        }
    });
});

function registerAirline(name, airline) {
    let payload = {
        name: name,
        airline: airline
    }
    flightSuretyApp.methods
        .registerAirline(payload.name, payload.airline)
        .send({ from: airlines[0], gas: gas }, (error, result) => {
        });
}

function fundAirline(airline) {
    flightSuretyData.methods.AIRLINE_SEED_FUNDING().call()
        .then(fee => {
            flightSuretyApp.methods
                .fund()
                .send({ from: airline, value: fee, gas: gas }, (error, result) => {
                });
    });
}

function registerFlight(flight, airline) {
    let payload = {
        flight: flight,
        timestamp: Math.floor(Date.now() / 1000)
    }
    flightSuretyApp.methods
        .registerFlight(payload.flight, payload.timestamp)
        .send({ from: airline, gas: gas }, (error, result) => {
        });
}

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) console.log(error)
    console.log(event)

    const index = event.returnValues.index;
    const airline = event.returnValues.airline;
    const flight = event.returnValues.flight;
    const timestamp = event.returnValues.timestamp;

    for (let oracle in oracles[index]) {
        let randomstatusCode = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
        flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, randomstatusCode)
        .send({ from: oracles[index][oracle] , gas: gas })
        .then(result => {
            console.log(`Oracle: ${oracles[index][oracle]}, index: ${index}, statusCode: ${randomstatusCode}, flightCode: ${flight}`);
        })
        .catch(error => {
            console.log(`Error sending oracle response: ${error}`)
        });
    }
});

flightSuretyApp.events.OracleReport({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyApp.events.FlightStatusInfo({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.FlightStatusUpdated({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.InsureeCredited({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.AirlineRegistered({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.AirlineFunded({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.FlightRegistered({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)

    //Collect all registered flights
    const flightCode = event.returnValues.flightCode;
    const airline = event.returnValues.airline;
    const timestamp = event.returnValues.timestamp;
    flights[flightCode] = [airline, timestamp];
});

flightSuretyData.events.InsurancePurchased({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

flightSuretyData.events.InsureePaid({
    fromBlock: 0
}, function (error, event) {
    if (error) console.log(error)
    console.log(event)
});

const app = express();
let cors = require('cors');
app.use(cors());

app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

app.get('/flights', (req, res) => {
    res.send({
        //Respond with registered flights
        flights
    })
})

export default app;


