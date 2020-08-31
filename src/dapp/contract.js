import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.passengers = [];
        this.gas = 6721975; // Gas price
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 5;

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter]);
                this.authorizeCaller(accts[counter]);
                counter++;
            }

            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
           .isOperational()
           .call({ from: self.owner }, callback);
    }

    fetchFlightStatus(flight, airline, timestamp, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flight,
            timestamp: timestamp
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.passengers[0] }, (error, result) => {
                callback(error, payload);
            });
    }

    checkFlightStatus(flight, airline, timestamp, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flight,
            timestamp: timestamp
        }
        self.flightSuretyData.methods
            .checkFlightStatus(payload.flight, payload.timestamp, payload.airline)
            .call((error, result) => {
                callback(error, result);
            });
    }

    authorizeCaller(caller) {
        let self = this;
        let payload = {
            insuree: caller
        }
        self.flightSuretyData.methods
            .authorizeCaller(payload.insuree)
            .send((error, result) => {
            });
    }

    buy(flight, airline, timestamp, callback) {
        let self = this;
        let payload = {
            flight: flight,
            airline: airline,
            timestamp: timestamp
        }
        self.flightSuretyData.methods.FLIGHT_INSURANCE_AMOUNT().call()
            .then(fee => {
                self.flightSuretyApp.methods
                    .buy(payload.flight, payload.timestamp, payload.airline)
                    .send({ from: self.passengers[0], value: fee, gas: self.gas }, (error, result) => {
                        callback(error, payload);
                    });
            });
    }

    pay(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .pay()
            .send({ from: self.passengers[0] }, (error, result) => {
                callback(error, result);
            });
    }

    checkCredit(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .checkCredit()
            .call({ from: self.passengers[0] }, callback);
    }
}