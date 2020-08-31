pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    struct Airline {
        bool isRegistered;
        string name;
        address airline;
    }

    struct Flight {
        string flightCode;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    uint private totalAirlines = 0;
    uint private insurance_counter = 0;

    mapping(bytes32 => Flight) private flights;
    bytes32[] private flight_ids = new bytes32[](0);
    mapping(address => Airline) private airlines;
    mapping(bytes32 => bool) private insurances; // Mapping FlightInsuranceKey => boolean (insured/not insured)
    mapping(bytes32 => address[]) private insurees; // Mapping FlightKey => insuree address
    mapping(address => uint256) private payouts;
    mapping(address => uint256) private funds;
    mapping(address => uint256) private authorizedCallers;

    uint256 public constant FLIGHT_INSURANCE_AMOUNT = 1 ether;
    uint256 public constant AIRLINE_SEED_FUNDING = 10 ether;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered(string name, address airline);

    event AirlineFunded(address airline, uint256 amount, string name);

    event FlightRegistered(string flightCode, address airline, uint256 timestamp);

    event FlightStatusUpdated(string flightCode, uint256 timestamp, address airline, uint8 statusCode);

    event InsurancePurchased(address insuree, string flightCode, address airline, uint256 amount);

    event InsureeCredited(address insuree, string flight, address airline, uint256 creditAmount);

    event InsureePaid(address insuree, uint256 insuredAmount);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    string name,
                                    address airline

                                ) 
                                public 
    {
        contractOwner = msg.sender;

        // Register First airline
        airlines[airline].name = name;
        airlines[airline].isRegistered = true;
        airlines[airline].airline = airline;

        totalAirlines = totalAirlines.add(1);

        emit AirlineRegistered(name, airline);

    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireIsCallerAuthorized() {
        require(authorizedCallers[msg.sender] == 1, "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    function checkFlightStatus( string flightCode, uint256 timestamp, address airline ) public view returns (uint8) {
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        return flights[key].statusCode;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    function authorizeCaller(address contractAddress) public requireContractOwner {
        authorizedCallers[contractAddress] = 1;
    }

    function deauthorizeCaller(address contractAddress) public requireContractOwner {
        delete authorizedCallers[contractAddress];
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function isAirlineRegistered(address airline) public view returns (bool) {
        return airlines[airline].isRegistered;
    }

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (
                                string name,
                                address airline
                            )
                            requireIsOperational
                            external
    {
        require(isAirlineRegistered(airline) != true, "Airline is already registered.");
        airlines[airline] = Airline({
        name : name,
        isRegistered : true,
        airline : airline
        });
        totalAirlines = totalAirlines.add(1);

        emit AirlineRegistered(name, airline);
    }

    function getTotalAirlines()
    requireIsOperational
    external view returns (uint256) {
        return totalAirlines;
    }

    function isAirlineFunded(address airline) public view returns (bool) {
        require(isAirlineRegistered(airline) == true, "Airline is not registered");
        return funds[airline] >= AIRLINE_SEED_FUNDING;
    }

    function isFlightRegistered(string flightCode, uint256 timestamp, address airline) public view returns (bool) {
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        return flights[key].isRegistered;
    }   

    function registerFlight(string flightCode, uint256 timestamp, address airline)
    external
    requireIsOperational
    {
        require(isAirlineFunded(airline) == true, "Airline associated with flight is not registered or funded");
        require(isFlightRegistered(flightCode, timestamp, airline) != true, "Flight is already registered");

        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        flights[key] = Flight({
        flightCode: flightCode,
        isRegistered: true,
        statusCode: STATUS_CODE_UNKNOWN,
        updatedTimestamp: timestamp,
        airline: airline
        });

        flight_ids.push(key);
        insurees[key] = new address[](0); // Placeholder for passengers

        emit FlightRegistered(flightCode, airline, timestamp);
    }

    function updateFlightStatus(string flightCode, uint256 timestamp, address airline, uint8 statusCode)
    external
    requireIsOperational
    {
        require(isFlightRegistered(flightCode, timestamp, airline) == true, "Flight is not registered");
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        flights[key].statusCode = statusCode;

        emit FlightStatusUpdated(flightCode, timestamp, airline, statusCode);
    }

    function isFlightInsured(string flightCode, uint256 timestamp, address airline, address insuree) public view returns (bool) {
        bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flightCode, timestamp, insuree));
        return insurances[insuranceFlightKey];
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy
                            (
                                string flightCode,
                                uint256 timestamp,
                                address airline,
                                address insuree,
                                uint256 amount
                            )
                            requireIsOperational
                            requireIsCallerAuthorized
                            external
                            payable
    {
        require(amount == FLIGHT_INSURANCE_AMOUNT, "Flight insurance amount of 1 ether is required");
        require(isFlightRegistered(flightCode, timestamp, airline) == true, "Flight is not registered");
        require(isFlightInsured(flightCode, timestamp, airline, insuree) != true, "Insurance already brought for this flight");
        bytes32 key = getFlightKey(airline, flightCode, timestamp);
        bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flightCode, timestamp, insuree));
        insurances[insuranceFlightKey] = true;
        insurees[key].push(insuree);

        emit InsurancePurchased(insuree, flightCode, airline, amount);
    }

    /**
     *  @dev Credit payouts to insurees
    */
    function creditInsurees
                                (
                                    string flight,
                                    uint256 timestamp,
                                    address airline
                                )
                                requireIsOperational
                                external
    {
        bytes32 key = getFlightKey(airline, flight, timestamp);
        require(flights[key].statusCode == STATUS_CODE_LATE_AIRLINE, "Flight must be delayed due to airlines");

        address[] memory insureesToCredit = insurees[key];
        uint256 amountToCredit = FLIGHT_INSURANCE_AMOUNT.mul(3).div(2); // 1.5X times flight insured amount.
        for (uint i = 0; i < insureesToCredit.length; i++) {
            payouts[insureesToCredit[i]] = payouts[insureesToCredit[i]].add(amountToCredit);
            bytes32 insuranceFlightKey = keccak256(abi.encodePacked(airline, flight, timestamp, insureesToCredit[i]));
            delete insurances[insuranceFlightKey]; // remove flight insurance state of the insuree

            emit InsureeCredited(insureesToCredit[i], flight, airline, amountToCredit);
        }
        insurees[key] = new address[](0); // delete all flight passengers.
    }

    /**
     *  @dev Check credit amount of the insuree
     *
    */
    function checkCredit( address insuree )
    requireIsOperational
    external view returns (uint256) {
        return payouts[insuree];
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                address insuree
                            )
                            requireIsOperational
                            requireIsCallerAuthorized
                            external
                            returns (uint256)
    {
        uint256 insuredAmount = payouts[insuree];
        payouts[insuree] = 0;

        emit InsureePaid(insuree, insuredAmount);
        return insuredAmount;
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (
                                address airline,
                                uint256 amount
                            )
                            requireIsOperational
                            public
                            payable
    {
        require(isAirlineRegistered(airline) == true, "Airline must be registered inorder to fund.");
        require(amount >= AIRLINE_SEED_FUNDING, "Funding amount of 10 ether is required");
        funds[airline] = funds[airline].add(amount);

        emit AirlineFunded(airline, amount, airlines[airline].name);
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund(msg.sender, msg.value);
    }


}

