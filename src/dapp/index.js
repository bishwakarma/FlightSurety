
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let flightStatusCodes = {"0":"STATUS_CODE_UNKNOWN","10":"STATUS_CODE_ON_TIME","20":"STATUS_CODE_LATE_AIRLINE","30":"STATUS_CODE_LATE_WEATHER","40":"STATUS_CODE_LATE_TECHNICAL","50":"STATUS_CODE_LATE_OTHER"};

    let contract = new Contract('localhost', () => {

        // Read transaction
        contract.isOperational((error, result) => {
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result } ]);
        });
    

        // User-submitted transaction: Fetch flight status
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('fflight-number').value;
            let airline = DOM.elid('fflight-airline').value;
            let timestamp = DOM.elid('fflight-timestamp').value;
            // Write transaction
            contract.fetchFlightStatus(flight, airline, timestamp, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp } ]);
            });
        });


        // User-submitted transaction: Check flight status
        DOM.elid('submit-status').addEventListener('click', () => {
            let flight = DOM.elid('cflight-number').value;
            let airline = DOM.elid('cflight-airline').value;
            let timestamp = DOM.elid('cflight-timestamp').value;
            // Write transaction
            contract.checkFlightStatus(flight, airline, timestamp, (error, result) => {
                display('Check Flight Status', 'Get flight status code updated by oracles', [ { label: 'Check Flight Status', error: error, value: flightStatusCodes[result] } ]);
            });
        });


        // User-submitted transaction: Purchase Insurance for flight
        DOM.elid('submit-insurance').addEventListener('click', () => {
            let flight = DOM.elid('iflight-number').value;
            let airline = DOM.elid('iflight-airline').value;
            let timestamp = DOM.elid('iflight-timestamp').value;
            // Write transaction
            contract.buy(flight, airline, timestamp, (error, result) => {
                display('Flight Insurance', 'Purchase', [ { label: 'Insurance Purchase Status', error: error, value: `Insurance Purchased for flight ${result.flight}` } ]);
            });
        });


        // User-submitted transaction: Check credit
        DOM.elid('submit-credit').addEventListener('click', () => {
            // Write transaction
            contract.checkCredit((error, result) => {
                display('Credit Added', 'Credit amount added by airline', [ { label: 'Credit Amount Status', error: error, value: `${result/100e16} ETH` } ]);
            });
        });

        // User-submitted transaction: Withdraw credit
        DOM.elid('submit-withdraw').addEventListener('click', () => {
            // Write transaction
            contract.pay((error, result) => {
                display('Withdraw credit', 'Withdraw credit amount added by airline', [ { label: 'Withdrawal Status: ', error: error, value: `txHash: ${result}` } ]);
            });
        });
    
    });

})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







