
var Test = require('../config/testConfig.js');
//var BigNumber = require('bignumber.js');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 25;
  var config;
  let flight = 'ND1309'; // Course number
  let timestamp = Math.floor(Date.now() / 1000);
  let Passenger = accounts[26];

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);

    // Watch contract events
    config.STATUS_CODE_UNKNOWN = 0;
    config.STATUS_CODE_ON_TIME = 10;
    config.STATUS_CODE_LATE_AIRLINE = 20;
    config.STATUS_CODE_LATE_WEATHER = 30;
    config.STATUS_CODE_LATE_TECHNICAL = 40;
    config.STATUS_CODE_LATE_OTHER = 50;
  });

  it('can register oracles', async () => {

    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=1; a<=TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('(Airline) fund airline and register flight', async () => {
    //ARRANGE
    let fee = await config.flightSuretyData.AIRLINE_SEED_FUNDING.call();

    //ACT
    await config.flightSuretyApp.fund({ from: config.firstAirline, value: fee }); // Fund airline
    let txFunded = await config.flightSuretyData.isAirlineFunded(config.firstAirline); // Check if the airline got funded from above tx

    await config.flightSuretyApp.registerFlight(flight, timestamp, { from : config.firstAirline }); // Register flight
    let txRegistered = await config.flightSuretyData.isFlightRegistered(flight, timestamp, config.firstAirline); // Verify is flight got registered

    //ASSERT
    assert.equal(txFunded, true, "Airline isn't funded");
    assert.equal(txRegistered, true, "Flight is not registered");
  });

  it('(Passenger) Passengers may pay up to 1 ether for purchasing flight insurance', async () => {
    // ARRANGE
    let fee = await config.flightSuretyData.FLIGHT_INSURANCE_AMOUNT.call();

    //ACT
    await config.flightSuretyData.authorizeCaller(Passenger, { from: config.owner });
    let balanceBefore = web3.utils.fromWei(await web3.eth.getBalance(Passenger));
    await config.flightSuretyApp.buy(flight, timestamp, config.firstAirline, { from: Passenger, value: fee });
    let balanceAfter = web3.utils.fromWei(await web3.eth.getBalance(Passenger));

    let result = await config.flightSuretyData.isFlightInsured.call(flight, timestamp, config.firstAirline, Passenger);

    //ASSERT
    assert.equal(balanceAfter < balanceBefore, true, "Passenger isn't authorized or passenger was not able to buy insurance for flight");
    assert.equal(result, true , "Passenger was not able to buy insurance for flight");
  });

  it('can request flight status', async () => {
    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=1; a<=TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, config.STATUS_CODE_LATE_AIRLINE, { from: accounts[a] });
        }
        catch(e) {
          // Enable this when debugging
          //  console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
        }

      }
    }
  });

  it('(Passenger Repayment) If flight is delayed due to airline fault, passenger receives credit of 1.5X the amount they paid', async () => {
    //ACT
    let txFee = await config.flightSuretyData.FLIGHT_INSURANCE_AMOUNT.call();
    let fee = web3.utils.fromWei(txFee.toString());
    let txFlightStatus = await config.flightSuretyData.checkFlightStatus.call(flight, timestamp, config.firstAirline);
    let txCredit = await config.flightSuretyApp.checkCredit.call({from: Passenger});
    let credit = web3.utils.fromWei(txCredit.toString());

    // ASSERT
    assert.equal(txFlightStatus.toNumber(), config.STATUS_CODE_LATE_AIRLINE, "Flight status should be changed via oracles");
    assert.equal(credit > fee, true, "Passenger should be credited with amount 1.5X times their paid fee");
  });

  it('(Passenger Withdraw) Passenger can withdraw any funds owed to them as a result of receiving credit for insurance payout', async () => {
    //ARRANGE
    let balanceBefore = web3.utils.fromWei(await web3.eth.getBalance(Passenger));

    //ACT
    await config.flightSuretyApp.pay( {from: Passenger} );
    let balanceAfter = web3.utils.fromWei(await web3.eth.getBalance(Passenger));
    let txCredit = await config.flightSuretyApp.checkCredit.call({from: Passenger});
    let credit = web3.utils.fromWei(txCredit.toString());

    //ASSERT
    assert.equal(balanceAfter > balanceBefore, true, "Passenger couldn't make a withdrawal");
    assert.equal(credit == 0, true, "Credit should be set to zero after passenger has made withdrawal");
  });
 
});
