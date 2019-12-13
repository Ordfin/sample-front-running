// Import web3 for broadcasting transactions
var Web3 = require('web3');
// Import node-fetch to query the trading API
var fetch = require('node-fetch');
// import ethereumjs-tx to sign and serialise transactions
var Tx = require('ethereumjs-tx').Transaction;

// Connect to Infura’s ropsten node
const web3 = new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io"));

// Representation of ETH as an address on Ropsten
const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
// KNC contract address on Rinkeby
// const KNC_TOKEN_ADDRESS = '0x6FA355a7b6bD2D6bD8b927C489221BFBb6f1D7B2';

// KNC contract address on Ropsten
const KNC_TOKEN_ADDRESS = '0x4E470dc7321E84CA96FcAEDD0C8aBCebbAEB68C6';
const ETH_DECIMALS = 18;
const KNC_DECIMALS = 18;
// How many KNC you want to buy
const QTY = 10;
// Gas price of the transaction
const GAS_PRICE = 'medium';
// wallet address for rinkeby
// const USER_ACCOUNT = '0xd0ee49F0B17144CF7D046c4EF442003D89b84e50';
// Your Ethereum wallet address for ropsten
const USER_ACCOUNT = '0x6fBa2847779979FD8c207e26fc0c7dB51fdcb99B';
// private key for rinkeby
// const PRIVATE_KEY = Buffer.from('F06AC31EC8660085CA78727B72B8EE6C39281614315F772CCA2BF18919750D93', 'hex');
// Your private key for ropsten
const PRIVATE_KEY = Buffer.from('3D6CCA46D241A2D2138C427BAB4915B0DFE2296A081ADA59478F8A2A3724ADF3', 'hex');

async function main() {
    /*
    #################################
    ### CHECK IF KNC IS SUPPORTED ###
    #################################
    */

    // Querying the API /currencies endpoint
    let tokenInfoRequest = await fetch(
        "https://ropsten-api.kyber.network/currencies"
    );
    // Parsing the output
    let tokens = await tokenInfoRequest.json();
    console.log(JSON.stringify(tokens));

    // Checking to see if KNC is supported
    let supported = tokens.data.some(token => {
        return "KNC" == token.symbol;
    });
    // If not supported, return.
    if (!supported) {
        console.log("Token is not supported");
        return;
    }

    /*
    ####################################
    ### GET ETH/KNC CONVERSION RATES ###
    ####################################
    */

    // Querying the API /buy_rate endpoint
    let ratesRequest = await fetch(
        "https://ropsten-api.kyber.network/buy_rate?id=" +
        KNC_TOKEN_ADDRESS +
        "&qty=" +
        QTY
    );
    // Parsing the output
    let rates = await ratesRequest.json();
    console.log(JSON.stringify(rates));
    // Getting the source quantity
    let srcQty = rates.data[0].src_qty;

    /*
    #######################
    ### TRADE EXECUTION ###
    #######################
    */

    // Querying the API /trade_data endpoint
    // Note that a factor of 0.97 is used to account for slippage but you can use any value you want.
    let tradeDetailsRequest = await fetch(
        "https://ropsten-api.kyber.network/trade_data?user_address=" +
        USER_ACCOUNT +
        "&src_id=" +
        ETH_TOKEN_ADDRESS +
        "&dst_id=" +
        KNC_TOKEN_ADDRESS +
        "&src_qty=" +
        srcQty / 0.97 +
        "&min_dst_qty=" +
        QTY +
        "&gas_price=" +
        GAS_PRICE
        // "&wallet_id=" +
        // WALLET_ID
    );
    // Parsing the output
    let tradeDetails = await tradeDetailsRequest.json();
    // Extract the raw transaction details
    let rawTx = tradeDetails.data[0];
    console.log(rawTx);
    // Create a new transaction
    let tx = new Tx(rawTx, {'chain': 'ropsten'});
    // Signing the transaction
    tx.sign(PRIVATE_KEY);
    // Serialise the transaction (RLP encoding)
    let serializedTx = tx.serialize();
    // Broadcasting the transaction
    txReceipt = await web3.eth
        .sendSignedTransaction("0x" + serializedTx.toString("hex"))
        .catch(error => console.log(error));
    // Log the transaction receipt
    console.log(txReceipt);
}

main();