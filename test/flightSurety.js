
var Test = require('../config/testConfig.js');
// var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    let secondAirline = accounts[2];
    let secondAirlineName = "American Airlines";
    let thirdAirline = accounts[3];
    let thirdAirlineName = "Frontier Airlines";
    let fourthAirline = accounts[4];
    let fourthAirlineName = "United Airlines";
    let fifthAirline = accounts[5];
    let fifthAirlineName = "Sun Country Airlines";

    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* Operations and Settings                                                              */
    /****************************************************************************************/

    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try
        {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try
        {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try
        {
            await config.flightSuretyData.getTotalAirlines();
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('(airline) First airline is registered when contract is deployed', async () => {
        // ARRANGE
        let airlineRegistered;

        // ACT
        try {
            airlineRegistered = await config.flightSuretyData.isAirlineRegistered(config.firstAirline);
        } catch (e) {
            airlineRegistered = false;
        }

        // ASSERT
        assert.equal(airlineRegistered, true, "First airline should be registered when contract is deployed");

    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {

        // ARRANGE
        let newAirline = accounts[2];
        let newAirlineName = 'Delta Airlines';

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(newAirlineName, newAirline, {from: config.firstAirline});
        }
        catch(e) {
        }
        let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline);

        // ASSERT
        assert.equal(result, false, "Airline should not be able to register another airline if it hasn't provided funding");

    });

    it('(Multiparty Consensus) Only existing airline may register a new airline until there are at least four airlines registered', async () => {
        // ARRANGE
        let fee = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();

        // ACT
        await config.flightSuretyApp.fund({ from: config.firstAirline, value: fee }); // Fund first airline
        let txFundedFirstAirline = await config.flightSuretyData.isAirlineFunded(config.firstAirline); // Check if the airline got funded

        await config.flightSuretyApp.registerAirline(secondAirlineName, secondAirline, {from: config.firstAirline}); // Register second airline
        await config.flightSuretyApp.fund({ from: secondAirline, value: fee }); // Fund second airline

        await config.flightSuretyApp.registerAirline(thirdAirlineName, thirdAirline, {from: secondAirline}); // Register third airline
        await config.flightSuretyApp.fund({ from: thirdAirline, value: fee }); // Fund third airline

        await config.flightSuretyApp.registerAirline(fourthAirlineName, fourthAirline, {from: thirdAirline}); // Register fourth airline
        await config.flightSuretyApp.fund({ from: fourthAirline, value: fee }); // Fund fourth airline

        await config.flightSuretyApp.registerAirline("Test Airline", config.testAddresses[1], {from: fourthAirline}); // Register test airline
        let txRegistered = await config.flightSuretyData.isAirlineRegistered.call(config.testAddresses[1]); // Verify if test airline got registered

        // ASSERT
        assert.equal(txFundedFirstAirline, true, "Airline should be funded to register new airlines");
        assert.equal(txRegistered, false, "Existing airline may register a new airline until there are at least four airlines registered");
    });

    it('(Multiparty Consensus) Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async() => {
        // ACT
        await config.flightSuretyApp.registerAirline(fifthAirlineName, fifthAirline, {from: fourthAirline}); // Register fifth airline
        let txVoteFromFirstAirline = await config.flightSuretyData.isAirlineRegistered.call(fifthAirline); // Verify if the airline got registered

        await config.flightSuretyApp.registerAirline(fifthAirlineName, fifthAirline, {from: secondAirline}); // Register fifth airline
        let txVoteFromSecondAirline = await config.flightSuretyData.isAirlineRegistered.call(fifthAirline); // Verify if the airline got registered

        // ASSERT
        assert.equal(txVoteFromFirstAirline, false, "50% of multi-party consensus is required");
        assert.equal(txVoteFromSecondAirline, true, "Overall 50% multi-party consensus is required");
    });

    it('(Airline Ante) Airline can be registered, but does not participate in contract until it submits funding of 10 ether', async() => {
        // ARRANGE
        let flight = 'ND1309'; // Course number
        let timestamp = Math.floor(Date.now() / 1000);
        let airlineRegistered = true;
        let airlineFunded = true;
        let fee = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();
        let result = false;

        // ACT
        try {
            await config.flightSuretyData.isAirlineRegistered.call(fifthAirline);
        } catch (e) {
            airlineRegistered = false;
        }

        try {
            await config.flightSuretyData.isAirlineFunded(fifthAirline);
            await config.flightSuretyApp.registerFlight(flight, timestamp, { from: fifthAirline});
            result = await config.flightSuretyData.isFlightRegistered(flight, timestamp, fifthAirline);
        } catch (e) {
            airlineFunded = false;
        }

        if(airlineFunded === false) {
            await config.flightSuretyApp.fund({ from: fifthAirline, value: fee }); // Fund airline
            await config.flightSuretyApp.registerFlight(flight, timestamp, { from: fifthAirline});
            result = await config.flightSuretyData.isFlightRegistered(flight, timestamp, fifthAirline);
        }

        // ASSERT
        assert.equal(airlineRegistered, true, "Airline should be registered");
        assert.equal(airlineFunded, false, "Airline should be funded to take part in contract");
        assert.equal(result, true, "Airline should be funded to take part in contract i.e. register flight");
    });
});
